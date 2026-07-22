import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Flame,
  HeartPulse,
  Moon,
  UtensilsCrossed,
} from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { sessionKey, type SessionType, type WeekPlan } from '@/lib/plan'
import { fmtPace } from '@/lib/time'
import { SESSION_ZONE, type ZoneId } from '@/lib/heartrate'
import { routineForSession } from '@/lib/recovery'
import { ExerciseGif } from '@/components/ExerciseGif'
import { cn } from '@/lib/utils'

const TYPE_STYLE: Record<SessionType, { label: string; cls: string }> = {
  zone2: { label: '有氧', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/40' },
  interval: { label: '间歇', cls: 'bg-red-500/15 text-red-400 border-red-500/40' },
  tempo: { label: '节奏', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/40' },
  strength: { label: '力量', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/40' },
  hybrid: { label: '混合', cls: 'bg-primary/15 text-primary border-primary/40' },
  simulation: { label: '模拟赛', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40' },
  recovery: { label: '恢复', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  rest: { label: '休息', cls: 'bg-muted text-muted-foreground border-border' },
}

const PHASE_COLOR: Record<string, string> = {
  基础期: 'text-sky-400 border-sky-500/40',
  强化期: 'text-violet-400 border-violet-500/40',
  专项期: 'text-primary border-primary/40',
  减量期: 'text-emerald-400 border-emerald-500/40',
}

function weekProgress(week: WeekPlan, completed: Record<string, boolean>) {
  const train = week.days.filter((d) => !d.isRest)
  const done = week.days.filter((d, di) => !d.isRest && completed[sessionKey(week.week, di)])
  return { done: done.length, total: train.length }
}

export function PlanSection(app: AppStateHook) {
  const {
    plan,
    completed,
    toggleSession,
    paceSec,
    profile,
    cuttingWeeks,
    zoneResult,
    raceHR,
    stretchDone,
    toggleStretchStep,
    restingHr,
  } = app
  const [activeWeek, setActiveWeek] = useState(1)
  const [openStretch, setOpenStretch] = useState<string | null>(null)
  const week = plan[Math.min(activeWeek, plan.length) - 1]

  // 训练科目 → 心率区间文案
  const hrLine = (type: SessionType): string | null => {
    const mapping = SESSION_ZONE[type]
    if (!mapping) return null
    if (mapping === 'race') {
      return `比赛心率：跑步 ${raceHR.runRange[0]}–${raceHR.runRange[1]} / 站点 ≤${raceHR.stationRange[1]} bpm`
    }
    if (mapping === 'Z4-Z5') {
      const z4 = zoneResult.zones.find((z) => z.id === 'Z4')
      const z5 = zoneResult.zones.find((z) => z.id === 'Z5')
      if (!z4 || !z5) return null
      return `心率 Z4–Z5 · ${z4.range[0]}–${z5.range[1]} bpm`
    }
    const z = zoneResult.zones.find((x) => x.id === (mapping as ZoneId))
    return z ? `心率 ${z.id} · ${z.range[0]}–${z.range[1]} bpm` : null
  }

  const overall = useMemo(() => {
    let done = 0
    let total = 0
    for (const w of plan) {
      const p = weekProgress(w, completed)
      done += p.done
      total += p.total
    }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [plan, completed])

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            <CalendarDays className="mr-2 inline h-5 w-5 text-primary" />
            {profile.weeksToRace} 周训练计划
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            目标配速 {fmtPace(paceSec)} · 每周 {profile.daysPerWeek} 练 · 基础期 → 强化期 → 专项期 → 减量期。
            点击卡片标记完成。
          </p>
        </div>
        <div className="w-56">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>总进度</span>
            <span className="font-num text-primary">
              {overall.done}/{overall.total} 次 · {overall.pct}%
            </span>
          </div>
          <Progress value={overall.pct} className="h-2" />
        </div>
      </div>

      {/* 周选择 + 总览网格 */}
      <div className="flex flex-wrap gap-1.5">
        {plan.map((w) => {
          const p = weekProgress(w, completed)
          const pct = p.total ? p.done / p.total : 0
          const active = w.week === week.week
          return (
            <Button
              key={w.week}
              variant={active ? 'default' : 'outline'}
              size="sm"
              className={cn('font-num relative h-9 w-12 p-0', !active && pct === 1 && 'border-emerald-500/50 text-emerald-400')}
              onClick={() => setActiveWeek(w.week)}
            >
              W{w.week}
              <span
                className={cn(
                  'absolute inset-x-1 bottom-0.5 h-0.5 rounded-full',
                  pct === 0 ? 'bg-transparent' : pct === 1 ? 'bg-emerald-400' : 'bg-primary',
                )}
                style={pct > 0 && pct < 1 ? { width: `${pct * 80}%` } : undefined}
              />
            </Button>
          )
        })}
      </div>

      {/* 当前周 */}
      {week && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-num text-lg font-bold">第 {week.week} 周</h3>
            <Badge variant="outline" className={PHASE_COLOR[week.phaseLabel]}>
              {week.phaseLabel}
            </Badge>
            {cuttingWeeks > 0 && week.week <= cuttingWeeks && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-400">
                <UtensilsCrossed className="mr-1 h-3 w-3" />
                减重窗口期
              </Badge>
            )}
            <span className="font-num ml-auto text-xs text-muted-foreground">
              本周完成 {weekProgress(week, completed).done}/{weekProgress(week, completed).total}
            </span>
          </div>

          {week.note && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
              <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              {week.note}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {week.days.map((d, di) => {
              const key = sessionKey(week.week, di)
              const done = !!completed[key]
              const style = TYPE_STYLE[d.session.type]
              const hr = hrLine(d.session.type)
              const routine = routineForSession(d.session.type)
              const stretchList = stretchDone[key] ?? []
              const stretchOpen = openStretch === key
              return (
                <Card
                  key={key}
                  onClick={() => !d.isRest && toggleSession(key)}
                  className={cn(
                    'transition-colors',
                    d.isRest ? 'opacity-60' : 'cursor-pointer hover:border-primary/50',
                    done && 'border-emerald-500/50 bg-emerald-500/5',
                  )}
                >
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{d.dayLabel}</span>
                      {d.isRest ? (
                        <Circle className="h-4 w-4 text-muted-foreground/40" />
                      ) : done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <Badge variant="outline" className={cn('text-[11px]', style.cls)}>
                      {style.label}
                    </Badge>
                    <div className="text-sm font-bold leading-snug">{d.session.name}</div>
                    <div className="font-num text-xs text-muted-foreground">
                      {d.session.durationMin > 0 ? `${d.session.durationMin} 分钟` : '—'} · {d.session.intensity}
                    </div>
                    {hr && (
                      <div className="font-num flex items-center gap-1 text-[11px] text-red-400/90">
                        <HeartPulse className="h-3 w-3" />
                        {hr}
                      </div>
                    )}
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{d.session.details}</p>
                    {d.session.mediaKeys && d.session.mediaKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {d.session.mediaKeys.map((mk) => (
                          <ExerciseGif key={mk} mediaKey={mk} size={44} />
                        ))}
                      </div>
                    )}

                    {/* 拉伸与恢复面板 */}
                    <div className="border-t pt-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenStretch(stretchOpen ? null : key)}
                        className="flex w-full items-center justify-between text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <span className="flex items-center gap-1">
                          拉伸与恢复 · {routine.title}（约 {routine.durationMin} 分钟）
                        </span>
                        <span className="font-num flex items-center gap-1">
                          {stretchList.length}/{routine.steps.length}
                          {stretchOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </span>
                      </button>
                      {stretchOpen && (
                        <div className="mt-2 space-y-1.5">
                          {routine.steps.map((s) => {
                            const checked = stretchList.includes(s.id)
                            return (
                              <label key={s.id} className="flex cursor-pointer items-start gap-2">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleStretchStep(key, s.id)}
                                  className="mt-0.5 h-3.5 w-3.5"
                                />
                                {s.mediaKey && <ExerciseGif mediaKey={s.mediaKey} size={30} />}
                                <span className="flex-1">
                                  <span
                                    className={cn(
                                      'text-[11px] font-medium leading-tight',
                                      checked && 'text-muted-foreground line-through',
                                    )}
                                  >
                                    {s.name} <span className="font-num text-muted-foreground">{s.dose}</span>
                                  </span>
                                  <span className="block text-[10px] leading-snug text-muted-foreground/70">
                                    {s.tip}
                                  </span>
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 恢复指南 ── */}
      <Card>
        <CardContent className="flex flex-wrap items-start gap-x-8 gap-y-2 p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Moon className="h-4 w-4 text-sky-400" />
            恢复指南
          </div>
          <ul className="flex-1 space-y-1 text-xs leading-relaxed text-muted-foreground">
            <li>· 每晚睡眠 7–9 小时，比赛周优先保证睡眠而非加练。</li>
            <li>· 每周至少 1 个完全休息日；恢复日保持「轻松到能交谈」的强度。</li>
            <li>
              · 持续疲劳或静息心率比平时升高 &gt;5 bpm 时，主动减量 30–50%
              {restingHr !== null && `（你的基准静息心率：${restingHr} bpm，超过 ${restingHr + 5} bpm 即触发）`}
              {restingHr === null && '（可在上方「心率区间」中录入静息心率作为基准）'}。
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
