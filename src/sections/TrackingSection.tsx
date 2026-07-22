import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from 'recharts'
import {
  Activity,
  CalendarRange,
  CheckCircle2,
  Flame,
  Scale,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sessionKey } from '@/lib/plan'
import { mealKey } from '@/lib/nutrition'
import {
  addDays,
  currentStreak,
  dayState,
  diffDays,
  effectiveRaceDate,
  locateDay,
  safeRateRange,
  sortWeightLog,
  targetWeightAtDate,
  todayISO,
  weekSummary,
  weeklyRateKg,
  weightDeviation,
  type DayCell,
} from '@/lib/tracking'
import { cn } from '@/lib/utils'

const CELL_STYLE: Record<string, string> = {
  full: 'bg-emerald-500',
  partial: 'bg-amber-500/70',
  none: 'bg-muted',
  future: 'bg-muted/30',
  outofplan: 'bg-transparent',
}

export function TrackingSection(app: AppStateHook) {
  const {
    profile,
    verdict,
    plan,
    completed,
    mealsDone,
    weightLog,
    addWeightEntry,
    removeWeightEntry,
    planStartDate,
    setPlanStartDate,
    updateProfile,
    trajectory,
  } = app

  const today = todayISO()
  const start = planStartDate ?? today
  const raceDate = effectiveRaceDate(profile, planStartDate)
  const daysToRace = raceDate ? diffDays(today, raceDate) : null
  const currentWeekNum = Math.max(1, Math.min(plan.length, Math.floor(diffDays(start, today) / 7) + 1))
  // 有效周数口径的 profile（轨迹/偏差与计划长度一致）
  const effProfile = useMemo(() => ({ ...profile, weeksToRace: plan.length }), [profile, plan.length])

  const [entryDate, setEntryDate] = useState(today)
  const [entryKg, setEntryKg] = useState('')

  const sorted = useMemo(() => sortWeightLog(weightLog), [weightLog])
  const latest = sorted.length ? sorted[sorted.length - 1] : null

  // ── 体重图表数据（轨迹由 hook 按有效周数派生）──
  const actualPoints = useMemo(
    () =>
      sorted.map((e) => ({
        week: Math.round((diffDays(start, e.date) / 7) * 100) / 100,
        actual: e.kg,
      })),
    [sorted, start],
  )

  // ── 偏差与速率 ──
  const deviation = useMemo(() => {
    if (!latest) return null
    const target = targetWeightAtDate(effProfile, verdict, start, latest.date)
    return weightDeviation(Math.round((latest.kg - target) * 10) / 10)
  }, [latest, effProfile, verdict, start])

  const rate = useMemo(() => weeklyRateKg(weightLog), [weightLog])
  const [safeLo, safeHi] = safeRateRange(latest?.kg ?? profile.weightKg)

  // ── 执行统计 ──
  const exec = useMemo(() => {
    let trainDone = 0
    let trainTotal = 0
    let mealDoneCount = 0
    let mealTotal = 0
    for (const w of plan) {
      w.days.forEach((d, di) => {
        if (!d.isRest) {
          trainTotal++
          if (completed[sessionKey(w.week, di)]) trainDone++
        }
        mealTotal++
        if (mealsDone[mealKey(w.week, di)]) mealDoneCount++
      })
    }
    return {
      trainDone,
      trainTotal,
      trainPct: trainTotal ? Math.round((trainDone / trainTotal) * 100) : 0,
      mealDone: mealDoneCount,
      mealTotal,
      mealPct: mealTotal ? Math.round((mealDoneCount / mealTotal) * 100) : 0,
      streak: currentStreak(start, plan, completed, mealsDone, today),
    }
  }, [plan, completed, mealsDone, start, today])

  // ── 热力图（最近 84 天，GitHub 风格：列=周，行=星期）──
  const heatmap = useMemo<DayCell[]>(() => {
    const cells: DayCell[] = []
    for (let i = 83; i >= 0; i--) {
      const date = addDays(today, -i)
      const loc = locateDay(start, plan.length, date)
      const isFuture = date > today
      const state = loc
        ? dayState(loc, plan[loc.week - 1], completed, mealsDone, isFuture)
        : 'outofplan'
      cells.push({ date, state, week: loc?.week ?? 0, dayIndex: loc?.dayIndex ?? 0 })
    }
    return cells
  }, [today, start, plan, completed, mealsDone])

  // ── 本周总结 ──
  const summary = useMemo(() => {
    const w = plan[currentWeekNum - 1]
    if (!w) return null
    return weekSummary(w, completed, mealsDone, weightLog, addDays(start, (currentWeekNum - 1) * 7), verdict.needCut)
  }, [plan, currentWeekNum, completed, mealsDone, weightLog, start, verdict.needCut])

  const submitWeight = () => {
    const kg = Number(entryKg)
    if (!entryDate || Number.isNaN(kg) || kg < 30 || kg > 250) return
    addWeightEntry({ date: entryDate, kg: Math.round(kg * 10) / 10 })
    setEntryKg('')
  }

  const devColor =
    deviation?.status === 'ok'
      ? 'text-emerald-400'
      : deviation?.status === 'slow'
        ? 'text-amber-400'
        : 'text-red-400'

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          <Activity className="mr-2 inline h-5 w-5 text-primary" />
          体重与执行追踪
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          记录体重、对照目标轨迹，并汇总训练与饮食的执行情况。
        </p>
      </div>

      {/* ── 计划日期 + 记录输入 ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="h-4 w-4 text-primary" />
              计划周期
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">计划开始日期</Label>
                <Input
                  type="date"
                  value={start}
                  max={today}
                  onChange={(e) => e.target.value && setPlanStartDate(e.target.value)}
                  className="font-num h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">比赛日期（可编辑）</Label>
                <Input
                  type="date"
                  value={profile.raceDate ?? ''}
                  min={today}
                  onChange={(e) => updateProfile({ raceDate: e.target.value || null })}
                  className="font-num h-9"
                />
              </div>
            </div>
            {!profile.raceDate && (
              <p className="text-[11px] text-muted-foreground">未设置比赛日期，按「开始日期 + 周数」推算。</p>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-2.5">
                <div className="text-[11px] text-muted-foreground">距比赛</div>
                <div className="font-num mt-0.5 font-bold text-primary">
                  {daysToRace !== null ? `${Math.max(0, daysToRace)} 天` : '—'}
                </div>
              </div>
              <div className="rounded-lg border p-2.5">
                <div className="text-[11px] text-muted-foreground">当前进度</div>
                <div className="font-num mt-0.5 font-bold">
                  第 {currentWeekNum} / {plan.length} 周
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 体重录入 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-primary" />
              记录体重
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">日期</Label>
                <Input
                  type="date"
                  value={entryDate}
                  max={today}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="font-num h-9"
                />
              </div>
              <div className="w-28 space-y-1.5">
                <Label className="text-xs text-muted-foreground">体重 kg</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder={String(profile.weightKg)}
                  value={entryKg}
                  onChange={(e) => setEntryKg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitWeight()}
                  className="font-num h-9"
                />
              </div>
              <Button onClick={submitWeight} className="h-9">
                记录
              </Button>
            </div>
            {/* 条目列表（最新 14 条，可滚动） */}
            <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
              {[...sorted].reverse().slice(0, 14).map((e) => (
                <div key={e.date} className="group flex items-center justify-between rounded border px-2 py-1 text-xs">
                  <span className="font-num text-muted-foreground">{e.date}</span>
                  <span className="font-num font-bold">{e.kg.toFixed(1)} kg</span>
                  <button
                    onClick={() => removeWeightEntry(e.date)}
                    className="text-muted-foreground/50 transition-colors hover:text-red-400"
                    aria-label={`删除 ${e.date}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {sorted.length === 0 && (
                <p className="py-2 text-center text-xs text-muted-foreground">暂无记录，输入今日体重开始追踪</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 偏差分析 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">偏差分析</CardTitle>
            <CardDescription>最新体重 vs 目标轨迹</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {deviation && latest ? (
              <>
                <div className="flex items-end gap-3">
                  <div className={cn('font-num text-2xl font-extrabold', devColor)}>{deviation.label}</div>
                  <div className="font-num pb-0.5 text-sm text-muted-foreground">
                    偏差 {deviation.diffKg > 0 ? '+' : ''}
                    {deviation.diffKg.toFixed(1)} kg
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{deviation.detail}</p>
                <div className="rounded-lg border p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">7 日体重速率</span>
                    {rate !== null ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-num',
                          verdict.needCut
                            ? rate <= -safeLo && rate >= -safeHi
                              ? 'border-emerald-500/50 text-emerald-400'
                              : rate < -safeHi
                                ? 'border-red-500/50 text-red-400'
                                : 'border-amber-500/50 text-amber-400'
                            : Math.abs(rate) <= safeLo
                              ? 'border-emerald-500/50 text-emerald-400'
                              : 'border-amber-500/50 text-amber-400',
                        )}
                      >
                        {rate > 0 ? '+' : ''}
                        {rate.toFixed(2)} kg/周
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">记录 ≥3 天后可用</span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    安全范围：{verdict.needCut ? `−${safeHi.toFixed(2)} ~ −${safeLo.toFixed(2)}` : `±${safeLo.toFixed(2)}`} kg/周（体重 0.5%–0.75%）
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">记录第一条体重后自动生成偏差分析。</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 体重曲线 vs 目标轨迹 ── */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">体重曲线 vs 目标轨迹</CardTitle>
          <CardDescription>
            {verdict.needCut ? '虚线为目标减重轨迹（计划起点 → 比赛日）' : '维持模式：目标为当前体重 ±0.5 kg 维持带'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                <XAxis
                  type="number"
                  dataKey="week"
                  domain={[0, plan.length]}
                  tick={{ fontSize: 11, fill: 'hsl(240 5% 60%)' }}
                  tickFormatter={(v: number) => (v === 0 ? '开始' : v === plan.length ? '比赛' : `W${v}`)}
                />
                <YAxis
                  type="number"
                  domain={['dataMin - 1.5', 'dataMax + 1.5']}
                  tick={{ fontSize: 11, fill: 'hsl(240 5% 60%)' }}
                  unit="kg"
                  width={64}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(240 6% 8%)',
                    border: '1px solid hsl(240 4% 18%)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => `第 ${Number(v).toFixed(1)} 周`}
                  formatter={(v: number | string) => `${Number(v).toFixed(1)} kg`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {!verdict.needCut && (
                  <ReferenceArea
                    y1={profile.weightKg - 0.5}
                    y2={profile.weightKg + 0.5}
                    fill="hsl(160 80% 45%)"
                    fillOpacity={0.08}
                  />
                )}
                <Line
                  data={trajectory}
                  type="monotone"
                  dataKey="target"
                  name="目标轨迹"
                  stroke="hsl(18 100% 55%)"
                  strokeDasharray="6 4"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  data={actualPoints}
                  type="monotone"
                  dataKey="actual"
                  name="实际体重"
                  stroke="hsl(160 80% 45%)"
                  dot={{ r: 3, fill: 'hsl(160 80% 45%)' }}
                  strokeWidth={2.5}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── 执行看板 ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              执行看板（最近 12 周）
            </CardTitle>
            <CardDescription>每天一格：训练 + 饮食全部完成为绿色，部分完成为黄色</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="font-num text-2xl font-extrabold text-primary">{exec.trainPct}%</div>
                <div className="text-[11px] text-muted-foreground">
                  训练完成率 {exec.trainDone}/{exec.trainTotal}
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="font-num text-2xl font-extrabold text-sky-400">{exec.mealPct}%</div>
                <div className="text-[11px] text-muted-foreground">
                  饮食执行率 {exec.mealDone}/{exec.mealTotal}
                </div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="font-num flex items-center justify-center gap-1 text-2xl font-extrabold text-amber-400">
                  <Flame className="h-5 w-5" />
                  {exec.streak}
                </div>
                <div className="text-[11px] text-muted-foreground">连续全完成天数</div>
              </div>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="grid w-fit grid-flow-col grid-rows-7 gap-[3px]">
                {heatmap.map((c) => (
                  <div
                    key={c.date}
                    title={`${c.date} · ${c.state === 'full' ? '全完成' : c.state === 'partial' ? '部分完成' : c.state === 'future' ? '未来' : c.state === 'outofplan' ? '计划外' : '未完成'}`}
                    className={cn('h-3 w-3 rounded-[3px]', CELL_STYLE[c.state])}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500" /> 全完成</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-amber-500/70" /> 部分完成</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] bg-muted" /> 未完成</span>
            </div>
          </CardContent>
        </Card>

        {/* 周总结 */}
        {summary && (
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">本周总结 · 第 {summary.week} 周</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">训练</span>
                  <span className="font-num font-bold">
                    {summary.trainDone}/{summary.trainTotal} 完成
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">饮食</span>
                  <span className="font-num font-bold">
                    {summary.mealDone}/{summary.mealTotal} 执行
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">本周体重变化</span>
                  {summary.weightChange !== null ? (
                    <span
                      className={cn(
                        'font-num flex items-center gap-1 font-bold',
                        summary.weightChange < 0 ? 'text-emerald-400' : summary.weightChange > 0 ? 'text-amber-400' : '',
                      )}
                    >
                      {summary.weightChange < 0 ? (
                        <TrendingDown className="h-3.5 w-3.5" />
                      ) : summary.weightChange > 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : null}
                      {summary.weightChange > 0 ? '+' : ''}
                      {summary.weightChange.toFixed(1)} kg
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">记录 ≥2 次后可用</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
                <span className="font-bold text-primary">建议：</span>
                {summary.suggestion}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
