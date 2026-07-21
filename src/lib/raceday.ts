// 装备与比赛日清单：结构化内容（纯数据 + 纯函数）
import type { Segment } from '@/types'

export interface CheckItem {
  id: string
  label: string
  note?: string
}

export interface CheckGroup {
  id: string
  title: string
  items: CheckItem[]
}

// ── 装备清单 ─────────────────────────────────────────────

export const GEAR_GROUPS: CheckGroup[] = [
  {
    id: 'gear-wear',
    title: '穿着',
    items: [
      {
        id: 'gear-wear-shoes',
        label: '防滑抓地跑鞋',
        note: 'HYROX 地面为地毯+雪橇区，推荐 court/综合训练鞋，而非厚底碳板鞋',
      },
      { id: 'gear-wear-socks', label: '压缩袜' },
      { id: 'gear-wear-top', label: '速干背心/短袖' },
      { id: 'gear-wear-shorts', label: '短裤' },
      { id: 'gear-wear-gloves', label: '手套（可选）', note: '拉雪橇/农夫行走防滑防磨' },
      { id: 'gear-wear-wrist', label: '护腕/护掌（可选）' },
    ],
  },
  {
    id: 'gear-fuel',
    title: '补给',
    items: [
      {
        id: 'gear-fuel-gels',
        label: '能量胶 ×3',
        note: '对应第 3/5/6 站后补给点（与营养模块「赛中补给」一致）',
      },
      { id: 'gear-fuel-salt', label: '电解质片/盐丸' },
      {
        id: 'gear-fuel-bottle',
        label: '软水壶或赛前补水计划',
        note: '赛道设有官方饮水站，按官方规则使用',
      },
      { id: 'gear-fuel-vaseline', label: '凡士林（防磨）', note: '室内赛事，无需防晒；重点涂抹大腿内侧/腋下/乳头' },
    ],
  },
  {
    id: 'gear-docs',
    title: '证件与其他',
    items: [
      { id: 'gear-docs-id', label: '身份证件' },
      { id: 'gear-docs-ticket', label: '报名确认/二维码' },
      { id: 'gear-docs-chip', label: '领取计时手环/芯片', note: '现场领取，提前核对个人信息' },
      { id: 'gear-docs-cash', label: '现金/交通卡' },
      { id: 'gear-docs-clothes', label: '赛后更换干衣' },
      { id: 'gear-docs-towel', label: '毛巾' },
      { id: 'gear-docs-bag', label: '塑料袋（装湿衣）' },
    ],
  },
]

// ── 比赛日时间线 ─────────────────────────────────────────

export interface TimelineItem {
  id: string
  /** 距起跑的分钟数（T-x） */
  offsetMin: number
  title: string
  detail: string
}

export function buildTimeline(preRaceCarbG: number): TimelineItem[] {
  return [
    {
      id: 'tl-180',
      offsetMin: 180,
      title: '起床 + 赛前早餐',
      detail: `碳水约 ${preRaceCarbG}g（体重 2 g/kg）：米饭/馒头 + 鸡蛋 + 香蕉，低脂低纤维，充分饮水`,
    },
    {
      id: 'tl-120',
      offsetMin: 120,
      title: '到达场馆 · 安检 · 存包',
      detail: '带齐证件与报名二维码，轻装入场，预留排队时间',
    },
    {
      id: 'tl-75',
      offsetMin: 75,
      title: '领取计时设备 · 熟悉动线',
      detail: '确认计时手环佩戴牢固；走一遍 Roxzone 动线与饮水站位置',
    },
    {
      id: 'tl-45',
      offsetMin: 45,
      title: '动态热身',
      detail:
        '开合跳 60s → 弓步转体 ×10 → 高抬腿 30s → 空蹲 ×15 → 划船机 500m 轻桨 → 轻量墙球 ×20 → 短加速跑 3×40m',
    },
    {
      id: 'tl-15',
      offsetMin: 15,
      title: '进入集结区',
      detail: '小口运动饮料，最后检查鞋带与计时设备，专注前 4km 配速纪律',
    },
    {
      id: 'tl-0',
      offsetMin: 0,
      title: '起跑 🏁',
      detail: '按目标配速出发，前 1km 宁可慢 5 秒',
    },
  ]
}

