// localStorage 持久化（单 key、带版本号；v1 → v2 → v3 链式迁移，保留用户数据）
import {
  DEFAULT_EXCLUDED_FOODS,
  DEFAULT_NUTRITION,
  DEFAULT_PROFILE,
  DEFAULT_SYNC,
  type AppState,
  type NutritionPrefs,
} from '@/types'
import { defaultSplits } from './hyrox'

export const STORAGE_KEY = 'hyrox-bj-plan:v6'
const LEGACY_KEY_V5 = 'hyrox-bj-plan:v5'
const LEGACY_KEY_V4 = 'hyrox-bj-plan:v4'
const LEGACY_KEY_V3 = 'hyrox-bj-plan:v3'
const LEGACY_KEY_V2 = 'hyrox-bj-plan:v2'
const LEGACY_KEY_V1 = 'hyrox-bj-plan:v1'

export function defaultState(): AppState {
  return {
    version: 6,
    profile: { ...DEFAULT_PROFILE },
    splits: defaultSplits(DEFAULT_PROFILE.sex, DEFAULT_PROFILE.division),
    completed: {},
    nutrition: { ...DEFAULT_NUTRITION },
    mealsDone: {},
    excludedFoods: [...DEFAULT_EXCLUDED_FOODS],
    weightLog: [],
    planStartDate: null,
    raceDayChecks: {},
    customItems: {},
    raceStartTime: '09:00',
    hrMaxOverride: null,
    restingHr: null,
    stretchDone: {},
    sync: { ...DEFAULT_SYNC },
  }
}

type AnyState = Partial<AppState> & { version?: number }

/** 将任意旧版本（v1–v6）数据规范化为当前 v6 结构 */
function sanitize(parsed: AnyState): AppState {
  const profile = { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) }
  const nutrition: NutritionPrefs = { ...DEFAULT_NUTRITION, ...(parsed.nutrition ?? {}) }
  return {
    version: 6,
    profile,
    splits:
      Array.isArray(parsed.splits) && parsed.splits.length === 17
        ? (parsed.splits as AppState['splits'])
        : defaultSplits(profile.sex, profile.division),
    completed: parsed.completed ?? {},
    nutrition,
    mealsDone: parsed.mealsDone ?? {},
    // v2 → v3：默认加入牛肉禁忌（用户不吃牛羊肉；库中无羊肉项）
    excludedFoods: Array.isArray(parsed.excludedFoods)
      ? parsed.excludedFoods
      : [...DEFAULT_EXCLUDED_FOODS],
    weightLog: Array.isArray(parsed.weightLog) ? parsed.weightLog : [],
    planStartDate: typeof parsed.planStartDate === 'string' ? parsed.planStartDate : null,
    // v3 → v4：比赛日清单默认全新
    raceDayChecks: parsed.raceDayChecks ?? {},
    customItems: parsed.customItems ?? {},
    raceStartTime: typeof parsed.raceStartTime === 'string' ? parsed.raceStartTime : '09:00',
    // v4 → v5：心率与拉伸数据默认全新
    hrMaxOverride: typeof parsed.hrMaxOverride === 'number' ? parsed.hrMaxOverride : null,
    restingHr: typeof parsed.restingHr === 'number' ? parsed.restingHr : null,
    stretchDone: parsed.stretchDone ?? {},
    // v5 → v6：云同步默认未启用
    sync: parsed.sync ? { ...DEFAULT_SYNC, ...parsed.sync } : { ...DEFAULT_SYNC },
  }
}

export function loadState(): AppState {
  try {
    for (const key of [STORAGE_KEY, LEGACY_KEY_V5, LEGACY_KEY_V4, LEGACY_KEY_V3, LEGACY_KEY_V2, LEGACY_KEY_V1]) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as AnyState
      if (!parsed.profile) continue
      const migrated = sanitize(parsed)
      if (key !== STORAGE_KEY) {
        // 旧版本数据 → 写入新 key 并清除旧 key
        saveState(migrated)
        try {
          localStorage.removeItem(key)
        } catch {
          // ignore
        }
      }
      return migrated
    }
    return defaultState()
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 存储失败（如隐私模式）时静默降级为内存态
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_KEY_V5)
    localStorage.removeItem(LEGACY_KEY_V4)
    localStorage.removeItem(LEGACY_KEY_V3)
    localStorage.removeItem(LEGACY_KEY_V2)
    localStorage.removeItem(LEGACY_KEY_V1)
  } catch {
    // ignore
  }
}

/** 导出：当前状态序列化为 JSON 字符串（剥离云同步元信息，导出文件不含任何云端标识/凭据） */
export function exportState(state: AppState): string {
  const safe: AppState = { ...state, sync: { ...DEFAULT_SYNC } }
  return JSON.stringify(safe, null, 2)
}

/**
 * 导入：解析 JSON 并走 sanitize() 校验/规范化（与版本迁移同一入口）。
 * 解析失败或缺少关键字段时抛出 Error，调用方负责展示错误。
 */
export function importState(json: string): AppState {
  let parsed: AnyState
  try {
    parsed = JSON.parse(json) as AnyState
  } catch {
    throw new Error('文件不是有效的 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.profile || typeof parsed.profile !== 'object') {
    throw new Error('文件缺少必需的个人资料数据，不是有效的备份文件')
  }
  return sanitize(parsed)
}
