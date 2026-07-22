// Apple 健康数据接入（纯函数；数据由 iOS 快捷指令推送到同一私密 Gist 的第二文件）
// 应用只拉取该文件，永不写入。解析对缺失字段完全容忍。
import type { AppState, HealthDay, HealthPayload, HealthWorkout } from '@/types'
import { GIST_HEALTH_FILENAME, ghGet } from './gistSync'
import { weightVerdict } from './body'
import { targetPaceSecPerKm } from './hyrox'
import { generatePlan, sessionKey } from './plan'
import { locateDay } from './tracking'

// ── 容忍式解析 ───────────────────────────────────────────

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

function parseDay(raw: unknown): HealthDay {
  if (!raw || typeof raw !== 'object') return {}
  const d = raw as Record<string, unknown>
  const day: HealthDay = {}
  const steps = num(d.steps)
  const activeKcal = num(d.activeKcal)
  const restingHr = num(d.restingHr)
  const hrv = num(d.hrv)
  const sleepHours = num(d.sleepHours)
  const weightKg = num(d.weightKg)
  if (steps !== undefined) day.steps = steps
  if (activeKcal !== undefined) day.activeKcal = activeKcal
  if (restingHr !== undefined) day.restingHr = restingHr
  if (hrv !== undefined) day.hrv = hrv
  if (sleepHours !== undefined) day.sleepHours = sleepHours
  if (weightKg !== undefined) day.weightKg = weightKg
  if (Array.isArray(d.workouts)) {
    const ws: HealthWorkout[] = []
    for (const w of d.workouts) {
      if (!w || typeof w !== 'object') continue
      const wo = w as Record<string, unknown>
      const type = typeof wo.type === 'string' ? wo.type : '其他'
      const item: HealthWorkout = { type }
      const minutes = num(wo.minutes)
      const avgHr = num(wo.avgHr)
      const kcal = num(wo.kcal)
      if (typeof wo.start === 'string') item.start = wo.start
      if (minutes !== undefined) item.minutes = minutes
      if (avgHr !== undefined) item.avgHr = avgHr
      if (kcal !== undefined) item.kcal = kcal
      ws.push(item)
    }
    if (ws.length) day.workouts = ws
  }
  return day
}

