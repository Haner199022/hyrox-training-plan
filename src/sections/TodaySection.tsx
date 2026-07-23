import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Circle,
  Droplets,
  Flame,
  HeartPulse,
  MonitorSmartphone,
  Share,
  Smartphone,
  UtensilsCrossed,
} from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ExerciseGif } from '@/components/ExerciseGif'
import { sessionKey } from '@/lib/plan'
import { routineForSession } from '@/lib/recovery'
import { hrLineForSession } from '@/lib/heartrate'
import { dayTargets, mealKey, mealSlots, DAY_TYPE_LABEL, type DayType } from '@/lib/nutrition'
import { composeDayMeals, dayMealTotals, filterFromExcluded } from '@/lib/meals'
import { diffDays, effectiveRaceDate, locateDay, todayISO } from '@/lib/tracking'
import { simulationWeeks } from '@/lib/plan'
import { cn } from '@/lib/utils'

const DAY_TYPE_STYLE: Record<DayType, string> = {
  high: 'border-red-500/40 bg-red-500/10 text-red-400',
  normal: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  rest: 'border-border bg-muted text-muted-foreground',
}

const TYPE_STYLE: Record<string, string> = {
  zone2: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
  interval: 'bg-red-500/15 text-red-400 border-red-500/40',
  tempo: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  strength: 'bg-violet-500/15 text-violet-400 border-violet-500/40',
  hybrid: 'bg-primary/15 text-primary border-primary/40',
  simulation: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  recovery: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  rest: 'bg-muted text-muted-foreground border-border',
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function TodaySection(app: AppStateHook) {
  const {
    profile,
    plan,
    planStartDate,
    completed,
    toggleSession,
    mealsDone,
    toggleMeal,
    macros,
    excludedFoods,
    zoneResult,
    raceHR,
    fueling,
    verdict,
    stretchDone,
    toggleStretchStep,
  } = app

  const today = todayISO()
  const raceDate = effectiveRaceDate(profile, planStartDate)
  const daysLeft = raceDate ? Math.max(0, diffDays(today, raceDate)) : null
  const loc = planStartDate ? locateDay(planStartDate, plan.length, today) : null
  const week = loc ? plan[loc.week - 1] : null
  const dayPlan = loc && week ? week.days[loc.dayIndex] : null

  // ── 今日配餐（与营养模块同一生成器，计算量小，直接内联）──
  const todayMeals = (() => {
    if (!week || loc === null) return null
    const targets = dayTargets(week.days, macros)
    const t = targets[loc.dayIndex]
    const slots = mealSlots(t.type)
    const filter = filterFromExcluded(excludedFoods)
    const meals = composeDayMeals(t, slots, loc.dayIndex, filter)
    return { target: t, meals, totals: dayMealTotals(meals) }
  })()

  // ── 今日提醒（规则化，最多 3 行）──
  const reminders = (() => {
    const lines: { icon: 'fuel' | 'water' | 'ctx'; text: string }[] = []
    if (dayPlan && !dayPlan.isRest) {
      lines.push({
        icon: 'fuel',
        text: `补给：练前 2h 碳水 ${fueling.preCarbG[0]}–${fueling.preCarbG[1]}g · 练后 30min 蛋白 ${fueling.postProteinG}g + 碳水 ${fueling.postCarbG}g`,
      })
    }
    lines.push({
      icon: 'water',
      text: `饮水 ${fueling.waterMl[0].toLocaleString()}–${fueling.waterMl[1].toLocaleString()} ml${dayPlan && !dayPlan.isRest ? '，训练中每 30 分钟加 300–500 ml' : ''}`,
    })
    if (week?.phase === 'taper') {
      lines.push({ icon: 'ctx', text: '减量周：训练量下降但保持强度，多睡眠、补碳水，比赛前 48h 不做大强度。' })
    } else if (week) {
      const sims = simulationWeeks(plan.length)
      const upcoming = [...sims.half, sims.full]
        .filter((w) => w >= week.week)
        .sort((a, b) => a - b)[0]
      if (upcoming !== undefined && loc) {
        const daysToSim = (upcoming - week.week) * 7 + Math.max(0, 6 - loc.dayIndex)
        if (daysToSim > 0) lines.push({ icon: 'ctx', text: `距第 ${upcoming} 周模拟赛约 ${daysToSim} 天，本周注意装备与补给演练。` })
      }
      if (lines.length < 3 && verdict.needCut) {
        lines.push({ icon: 'ctx', text: `减重进行中：目标 ${verdict.targetWeight.toFixed(1)} kg，蛋白质吃够 ${macros.proteinG}g/天，缺口 ≤500 kcal。` })
      }
    }
    return lines.slice(0, 3)
  })()

  const standalone = isStandalone()
  const dayKey = loc ? sessionKey(loc.week, loc.dayIndex) : null
  const mKey = loc ? mealKey(loc.week, loc.dayIndex) : null
  const trainDone = dayKey ? !!completed[dayKey] : false
  const mealDone = mKey ? !!mealsDone[mKey] : false
  const routine = dayPlan ? routineForSession(dayPlan.session.type) : null
  const stretchList = dayKey ? (stretchDone[dayKey] ?? []) : []
  const hr = dayPlan ? hrLineForSession(dayPlan.session.type, zoneResult, raceHR) : null

  const weekDayCN = ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()]

  return (
    <section className="space-y-4">
      {/* 标题行 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="text-2xl font-extrabold tracking-tight">
          今日 <span className="text-primary">{today.slice(5).replace('-', '/')} 周{weekDayCN}</span>
        </h1>
        {daysLeft !== null && (
          <Badge className="font-num bg-primary/15 text-primary hover:bg-primary/20" variant="secondary">
            距比赛 {daysLeft} 天
          </Badge>
        )}
        {week && loc && (
          <Badge variant="outline" className="font-num">
            第 {loc.week} 周 · 第 {loc.dayIndex + 1} 天 · {week.phaseLabel}
          </Badge>
        )}
        <a
          href="#dashboard"
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          全部数据 <ChevronDown className="h-3.5 w-3.5" />
        </a>
      </div>

      {!loc || !dayPlan ? (
        <Card className="border-dashed">
          <CardContent className="p-5 text-sm text-muted-foreground">
            今天不在训练计划范围内。{raceDate && daysLeft === 0 ? '今天就是比赛日——加油！🏁' : '可在下方「体重与执行追踪」中调整计划开始日期。'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* ── 今日训练 ── */}
          <Card className={cn(trainDone && 'border-emerald-500/50 bg-emerald-500/5')}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">今日训练</span>
                  <Badge variant="outline" className={cn('text-[10px]', TYPE_STYLE[dayPlan.session.type])}>
                    {dayPlan.session.name.split('·')[0].trim()}
                  </Badge>
                </div>
                <button onClick={() => !dayPlan.isRest && dayKey && toggleSession(dayKey)} aria-label="标记今日训练完成">
                  {trainDone ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </div>
              <div className="text-base font-bold leading-snug">{dayPlan.session.name}</div>
              <div className="font-num text-xs text-muted-foreground">
                {dayPlan.session.durationMin > 0 ? `${dayPlan.session.durationMin} 分钟` : '—'} · {dayPlan.session.intensity}
              </div>
              {hr && (
                <div className="font-num flex items-center gap-1 text-xs text-red-400/90">
                  <HeartPulse className="h-3.5 w-3.5" />
                  {hr}
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">{dayPlan.session.details}</p>
              {dayPlan.session.mediaKeys && dayPlan.session.mediaKeys.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dayPlan.session.mediaKeys.map((mk) => (
                    <ExerciseGif key={mk} mediaKey={mk} size={48} />
                  ))}
                </div>
              )}
              {routine && (
                <div className="border-t pt-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      练后{routine.title}（约 {routine.durationMin} 分钟）
                    </span>
                    <span className="font-num">
                      {stretchList.length}/{routine.steps.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {routine.steps.map((s) => {
                      const checked = stretchList.includes(s.id)
                      return (
                        <label key={s.id} className="flex cursor-pointer items-center gap-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => dayKey && toggleStretchStep(dayKey, s.id)}
                            className="h-3.5 w-3.5"
                          />
                          {s.mediaKey && <ExerciseGif mediaKey={s.mediaKey} size={26} />}
                          <span
                            className={cn(
                              'flex-1 text-xs',
                              checked && 'text-muted-foreground line-through',
                            )}
                          >
                            {s.name} <span className="font-num text-muted-foreground">{s.dose}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 今日菜谱 ── */}
          {todayMeals && mKey && (
            <Card className={cn(mealDone && 'border-emerald-500/50 bg-emerald-500/5')}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">今日菜谱</span>
                    <Badge variant="outline" className={cn('text-[10px]', DAY_TYPE_STYLE[todayMeals.target.type])}>
                      {DAY_TYPE_LABEL[todayMeals.target.type]}
                    </Badge>
                  </div>
                  <button onClick={() => toggleMeal(mKey)} aria-label="标记今日饮食已执行">
                    {mealDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
                <div className="font-num text-xs">
                  目标 <span className="font-bold text-primary">{todayMeals.target.kcal.toLocaleString()} kcal</span>
                  {' · '}碳水 {todayMeals.target.carbG}g · 蛋白 {todayMeals.target.proteinG}g · 脂肪 {todayMeals.target.fatG}g
                </div>
                <div className="space-y-2 border-t pt-2">
                  {todayMeals.meals.map((m) => (
                    <div key={m.slotName}>
                      <div className="flex justify-between text-xs">
                        <span className={cn('font-medium', m.slotName === '训练后加餐' && 'text-primary')}>
                          {m.slotName}
                        </span>
                        <span className="font-num text-muted-foreground">{m.kcal} kcal</span>
                      </div>
                      <div className="text-[11px] leading-relaxed text-muted-foreground">
                        {m.items.map((i) => `${i.name} ${i.amountG}g`).join('、') || '—'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="font-num border-t pt-1.5 text-[11px] text-muted-foreground">
                  配餐合计 ≈ {todayMeals.totals.kcal.toLocaleString()} kcal · 碳 {todayMeals.totals.carbG}g / 蛋 {todayMeals.totals.proteinG}g / 脂 {todayMeals.totals.fatG}g
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── 今日提醒 ── */}
      {reminders.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="space-y-1 p-3.5">
            {reminders.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs leading-relaxed text-amber-200/90">
                {r.icon === 'fuel' && <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />}
                {r.icon === 'water' && <Droplets className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />}
                {r.icon === 'ctx' && <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
                {r.text}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── 添加到主屏幕提示（未安装时）── */}
      {!standalone && (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="flex items-start gap-3 p-3.5">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <div className="text-xs leading-relaxed text-sky-200/90">
              <span className="font-bold">添加到手机主屏幕</span>，每天打开即见今日训练与菜谱：
              <div className="mt-1 flex items-center gap-1 text-sky-200/80">
                iOS Safari：点 <Share className="inline h-3 w-3" /> 分享 →「添加到主屏幕」
              </div>
              <div className="flex items-center gap-1 text-sky-200/80">
                Android Chrome：菜单 <MonitorSmartphone className="inline h-3 w-3" /> →「安装应用 / 添加到主屏幕」
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
