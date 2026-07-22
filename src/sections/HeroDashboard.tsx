import { CalendarClock, Flag, Flame, Gauge, Scale, TrendingUp } from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { fmtHMS, fmtDelta } from '@/lib/time'
import { sessionKey } from '@/lib/plan'
import { diffDays, effectiveRaceDate, fmtCN, todayISO } from '@/lib/tracking'
import { cn } from '@/lib/utils'

function StatCard({
  icon,
  label,
  value,
  sub,
  accent = false,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent?: boolean
  tone?: 'ok' | 'warn' | 'bad'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 sm:p-5',
        accent && 'card-glow border-primary/50',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          'font-num mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl',
          accent && 'text-primary text-glow',
          tone === 'ok' && 'text-emerald-400',
          tone === 'warn' && 'text-amber-400',
          tone === 'bad' && 'text-red-400',
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  )
}

export function HeroDashboard(app: AppStateHook) {
  const { profile, estimate, feasibility, verdict, plan, completed, calTarget, planStartDate } = app
  const raceDate = effectiveRaceDate(profile, planStartDate)
  const daysLeft = raceDate ? Math.max(0, diffDays(todayISO(), raceDate)) : profile.weeksToRace * 7

  // 本周训练进度（第一周）
  const week1 = plan[0]
  const week1Sessions = week1 ? week1.days.filter((d) => !d.isRest) : []
  const week1Done = week1Sessions.filter(
    (d) => completed[sessionKey(1, week1.days.indexOf(d))],
  ).length

  // 总进度
  const allKeys = plan.flatMap((w) =>
    w.days.map((d, di) => ({ key: sessionKey(w.week, di), rest: d.isRest })),
  )
  const trainKeys = allKeys.filter((k) => !k.rest)
  const doneTotal = trainKeys.filter((k) => completed[k.key]).length
  const overallPct = trainKeys.length ? Math.round((doneTotal / trainKeys.length) * 100) : 0

  const gap = estimate.totalSec - profile.targetSec
  const gapTone = gap <= 0 ? 'ok' : gap <= 300 ? 'warn' : 'bad'

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label="距离比赛"
          value={`${daysLeft} 天`}
          sub={raceDate ? `比赛日 ${fmtCN(raceDate)}` : `${profile.weeksToRace} 周 · 北京站`}
        />
        <StatCard
          icon={<Flag className="h-3.5 w-3.5" />}
          label="目标完赛时间"
          value={fmtHMS(profile.targetSec)}
          sub={`${profile.division === 'open' ? 'Open' : 'Pro'} 组 · ${profile.sex === 'male' ? '男子' : '女子'}`}
          accent
        />
        <StatCard
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="当前预估完赛"
          value={fmtHMS(estimate.totalSec)}
          sub={`差距 ${fmtDelta(gap)} · ${feasibility.label}`}
          tone={gapTone}
        />
        <StatCard
          icon={<Scale className="h-3.5 w-3.5" />}
          label="体重策略"
          value={verdict.needCut ? `需减 ${verdict.lossKg.toFixed(1)} kg` : '无需减重'}
          sub={
            verdict.needCut
              ? `目标 ${verdict.targetWeight.toFixed(1)} kg · ${verdict.feasibleBeforeRace ? '赛前可完成' : '周期偏紧'}`
              : '以提升能力为主'
          }
          tone={verdict.needCut ? (verdict.feasibleBeforeRace ? 'warn' : 'bad') : 'ok'}
        />
        <StatCard
          icon={<Flame className="h-3.5 w-3.5" />}
          label="每日热量目标"
          value={`${calTarget.kcal.toLocaleString()} kcal`}
          sub={calTarget.mode === 'cut' ? `减重 · 缺口 ${calTarget.appliedDeficit} kcal` : '维持体重'}
        />
        <StatCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="本周训练进度"
          value={`${week1Done}/${week1Sessions.length}`}
          sub={`全计划完成 ${overallPct}%（${doneTotal}/${trainKeys.length} 次）`}
        />
      </div>
    </section>
  )
}
