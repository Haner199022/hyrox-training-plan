// Apple 健康导出文件（export.xml）解析与合并（纯函数，可在浏览器/Node 运行）
//
// 解析策略：对 XML 文本做分块「流式」正则提取，而不是 DOMParser 全量构建 DOM——
// iPhone 健康导出常见 100MB–1GB+，DOM 会溢出内存。Record/Workout 元素按块扫描，
// 不完整的元素尾部保留到下一个块继续。容忍属性缺失与顺序变化。
import type { HealthDay, HealthPayload, HealthWorkout } from '@/types'

const LB_TO_KG = 0.453592
const KJ_TO_KCAL = 0.239006

// ── HealthKit 日期工具 ─────────────────────────────────────

/** "2026-07-22 08:30:00 +0800" → 日键 "2026-07-22"（直接取日期段，避免时区换算） */
function dayKeyOf(hkDate: string): string {
  return hkDate.slice(0, 10)
}

/** HealthKit 日期字符串 → epoch ms（用于同日最新样本比较与睡眠时长） */
function hkTime(hkDate: string): number {
  // "2026-07-22 08:30:00 +0800" → "2026-07-22T08:30:00+08:00"
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/.exec(hkDate.trim())
  if (!m) return 0
  return Date.parse(`${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`)
}

function parseAttrs(el: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([\w:]+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(el))) out[m[1]] = m[2]
  return out
}

// ── 聚合中间态 ────────────────────────────────────────────

interface Acc {
  steps: number
  activeKcal: number
  rhrSum: number
  rhrN: number
  hrvSum: number
  hrvN: number
  sleepSec: number
  weightKg?: number
  weightAt: number
  workouts: HealthWorkout[]
}

function newAcc(): Acc {
  return { steps: 0, activeKcal: 0, rhrSum: 0, rhrN: 0, hrvSum: 0, hrvN: 0, sleepSec: 0, weightAt: 0, workouts: [] }
}

// ── 训练类型映射 ──────────────────────────────────────────

const WORKOUT_TYPE_MAP: [RegExp, string][] = [
  [/Running/i, '跑步'],
  [/TraditionalStrengthTraining|FunctionalStrengthTraining/i, '力量训练'],
  [/Cycling/i, '骑行'],
  [/Rowing/i, '划船'],
  [/Swimming/i, '游泳'],
  [/Walking/i, '步行'],
  [/HIIT|HighIntensityIntervalTraining|CrossTraining|MixedCardio/i, '混合训练'],
  [/Yoga/i, '瑜伽'],
]

function mapWorkoutType(hkType: string): string {
  for (const [re, label] of WORKOUT_TYPE_MAP) if (re.test(hkType)) return label
  return '其他'
}

// ── 主聚合函数 ────────────────────────────────────────────

export interface AggregateOptions {
  /** 只保留 dayKey >= minDate 的样本；null = 全部 */
  minDate: string | null
  /** 进度回调（0–1），约每 4MB 触发一次 */
  onProgress?: (fraction: number) => void
  /** 每处理约 32MB 让出一次事件循环（浏览器保持响应） */
  yieldEveryBytes?: number
}

export interface ImportSummary {
  dayCount: number
  weightCount: number
  workoutCount: number
  dateRange: [string, string] | null
}

const CHUNK = 4 * 1024 * 1024

/**
 * 从 export.xml 文本聚合出按日的 HealthDay 映射。
 * 分块扫描 <Record .../> 与 <Workout ...>...</Workout> 元素。
 */