/** 容忍式解析健康载荷；垃圾输入返回 null */
export function parseHealthPayload(json: unknown): HealthPayload | null {
  if (!json || typeof json !== 'object') return null
  const p = json as Record<string, unknown>
  if (p.app !== 'hyrox-bj-plan-health') return null
  if (!p.days || typeof p.days !== 'object') return null
  const days: Record<string, HealthDay> = {}
  for (const [date, raw] of Object.entries(p.days as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    days[date] = parseDay(raw)
  }
  return {
    app: 'hyrox-bj-plan-health',
    updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '',
    days,
  }
}

interface GhGistFiles {
  files?: Record<string, { content?: string }>
}

/** 拉取健康数据文件；文件不存在（快捷指令未设置）→ null，不视为错误 */
export async function pullHealth(token: string, gistId: string): Promise<HealthPayload | null> {
  const gist = await ghGet<GhGistFiles>(token, `/gists/${gistId}`)
  const content = gist.files?.[GIST_HEALTH_FILENAME]?.content
  if (!content) return null
  try {
    return parseHealthPayload(JSON.parse(content))
  } catch {
    return null
  }
}

// ── 序列与基线 ───────────────────────────────────────────

export function sortedDays(payload: HealthPayload): [string, HealthDay][] {
  return Object.entries(payload.days).sort(([a], [b]) => a.localeCompare(b))
}

export function lastNDays(payload: HealthPayload, n: number): [string, HealthDay][] {
  return sortedDays(payload).slice(-n)
}

export function latestDay(payload: HealthPayload): { date: string; day: HealthDay } | null {
  const all = sortedDays(payload)
  if (!all.length) return null
  const [date, day] = all[all.length - 1]
  return { date, day }
}

export interface HealthBaseline {
  restingHr: number | null
  hrv: number | null
  sleep: number | null
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

/** 近 14 天基线（静息心率 / HRV / 睡眠），数据不足的指标为 null */
export function baseline14(payload: HealthPayload): HealthBaseline {
  const days = lastNDays(payload, 14).map(([, d]) => d)
  return {
    restingHr: avg(days.map((d) => d.restingHr).filter((v): v is number => v !== undefined)),
    hrv: avg(days.map((d) => d.hrv).filter((v): v is number => v !== undefined)),
    sleep: avg(days.map((d) => d.sleepHours).filter((v): v is number => v !== undefined)),
  }
}

// ── 恢复状态判定（规则化，可单测）─────────────────────────

export type RecoveryLevel = 'good' | 'mild' | 'reduce'

export interface RecoveryStatus {
  level: RecoveryLevel
  label: string
  advice: string
  details: string[]
}

/**
 * 评分规则（累加）：
 * 静息心率较 14 天基线 +5 bpm 以上 → 2 分；+2~5 → 1 分
 * HRV 低于基线 15% 以上 → 2 分；低于 5%~15% → 1 分
 * 睡眠 <6h → 2 分；6~7h → 1 分
 * 0–1 分 状态良好；2–3 分 轻度疲劳；≥4 分 建议减量
 */
export function recoveryStatus(payload: HealthPayload): RecoveryStatus | null {
  const latest = latestDay(payload)
  if (!latest) return null
  const base = baseline14(payload)
  let score = 0
  const details: string[] = []

  if (latest.day.restingHr !== undefined && base.restingHr !== null) {
    const delta = latest.day.restingHr - base.restingHr
    if (delta > 5) {
      score += 2
      details.push(`静息心率较基线 +${delta.toFixed(0)} bpm`)
    } else if (delta > 2) {
      score += 1
      details.push(`静息心率较基线 +${delta.toFixed(0)} bpm`)
    }
  }
  if (latest.day.hrv !== undefined && base.hrv !== null && base.hrv > 0) {
    const ratio = latest.day.hrv / base.hrv
    if (ratio < 0.85) {
      score += 2
      details.push(`HRV 低于基线 ${Math.round((1 - ratio) * 100)}%`)
    } else if (ratio < 0.95) {
      score += 1
      details.push(`HRV 低于基线 ${Math.round((1 - ratio) * 100)}%`)
    }
  }
  if (latest.day.sleepHours !== undefined) {
    if (latest.day.sleepHours < 6) {
      score += 2
      details.push(`睡眠仅 ${latest.day.sleepHours.toFixed(1)} 小时`)
    } else if (latest.day.sleepHours < 7) {
      score += 1
      details.push(`睡眠 ${latest.day.sleepHours.toFixed(1)} 小时，不足 7 小时`)
    }
  }

  if (score >= 4)
    return {
      level: 'reduce',
      label: '建议减量',
      advice: '恢复指标明显偏离基线：未来 2–3 天训练量减半或改为恢复日内容，优先补睡眠。',
      details,
    }
  if (score >= 2)
    return {
      level: 'mild',
      label: '轻度疲劳',
      advice: '恢复指标轻度偏离：今日训练保持原计划但留意体感，避免额外加练，今晚提前入睡。',
      details,
    }
  return {
    level: 'good',
    label: '状态良好',
    advice: details.length ? '指标基本正常，可按计划训练。' : '恢复指标正常，可按计划执行今日训练。',
    details,
  }
}

// ── 自动动作（幂等）───────────────────────────────────────

const RUN_SESSION_TYPES = new Set(['zone2', 'interval', 'tempo'])
const MATCH_KEY_PREFIX = 'auto@'

function isRunWorkout(type: string): boolean {
  return type.includes('跑') || /run/i.test(type)
}

/**
 * 自动动作（幂等）：
 * 1. 某天有 weightKg 且该日期不在 weightLog 也不在 appliedWeightDates → 追加体重记录。
 * 2. 某天有 workouts：映射到计划中的当天（tracking.locateDay），
 *    若该天有未打卡的训练课，且某条 workout 时长 ≥ 计划时长 60%，且类型匹配
 *    （跑步类 workout ↔ zone2/间歇/节奏课；其他类型 ↔ 力量/混合课）→ 自动打卡该课。
 */
export function applyHealthAutoActions(state: AppState): AppState {
  const payload = state.health.payload
  if (!payload || !state.planStartDate) return state

  const { weightLog, completed, appliedWeightDates, autoLoggedWorkoutKeys } = {
    weightLog: [...state.weightLog],
    completed: { ...state.completed },
    appliedWeightDates: [...state.health.appliedWeightDates],
    autoLoggedWorkoutKeys: [...state.health.autoLoggedWorkoutKeys],
  }
  let changed = false

  // 计划（与 useAppState 派生逻辑一致）
  const verdict = weightVerdict(state.profile)
  const cuttingWeeks = verdict.needCut ? Math.min(verdict.weeksNeeded + 1, state.profile.weeksToRace - 2) : 0
  const plan = generatePlan(state.profile, targetPaceSecPerKm(state.splits), cuttingWeeks)

  const loggedDates = new Set(weightLog.map((e) => e.date))

  for (const [date, day] of Object.entries(payload.days)) {
    // 1) 体重自动记录
    if (day.weightKg !== undefined && !loggedDates.has(date) && !appliedWeightDates.includes(date)) {
      weightLog.push({ date, kg: day.weightKg })
      appliedWeightDates.push(date)
      loggedDates.add(date)
      changed = true
    }

    // 2) 训练自动打卡
    if (!day.workouts?.length) continue
    const loc = locateDay(state.planStartDate, state.profile.weeksToRace, date)
    if (!loc) continue
    const dayKey = sessionKey(loc.week, loc.dayIndex)
    const matchKey = `${MATCH_KEY_PREFIX}${date}`
    if (completed[dayKey] || autoLoggedWorkoutKeys.includes(matchKey)) continue
    const dayPlan = plan[loc.week - 1]?.days[loc.dayIndex]
    if (!dayPlan || dayPlan.isRest) continue
    const planned = dayPlan.session
    const matched = day.workouts.some((w) => {
      const minutes = w.minutes ?? 0
      if (minutes < planned.durationMin * 0.6) return false
      return isRunWorkout(w.type) ? RUN_SESSION_TYPES.has(planned.type) : !RUN_SESSION_TYPES.has(planned.type)
    })
    if (matched) {
      completed[dayKey] = true
      autoLoggedWorkoutKeys.push(matchKey)
      changed = true
    }
  }

  if (!changed) return state
  return {
    ...state,
    weightLog,
    completed,
    health: { ...state.health, appliedWeightDates, autoLoggedWorkoutKeys },
  }
}

/** 判断某天的训练是否由健康数据自动打卡（供 UI 标注） */
export function isAutoLogged(state: AppState, date: string): boolean {
  return state.health.autoLoggedWorkoutKeys.includes(`${MATCH_KEY_PREFIX}${date}`)
}
