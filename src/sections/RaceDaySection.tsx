import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Flag,
  HeartPulse,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  GEAR_GROUPS,
  PACE_WARNING,
  buildPostRace,
  buildRaceRows,
  buildTimeline,
  customKey,
  readiness,
  timelineTime,
  type CheckGroup,
} from '@/lib/raceday'
import { fmtCN, raceDateOf } from '@/lib/tracking'
import { fmtMS } from '@/lib/time'
import { ExerciseGif } from '@/components/ExerciseGif'
import { cn } from '@/lib/utils'

/** 站点段 → 演示媒体（sledpush/sledpull/row 数据集无匹配，保持纯文本） */
const STATION_MEDIA: Record<string, string> = {
  skierg: 'skierg',
  bbj: 'bbj',
  farmers: 'farmers',
  lunges: 'lunges',
  wallballs: 'wallballs',
}

export function RaceDaySection(app: AppStateHook) {
  const {
    profile,
    splits,
    fueling,
    planStartDate,
    raceDayChecks,
    customItems,
    raceStartTime,
    toggleRaceCheck,
    addCustomItem,
    removeCustomItem,
    setRaceStartTime,
    resetRaceDay,
  } = app

  const raceDate = planStartDate ? raceDateOf(planStartDate, profile.weeksToRace) : null
  const preRaceCarbG = Math.round(profile.weightKg * 2)
  const timeline = useMemo(() => buildTimeline(preRaceCarbG), [preRaceCarbG])
  const postRace = useMemo(
    () => buildPostRace(fueling.postProteinG, fueling.postCarbG, fueling.waterMl),
    [fueling],
  )
  const raceRows = useMemo(() => buildRaceRows(splits), [splits])

  // ── 准备度统计（含自定义项）──
  const allIds = useMemo(() => {
    const ids: string[] = []
    for (const g of [...GEAR_GROUPS, postRace]) {
      ids.push(...g.items.map((i) => i.id))
      ids.push(...(customItems[g.id] ?? []).map((l) => customKey(g.id, l)))
    }
    ids.push(...timeline.map((t) => t.id))
    ids.push(...raceRows.map((r) => `race-${r.id}`))
    return ids
  }, [postRace, timeline, raceRows, customItems])
  const ready = readiness(allIds, raceDayChecks)

  const groupProgress = (g: CheckGroup) => {
    const ids = [...g.items.map((i) => i.id), ...(customItems[g.id] ?? []).map((l) => customKey(g.id, l))]
    const r = readiness(ids, raceDayChecks)
    return r
  }

  const [customDraft, setCustomDraft] = useState<Record<string, string>>({})

  const renderGroup = (g: CheckGroup) => {
    const r = groupProgress(g)
    const customs = customItems[g.id] ?? []
    return (
      <Card key={g.id}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{g.title}</CardTitle>
            <span className="font-num text-xs text-muted-foreground">
              {r.done}/{r.total}
            </span>
          </div>
          <Progress value={r.pct} className="h-1.5" />
        </CardHeader>
        <CardContent className="space-y-2">
          {g.items.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={!!raceDayChecks[item.id]}
                onCheckedChange={() => toggleRaceCheck(item.id)}
                className="mt-0.5"
              />
              <span className="flex-1">
                <span
                  className={cn(
                    'text-sm leading-tight',
                    raceDayChecks[item.id] && 'text-muted-foreground line-through',
                  )}
                >
                  {item.label}
                </span>
                {item.note && (
                  <span className="block text-[11px] leading-snug text-muted-foreground">{item.note}</span>
                )}
              </span>
            </label>
          ))}
          {customs.map((label) => {
            const key = customKey(g.id, label)
            return (
              <div key={key} className="flex items-start gap-2.5">
                <Checkbox
                  checked={!!raceDayChecks[key]}
                  onCheckedChange={() => toggleRaceCheck(key)}
                  className="mt-0.5"
                />
                <span
                  className={cn(
                    'flex-1 text-sm leading-tight',
                    raceDayChecks[key] && 'text-muted-foreground line-through',
                  )}
                >
                  {label}
                  <span className="ml-1 text-[10px] text-muted-foreground">(自定义)</span>
                </span>
                <button
                  onClick={() => removeCustomItem(g.id, label)}
                  className="text-muted-foreground/50 transition-colors hover:text-red-400"
                  aria-label={`删除 ${label}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
          <div className="flex gap-1.5 pt-1">
            <Input
              value={customDraft[g.id] ?? ''}
              onChange={(e) => setCustomDraft((d) => ({ ...d, [g.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addCustomItem(g.id, customDraft[g.id] ?? '')
                  setCustomDraft((d) => ({ ...d, [g.id]: '' }))
                }
              }}
              placeholder="自定义物品…"
              className="h-7 text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => {
                addCustomItem(g.id, customDraft[g.id] ?? '')
                setCustomDraft((d) => ({ ...d, [g.id]: '' }))
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            <ClipboardList className="mr-2 inline h-5 w-5 text-primary" />
            装备与比赛日清单
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {raceDate
              ? `HYROX 北京站 · ${fmtCN(raceDate)} · 起跑 ${raceStartTime}`
              : '请先在「体重与执行追踪」中设置计划开始日期'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-44">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>整体准备度</span>
              <span className="font-num text-primary">{ready.pct}%</span>
            </div>
            <Progress value={ready.pct} className="h-2" />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                重置清单
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认重置比赛日清单？</AlertDialogTitle>
                <AlertDialogDescription>
                  将清除全部勾选状态、自定义条目，并将起跑时间恢复为 09:00。此操作不影响其他模块数据。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={resetRaceDay}>确认重置</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {!planStartDate && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-amber-200/90">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            尚未设置计划开始日期——请先在上方「体重与执行追踪」模块中设置，比赛日期与时间线将自动推算。
          </CardContent>
        </Card>
      )}

      {/* ── 装备清单 ── */}
      <div className="space-y-3">
        <h3 className="text-base font-bold">装备清单</h3>
        <div className="grid gap-3 md:grid-cols-3">{GEAR_GROUPS.map(renderGroup)}</div>
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          携带物品与补给规则提示：各站赛事对自带补给、水壶与装备的规定可能不同，请以 HYROX 官方运动员手册与赛前通知为准；未明确允许的物品不要带入赛道区。
        </div>
      </div>

      <Separator />

      {/* ── 比赛日时间线 ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-bold">
            <CalendarClock className="mr-1.5 inline h-4 w-4 text-primary" />
            比赛日时间线
          </h3>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">起跑时间</span>
            <Input
              type="time"
              value={raceStartTime}
              onChange={(e) => e.target.value && setRaceStartTime(e.target.value)}
              className="font-num h-8 w-28"
            />
          </div>
        </div>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-0">
              {timeline.map((t, i) => (
                <label key={t.id} className="group flex cursor-pointer gap-4">
                  {/* 时间轴 */}
                  <div className="flex w-14 shrink-0 flex-col items-end">
                    <span className="font-num text-sm font-bold text-primary">
                      {timelineTime(raceStartTime, t.offsetMin)}
                    </span>
                    <span className="font-num text-[10px] text-muted-foreground">
                      {t.offsetMin > 0 ? `T-${t.offsetMin}min` : 'T-0'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Checkbox
                      checked={!!raceDayChecks[t.id]}
                      onCheckedChange={() => toggleRaceCheck(t.id)}
                      className="mt-0.5 rounded-full"
                    />
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-5">
                    <div
                      className={cn(
                        'text-sm font-bold',
                        raceDayChecks[t.id] && 'text-muted-foreground line-through',
                      )}
                    >
                      {t.title}
                    </div>
                    <div className="text-xs leading-relaxed text-muted-foreground">{t.detail}</div>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ── 赛中执行卡 ── */}
      <div className="space-y-3">
        <h3 className="text-base font-bold">
          <Flag className="mr-1.5 inline h-4 w-4 text-primary" />
          赛中执行卡
        </h3>
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs leading-relaxed text-red-200/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          {PACE_WARNING}
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {raceRows.map((r, i) => {
              const key = `race-${r.id}`
              const checked = !!raceDayChecks[key]
              return (
                <label key={key} className="flex cursor-pointer items-center gap-3 px-4 py-2.5">
                  <span className="font-num w-6 shrink-0 text-center text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <Checkbox checked={checked} onCheckedChange={() => toggleRaceCheck(key)} />
                  <ExerciseGif mediaKey={STATION_MEDIA[r.id]} size={34} />
                  <div className="w-44 shrink-0">
                    <div className={cn('truncate text-sm font-medium', checked && 'text-muted-foreground line-through')}>
                      {r.name}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'font-num w-14 shrink-0 text-sm font-bold',
                      r.id === 'roxzone' ? 'text-amber-400' : r.id.startsWith('run') ? 'text-sky-400' : 'text-primary',
                    )}
                  >
                    {fmtMS(r.targetSec)}
                  </span>
                  <span className="flex-1 text-xs leading-snug text-muted-foreground">{r.tip}</span>
                  {checked && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                </label>
              )
            })}
          </CardContent>
        </Card>
        <p className="text-[11px] text-muted-foreground">
          段落目标实时联动「目标分解」模块的当前设置；比赛中可按完成情况勾选。
        </p>
      </div>

      <Separator />

      {/* ── 赛后恢复 ── */}
      <div className="space-y-3">
        <h3 className="text-base font-bold">
          <HeartPulse className="mr-1.5 inline h-4 w-4 text-emerald-400" />
          赛后恢复清单
        </h3>
        <div className="grid gap-3 md:grid-cols-3">{renderGroup(postRace)}</div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        <Badge variant="outline" className="mr-1.5 text-[10px]">提示</Badge>
        能量胶数量与补给点、赛前碳水目标、赛后蛋白/碳水与饮水量均与「饮食计划」模块的数值联动。
      </div>
    </section>
  )
}
