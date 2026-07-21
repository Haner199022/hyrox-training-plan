// 体重与执行追踪（纯函数）
import type { CompletionMap, Profile, WeightEntry } from '@/types'
import { weightTrajectory, type WeightVerdict } from './body'
import { sessionKey, type WeekPlan } from './plan'
import { mealKey } from './nutrition'

const DAY_MS = 24 * 3600 * 1000

export function todayISO(): string {
  return toISO(new Date())
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(parseISO(iso).getTime() + days * DAY_MS))
}

/** b - a 的天数差 */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY_MS)
}

export function raceDateOf(startISO: string, weeks: number): string {
  return addDays(startISO, weeks * 7)
}

export function fmtCN(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`
}

export function sortWeightLog(log: WeightEntry[]): WeightEntry[] {
  return [...log].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * 目标轨迹在指定日期的体重（kg）：
 * 复用身体引擎的周级轨迹，在相邻两周之间线性插值。
 * 无减重需求时轨迹为当前体重水平线。
 */
export function targetWeightAtDate(
  p: Profile,
  v: WeightVerdict,
  startISO: string,
  dateISO: string,
): number {
  const pts = weightTrajectory(p, v)
  const weekF = diffDays(startISO, dateISO) / 7
  const w = Math.max(0, Math.min(p.weeksToRace, weekF))
  const lo = Math.floor(w)
  const hi = Math.min(p.weeksToRace, lo + 1)
  const frac = w - lo
  return pts[lo].target + (pts[hi].target - pts[lo].target) * frac
}

export type DeviationStatus = 'ok' | 'slow' | 'fast'

export interface DeviationResult {
  status: DeviationStatus
  label: string
  /** 实际 − 轨迹目标（kg），正 = 高于轨迹 */
  diffKg: number
  detail: string
}

export function weightDeviation(diffKg: number): DeviationResult {
  if (Math.abs(diffKg) <= 0.5)
    return { status: 'ok', label: '进度正常', diffKg, detail: '实际体重与目标轨迹偏差在 ±0.5 kg 以内，保持当前节奏。' }
  if (diffKg > 0.5)
    return {
      status: 'slow',
      label: '减重偏慢',
      diffKg,
      detail: '实际体重高于轨迹目标。复核饮食记录是否完整，可考虑将每日热量缺口上调 50–100 kcal。',
    }
  return {
    status: 'fast',
    label: '下降过快',
    diffKg,
    detail: '体重下降快于轨迹，存在肌肉流失风险。建议缩小热量缺口并确保蛋白质达标。',
  }
}

/** 近 7 日体重变化速率（kg/周）：取最近一条与 7 天前最近一条记录；数据不足返回 null */
export function weeklyRateKg(log: WeightEntry[]): number | null {
  const sorted = sortWeightLog(log)
  if (sorted.length < 2) return null
  const latest = sorted[sorted.length - 1]
  const cutoff = addDays(latest.date, -7)
  // 取 ≤ cutoff 的最后一条；没有则取最早一条
  let base: WeightEntry | null = null
  for (const e of sorted) {
    if (e.date <= cutoff) base = e
    else break
  }
  if (!base) base = sorted[0]
  const days = Math.max(1, diffDays(base.date, latest.date))
  if (days < 3) return null
  return ((latest.kg - base.kg) / days) * 7
}

/** 安全减重速率范围（kg/周，按当前体重 0.5%–0.75%） */
export function safeRateRange(weightKg: number): [number, number] {
  return [weightKg * 0.005, weightKg * 0.0075]
}

// ── 执行热力图 ─────────────────────────────────────────────

export type DayState = 'full' | 'partial' | 'none' | 'future' | 'outofplan'

export interface DayCell {
  date: string
  state: DayState
  week: number
  dayIndex: number
}

/** 某一天对应的计划位置；不在计划范围内返回 null */
export function locateDay(
  startISO: string,
  totalWeeks: number,
  dateISO: string,
): { week: number; dayIndex: number } | null {
  const d = diffDays(startISO, dateISO)
  if (d < 0 || d >= totalWeeks * 7) return null
  return { week: Math.floor(d / 7) + 1, dayIndex: d % 7 }
}

export function dayState(
  loc: { week: number; dayIndex: number },
  weekPlan: WeekPlan | undefined,
  completed: CompletionMap,
  mealsDone: CompletionMap,
  isFuture: boolean,
): DayState {
  if (isFuture) return 'future'
  if (!weekPlan) return 'outofplan'
  const day = weekPlan.days[loc.dayIndex]
  const trainOk = day.isRest || !!completed[sessionKey(loc.week, loc.dayIndex)]
  const mealOk = !!mealsDone[mealKey(loc.week, loc.dayIndex)]
  if (trainOk && mealOk) return 'full'
  if (trainOk || mealOk) return 'partial'
  return 'none'
}

/** 连续全完成天数（从今天/昨天向前数） */
export function currentStreak(
  startISO: string,
  plan: WeekPlan[],
  completed: CompletionMap,
  mealsDone: CompletionMap,
  today: string,
): number {
  let streak = 0
  // 今天未完成时从昨天开始数，避免“今天还没结束”打断连击
  let cursor = today
  const firstLoc = locateDay(startISO, plan.length, cursor)
  if (firstLoc) {
    const s = dayState(firstLoc, plan[firstLoc.week - 1], completed, mealsDone, false)
    if (s !== 'full') cursor = addDays(today, -1)
  }
  for (let i = 0; i < plan.length * 7; i++) {
    const loc = locateDay(startISO, plan.length, cursor)
    if (!loc) break
    const s = dayState(loc, plan[loc.week - 1], completed, mealsDone, false)
    if (s === 'full') {
      streak++
      cursor = addDays(cursor, -1)
    } else {
      break
    }
  }
  return streak
}

// ── 周总结 ────────────────────────────────────────────────

export interface WeekSummary {
  week: number
  trainDone: number
  trainTotal: number
  mealDone: number
  mealTotal: number
  /** 本周体重变化（kg），数据不足为 null */
  weightChange: number | null
  suggestion: string
}

export function weekSummary(
  week: WeekPlan,
  completed: CompletionMap,
  mealsDone: CompletionMap,
  log: WeightEntry[],
  weekStartISO: string,
  needCut: boolean,
): WeekSummary {
  let trainDone = 0
  let trainTotal = 0
  let mealDone = 0
  week.days.forEach((d, di) => {
    if (!d.isRest) {
      trainTotal++
      if (completed[sessionKey(week.week, di)]) trainDone++
    }
    if (mealsDone[mealKey(week.week, di)]) mealDone++
  })

  const weekEndISO = addDays(weekStartISO, 6)
  const inWeek = sortWeightLog(log).filter((e) => e.date >= weekStartISO && e.date <= weekEndISO)
  const weightChange =
    inWeek.length >= 2 ? Math.round((inWeek[inWeek.length - 1].kg - inWeek[0].kg) * 10) / 10 : null

  const trainRate = trainTotal ? trainDone / trainTotal : 1
  let suggestion: string
  const rate = weeklyRateKg(log)
  if (trainRate < 0.6) {
    suggestion = '本周训练完成率偏低：建议把「每周可训练天数」下调到能稳定完成的水平，完成质量优于数量。'
  } else if (needCut && rate !== null && Math.abs(rate) < 0.1 && sortWeightLog(log).length >= 4) {
    suggestion = '体重近阶段几乎停滞：建议复核热量记录是否低估，或将每日热量缺口上调 100 kcal。'
  } else if (needCut && rate !== null && rate < -safeRateRange(log[log.length - 1]?.kg ?? 70)[1]) {
    suggestion = '体重下降快于安全速率：建议将热量缺口缩小 100–150 kcal，优先保住肌肉与训练质量。'
  } else {
    suggestion = '本周执行良好，保持节奏；注意睡眠 7–9 小时与充分补液。'
  }

  return {
    week: week.week,
    trainDone,
    trainTotal,
    mealDone,
    mealTotal: week.days.length,
    weightChange,
    suggestion,
  }
}
