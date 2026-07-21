// 时间格式化与解析工具（纯函数）

/** 秒 → "m:ss"（如 245 → "4:05"） */
export function fmtMS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/** 秒 → "h:mm:ss"（如 4800 → "1:20:00"） */
export function fmtHMS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** 每公里配速：秒/km → "m:ss/km" */
export function fmtPace(secPerKm: number): string {
  return `${fmtMS(secPerKm)}/km`
}

/** 解析 "m:ss" 或 "h:mm:ss" → 秒；非法输入返回 null */
export function parseTime(text: string): number | null {
  const t = text.trim()
  if (!/^\d{1,2}(:\d{1,2}){1,2}$/.test(t)) return null
  const parts = t.split(':').map(Number)
  if (parts.some((n) => Number.isNaN(n))) return null
  if (parts.length === 2) {
    const [m, s] = parts
    if (s >= 60) return null
    return m * 60 + s
  }
  const [h, m, s] = parts
  if (m >= 60 || s >= 60) return null
  return h * 3600 + m * 60 + s
}

/** 带符号的差值显示，如 "+1:30" / "-0:45" */
export function fmtDelta(deltaSec: number): string {
  const sign = deltaSec > 0 ? '+' : deltaSec < 0 ? '-' : '±'
  return `${sign}${fmtMS(Math.abs(deltaSec))}`
}
