// GitHub Gist 云同步引擎（GitHub REST API v3，纯异步函数）
// 安全约定：token 永不写入 AppState / 日志 / 导出文件，仅存于独立 localStorage key。
import type { AppState } from '@/types'

const API = 'https://api.github.com'
export const GIST_FILENAME = 'hyrox-training-data.json'
const GIST_DESCRIPTION = 'HYROX 训练计划数据同步(请勿删除)'
const TOKEN_KEY = 'hyrox-bj-plan:sync-token'

// ── Token 存储（独立于 AppState）─────────────────────────────

export function loadSyncToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveSyncToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function clearSyncToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

// ── 错误类型 ─────────────────────────────────────────────

export type SyncErrorKind = 'unauthorized' | 'forbidden' | 'notfound' | 'network' | 'corrupt'

export class SyncError extends Error {
  kind: SyncErrorKind
  constructor(kind: SyncErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export function syncErrorMessage(e: unknown): string {
  if (e instanceof SyncError) {
    switch (e.kind) {
      case 'unauthorized':
        return 'Token 无效或已过期，请重新生成'
      case 'forbidden':
        return '权限不足或 API 额度受限，请确认 Token 勾选了 Gists 读写权限'
      case 'notfound':
        return '云端 Gist 已被删除'
      case 'corrupt':
        return '云端数据格式异常'
      case 'network':
      default:
        return '网络连接失败，请检查网络后重试'
    }
  }
  return '未知错误'
}

// ── HTTP 基础 ────────────────────────────────────────────

async function api<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new SyncError('network', 'network failure')
  }
  if (res.status === 401) throw new SyncError('unauthorized', '401')
  if (res.status === 403) throw new SyncError('forbidden', '403')
  if (res.status === 404) throw new SyncError('notfound', '404')
  if (!res.ok) throw new SyncError('network', `http ${res.status}`)
  return (await res.json()) as T
}

/** 供其他模块（如健康数据拉取）复用的 GET 封装 */
export async function ghGet<T>(token: string, path: string): Promise<T> {
  return api<T>(token, 'GET', path)
}

export const GIST_HEALTH_FILENAME = 'hyrox-health-data.json'

// ── 同步载荷 ─────────────────────────────────────────────

export interface SyncPayload {
  app: 'hyrox-bj-plan'
  version: number
  updatedAt: string
  state: AppState
}

export function buildPayload(state: AppState): SyncPayload {
  return {
    app: 'hyrox-bj-plan',
    version: state.version,
    updatedAt: new Date().toISOString(),
    state,
  }
}

function parsePayload(content: string | undefined): SyncPayload | null {
  if (!content) return null
  try {
    const p = JSON.parse(content) as SyncPayload
    if (p && p.app === 'hyrox-bj-plan' && p.state && typeof p.updatedAt === 'string') return p
    return null
  } catch {
    return null
  }
}

// ── API 操作 ─────────────────────────────────────────────

interface GhUser {
  login: string
}

interface GhGistFile {
  filename?: string
  content?: string
}

interface GhGist {
  id: string
  files: Record<string, GhGistFile>
}

/** 验证 token，返回 GitHub 登录名 */
export async function validateToken(token: string): Promise<string> {
  const user = await api<GhUser>(token, 'GET', '/user')
  return user.login
}

/** 查找包含数据文件的 Gist；不存在则创建（私密）。返回 gist id */
export async function findOrCreateGist(token: string, initialState: AppState): Promise<string> {
  const gists = await api<GhGist[]>(token, 'GET', '/gists?per_page=100')
  const found = gists.find((g) => g.files && g.files[GIST_FILENAME])
  if (found) return found.id
  const payload = buildPayload(initialState)
  const created = await api<GhGist>(token, 'POST', '/gists', {
    description: GIST_DESCRIPTION,
    public: false,
    files: { [GIST_FILENAME]: { content: JSON.stringify(payload, null, 2) } },
  })
  return created.id
}

/** 拉取云端数据；gist 不存在抛 notfound；内容损坏返回 null */
export async function pullState(token: string, gistId: string): Promise<SyncPayload | null> {
  const gist = await api<GhGist>(token, 'GET', `/gists/${gistId}`)
  return parsePayload(gist.files?.[GIST_FILENAME]?.content)
}

/** 推送本地数据到云端，返回实际写入的载荷（含新 updatedAt） */
export async function pushState(token: string, gistId: string, state: AppState): Promise<SyncPayload> {
  const payload = buildPayload(state)
  await api<GhGist>(token, 'PATCH', `/gists/${gistId}`, {
    files: { [GIST_FILENAME]: { content: JSON.stringify(payload, null, 2) } },
  })
  return payload
}

/** 相对时间显示 */
export function relativeTime(iso: string | null): string {
  if (!iso) return '从未'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Date(iso).toLocaleDateString('zh-CN')
}
