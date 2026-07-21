import { HeartPulse, Info } from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { estimateHRmax } from '@/lib/heartrate'
import { cn } from '@/lib/utils'

const ZONE_COLORS = [
  'hsl(240 5% 40%)', // Z1 灰
  'hsl(210 85% 55%)', // Z2 蓝
  'hsl(160 75% 45%)', // Z3 绿
  'hsl(40 95% 55%)', // Z4 黄
  'hsl(10 90% 55%)', // Z5 红
]

export function HeartRateSection(app: AppStateHook) {
  const {
    profile,
    hrmax,
    hrmaxIsOverride,
    hrMaxOverride,
    setHrMaxOverride,
    restingHr,
    setRestingHr,
    zoneResult,
    raceHR,
  } = app

  const tanaka = estimateHRmax(profile.age, profile.sex, 'tanaka')
  const gulati = estimateHRmax(profile.age, profile.sex, 'gulati')

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          <HeartPulse className="mr-2 inline h-5 w-5 text-primary" />
          心率区间 · 我的跑步最佳心率
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          基于 {zoneResult.methodLabel} 计算；训练计划中的跑步课已同步标注目标心率。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── 设置卡 ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">心率设置</CardTitle>
            <CardDescription>留空则使用公式估算</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">最大心率 HRmax</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    hrmaxIsOverride ? 'border-sky-500/50 text-sky-400' : 'border-amber-500/50 text-amber-400',
                  )}
                >
                  {hrmaxIsOverride ? '手动覆盖' : '估算值'}
                </Badge>
              </div>
              <div className="font-num mt-1 text-3xl font-extrabold text-primary">{hrmax} <span className="text-sm font-normal text-muted-foreground">bpm</span></div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {profile.sex === 'female'
                  ? `Gulati 女性公式 206−0.88×年龄 = ${gulati}；Tanaka 公式参考值 ${tanaka}`
                  : `Tanaka 公式 208−0.7×年龄 = ${tanaka}`}
              </p>
              <div className="mt-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">手动覆盖 HRmax（bpm，选填）</Label>
                <Input
                  type="number"
                  min={120}
                  max={220}
                  placeholder={String(tanaka)}
                  value={hrMaxOverride ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '') return setHrMaxOverride(null)
                    const v = Number(raw)
                    if (!Number.isNaN(v)) setHrMaxOverride(Math.min(220, Math.max(120, Math.round(v))))
                  }}
                  className="font-num h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">静息心率（bpm，选填）</Label>
              <Input
                type="number"
                min={35}
                max={110}
                placeholder="晨起测量，如 58"
                value={restingHr ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') return setRestingHr(null)
                  const v = Number(raw)
                  if (!Number.isNaN(v)) setRestingHr(Math.min(110, Math.max(35, Math.round(v))))
                }}
                className="font-num h-9"
              />
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                填写后区间自动切换为 Karvonen 储备心率法（更个体化）；晨起卧床测量最准。
              </p>
            </div>
            <Badge variant="outline" className="border-primary/50 text-primary">
              当前算法：{zoneResult.methodLabel}
            </Badge>
          </CardContent>
        </Card>

        {/* ── 五区间 ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">五大心率区间</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 区间彩条 */}
            <div className="flex h-10 w-full overflow-hidden rounded-lg">
              {zoneResult.zones.map((z, i) => (
                <div
                  key={z.id}
                  className="flex flex-1 flex-col items-center justify-center text-background"
                  style={{ backgroundColor: ZONE_COLORS[i] }}
                  title={`${z.id} ${z.name} ${z.range[0]}–${z.range[1]} bpm`}
                >
                  <span className="text-[10px] font-bold leading-none">{z.id}</span>
                  <span className="font-num text-[9px] leading-tight opacity-90">
                    {z.range[0]}–{z.range[1]}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {zoneResult.zones.map((z, i) => (
                <div key={z.id} className="rounded-lg border p-2.5" style={{ borderTopColor: ZONE_COLORS[i], borderTopWidth: 3 }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold">{z.id}</span>
                    <span className="font-num text-xs font-bold" style={{ color: ZONE_COLORS[i] }}>
                      {z.range[0]}–{z.range[1]}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-foreground/80">{z.name}</div>
                  <div className="mt-1 text-[10px] leading-snug text-muted-foreground">{z.purpose}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground/70">谈话测试：{z.talkTest}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground/50">{z.pctLabel}</div>
                </div>
              ))}
            </div>

            {/* 比赛心率策略 */}
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="text-sm font-bold text-primary">比赛心率策略 · HYROX 1:20 目标</div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="font-num text-lg font-extrabold text-sky-400">
                    {raceHR.runRange[0]}–{raceHR.runRange[1]}
                  </div>
                  <div className="text-[11px] text-muted-foreground">跑步段：Z3 上限 ~ Z4 下限（85–90% HRmax）</div>
                </div>
                <div>
                  <div className="font-num text-lg font-extrabold text-amber-400">
                    {raceHR.stationRange[0]}–{raceHR.stationRange[1]}
                  </div>
                  <div className="text-[11px] text-muted-foreground">站点段：允许冲到 Z4（90–95%）</div>
                </div>
                <div>
                  <div className="font-num text-lg font-extrabold text-red-400">
                    {raceHR.finishRange[0]}+
                  </div>
                  <div className="text-[11px] text-muted-foreground">最后 2km：全力（Z5）</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
