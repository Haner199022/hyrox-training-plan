import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Activity, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { fmtHMS, fmtMS, fmtDelta, fmtPace, parseTime } from '@/lib/time'
import { cn } from '@/lib/utils'

/** mm:ss 文本输入框，失焦时校验并提交 */
function TimeInput({
  label,
  valueSec,
  onCommit,
  hint,
}: {
  label: string
  valueSec: number
  onCommit: (sec: number) => void
  hint?: string
}) {
  const [text, setText] = useState(fmtMS(valueSec))
  const [err, setErr] = useState(false)
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setErr(false)
        }}
        onFocus={() => setText(fmtMS(valueSec))}
        onBlur={() => {
          const sec = parseTime(text)
          if (sec == null || sec <= 0) {
            setErr(true)
            setText(fmtMS(valueSec))
          } else {
            onCommit(sec)
            setText(fmtMS(sec))
          }
        }}
        className={cn('font-num h-9', err && 'border-destructive')}
        placeholder="mm:ss"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function NumField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string
  value: number | null
  onCommit: (v: number | null) => void
  min: number
  max: number
  step?: number
  unit?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {unit ? `（${unit}）` : ''}
      </Label>
      <Input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder="选填"
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') return onCommit(null)
          const v = Number(raw)
          if (!Number.isNaN(v)) onCommit(Math.min(max, Math.max(min, v)))
        }}
        className="font-num h-9"
      />
    </div>
  )
}