export async function aggregateXml(
  xml: string,
  opts: AggregateOptions,
): Promise<{ days: Record<string, HealthDay>; summary: ImportSummary }> {
  const acc = new Map<string, Acc>()
  const yieldEvery = opts.yieldEveryBytes ?? 32 * 1024 * 1024
  const get = (day: string): Acc => {
    let a = acc.get(day)
    if (!a) {
      a = newAcc()
      acc.set(day, a)
    }
    return a
  }

  const handleRecord = (el: string) => {
    const a = parseAttrs(el)
    const type = a.type ?? ''
    const start = a.startDate ?? ''
    const end = a.endDate ?? start
    if (!start) return
    const val = Number(a.value)
    switch (type) {
      case 'HKQuantityTypeIdentifierBodyMass': {
        if (!Number.isFinite(val)) return
        const day = dayKeyOf(end)
        if (opts.minDate && day < opts.minDate) return
        const kg = a.unit === 'lb' ? val * LB_TO_KG : val
        const t = hkTime(end)
        const accD = get(day)
        if (t >= accD.weightAt) {
          accD.weightAt = t
          accD.weightKg = Math.round(kg * 10) / 10
        }
        return
      }
      case 'HKQuantityTypeIdentifierRestingHeartRate': {
        if (!Number.isFinite(val)) return
        const day = dayKeyOf(end)
        if (opts.minDate && day < opts.minDate) return
        const accD = get(day)
        accD.rhrSum += val
        accD.rhrN++
        return
      }
      case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': {
        if (!Number.isFinite(val)) return
        const day = dayKeyOf(end)
        if (opts.minDate && day < opts.minDate) return
        const accD = get(day)
        accD.hrvSum += val
        accD.hrvN++
        return
      }
      case 'HKQuantityTypeIdentifierStepCount': {
        if (!Number.isFinite(val)) return
        const day = dayKeyOf(start)
        if (opts.minDate && day < opts.minDate) return
        get(day).steps += val
        return
      }
      case 'HKQuantityTypeIdentifierActiveEnergyBurned': {
        if (!Number.isFinite(val)) return
        const day = dayKeyOf(start)
        if (opts.minDate && day < opts.minDate) return
        get(day).activeKcal += a.unit === 'kJ' ? val * KJ_TO_KCAL : val
        return
      }
      case 'HKCategoryTypeIdentifierSleepAnalysis': {
        const v = a.value ?? ''
        // 只统计 Asleep 类（AsleepCore/Deep/REM/Unspecified），排除 InBed/Awake
        if (!v.includes('Asleep') || v.includes('InBed')) return
        // 归到醒来当天（endDate 的日期）
        const day = dayKeyOf(end)
        if (opts.minDate && day < opts.minDate) return
        const dur = Math.max(0, hkTime(end) - hkTime(start)) / 1000
        get(day).sleepSec += dur
        return
      }
      default:
        return
    }
  }

  const handleWorkout = (el: string) => {
    const a = parseAttrs(el.slice(0, el.indexOf('>') + 1))
    const start = a.startDate ?? ''
    if (!start) return
    const day = dayKeyOf(start)
    if (opts.minDate && day < opts.minDate) return
    let minutes = Number(a.duration)
    if (!Number.isFinite(minutes)) minutes = 0
    if (a.durationUnit === 's' || a.durationUnit === 'sec') minutes /= 60
    else if (a.durationUnit === 'hr') minutes *= 60
    const w: HealthWorkout = { type: mapWorkoutType(a.workoutActivityType ?? '') }
    w.start = start.replace(' ', 'T').replace(' ', '')
    if (minutes > 0) w.minutes = Math.round(minutes)
    // 能量：优先 totalEnergyBurned 属性，其次内部 WorkoutStatistics
    let kcal = Number(a.totalEnergyBurned)
    if (Number.isFinite(kcal) && a.totalEnergyBurnedUnit === 'kJ') kcal *= KJ_TO_KCAL
    if (!Number.isFinite(kcal)) {
      const m = /WorkoutStatistics[^>]*type="HKQuantityTypeIdentifierActiveEnergyBurned"[^>]*sum="([\d.]+)"/.exec(el)
        ?? /WorkoutStatistics[^>]*sum="([\d.]+)"[^>]*type="HKQuantityTypeIdentifierActiveEnergyBurned"/.exec(el)
      if (m) kcal = Number(m[1])
    }
    if (Number.isFinite(kcal) && kcal > 0) w.kcal = Math.round(kcal)
    const hrM = /WorkoutStatistics[^>]*type="HKQuantityTypeIdentifierHeartRate"[^>]*average="([\d.]+)"/.exec(el)
      ?? /WorkoutStatistics[^>]*average="([\d.]+)"[^>]*type="HKQuantityTypeIdentifierHeartRate"/.exec(el)
    if (hrM) w.avgHr = Math.round(Number(hrM[1]))
    get(day).workouts.push(w)
  }

  const reRecord = /<Record\b[^>]*?\/>/g
  const reWorkout = /<Workout\b[^>]*?(?:\/>|>[\s\S]*?<\/Workout>)/g

  let buffer = ''
  let processed = 0
  let sinceYield = 0
  const total = xml.length

  const scan = () => {
    let lastEnd = 0
    reRecord.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = reRecord.exec(buffer))) {
      handleRecord(m[0])
      lastEnd = Math.max(lastEnd, m.index + m[0].length)
    }
    reWorkout.lastIndex = 0
    while ((m = reWorkout.exec(buffer))) {
      handleWorkout(m[0])
      lastEnd = Math.max(lastEnd, m.index + m[0].length)
    }
    buffer = buffer.slice(lastEnd)
  }

  for (let i = 0; i < total; i += CHUNK) {
    buffer += xml.slice(i, i + CHUNK)
    scan()
    processed = Math.min(total, i + CHUNK)
    sinceYield += CHUNK
    opts.onProgress?.(processed / total)
    if (sinceYield >= yieldEvery) {
      sinceYield = 0
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  scan() // 处理尾部

  // 汇总为 HealthDay
  const days: Record<string, HealthDay> = {}
  let weightCount = 0
  let workoutCount = 0
  const keys = [...acc.keys()].sort()
  for (const day of keys) {
    const a = acc.get(day) as Acc
    const d: HealthDay = {}
    if (a.steps > 0) d.steps = Math.round(a.steps)
    if (a.activeKcal > 0) d.activeKcal = Math.round(a.activeKcal)
    if (a.rhrN > 0) d.restingHr = Math.round(a.rhrSum / a.rhrN)
    if (a.hrvN > 0) d.hrv = Math.round(a.hrvSum / a.hrvN)
    if (a.sleepSec > 0) d.sleepHours = Math.round((a.sleepSec / 3600) * 10) / 10
    if (a.weightKg !== undefined) {
      d.weightKg = a.weightKg
      weightCount++
    }
    if (a.workouts.length) {
      d.workouts = a.workouts
      workoutCount += a.workouts.length
    }
    days[day] = d
  }

  return {
    days,
    summary: {
      dayCount: keys.length,
      weightCount,
      workoutCount,
      dateRange: keys.length ? [keys[0], keys[keys.length - 1]] : null,
    },
  }
}

// ── 合并（既有快捷指令数据优先，导入只补缺失）─────────────

function mergeDay(imported: HealthDay | undefined, existing: HealthDay | undefined): HealthDay {
  if (!imported) return existing ?? {}
  if (!existing) return imported
  const out: HealthDay = { ...imported }
  // 既有（快捷指令推送）字段优先；导入只填缺失
  for (const key of ['steps', 'activeKcal', 'restingHr', 'hrv', 'sleepHours', 'weightKg'] as const) {
    if (existing[key] !== undefined) out[key] = existing[key]
  }
  out.workouts = existing.workouts?.length ? existing.workouts : imported.workouts
  return out
}

export function mergeHealthPayload(
  existing: HealthPayload | null,
  imported: Record<string, HealthDay>,
): HealthPayload {
  const days: Record<string, HealthDay> = {}
  for (const [date, d] of Object.entries(imported)) days[date] = d
  if (existing) {
    for (const [date, d] of Object.entries(existing.days)) {
      days[date] = mergeDay(days[date], d)
    }
  }
  return {
    app: 'hyrox-bj-plan-health',
    updatedAt: new Date().toISOString(),
    days,
  }
}

/** 大文件门槛：未压缩 XML 超过该大小先弹确认（字节） */
export const LARGE_FILE_THRESHOLD = 300 * 1024 * 1024

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  return `${Math.round(bytes / 1024 / 1024)} MB`
}
