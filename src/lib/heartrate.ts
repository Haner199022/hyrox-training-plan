// 跑步心率区间引擎（纯函数）
import type { Profile, Sex } from '@/types'

/**
 * 最大心率估算：
 * - Tanaka（默认，男女通用）：HRmax = 208 − 0.7 × 年龄
 *   来源：Tanaka et al., 2001，较传统 220−年龄 在大样本上更准确。
 * - Gulati（女性备选）：HRmax = 206 − 0.88 × 年龄
 *   来源：Gulati et al., 2010，基于女性人群的运动试验数据。
 */
export type HRMaxMethod = 'tanaka' | 'gulati'

export function estimateHRmax(age: number, sex: Sex, method?: HRMaxMethod): number {
  const m = method ?? (sex === 'female' ? 'gulati' : 'tanaka')
  const v = m === 'gulati' ? 206 - 0.88 * age : 208 - 0.7 * age
  return Math.round(Math.max(150, Math.min(210, v)))
}

export type ZoneId = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

export interface HRZone {
  id: ZoneId
  name: string
  /** bpm 区间 [下限, 上限]（含） */
  range: [number, number]
  /** 强度百分比说明 */
  pctLabel: string
  purpose: string
  talkTest: string
}

/**
 * 区间带宽约定：
 * - Karvonen（储备心率 HRR，有静息心率时）：Z1 50–60% / Z2 60–70% / Z3 70–80% / Z4 80–90% / Z5 90–100% HRR
 *   区间心率 = 静息心率 + 百分比 × (HRmax − 静息心率)
 * - %HRmax（无静息心率时）：Z1 57–63% / Z2 63–76% / Z3 76–90% / Z4 90–95% / Z5 95–100% HRmax
 *   （常见运动生理教材分法，Z2 上限对齐“谈话测试”边界）
 */
const HRR_BANDS: [number, number][] = [
  [0.5, 0.6],
  [0.6, 0.7],
  [0.7, 0.8],
  [0.8, 0.9],
  [0.9, 1.0],
]

const HRMAX_BANDS: [number, number][] = [
  [0.57, 0.63],
  [0.63, 0.76],
  [0.76, 0.9],
  [0.9, 0.95],
  [0.95, 1.0],
]

const ZONE_META: { id: ZoneId; name: string; purpose: string; talkTest: string }[] = [
  { id: 'Z1', name: '恢复区', purpose: '主动恢复、热身与冷身、恢复日轻松动', talkTest: '能轻松唱歌' },
  { id: 'Z2', name: '有氧区', purpose: '有氧底盘建设，HYROX 训练量主力（Zone 2 有氧跑）', talkTest: '能完整说句子' },
  { id: 'Z3', name: '节奏区', purpose: '节奏跑/马拉松配速，提升有氧效率', talkTest: '只能说短句' },
  { id: 'Z4', name: '阈值区', purpose: '乳酸门槛与间歇训练，HYROX 比赛主体强度', talkTest: '只能说词语' },
  { id: 'Z5', name: '间歇区', purpose: '最大摄氧量刺激、短间歇与终点冲刺', talkTest: '几乎无法说话' },
]

export type ZoneMethod = 'karvonen' | 'hrmax'

export interface ZoneResult {
  method: ZoneMethod
  methodLabel: string
  zones: HRZone[]
}

export function computeZones(hrmax: number, restingHr: number | null): ZoneResult {
  if (restingHr !== null && restingHr > 30 && restingHr < hrmax) {
    const hrr = hrmax - restingHr
    return {
      method: 'karvonen',
      methodLabel: 'Karvonen 储备心率法',
      zones: ZONE_META.map((m, i) => ({
        ...m,
        pctLabel: `${Math.round(HRR_BANDS[i][0] * 100)}–${Math.round(HRR_BANDS[i][1] * 100)}% HRR`,
        range: [
          Math.round(restingHr + HRR_BANDS[i][0] * hrr),
          Math.round(restingHr + HRR_BANDS[i][1] * hrr),
        ],
      })),
    }
  }
  return {
    method: 'hrmax',
    methodLabel: '%HRmax 最大心率法',
    zones: ZONE_META.map((m, i) => ({
      ...m,
      pctLabel: `${Math.round(HRMAX_BANDS[i][0] * 100)}–${Math.round(HRMAX_BANDS[i][1] * 100)}% HRmax`,
      range: [Math.round(HRMAX_BANDS[i][0] * hrmax), Math.round(HRMAX_BANDS[i][1] * hrmax)],
    })),
  }
}

/** 有效最大心率：手动覆盖优先，其次公式估算 */
export function effectiveHRmax(p: Profile, override: number | null): { hrmax: number; isOverride: boolean } {
  if (override !== null && override >= 120 && override <= 220) return { hrmax: Math.round(override), isOverride: true }
  return { hrmax: estimateHRmax(p.age, p.sex), isOverride: false }
}

// ── HYROX 比赛心率策略（1:20 目标）──────────────────────────

export interface RaceHRStrategy {
  runRange: [number, number]
  stationRange: [number, number]
  finishRange: [number, number]
}

export function raceHRStrategy(hrmax: number): RaceHRStrategy {
  return {
    // 跑步段：Z3 上限 ~ Z4 下限 ≈ 85–90% HRmax
    runRange: [Math.round(hrmax * 0.85), Math.round(hrmax * 0.9)],
    // 站点段：允许冲到 Z4（90–95% HRmax）
    stationRange: [Math.round(hrmax * 0.9), Math.round(hrmax * 0.95)],
    // 最后 2km：全力（95–100% HRmax）
    finishRange: [Math.round(hrmax * 0.95), hrmax],
  }
}

/** 训练科目 → 心率区间映射（供训练计划展示） */
export const SESSION_ZONE: Record<string, ZoneId | 'Z4-Z5' | 'race' | null> = {
  zone2: 'Z2',
  tempo: 'Z3',
  interval: 'Z4-Z5',
  recovery: 'Z1',
  strength: null,
  hybrid: 'Z4',
  simulation: 'race',
  rest: null,
}
