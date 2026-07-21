// 热量与宏量营养素引擎（纯函数）
import type { NutritionPrefs, Profile } from '@/types'
import type { WeightVerdict } from './body'
import type { DayPlan } from './plan'

/**
 * 活动系数表（按每周训练天数）：
 * 3 天 → 1.45 · 4 天 → 1.50 · 5 天 → 1.55 · 6 天 → 1.60 · 7 天 → 1.65
 * 依据：HYROX 训练以中高强度混合训练为主，在一般久坐-轻活动基础上按训练频率上调。
 */
export const ACTIVITY_FACTORS: Record<number, number> = {
  3: 1.45,
  4: 1.5,
  5: 1.55,
  6: 1.6,
  7: 1.65,
}

/** Mifflin-St Jeor 基础代谢率（kcal/天） */
export function calcBMR(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return Math.round(p.sex === 'male' ? base + 5 : base - 161)
}

export function calcTDEE(p: Profile): number {
  const days = Math.max(3, Math.min(7, p.daysPerWeek))
  return Math.round(calcBMR(p) * ACTIVITY_FACTORS[days])
}

/** 每日热量下限：max(性别安全下限, BMR × 0.9) */
export function calorieFloor(p: Profile): number {
  const sexFloor = p.sex === 'male' ? 1500 : 1200
  return Math.round(Math.max(sexFloor, calcBMR(p) * 0.9))
}

export interface CalorieTarget {
  mode: 'cut' | 'maintain'
  tdee: number
  bmr: number
  /** 应用缺口/下限之后的最终热量目标 */
  kcal: number
  /** 实际应用的缺口（被下限截断后可能小于用户设定） */
  appliedDeficit: number
  floorKcal: number
  floored: boolean
  /** 用户设定缺口 > 500 kcal（超出 ≤500 kcal/天 指南） */
  deficitWarning: boolean
}

export function calorieTarget(p: Profile, verdict: WeightVerdict, prefs: NutritionPrefs): CalorieTarget {
  const tdee = calcTDEE(p)
  const floor = calorieFloor(p)
  if (!verdict.needCut) {
    return {
      mode: 'maintain',
      tdee,
      bmr: calcBMR(p),
      kcal: tdee,
      appliedDeficit: 0,
      floorKcal: floor,
      floored: false,
      deficitWarning: false,
    }
  }
  const raw = tdee - prefs.deficitKcal
  const kcal = Math.max(raw, floor)
  return {
    mode: 'cut',
    tdee,
    bmr: calcBMR(p),
    kcal,
    appliedDeficit: tdee - kcal,
    floorKcal: floor,
    floored: raw < floor,
    deficitWarning: prefs.deficitKcal > 500,
  }
}

export interface Macros {
  proteinG: number
  fatG: number
  carbG: number
  proteinKcal: number
  fatKcal: number
  carbKcal: number
  proteinPct: number
  fatPct: number
  carbPct: number
}

/** 宏量营养素：蛋白质/脂肪按 g/kg，碳水补足剩余热量（蛋白 4 kcal/g、碳水 4 kcal/g、脂肪 9 kcal/g） */
export function macrosFor(kcalTarget: number, p: Profile, prefs: NutritionPrefs): Macros {
  const proteinG = Math.round(prefs.proteinGPerKg * p.weightKg)
  const fatG = Math.round(prefs.fatGPerKg * p.weightKg)
  const proteinKcal = proteinG * 4
  const fatKcal = fatG * 9
  const carbKcal = Math.max(0, kcalTarget - proteinKcal - fatKcal)
  const carbG = Math.round(carbKcal / 4)
  const total = proteinKcal + fatKcal + carbKcal || 1
  return {
    proteinG,
    fatG,
    carbG,
    proteinKcal,
    fatKcal,
    carbKcal,
    proteinPct: Math.round((proteinKcal / total) * 100),
    fatPct: Math.round((fatKcal / total) * 100),
    carbPct: Math.round((carbKcal / total) * 100),
  }
}

// ── 碳水周期化 ─────────────────────────────────────────────

export type DayType = 'high' | 'normal' | 'rest'

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  high: '高强度日',
  normal: '普通训练日',
  rest: '休息日',
}

