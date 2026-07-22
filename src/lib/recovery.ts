// 拉伸与恢复训练库（纯数据 + 纯函数）
import type { SessionType } from './plan'

export interface RoutineStep {
  id: string
  name: string
  /** 持续时间/组数，如 "每侧 30s × 2" */
  dose: string
  /** 一句要领 */
  tip: string
  /** 演示媒体 key（exerciseMedia），无匹配时省略 */
  mediaKey?: string
}

export interface Routine {
  id: string
  title: string
  durationMin: number
  steps: RoutineStep[]
}

/** 跑后拉伸（约 10 分钟） */
export const RUN_STRETCH: Routine = {
  id: 'run-stretch',
  title: '跑后拉伸',
  durationMin: 10,
  steps: [
    { id: 'rs-quad', mediaKey: 'stretch-quad-standing', name: '站姿股四头肌拉伸', dose: '每侧 30s × 2', tip: '骨盆微微后倾，膝盖指向地面，别塌腰' },
    { id: 'rs-hip', mediaKey: 'stretch-hip-flexor-lunge', name: '弓步髋屈肌拉伸', dose: '每侧 30s × 2', tip: '后腿膝盖着地，髋部向前下方推送' },
    { id: 'rs-ham', mediaKey: 'stretch-hamstring-seated', name: '坐姿腘绳肌拉伸', dose: '每侧 30s × 2', tip: '从髋部折叠而非弓背，脚尖回勾' },
    { id: 'rs-calf', mediaKey: 'stretch-calf-wall', name: '小腿靠墙拉伸', dose: '每侧 30s × 2', tip: '后脚跟着地，直膝与屈膝各一组（腓肠肌/比目鱼肌）' },
    { id: 'rs-glute', mediaKey: 'stretch-glute-figure4', name: '臀部 4 字拉伸', dose: '每侧 30s × 2', tip: '仰卧踝搭对侧膝，双手抱大腿拉向胸口' },
  ],
}

/** 力量/站点训练后放松（约 12 分钟） */
export const STRENGTH_ROLL: Routine = {
  id: 'strength-roll',
  title: '力量训练后放松',
  durationMin: 12,
  steps: [
    { id: 'sr-calf', name: '泡沫轴 · 小腿', dose: '每侧 45s', tip: '缓慢滚动，痛点停留 10 秒深呼吸' },
    { id: 'sr-quad', name: '泡沫轴 · 股四头肌', dose: '每侧 45s', tip: '俯卧撑位滚动，核心收紧别塌腰' },
    { id: 'sr-ham', name: '泡沫轴 · 腘绳肌', dose: '每侧 45s', tip: '双手撑地，从坐骨滚到膝窝上方' },
    { id: 'sr-lat', mediaKey: 'roller-lat', name: '泡沫轴 · 背阔肌', dose: '每侧 45s', tip: '侧卧臂过头顶，SkiErg/拉雪橇后重点' },
    { id: 'sr-thoracic', mediaKey: 'roller-back-thoracic', name: '泡沫轴 · 胸椎伸展', dose: '60s', tip: '双手抱头，逐节伸展上背部，腰不代偿' },
    { id: 'sr-rotator', name: '肩袖拉伸', dose: '每侧 30s × 2', tip: '毛巾背后上下牵引，墙球/划船后重点' },
    { id: 'sr-pec', mediaKey: 'stretch-chest-doorway', name: '胸肌门框拉伸', dose: '每侧 30s × 2', tip: '小臂贴门框身体前倾，雪橇推拉后重点' },
  ],
}

/** 混合训练/模拟赛后深度恢复（约 15–20 分钟） */
export const DEEP_RECOVERY: Routine = {
  id: 'deep-recovery',
  title: '深度恢复流程',
  durationMin: 18,
  steps: [
    { id: 'dr-walk', name: '慢走降温', dose: '3–5 min', tip: '心率降至 Z1 再开始静态拉伸' },
    { id: 'dr-legs', name: '泡沫轴 · 下肢全流程', dose: '6 min', tip: '小腿→腘绳肌→股四头肌→臀，每部位 45s' },
    { id: 'dr-upper', mediaKey: 'roller-lat', name: '泡沫轴 · 背阔肌 + 胸椎', dose: '3 min', tip: '配合深呼吸，逐段放松' },
    { id: 'dr-hip', mediaKey: 'stretch-hip-flexor-lunge', name: '弓步髋屈肌拉伸', dose: '每侧 45s × 2', tip: 'compromised running 后髋部最紧张的部位' },
    { id: 'rs-ham-d', mediaKey: 'stretch-hamstring-seated', name: '坐姿腘绳肌拉伸', dose: '每侧 45s × 2', tip: '从髋部折叠，呼吸时加深幅度' },
    { id: 'dr-glute', mediaKey: 'stretch-glute-figure4', name: '臀部 4 字拉伸', dose: '每侧 45s × 2', tip: '保持下背贴地' },
    { id: 'dr-breath', name: '仰卧呼吸练习', dose: '2 min', tip: '4-7-8 呼吸或箱式呼吸（4-4-4-4），激活副交感神经' },
  ],
}

/** 恢复日灵活性流程（约 15 分钟，配合 20–30 分钟轻松走/骑行） */
export const MOBILITY: Routine = {
  id: 'mobility',
  title: '全身灵活性流程',
  durationMin: 15,
  steps: [
    { id: 'mb-catcow', name: '猫牛式', dose: '×10', tip: '配合呼吸逐节活动脊柱，动作放慢' },
    { id: 'mb-world', mediaKey: 'world-greatest-stretch', name: '世界最伟大拉伸', dose: '每侧 ×5', tip: '弓步+肘触地+转体打开胸椎，一气呵成的全身动作' },
    { id: 'mb-hipcircle', name: '髋关节绕环', dose: '每方向 ×8', tip: '四点支撑位，膝盖画最大的圆' },
    { id: 'mb-ankle', mediaKey: 'ankle-circles', name: '踝关节活动', dose: '每侧 ×10', tip: '跪姿膝盖顶墙测试，脚跟不离地' },
    { id: 'mb-foam', mediaKey: 'roller-back-thoracic', name: '可选：泡沫轴全身', dose: '8–10 min', tip: '特别紧张的部位加做，轻松力度即可' },
  ],
}

/** 训练科目 → 对应恢复流程 */
export function routineForSession(type: SessionType): Routine {
  switch (type) {
    case 'zone2':
    case 'interval':
    case 'tempo':
      return RUN_STRETCH
    case 'strength':
      return STRENGTH_ROLL
    case 'hybrid':
    case 'simulation':
      return DEEP_RECOVERY
    case 'recovery':
    case 'rest':
    default:
      return MOBILITY
  }
}
