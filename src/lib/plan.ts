// 12 周（可 6–16 周）周期化训练计划生成器（纯函数）
import type { Profile } from '@/types'
import { fmtMS, fmtPace } from './time'

export type Phase = 'base' | 'build' | 'specific' | 'taper'

export const PHASE_LABEL: Record<Phase, string> = {
  base: '基础期',
  build: '强化期',
  specific: '专项期',
  taper: '减量期',
}

export type SessionType =
  | 'zone2'
  | 'interval'
  | 'tempo'
  | 'strength'
  | 'hybrid'
  | 'simulation'
  | 'recovery'
  | 'rest'

export interface Session {
  type: SessionType
  name: string
  durationMin: number
  intensity: string
  details: string
  /** 本课涉及动作的演示媒体 key（exerciseMedia），可选 */
  mediaKeys?: string[]
}

export interface DayPlan {
  dayLabel: string
  isRest: boolean
  session: Session
}

export interface WeekPlan {
  week: number
  phase: Phase
  phaseLabel: string
  note: string | null
  days: DayPlan[]
}

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 每周训练日落在星期几（索引 0=周一） */
const DAY_PATTERN: Record<number, number[]> = {
  3: [0, 2, 5],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
}

/** 各天数模板下的训练科目顺序 */
const SESSION_PATTERN: Record<number, SessionType[]> = {
  3: ['zone2', 'strength', 'hybrid'],
  4: ['zone2', 'interval', 'strength', 'hybrid'],
  5: ['zone2', 'interval', 'strength', 'tempo', 'hybrid'],
  6: ['zone2', 'interval', 'strength', 'tempo', 'hybrid', 'recovery'],
  7: ['zone2', 'interval', 'strength', 'tempo', 'strength', 'hybrid', 'recovery'],
}

/** 计算各阶段周数，总和 = totalWeeks */
export function phaseWeeks(totalWeeks: number): { phase: Phase; count: number }[] {
  const taper = totalWeeks >= 10 ? 2 : 1
  const rest = totalWeeks - taper
  const base = Math.max(1, Math.round(rest * 0.5))
  const build = Math.max(1, Math.round(rest * 0.3))
  const specific = Math.max(1, rest - base - build)
  return [
    { phase: 'base', count: base },
    { phase: 'build', count: build },
    { phase: 'specific', count: specific },
    { phase: 'taper', count: taper },
  ]
}

export function weekPhase(week: number, totalWeeks: number): Phase {
  const pw = phaseWeeks(totalWeeks)
  let acc = 0
  for (const { phase, count } of pw) {
    acc += count
    if (week <= acc) return phase
  }
  return 'taper'
}

/** 模拟赛周：中段半程模拟 + 专项期后段半程模拟 + 减量前一周全程模拟 */
export function simulationWeeks(totalWeeks: number): { half: number[]; full: number } {
  const half1 = Math.max(2, Math.round(totalWeeks / 2))
  const half2 = Math.max(half1 + 1, Math.round(totalWeeks * 0.8))
  const cappedHalf2 = Math.min(half2, totalWeeks - 2)
  const full = Math.max(1, totalWeeks - 1)
  return { half: [...new Set([half1, cappedHalf2])], full }
}

