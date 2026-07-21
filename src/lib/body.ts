// 身体指标与减重判定（纯函数）
import type { Profile, Sex } from '@/types'

export function calcBMI(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return weightKg / (m * m)
}

export interface BMIClass {
  label: string
  tone: 'ok' | 'warn' | 'bad'
}

/** 中国成人 BMI 标准 */
export function classifyBMI(bmi: number): BMIClass {
  if (bmi < 18.5) return { label: '偏低', tone: 'warn' }
  if (bmi < 24) return { label: '正常', tone: 'ok' }
  if (bmi < 28) return { label: '超重', tone: 'warn' }
  return { label: '肥胖', tone: 'bad' }
}

/**
 * Deurenberg 公式估算体脂率：
 * BF% = 1.20 × BMI + 0.23 × 年龄 − 10.8 × 性别(男1/女0) − 5.4
 */
export function estimateBodyFatPct(bmi: number, age: number, sex: Sex): number {
  const s = sex === 'male' ? 1 : 0
  return Math.max(3, Math.min(55, 1.2 * bmi + 0.23 * age - 10.8 * s - 5.4))
}

export function leanMassKg(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100)
}

/** 运动人群体脂率参考上限 */
export function athleticBfLimit(sex: Sex): number {
  return sex === 'male' ? 18 : 25
}

/** 比赛目标体脂率（保持去脂体重前提下的目标） */
export function targetBfPct(sex: Sex): number {
  return sex === 'male' ? 15 : 22
}

export interface WeightVerdict {
  needCut: boolean
  reasons: string[]
  /** 有效体脂率（用户输入或估算值） */
  effectiveBfPct: number
  bfIsEstimate: boolean
  bmi: number
  bmiClass: BMIClass
  leanMass: number
  /** 目标比赛体重 kg */
  targetWeight: number
  /** 需减重量 kg（0 表示无需减重） */
  lossKg: number
  /** 安全减重速率 kg/周 [下限, 上限] */
  weeklyRate: [number, number]
  /** 按上限速率所需周数 */
  weeksNeeded: number
  /** 是否能在比赛前安全完成 */
  feasibleBeforeRace: boolean
}

export function weightVerdict(p: Profile): WeightVerdict {
  const bmi = calcBMI(p.weightKg, p.heightCm)
  const bmiClass = classifyBMI(bmi)
  const bfIsEstimate = p.bodyFatPct == null
  const effectiveBfPct = bfIsEstimate ? estimateBodyFatPct(bmi, p.age, p.sex) : (p.bodyFatPct as number)
  const lean = leanMassKg(p.weightKg, effectiveBfPct)

  const reasons: string[] = []
  if (bmi >= 25) reasons.push(`BMI ${bmi.toFixed(1)} ≥ 25`)
  const limit = athleticBfLimit(p.sex)
  if (effectiveBfPct > limit)
    reasons.push(`体脂率 ${effectiveBfPct.toFixed(1)}% 高于运动人群参考（${p.sex === 'male' ? '男' : '女'} > ${limit}%）`)
  const needCut = reasons.length > 0

  // 目标体重：优先按“保持去脂体重 + 目标体脂率”反推；若已优于目标则退回 BMI 24 目标
  let targetWeight = lean / (1 - targetBfPct(p.sex) / 100)
  if (!needCut || targetWeight >= p.weightKg) {
    targetWeight = needCut ? 24 * Math.pow(p.heightCm / 100, 2) : p.weightKg
  }
  targetWeight = Math.round(targetWeight * 10) / 10

  const lossKg = needCut ? Math.max(0, Math.round((p.weightKg - targetWeight) * 10) / 10) : 0
  const weeklyRate: [number, number] = [
    Math.round(p.weightKg * 0.005 * 100) / 100,
    Math.round(p.weightKg * 0.0075 * 100) / 100,
  ]
  const weeksNeeded = lossKg > 0 ? Math.ceil(lossKg / weeklyRate[1]) : 0
  const feasibleBeforeRace = lossKg === 0 || weeksNeeded <= Math.max(1, p.weeksToRace - 2)

  return {
    needCut,
    reasons,
    effectiveBfPct,
    bfIsEstimate,
    bmi,
    bmiClass,
    leanMass: lean,
    targetWeight,
    lossKg,
    weeklyRate,
    weeksNeeded,
    feasibleBeforeRace,
  }
}

export interface WeightPoint {
  week: number
  label: string
  current: number
  target: number
}

/** 体重轨迹图表数据：当前体重水平线 vs 安全减重轨迹（每周按速率中值下降） */
export function weightTrajectory(p: Profile, v: WeightVerdict): WeightPoint[] {
  const weeks = p.weeksToRace
  const rateMid = (v.weeklyRate[0] + v.weeklyRate[1]) / 2
  const pts: WeightPoint[] = []
  for (let w = 0; w <= weeks; w++) {
    const projected = v.needCut
      ? Math.max(v.targetWeight, p.weightKg - rateMid * w)
      : p.weightKg
    pts.push({
      week: w,
      label: w === 0 ? '现在' : w === weeks ? '比赛周' : `第${w}周`,
      current: Math.round(p.weightKg * 10) / 10,
      target: Math.round(projected * 10) / 10,
    })
  }
  return pts
}
