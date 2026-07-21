// 由 5km PB 推算当前 HYROX 完赛能力的简化模型（纯函数）
import type { Profile } from '@/types'
import { ROXZONE_ID, STATIONS } from './hyrox'

export type FitnessBand = 'elite' | 'advanced' | 'intermediate' | 'beginner'

export interface BandInfo {
  band: FitnessBand
  label: string
  /** 疲劳后比赛配速相对 5km PB 配速的放缓系数 */
  fatigueFactor: number
  /** 站点用时相对默认目标的系数 */
  stationFactor: number
  /** Roxzone 估计（秒） */
  roxzoneSec: number
}

export function bandFromFiveKm(fiveKmSec: number): BandInfo {
  if (fiveKmSec < 20 * 60)
    return { band: 'elite', label: '精英业余（5km < 20:00）', fatigueFactor: 1.15, stationFactor: 0.88, roxzoneSec: 360 }
  if (fiveKmSec < 23 * 60)
    return { band: 'advanced', label: '进阶（5km 20:00–23:00）', fatigueFactor: 1.18, stationFactor: 1.0, roxzoneSec: 420 }
  if (fiveKmSec < 26 * 60)
    return { band: 'intermediate', label: '中级（5km 23:00–26:00）', fatigueFactor: 1.22, stationFactor: 1.15, roxzoneSec: 480 }
  return { band: 'beginner', label: '入门（5km ≥ 26:00）', fatigueFactor: 1.25, stationFactor: 1.35, roxzoneSec: 540 }
}

export interface RaceEstimate {
  band: BandInfo
  /** 5km PB 配速（秒/km） */
  freshPaceSecPerKm: number
  /** 疲劳后比赛配速（秒/km） */
  racePaceSecPerKm: number
  runTotalSec: number
  /** 各站点估计用时（key = station id） */
  stationSecs: Record<string, number>
  stationTotalSec: number
  roxzoneSec: number
  totalSec: number
}

export function estimateRace(p: Profile): RaceEstimate {
  const band = bandFromFiveKm(p.fiveKmSec)
  const freshPace = p.fiveKmSec / 5
  // 有 10km 成绩时，用它微调疲劳系数（10km 越接近 5km×2，耐力越好）
  let fatigue = band.fatigueFactor
  if (p.tenKmSec && p.tenKmSec > 0) {
    const ratio = p.tenKmSec / (p.fiveKmSec * 2) // 1.0 = 完美耐力，>1.1 = 耐力偏弱
    fatigue += Math.max(-0.04, Math.min(0.05, (ratio - 1.05) * 0.8))
  }
  const racePace = freshPace * fatigue
  const runTotal = Math.round(racePace * 8)
  const stationSecs: Record<string, number> = {}
  let stationTotal = 0
  for (const st of STATIONS) {
    const sec = Math.round(st.targetSec * band.stationFactor)
    stationSecs[st.id] = sec
    stationTotal += sec
  }
  return {
    band,
    freshPaceSecPerKm: freshPace,
    racePaceSecPerKm: racePace,
    runTotalSec: runTotal,
    stationSecs,
    stationTotalSec: stationTotal,
    roxzoneSec: band.roxzoneSec,
    totalSec: runTotal + stationTotal + band.roxzoneSec,
  }
}

export type Feasibility = 'ontrack' | 'challenging' | 'longroad'

export interface FeasibilityResult {
  verdict: Feasibility
  label: string
  detail: string
  /** 当前预估 − 目标（秒），负值表示已达标 */
  gapSec: number
}

export function assessFeasibility(est: RaceEstimate, p: Profile): FeasibilityResult {
  const gap = est.totalSec - p.targetSec
  // 每周训练带来的期望改善：每周约 0.4%–0.9%（取决于训练天数），封顶 12%
  const improvementCap = Math.min(0.12, p.weeksToRace * (0.004 + 0.0006 * (p.daysPerWeek - 3)))
  const projectedTotal = Math.round(est.totalSec * (1 - improvementCap))
  const projectedGap = projectedTotal - p.targetSec

  if (projectedGap <= 0)
    return {
      verdict: 'ontrack',
      label: '可达',
      detail: `按当前水平与 ${p.weeksToRace} 周训练周期，预计可提升至约 ${fmt(projectedTotal)}，目标在射程内。`,
      gapSec: gap,
    }
  if (projectedGap <= 300)
    return {
      verdict: 'challenging',
      label: '有挑战',
      detail: `训练周期结束预计约 ${fmt(projectedTotal)}，距目标差 ${fmt(projectedGap)}，需要高质量执行每一周，并优先补短板站点。`,
      gapSec: gap,
    }
  return {
    verdict: 'longroad',
    label: '需要更长周期',
    detail: `当前预估 ${fmt(est.totalSec)}，即使满周期提升后仍差 ${fmt(projectedGap)} 以上。建议本场以完赛+积累经验为目标，或放宽目标时间。`,
    gapSec: gap,
  }
}

function fmt(sec: number): string {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** 某段（站点）的当前估计用时 */
export function estimateSegmentSec(est: RaceEstimate, segmentId: string, runTargetSec: number): number {
  if (segmentId === ROXZONE_ID) return est.roxzoneSec
  if (segmentId.startsWith('run')) return Math.round(est.runTotalSec / 8)
  return est.stationSecs[segmentId] ?? runTargetSec
}

export interface GapItem {
  id: string
  name: string
  targetSec: number
  estimateSec: number
  gapSec: number
}