function sessionFor(
  type: SessionType,
  phase: Phase,
  p: Profile,
  targetPaceSec: number,
  volumeScale: number,
): Session {
  const cap = p.sessionMinutes
  const clamp = (min: number) => Math.min(cap, Math.round(min))
  const pace = fmtPace(targetPaceSec)
  const easyPace = fmtPace(targetPaceSec * 1.18)

  switch (type) {
    case 'zone2':
      return {
        type,
        name: 'Zone 2 有氧跑',
        durationMin: clamp((phase === 'base' ? 60 : phase === 'taper' ? 35 : 50) * volumeScale),
        intensity: 'RPE 3–4 / 心率 Z2（能交谈）',
        details:
          phase === 'base'
            ? `轻松跑 ${easyPace} 或更慢，建立有氧底盘。最后 10 分钟可加 4×20 秒加速跑。`
            : `轻松跑 ${easyPace}，保持步频 170+。这是恢复与燃脂的主力课。`,
      }
    case 'interval': {
      const reps = phase === 'base' ? 6 : phase === 'build' ? 8 : 8
      const repPace = fmtMS(targetPaceSec - 5)
      return {
        type,
        name: `间歇跑 ${reps}×1000m`,
        durationMin: clamp(55 * volumeScale),
        intensity: 'RPE 8–9 / 心率 Z4–Z5',
        details: `热身 15 分钟后，${reps}×1000m @ ${repPace}/km（略快于目标配速 ${pace}），组间慢跑/走动 90 秒。冷身 10 分钟。`,
      }
    }
    case 'tempo':
      return {
        type,
        name: '节奏跑',
        durationMin: clamp(45 * volumeScale),
        intensity: 'RPE 7 / 心率 Z3–Z4',
        details: `热身 10 分钟后，连续 20–25 分钟 @ ${fmtMS(targetPaceSec + 10)}/km（乳酸门槛强度），冷身 10 分钟。`,
      }
    case 'strength':
      return {
        type,
        name: phase === 'specific' ? '力量训练 · 雪橇专项' : '力量训练 · 下肢+核心',
        durationMin: clamp(60 * volumeScale),
        intensity: 'RPE 7–8 / 中大重量',
        details:
          phase === 'specific'
            ? '雪橇推/拉模拟（重雪橇或阻力带冲刺推）4 组、负重弓步 3×20m、壶铃农夫行走 3×40m、墙球 3×15。'
            : '六角杠硬拉或深蹲 4×6、罗马尼亚硬拉 3×8、推雪橇/腿推 4 组、平板支撑+Pallof 抗旋核心 3 组。',
        mediaKeys:
          phase === 'specific'
            ? ['lunge-dumbbell', 'farmers', 'wallballs', 'squat-barbell-full']
            : ['deadlift-trap-bar', 'squat-barbell-full', 'rdl-barbell', 'leg-press-45', 'plank-front', 'pallof-press'],
      }
    case 'hybrid':
      return {
        type,
        name: 'HYROX 混合训练',
        durationMin: clamp((phase === 'taper' ? 40 : 60) * volumeScale),
        intensity: 'RPE 8 / 比赛节奏',
        details:
          phase === 'base'
            ? '4 轮：跑 800m → 立即做 1 个站点动作（SkiErg 250m / 波比跳远 10m / 墙球 20 次轮换）。练习“带着疲劳做动作”。'
            : '5 轮：跑 1000m @ 目标配速 ' +
              pace +
              ' → 立即做站点动作（划船 250m / 沙袋弓步 20m / 农夫行走 40m / 墙球 25 次轮换）。严格控制换项时间 ≤45 秒。',
        mediaKeys:
          phase === 'base'
            ? ['skierg', 'bbj', 'wallballs']
            : ['lunges', 'farmers', 'wallballs'],
      }
    case 'simulation':
      return {
        type,
        name: '模拟赛',
        durationMin: cap,
        intensity: 'RPE 9 / 比赛配速',
        details: '',
        mediaKeys: ['skierg', 'bbj', 'farmers', 'lunges', 'wallballs'],
      }
    case 'recovery':
      return {
        type,
        name: '恢复日 · 主动恢复',
        durationMin: 45,
        intensity: 'RPE 2 / 心率 Z1',
        details:
          '20–30 分钟轻松走或骑行（能唱歌的强度）+ 全身灵活性流程：猫牛式 ×10、世界最伟大拉伸 每侧 ×5、髋关节绕环 每向 ×8、踝关节活动 每侧 ×10；可选泡沫轴 8–10 分钟。详见卡片下方「拉伸与恢复」面板。',
      }
    case 'rest':
    default:
      return {
        type: 'rest',
        name: '完全休息',
        durationMin: 0,
        intensity: '—',
        details: '完全休息日。保证 7–9 小时睡眠，正常饮食补水。',
      }
  }
}

export function generatePlan(p: Profile, targetPaceSec: number, cuttingWeeks: number): WeekPlan[] {
  const n = p.weeksToRace
  const days = Math.max(3, Math.min(7, p.daysPerWeek))
  const pattern = DAY_PATTERN[days]
  const sessions = SESSION_PATTERN[days]
  const sims = simulationWeeks(n)
  const weeks: WeekPlan[] = []

  for (let w = 1; w <= n; w++) {
    const phase = weekPhase(w, n)
    const volumeScale = phase === 'taper' ? (w === n ? 0.5 : 0.7) : 1
    const isHalfSim = sims.half.includes(w)
    const isFullSim = sims.full === w

    const dayPlans: DayPlan[] = DAY_LABELS.map((label, di) => {
      const trainIdx = pattern.indexOf(di)
      if (trainIdx === -1) {
        return { dayLabel: label, isRest: true, session: sessionFor('rest', phase, p, targetPaceSec, 1) }
      }
      const type = sessions[trainIdx]
      // 模拟赛替换当周混合训练日（最后一个训练日）
      if ((isHalfSim || isFullSim) && trainIdx === pattern.length - 1) {
        const s = sessionFor('simulation', phase, p, targetPaceSec, 1)
        s.name = isFullSim ? '全程模拟赛（8×1km + 8 站点）' : '半程模拟赛（4×1km + 4 站点）'
        s.details = isFullSim
          ? `按比赛流程完整演练：8 轮「1km 跑 @ ${fmtPace(targetPaceSec)} + 站点」。记录每段用时与 Roxzone，检验配速策略。`
          : `4 轮「1km 跑 @ ${fmtPace(targetPaceSec)} + 站点（SkiErg/推雪橇/波比跳远/划船）」。目标：找出最弱环节，验证装备与补给。`
        return { dayLabel: label, isRest: false, session: s }
      }
      return { dayLabel: label, isRest: false, session: sessionFor(type, phase, p, targetPaceSec, volumeScale) }
    })

    let note: string | null = null
    if (cuttingWeeks > 0 && w <= cuttingWeeks) {
      note = '减重窗口期：蛋白质 1.6–2.2 g/kg/天，热量缺口 ≤500 kcal/天，训练前后优先补充碳水与蛋白。'
    } else if (phase === 'taper') {
      note = '减量期：训练量下降但保持强度，多睡眠、补碳水，比赛前 48 小时不再做大强度。'
    }

    weeks.push({
      week: w,
      phase,
      phaseLabel: PHASE_LABEL[phase],
      note,
      days: dayPlans,
    })
  }
  return weeks
}

export function sessionKey(week: number, dayIndex: number): string {
  return `w${week}-d${dayIndex}`
}