export function ProfileSection(app: AppStateHook) {
  const { profile, updateProfile, verdict, estimate, feasibility, trajectory } = app
  const toneColor =
    feasibility.verdict === 'ontrack'
      ? 'text-emerald-400'
      : feasibility.verdict === 'challenging'
        ? 'text-amber-400'
        : 'text-red-400'

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          <Activity className="mr-2 inline h-5 w-5 text-primary" />
          个人状态 · 身体与目标
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          所有数据保存在本地浏览器，修改后下方全部分析与训练计划实时更新。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* ── 表单 ── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">基础信息</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">性别</Label>
              <Select
                value={profile.sex}
                onValueChange={(v) => updateProfile({ sex: v as 'male' | 'female' })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">男子</SelectItem>
                  <SelectItem value="female">女子</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">HYROX 组别</Label>
              <Select
                value={profile.division}
                onValueChange={(v) => updateProfile({ division: v as 'open' | 'pro' })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open 大众组</SelectItem>
                  <SelectItem value="pro">Pro 精英组</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumField label="年龄" value={profile.age} min={16} max={70} onCommit={(v) => v && updateProfile({ age: v })} />
            <NumField label="身高" unit="cm" value={profile.heightCm} min={140} max={210} onCommit={(v) => v && updateProfile({ heightCm: v })} />
            <NumField label="体重" unit="kg" value={profile.weightKg} min={40} max={160} step={0.5} onCommit={(v) => v && updateProfile({ weightKg: v })} />
            <NumField label="体脂率" unit="%，选填" value={profile.bodyFatPct} min={4} max={50} step={0.5} onCommit={(v) => updateProfile({ bodyFatPct: v })} />
            <TimeInput
              label="当前 5km 最好成绩"
              valueSec={profile.fiveKmSec}
              onCommit={(s) => updateProfile({ fiveKmSec: s })}
              hint="格式 mm:ss，如 22:30"
            />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">当前 10km 成绩（选填）</Label>
              <Input
                className="font-num h-9"
                placeholder="mm:ss"
                defaultValue={profile.tenKmSec ? fmtMS(profile.tenKmSec) : ''}
                onBlur={(e) => {
                  const t = e.target.value.trim()
                  if (!t) return updateProfile({ tenKmSec: null })
                  const sec = parseTime(t)
                  if (sec && sec > 0) updateProfile({ tenKmSec: sec })
                }}
              />
            </div>
            <TimeInput
              label="目标完赛时间"
              valueSec={profile.targetSec}
              onCommit={(s) => updateProfile({ targetSec: Math.max(3000, Math.min(9000, s)) })}
              hint="默认 80:00（1:20:00）"
            />
            <div className="col-span-2 space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">每周可训练天数</Label>
                <span className="font-num text-sm font-bold text-primary">{profile.daysPerWeek} 天</span>
              </div>
              <Slider
                value={[profile.daysPerWeek]}
                min={3}
                max={7}
                step={1}
                onValueChange={([v]) => updateProfile({ daysPerWeek: v })}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">每次可训练时长</Label>
                <span className="font-num text-sm font-bold text-primary">{profile.sessionMinutes} 分钟</span>
              </div>
              <Slider
                value={[profile.sessionMinutes]}
                min={45}
                max={150}
                step={5}
                onValueChange={([v]) => updateProfile({ sessionMinutes: v })}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">距离比赛周数</Label>
                <span className="font-num text-sm font-bold text-primary">{profile.weeksToRace} 周</span>
              </div>
              <Slider
                value={[profile.weeksToRace]}
                min={6}
                max={16}
                step={1}
                onValueChange={([v]) => updateProfile({ weeksToRace: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── 派生分析 ── */}
        <div className="space-y-4 lg:col-span-3">
          {/* 身体指标 */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">BMI</div>
                <div className="font-num mt-1 text-2xl font-bold">{verdict.bmi.toFixed(1)}</div>
                <Badge
                  variant="outline"
                  className={cn(
                    'mt-1',
                    verdict.bmiClass.tone === 'ok' && 'border-emerald-500/50 text-emerald-400',
                    verdict.bmiClass.tone === 'warn' && 'border-amber-500/50 text-amber-400',
                    verdict.bmiClass.tone === 'bad' && 'border-red-500/50 text-red-400',
                  )}
                >
                  {verdict.bmiClass.label}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">
                  体脂率{verdict.bfIsEstimate && <span className="ml-1 text-amber-400">(估算值)</span>}
                </div>
                <div className="font-num mt-1 text-2xl font-bold">{verdict.effectiveBfPct.toFixed(1)}%</div>
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                  {verdict.bfIsEstimate ? 'Deurenberg 公式估算' : '用户实测输入'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">去脂体重</div>
                <div className="font-num mt-1 text-2xl font-bold">{verdict.leanMass.toFixed(1)} kg</div>
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">肌肉、骨骼与水分</p>
              </CardContent>
            </Card>
          </div>

          {/* 减重判定 */}
          <Card className={cn(verdict.needCut && 'border-amber-500/40')}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {verdict.needCut ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                {verdict.needCut ? '建议减重' : '不需要减重 · 以提升能力为主'}
              </CardTitle>
              {verdict.needCut && (
                <CardDescription>{verdict.reasons.join('；')}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {verdict.needCut ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <div className="text-xs text-muted-foreground">目标比赛体重</div>
                      <div className="font-num text-lg font-bold text-primary">{verdict.targetWeight.toFixed(1)} kg</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">需减重量</div>
                      <div className="font-num text-lg font-bold">{verdict.lossKg.toFixed(1)} kg</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">安全速率</div>
                      <div className="font-num text-lg font-bold">
                        {verdict.weeklyRate[0].toFixed(2)}–{verdict.weeklyRate[1].toFixed(2)}
                        <span className="text-xs font-normal text-muted-foreground"> kg/周</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">赛前能否完成</div>
                      <div
                        className={cn(
                          'text-lg font-bold',
                          verdict.feasibleBeforeRace ? 'text-emerald-400' : 'text-red-400',
                        )}
                      >
                        {verdict.feasibleBeforeRace ? `可以 · 约 ${verdict.weeksNeeded} 周` : '周期偏紧'}
                      </div>
                    </div>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trajectory} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(240 5% 60%)' }} interval="preserveStartEnd" />
                        <YAxis
                          domain={['dataMin - 2', 'dataMax + 1']}
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
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="current" name="当前体重" stroke="hsl(240 5% 55%)" strokeDasharray="6 4" dot={false} strokeWidth={1.5} />
                        <Line type="monotone" dataKey="target" name="安全减重轨迹" stroke="hsl(18 100% 55%)" dot={false} strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    减重不是唯一杠杆：跑步经济性、力量水平与站点技术同样关键。速率按体重 0.5%–0.75%/周设定，过快减重会牺牲训练质量与肌肉量。
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  当前 BMI 与体脂率均在运动人群合理区间。把热量吃够，专注提升跑步配速与站点力量即可。
                </p>
              )}
            </CardContent>
          </Card>

          {/* 可行性评估 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">1:20 目标可行性评估</CardTitle>
              <CardDescription>
                由 5km PB 推算：疲劳后比赛配速约放慢 {Math.round((estimate.band.fatigueFactor - 1) * 100)}%，站点按「{estimate.band.label}」档估计
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">当前预估完赛</div>
                  <div className="font-num text-3xl font-extrabold">{fmtHMS(estimate.totalSec)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">目标</div>
                  <div className="font-num text-3xl font-extrabold text-primary">{fmtHMS(profile.targetSec)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">差距</div>
                  <div className={cn('font-num text-3xl font-extrabold', toneColor)}>
                    {fmtDelta(feasibility.gapSec)}
                  </div>
                </div>
                <Badge
                  className={cn(
                    'mb-1 text-sm',
                    feasibility.verdict === 'ontrack' && 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20',
                    feasibility.verdict === 'challenging' && 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/20',
                    feasibility.verdict === 'longroad' && 'bg-red-500/15 text-red-400 hover:bg-red-500/20',
                  )}
                  variant="secondary"
                >
                  {feasibility.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{feasibility.detail}</p>
              <div className="grid grid-cols-3 gap-3 border-t pt-3 text-center">
                <div>
                  <div className="font-num text-sm font-bold">{fmtPace(estimate.freshPaceSecPerKm)}</div>
                  <div className="text-[11px] text-muted-foreground">5km PB 配速</div>
                </div>
                <div>
                  <div className="font-num text-sm font-bold">{fmtPace(estimate.racePaceSecPerKm)}</div>
                  <div className="text-[11px] text-muted-foreground">预估比赛配速（疲劳后）</div>
                </div>
                <div>
                  <div className="font-num text-sm font-bold">{fmtMS(estimate.roxzoneSec)}</div>
                  <div className="text-[11px] text-muted-foreground">预估 Roxzone 合计</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