/** 碳水系数：高强度日 ×1.15，普通训练日 ×1.0，休息日 ×0.8（蛋白质/脂肪不变） */
export const CARB_FACTOR: Record<DayType, number> = {
  high: 1.15,
  normal: 1.0,
  rest: 0.8,
}

const HIGH_INTENSITY = new Set(['interval', 'hybrid', 'simulation'])

export function dayTypeOf(d: DayPlan): DayType {
  if (d.isRest || d.session.type === 'rest' || d.session.type === 'recovery') return 'rest'
  return HIGH_INTENSITY.has(d.session.type) ? 'high' : 'normal'
}

export interface DayTarget {
  dayLabel: string
  type: DayType
  sessionName: string
  kcal: number
  carbG: number
  proteinG: number
  fatG: number
}

/** 一周 7 天的逐日目标（碳水周期化后的热量与宏量） */
export function dayTargets(days: DayPlan[], base: Macros): DayTarget[] {
  return days.map((d) => {
    const type = dayTypeOf(d)
    const carbG = Math.round(base.carbG * CARB_FACTOR[type])
    const kcal = base.proteinKcal + base.fatKcal + carbG * 4
    return {
      dayLabel: d.dayLabel,
      type,
      sessionName: d.session.name,
      kcal,
      carbG,
      proteinG: base.proteinG,
      fatG: base.fatG,
    }
  })
}

// ── 餐次分配 ─────────────────────────────────────────────

export interface MealSlot {
  name: string
  pct: number
  hint: string
}

/** 餐次热量占比：训练日含训练前后加餐，休息日简化为四餐 */
export function mealSlots(type: DayType): MealSlot[] {
  if (type === 'rest') {
    return [
      { name: '早餐', pct: 0.3, hint: '碳水+蛋白均衡' },
      { name: '午餐', pct: 0.35, hint: '主餐，蔬菜足量' },
      { name: '加餐', pct: 0.05, hint: '水果或坚果' },
      { name: '晚餐', pct: 0.3, hint: '清淡，早吃' },
    ]
  }
  return [
    { name: '早餐', pct: 0.25, hint: '碳水为主+蛋白' },
    { name: '午餐', pct: 0.25, hint: '主餐，蔬菜足量' },
    { name: '训练前加餐', pct: 0.1, hint: '训练前 1–2h，低脂低纤维' },
    { name: '训练后加餐', pct: 0.15, hint: '训练后 30 分钟内' },
    { name: '晚餐', pct: 0.25, hint: '蛋白+蔬菜为主' },
  ]
}

// ── 训练日补给指南 ─────────────────────────────────────────

export interface FuelingGuide {
  preCarbG: [number, number]
  preText: string
  duringCarbPerHour: [number, number]
  duringText: string
  postProteinG: number
  postCarbG: number
  postText: string
  waterMl: [number, number]
}

export function fuelingGuide(p: Profile): FuelingGuide {
  return {
    preCarbG: [Math.round(p.weightKg * 1), Math.round(p.weightKg * 2)],
    preText: '训练前 2 小时：碳水 1–2 g/kg，低脂低纤维（如米饭+鸡胸肉、馒头+香蕉）',
    duringCarbPerHour: [30, 60],
    duringText: '训练超过 75 分钟：每小时补充 30–60g 碳水（运动饮料/能量胶/香蕉）',
    postProteinG: Math.round(p.weightKg * 0.3),
    postCarbG: Math.round(p.weightKg * 1),
    postText: '训练后 30 分钟内：蛋白质 0.3 g/kg + 碳水 1 g/kg，加速糖原恢复与肌肉修复',
    waterMl: [Math.round(p.weightKg * 35), Math.round(p.weightKg * 40)],
  }
}

// ── 比赛周营养策略 ─────────────────────────────────────────

export interface RaceWeekStrategy {
  carbLoadG: [number, number]
  caffeineMg: [number, number]
}

export function raceWeekStrategy(p: Profile): RaceWeekStrategy {
  return {
    carbLoadG: [Math.round(p.weightKg * 8), Math.round(p.weightKg * 10)],
    caffeineMg: [Math.round(p.weightKg * 3), Math.round(p.weightKg * 6)],
  }
}

export function mealKey(week: number, dayIndex: number): string {
  return `m${week}-d${dayIndex}`
}
