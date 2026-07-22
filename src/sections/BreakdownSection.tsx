import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { Minus, Plus, RotateCcw, Target } from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { defaultSplits, totalSeconds } from '@/lib/hyrox'
import { estimateSegmentSec, type GapItem } from '@/lib/raceModel'
import { fmtHMS, fmtMS, fmtDelta } from '@/lib/time'
import { ExerciseGif } from '@/components/ExerciseGif'
import { cn } from '@/lib/utils'

/** 站点 → 演示媒体（sledpush/sledpull/row 数据集无匹配，保持纯文本） */
const STATION_MEDIA: Record<string, string> = {
  skierg: 'skierg',
  bbj: 'bbj',
  farmers: 'farmers',
  lunges: 'lunges',
  wallballs: 'wallballs',
}

const SHORT_NAME: Record<string, string> = {
  skierg: 'SkiErg',
  sledpush: '推雪橇',
  sledpull: '拉雪橇',
  bbj: '波比跳远',
  row: '划船',
  farmers: '农夫行走',
  lunges: '沙袋弓步',
  wallballs: '墙球',
}

export function BreakdownSection(app: AppStateHook) {
  const { profile, splits, updateSegment, estimate } = app
  const total = totalSeconds(splits)
  const delta = total - profile.targetSec
  const ok = delta <= 0

  // 站点目标 vs 当前预估差距
  const gaps: GapItem[] = useMemo(
    () =>
      splits
        .filter((s) => s.kind === 'station')
        .map((s) => ({
          id: s.id,
          name: SHORT_NAME[s.id] ?? s.name,
          targetSec: s.targetSec,
          estimateSec: estimate.stationSecs[s.id] ?? s.targetSec,
          gapSec: (estimate.stationSecs[s.id] ?? s.targetSec) - s.targetSec,
        }))
        .sort((a, b) => b.gapSec - a.gapSec),
    [splits, estimate],
  )
  const top3 = new Set(gaps.slice(0, 3).map((g) => g.id))

  const resetSplits = () => {
    app.replaceSplits(defaultSplits(profile.sex, profile.division))
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            <Target className="mr-2 inline h-5 w-5 text-primary" />
            {fmtHMS(profile.targetSec)} 目标分解
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            拖动滑杆或点按 ± 微调每一段，总计实时重算。
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={cn('font-num text-3xl font-extrabold', ok ? 'text-emerald-400' : 'text-red-400')}>
              {fmtHMS(total)}
            </div>
            <div className={cn('font-num text-xs', ok ? 'text-emerald-400/80' : 'text-red-400/80')}>
              与目标差 {fmtDelta(delta)} {ok ? '· 达标' : '· 超出'}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetSplits}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            恢复默认
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 分段调节表 */}
        <Card className="lg:max-h-[560px] lg:overflow-y-auto">
          <CardContent className="divide-y p-0">
            {splits.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                {s.kind === 'station' && <ExerciseGif mediaKey={STATION_MEDIA[s.id]} size={28} />}
                <div className="w-40 shrink-0">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  {s.spec && (
                    <div className="truncate text-[11px] text-muted-foreground" title={s.spec}>
                      {s.spec}
                    </div>
                  )}
                </div>
                <Slider
                  className="flex-1"
                  value={[s.targetSec]}
                  min={s.min}
                  max={s.max}
                  step={5}
                  onValueChange={([v]) => updateSegment(s.id, v)}
                />
                <div className="flex w-28 shrink-0 items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateSegment(s.id, Math.max(s.min, s.targetSec - 5))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span
                    className={cn(
                      'font-num w-12 text-center text-sm font-bold',
                      s.kind === 'roxzone' ? 'text-amber-400' : s.kind === 'run' ? 'text-sky-400' : 'text-primary',
                    )}
                  >
                    {fmtMS(s.targetSec)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateSegment(s.id, Math.min(s.max, s.targetSec + 5))}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 目标 vs 当前预估 */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">站点：目标 vs 当前预估</CardTitle>
              <CardDescription>橙色高亮的三个站点是你当前差距最大的短板</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gaps} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(240 5% 60%)' }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(240 5% 60%)' }} tickFormatter={(v: number) => fmtMS(v)} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(240 6% 8%)',
                        border: '1px solid hsl(240 4% 18%)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number | string) => fmtMS(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="targetSec" name="目标用时" fill="hsl(240 5% 45%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="estimateSec" name="当前预估" radius={[3, 3, 0, 0]}>
                      {gaps.map((g) => (
                        <Cell
                          key={g.id}
                          fill={top3.has(g.id) ? 'hsl(18 100% 55%)' : 'hsl(18 60% 35%)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">你的三大短板 · 训练优先级</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {gaps.slice(0, 3).map((g, i) => (
                <div key={g.id} className="flex items-center gap-3">
                  <span className="font-num flex h-6 w-6 items-center justify-center rounded bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{g.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      目标 {fmtMS(g.targetSec)} · 当前预估 {fmtMS(g.estimateSec)}
                    </div>
                  </div>
                  <Badge variant="outline" className="font-num border-primary/50 text-primary">
                    差 {fmtDelta(g.gapSec)}
                  </Badge>
                </div>
              ))}
              <p className="pt-1 text-[11px] text-muted-foreground">
                跑步段当前预估约 {fmtMS(estimateSegmentSec(estimate, 'run1', 0))}/km（疲劳后），目标 {fmtMS(Math.round(splits.filter((s) => s.kind === 'run')[0]?.targetSec ?? 0))}/km。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
