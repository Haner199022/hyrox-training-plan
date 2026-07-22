import { useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import {
  Activity,
  BedDouble,
  CheckCircle2,
  Footprints,
  HeartPulse,
  Scale,
  Smartphone,
  Watch,
  Zap,
} from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  baseline14,
  isAutoLogged,
  lastNDays,
  latestDay,
  recoveryStatus,
  sortedDays,
} from '@/lib/health'
import { relativeTime } from '@/lib/gistSync'
import { cn } from '@/lib/utils'

export function HealthSection(app: AppStateHook) {
  const { health, syncInfo, state } = app
  const payload = health.payload

  const derived = useMemo(() => {
    if (!payload) return null
    const base = baseline14(payload)
    const latest = latestDay(payload)
    const recovery = recoveryStatus(payload)
    const last30 = lastNDays(payload, 30)
    const last14 = lastNDays(payload, 14)
    const hrChart = last30.map(([date, d]) => ({
      date: date.slice(5),
      静息心率: d.restingHr ?? null,
      HRV: d.hrv ?? null,
    }))
    const sleepChart = last14.map(([date, d]) => ({ date: date.slice(5), 睡眠: d.sleepHours ?? null }))
    const stepsChart = last14.map(([date, d]) => ({ date: date.slice(5), 步数: d.steps ?? null }))
    const workouts = sortedDays(payload)
      .flatMap(([date, d]) => (d.workouts ?? []).map((w) => ({ date, ...w })))
      .slice(-10)
      .reverse()
    return { base, latest, recovery, hrChart, sleepChart, stepsChart, workouts }
  }, [payload])

  // ── 未接入状态 ──
  if (!payload || !derived) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">
          <Watch className="mr-2 inline h-5 w-5 text-primary" />
          Apple 健康 · 动态追踪
        </h2>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <Smartphone className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-bold">尚未接入 Apple 健康数据</div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              数据由你 iPhone 上的快捷指令定时推送到同一个私密 Gist（文件 hyrox-health-data.json），
              应用每次打开时自动拉取：步数、活动千卡、静息心率、HRV、睡眠、体重与 Apple Watch 体能训练。
              {syncInfo.enabled
                ? '云同步已启用——在 iPhone 上配置好快捷指令后，数据会自动出现在这里。'
                : '请先在页面底部「数据管理」中启用云端同步，再配置 iPhone 快捷指令。'}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              配置方法见仓库 README 的「Apple 健康同步指南」：快捷指令读取 Apple 健康数据 →
              PATCH 到你的私密 Gist（仅追加健康文件，主数据文件不受影响）。
            </p>
          </CardContent>
        </Card>
      </section>
    )
  }

  const { base, latest, recovery, hrChart, sleepChart, stepsChart, workouts } = derived
  const d = latest?.day ?? {}
  const rhrDelta = d.restingHr !== undefined && base.restingHr !== null ? d.restingHr - base.restingHr : null
  const rhrAlert = rhrDelta !== null && rhrDelta > 5
  const sleepOk = d.sleepHours === undefined ? null : d.sleepHours >= 7 && d.sleepHours <= 9
  const recoveryColor =
    recovery?.level === 'good'
      ? 'border-emerald-500/40 text-emerald-400'
      : recovery?.level === 'mild'
        ? 'border-amber-500/40 text-amber-400'
        : 'border-red-500/40 text-red-400'

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            <Watch className="mr-2 inline h-5 w-5 text-primary" />
            Apple 健康 · 动态追踪
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            来自 iPhone 快捷指令 · 数据日 {latest?.date ?? '—'} · 上次拉取 {relativeTime(health.lastPulledAt)}
          </p>
        </div>
        {recovery && (
          <Badge variant="outline" className={cn('text-sm', recoveryColor)}>
            {recovery.label}
          </Badge>
        )}
      </div>

      {/* ── 今日卡片 ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Footprints className="h-3.5 w-3.5" /> 步数
            </div>
            <div className="font-num mt-1 text-xl font-bold">
              {d.steps !== undefined ? d.steps.toLocaleString() : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5" /> 活动千卡
            </div>
            <div className="font-num mt-1 text-xl font-bold">
              {d.activeKcal !== undefined ? `${Math.round(d.activeKcal)}` : '—'}
              <span className="text-xs font-normal text-muted-foreground"> kcal</span>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(rhrAlert && 'border-red-500/50')}>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HeartPulse className="h-3.5 w-3.5" /> 静息心率
            </div>
            <div className={cn('font-num mt-1 text-xl font-bold', rhrAlert && 'text-red-400')}>
              {d.restingHr ?? '—'}
              <span className="text-xs font-normal text-muted-foreground"> bpm</span>
            </div>
            <div className={cn('font-num text-[11px]', rhrAlert ? 'text-red-400' : 'text-muted-foreground')}>
              {rhrDelta !== null
                ? `基线 ${base.restingHr} · ${rhrDelta > 0 ? '+' : ''}${rhrDelta.toFixed(0)}${rhrAlert ? ' · 建议减量' : ''}`
                : '基线数据不足'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> HRV
            </div>
            <div className="font-num mt-1 text-xl font-bold">
              {d.hrv ?? '—'}
              <span className="text-xs font-normal text-muted-foreground"> ms</span>
            </div>
            <div className="font-num text-[11px] text-muted-foreground">
              {base.hrv !== null ? `基线 ${base.hrv}` : '基线数据不足'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BedDouble className="h-3.5 w-3.5" /> 睡眠
            </div>
            <div
              className={cn(
                'font-num mt-1 text-xl font-bold',
                sleepOk === false && 'text-amber-400',
                sleepOk === true && 'text-emerald-400',
              )}
            >
              {d.sleepHours !== undefined ? d.sleepHours.toFixed(1) : '—'}
              <span className="text-xs font-normal text-muted-foreground"> h</span>
            </div>
            <div className="text-[11px] text-muted-foreground">目标 7–9h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Scale className="h-3.5 w-3.5" /> 体重
            </div>
            <div className="font-num mt-1 text-xl font-bold">
              {d.weightKg !== undefined ? d.weightKg.toFixed(1) : '—'}
              <span className="text-xs font-normal text-muted-foreground"> kg</span>
            </div>
            <div className="text-[11px] text-muted-foreground">已自动写入体重曲线</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── 恢复状态 ── */}
        {recovery && (
          <Card className={cn('lg:col-span-1', recoveryColor)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">恢复状态</CardTitle>
              <CardDescription>静息心率 + HRV + 睡眠 综合判定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-lg font-extrabold">{recovery.label}</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{recovery.advice}</p>
              {recovery.details.length > 0 && (
                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                  {recovery.details.map((x) => (
                    <li key={x}>· {x}</li>
                  ))}
                </ul>
              )}
              {rhrAlert && (
                <p className="text-[11px] text-red-300/90">
                  静息心率升高 &gt;5 bpm 已触发减量提示——与「训练计划 → 恢复指南」规则一致。
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── 静息心率 + HRV 30 天 ── */}
        <Card className={recovery ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">近 30 天 · 静息心率 & HRV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hrChart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(240 5% 60%)' }} interval="preserveStartEnd" />
                  <YAxis yAxisId="rhr" domain={['dataMin - 3', 'dataMax + 3']} tick={{ fontSize: 10, fill: 'hsl(240 5% 60%)' }} />
                  <YAxis yAxisId="hrv" orientation="right" domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 10, fill: 'hsl(240 5% 60%)' }} width={44} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(240 6% 8%)', border: '1px solid hsl(240 4% 18%)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="rhr" type="monotone" dataKey="静息心率" stroke="hsl(10 90% 55%)" dot={false} strokeWidth={2} connectNulls />
                  <Line yAxisId="hrv" type="monotone" dataKey="HRV" stroke="hsl(160 75% 45%)" dot={false} strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── 睡眠 14 天 ── */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">近 14 天 · 睡眠</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sleepChart} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(240 5% 60%)' }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: 'hsl(240 5% 60%)' }} unit="h" />
                  <Tooltip
                    contentStyle={{ background: 'hsl(240 6% 8%)', border: '1px solid hsl(240 4% 18%)', borderRadius: 8, fontSize: 12 }}
                  />
                  <ReferenceLine y={7} stroke="hsl(160 75% 45%)" strokeDasharray="6 4" label={{ value: '7h', fill: 'hsl(160 75% 45%)', fontSize: 10 }} />
                  <Bar dataKey="睡眠" fill="hsl(210 85% 55%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ── 步数 14 天 ── */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base">近 14 天 · 步数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stepsChart} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(240 5% 60%)' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(240 5% 60%)' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(240 6% 8%)', border: '1px solid hsl(240 4% 18%)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="步数" fill="hsl(18 100% 55%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ── 训练记录 ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Apple Watch 训练记录</CardTitle>
            <CardDescription>最近 {workouts.length} 条</CardDescription>
          </CardHeader>
          <CardContent className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
            {workouts.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">暂无训练记录</p>
            )}
            {workouts.map((w, i) => {
              const auto = isAutoLogged(state, w.date)
              return (
                <div key={`${w.date}-${i}`} className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
                  <span className="font-num shrink-0 text-muted-foreground">{w.date.slice(5)}</span>
                  <span className="shrink-0 font-medium">{w.type}</span>
                  <span className="font-num flex-1 text-muted-foreground">
                    {w.minutes !== undefined ? `${Math.round(w.minutes)}min` : '—'}
                    {w.avgHr !== undefined ? ` · ${Math.round(w.avgHr)}bpm` : ''}
                    {w.kcal !== undefined ? ` · ${Math.round(w.kcal)}kcal` : ''}
                  </span>
                  {auto && (
                    <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      已计入计划
                    </span>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