/** "HH:MM" 起跑时间 − offsetMin → "HH:MM" */
export function timelineTime(startHHMM: string, offsetMin: number): string {
  const [h, m] = startHHMM.split(':').map(Number)
  const total = ((h || 0) * 60 + (m || 0) - offsetMin + 24 * 60) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// ── 赛中执行 ─────────────────────────────────────────────

const STATION_TIPS: Record<string, string> = {
  skierg: '留 10% 余力，长拉桨、髋部发力，别把心率拉爆',
  sledpush: '小步高频、身体前倾，一旦启动就别停',
  sledpull: '后坐发力、保持绳索张力；本站后到 Roxzone 补第 1 支能量胶',
  bbj: '节奏均匀、落地即起，腰背中立位别弓腰',
  row: '腿驱动优先，桨频 26–28 稳住；出站后补第 2 支胶/电解质',
  farmers: '核心收紧小步快走，握力不足就提前规划换手点；出站后补第 3 支胶',
  lunges: '步幅一致、躯干直立，按 20m 分组心理拆解',
  wallballs: '分组 20-20-20-20-20，组间 3–5 秒深呼吸即走',
  roxzone: '全程快走不停步，补给与调整都在这里完成',
}

const RUN_TIP_EARLY = '压住兴奋，配速误差控制在 ±5 秒内'
const RUN_TIP_LATE = '疲劳期保持步频， Roxzone 快走恢复心率'

export interface RaceRow {
  id: string
  name: string
  targetSec: number
  tip: string
}

/** 由目标分解的 17 段生成赛中执行序列（实时联动当前分段目标） */
export function buildRaceRows(splits: Segment[]): RaceRow[] {
  return splits.map((s) => {
    let tip: string
    if (s.kind === 'run') {
      const n = Number(s.id.replace('run', ''))
      tip = n <= 4 ? RUN_TIP_EARLY : RUN_TIP_LATE
    } else {
      tip = STATION_TIPS[s.id] ?? ''
    }
    return { id: s.id, name: s.name, targetSec: s.targetSec, tip }
  })
}

export const PACE_WARNING =
  '配速警示：前 4km 每公里配速不要快于目标均配 5 秒以上——HYROX 后半程的站点表现几乎都由前 4km 的纪律决定。'

// ── 赛后恢复 ─────────────────────────────────────────────

export function buildPostRace(
  postProteinG: number,
  postCarbG: number,
  waterMl: [number, number],
): CheckGroup {
  return {
    id: 'post-race',
    title: '赛后恢复',
    items: [
      { id: 'post-walk', label: '终点后慢走 10 分钟', note: '不要立刻坐下，让心率平缓回落' },
      {
        id: 'post-refuel',
        label: `30 分钟内：蛋白质 ${postProteinG}g + 碳水 ${postCarbG}g`,
        note: '与营养模块「训练后补给」一致（0.3 g/kg 蛋白 + 1 g/kg 碳水）',
      },
      {
        id: 'post-water',
        label: `当天补水 ${waterMl[0].toLocaleString()}–${waterMl[1].toLocaleString()} ml`,
        note: '含电解质，补至尿液清亮',
      },
      { id: 'post-sleep', label: '当晚睡眠 8 小时以上', note: '赛后当晚是恢复效率最高的窗口' },
      { id: 'post-nextday', label: '次日主动恢复 30 分钟', note: '轻松走/骑行 + 拉伸泡沫轴' },
      { id: 'post-week', label: '一周内避免大强度训练', note: '以 Z1–Z2 与灵活性练习为主' },
    ],
  }
}

// ── 准备度统计 ───────────────────────────────────────────

export interface ReadinessResult {
  done: number
  total: number
  pct: number
}

export function readiness(
  allIds: string[],
  checks: Record<string, boolean>,
): ReadinessResult {
  const done = allIds.filter((id) => checks[id]).length
  const total = allIds.length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

/** 自定义条目的勾选 key（按标签稳定，删除不影响其他条目） */
export function customKey(groupId: string, label: string): string {
  return `custom-${groupId}-${label}`
}
