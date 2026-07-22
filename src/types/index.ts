// 全局类型定义

export type Sex = 'male' | 'female'
export type Division = 'open' | 'pro'

export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  /** 体脂率 %，可空（空则用 Deurenberg 公式估算） */
  bodyFatPct: number | null
  /** 当前 5km 最好成绩（秒） */
  fiveKmSec: number
  /** 当前 10km 成绩（秒），可空 */
  tenKmSec: number | null
  /** 每周可训练天数 3–7 */
  daysPerWeek: number
  /** 每次可训练时长（分钟） */
  sessionMinutes: number
  /** HYROX 组别：Open / Pro */
  division: Division
  /** 目标完赛时间（秒），默认 4800 = 1:20:00 */
  targetSec: number
  /** 距离比赛周数 6–16，默认 12 */
  weeksToRace: number
}

export type SegmentKind = 'run' | 'station' | 'roxzone'

export interface Segment {
  id: string
  kind: SegmentKind
  name: string
  /** 目标用时（秒） */
  targetSec: number
  /** 站点规格说明（随组别变化），跑步段为空 */
  spec?: string
  /** 滑杆范围 */
  min: number
  max: number
}

/** 训练完成状态：key = "w{week}-d{dayIndex}" */
export type CompletionMap = Record<string, boolean>

/** 营养偏好（用户可调） */
export interface NutritionPrefs {
  /** 每日热量缺口 kcal（0–750，默认 400；>500 时界面给出警告） */
  deficitKcal: number
  /** 蛋白质 g/kg 体重（1.6–2.2，默认 1.8） */
  proteinGPerKg: number
  /** 脂肪 g/kg 体重（0.8–1.0，默认 0.9） */
  fatGPerKg: number
}

export const DEFAULT_NUTRITION: NutritionPrefs = {
  deficitKcal: 400,
  proteinGPerKg: 1.8,
  fatGPerKg: 0.9,
}

/** 体重记录条目 */
export interface WeightEntry {
  /** ISO 日期 YYYY-MM-DD */
  date: string
  kg: number
}

/** 默认排除的食材（用户声明不吃牛羊肉；数据库中无羊肉项） */
export const DEFAULT_EXCLUDED_FOODS: string[] = ['beef']

/** 云同步元信息（token 永远不在 AppState 中，单独存 localStorage） */
export interface SyncInfo {
  gistId: string | null
  enabled: boolean
  lastSyncedAt: string | null
}

export const DEFAULT_SYNC: SyncInfo = {
  gistId: null,
  enabled: false,
  lastSyncedAt: null,
}

// ── Apple 健康数据（由 iOS 快捷指令推送到同一私密 Gist 的第二文件）──

export interface HealthWorkout {
  type: string
  start?: string
  minutes?: number
  avgHr?: number
  kcal?: number
}

export interface HealthDay {
  steps?: number
  activeKcal?: number
  restingHr?: number
  hrv?: number
  sleepHours?: number
  weightKg?: number
  workouts?: HealthWorkout[]
}

export interface HealthPayload {
  app: 'hyrox-bj-plan-health'
  updatedAt: string
  days: Record<string, HealthDay>
}

export interface HealthState {
  /** 最近一次拉取的健康数据（应用只拉取，永不推送该文件） */
  payload: HealthPayload | null
  lastPulledAt: string | null
  /** 已自动写入体重记录的日期（幂等防重） */
  appliedWeightDates: string[]
  /** 已自动打卡的训练 dayKey 列表（幂等防重） */
  autoLoggedWorkoutKeys: string[]
}

export const DEFAULT_HEALTH: HealthState = {
  payload: null,
  lastPulledAt: null,
  appliedWeightDates: [],
  autoLoggedWorkoutKeys: [],
}

export interface AppState {
  version: 7
  profile: Profile
  splits: Segment[]
  completed: CompletionMap
  nutrition: NutritionPrefs
  /** 饮食执行打卡：key = "m{week}-d{dayIndex}" */
  mealsDone: CompletionMap
  /** 饮食禁忌：被排除的食材 id 列表 */
  excludedFoods: string[]
  /** 体重记录 */
  weightLog: WeightEntry[]
  /** 计划开始日期（ISO）；null = 尚未设置 */
  planStartDate: string | null
  /** 比赛日清单勾选状态：key = 清单项 id */
  raceDayChecks: CompletionMap
  /** 用户自定义清单项：groupId → 条目标签列表 */
  customItems: Record<string, string[]>
  /** 起跑时间 "HH:MM"，默认 09:00 */
  raceStartTime: string
  /** 手动覆盖最大心率（bpm）；null = 使用公式估算 */
  hrMaxOverride: number | null
  /** 静息心率（bpm）；null = 未测量，区间按 %HRmax 计算 */
  restingHr: number | null
  /** 每日拉伸/恢复步骤完成：dayKey("w{n}-d{i}") → 已完成步骤 id 列表 */
  stretchDone: Record<string, string[]>
  /** 云同步元信息 */
  sync: SyncInfo
  /** Apple 健康数据 */
  health: HealthState
}

export const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 32,
  heightCm: 176,
  weightKg: 78,
  bodyFatPct: null,
  fiveKmSec: 23 * 60, // 23:00
  tenKmSec: null,
  daysPerWeek: 5,
  sessionMinutes: 90,
  division: 'open',
  targetSec: 4800, // 1:20:00
  weeksToRace: 12,
}
