// HYROX 赛制硬编码数据 + 目标分段生成（纯函数）
import type { Division, Segment, Sex } from '@/types'

export const ROXZONE_ID = 'roxzone'

export interface StationDef {
  id: string
  name: string
  /** 按性别/组别返回器材规格描述 */
  spec: (sex: Sex, div: Division) => string
  /** 默认目标用时（秒） */
  targetSec: number
  min: number
  max: number
}

export const STATIONS: StationDef[] = [
  {
    id: 'skierg',
    name: 'SkiErg 滑雪机 1000m',
    spec: () => '1000m，注意拉桨节奏与核心参与',
    targetSec: 255, // 4:15
    min: 180,
    max: 420,
  },
  {
    id: 'sledpush',
    name: 'Sled Push 推雪橇 50m',
    spec: (sex, div) =>
      sex === 'male'
        ? div === 'pro'
          ? '202kg（含雪橇自重）· 男子 Pro'
          : '152kg（含雪橇自重）· 男子 Open'
        : div === 'pro'
          ? '152kg（含雪橇自重）· 女子 Pro'
          : '102kg（含雪橇自重）· 女子 Open',
    targetSec: 240, // 4:00
    min: 150,
    max: 420,
  },
  {
    id: 'sledpull',
    name: 'Sled Pull 拉雪橇 50m',
    spec: (sex, div) =>
      sex === 'male'
        ? div === 'pro'
          ? '153kg · 男子 Pro'
          : '103kg · 男子 Open'
        : div === 'pro'
          ? '103kg · 女子 Pro'
          : '78kg · 女子 Open',
    targetSec: 300, // 5:00
    min: 180,
    max: 480,
  },
  {
    id: 'bbj',
    name: 'Burpee Broad Jumps 80m',
    spec: () => '80m 波比跳远，腰背中立位，别抢节奏',
    targetSec: 345, // 5:45
    min: 240,
    max: 540,
  },
  {
    id: 'row',
    name: 'Rowing 划船机 1000m',
    spec: () => '1000m，桨频 26–30，腿驱优先',
    targetSec: 270, // 4:30
    min: 200,
    max: 420,
  },
  {
    id: 'farmers',
    name: 'Farmers Carry 农夫行走 200m',
    spec: (sex, div) =>
      sex === 'male'
        ? div === 'pro'
          ? '2×32kg 壶铃 · 男子 Pro'
          : '2×24kg 壶铃 · 男子 Open'
        : div === 'pro'
          ? '2×24kg 壶铃 · 女子 Pro'
          : '2×16kg 壶铃 · 女子 Open',
    targetSec: 150, // 2:30
    min: 90,
    max: 300,
  },
  {
    id: 'lunges',
    name: 'Sandbag Lunges 沙袋弓步 100m',
    spec: (sex, div) =>
      sex === 'male'
        ? div === 'pro'
          ? '30kg 沙袋 · 男子 Pro'
          : '20kg 沙袋 · 男子 Open'
        : div === 'pro'
          ? '20kg 沙袋 · 女子 Pro'
          : '10kg 沙袋 · 女子 Open',
    targetSec: 300, // 5:00
    min: 180,
    max: 480,
  },
  {
    id: 'wallballs',
    name: 'Wall Balls 墙球 100 次',
    spec: (sex, div) =>
      sex === 'male'
        ? div === 'pro'
          ? '9kg 球 @ 3m 靶 · 男子 Pro'
          : '6kg 球 @ 3m 靶 · 男子 Open'
        : div === 'pro'
          ? '6kg 球 @ 2.7m 靶 · 女子 Pro'
          : '4kg 球 @ 2.7m 靶 · 女子 Open',
    targetSec: 450, // 7:30
    min: 240,
    max: 720,
  },
]

export const RUN_TARGET_SEC = 255 // 每公里 4:15，8 段共 34:00
export const ROXZONE_TARGET_SEC = 450 // 7:30

const RUN_MIN = 200
const RUN_MAX = 360

/** 生成默认目标分段（按比赛顺序：跑→站→跑→站……最后 Roxzone 汇总），总计恰好 4800 秒 */
export function defaultSplits(sex: Sex, div: Division): Segment[] {
  const segs: Segment[] = []
  STATIONS.forEach((st, i) => {
    segs.push({
      id: `run${i + 1}`,
      kind: 'run',
      name: `第 ${i + 1} 跑 · 1km`,
      targetSec: RUN_TARGET_SEC,
      min: RUN_MIN,
      max: RUN_MAX,
    })
    segs.push({
      id: st.id,
      kind: 'station',
      name: st.name,
      spec: st.spec(sex, div),
      targetSec: st.targetSec,
      min: st.min,
      max: st.max,
    })
  })
  segs.push({
    id: ROXZONE_ID,
    kind: 'roxzone',
    name: 'Roxzone 换项区（合计）',
    spec: '跑步与站点之间的走动/调整时间，典型合计 3–8 分钟',
    targetSec: ROXZONE_TARGET_SEC,
    min: 180,
    max: 720,
  })
  return segs
}

export function totalSeconds(segs: Segment[]): number {
  return segs.reduce((a, s) => a + s.targetSec, 0)
}

/** 将全部跑步段的总目标均摊回每公里配速（秒/km） */
export function targetPaceSecPerKm(segs: Segment[]): number {
  const runTotal = segs.filter((s) => s.kind === 'run').reduce((a, s) => a + s.targetSec, 0)
  return runTotal / 8
}

/**
 * 将现有分段等比缩放到新的总目标时间，并保证总和精确等于 newTotal。
 * 逐秒修正分配给绝对值最大的段。
 */
export function scaleSplits(segs: Segment[], newTotal: number): Segment[] {
  const cur = totalSeconds(segs)
  if (cur === newTotal || cur <= 0) return segs
  const scaled = segs.map((s) => ({
    ...s,
    targetSec: Math.max(s.min, Math.round((s.targetSec * newTotal) / cur)),
  }))
  let diff = newTotal - totalSeconds(scaled)
  const order = [...scaled.keys()].sort((a, b) =>
    diff > 0
      ? scaled[b].targetSec - scaled[a].targetSec
      : scaled[a].targetSec - scaled[b].targetSec,
  )
  let i = 0
  let guard = 0
  while (diff !== 0 && guard < 10000) {
    const idx = order[i % order.length]
    const step = diff > 0 ? 1 : -1
    const next = scaled[idx].targetSec + step
    if (next >= scaled[idx].min && next <= scaled[idx].max) {
      scaled[idx] = { ...scaled[idx], targetSec: next }
      diff -= step
    }
    i++
    guard++
  }
  return scaled
}

/** 刷新站点规格文案（性别/组别变化时调用，保持 targetSec 不变） */
export function refreshSpecs(segs: Segment[], sex: Sex, div: Division): Segment[] {
  return segs.map((s) => {
    if (s.kind !== 'station') return s
    const def = STATIONS.find((st) => st.id === s.id)
    return def ? { ...s, spec: def.spec(sex, div) } : s
  })
}
