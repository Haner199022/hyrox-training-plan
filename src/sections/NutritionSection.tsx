import { useMemo, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Apple,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Droplets,
  Dumbbell,
  Flag,
  Pill,
  RotateCcw,
  UtensilsCrossed,
} from 'lucide-react'
import type { AppStateHook } from '@/hooks/useAppState'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  ACTIVITY_FACTORS,
  DAY_TYPE_LABEL,
  dayTargets,
  mealKey,
  mealSlots,
  type DayType,
} from '@/lib/nutrition'
import { composeDayMeals, dayMealTotals, filterFromExcluded } from '@/lib/meals'
import { FOOD_TAGS, foodsByTag } from '@/lib/foods'
import { cn } from '@/lib/utils'

const DAY_TYPE_STYLE: Record<DayType, string> = {
  high: 'border-red-500/40 bg-red-500/10 text-red-400',
  normal: 'border-sky-500/40 bg-sky-500/10 text-sky-400',
  rest: 'border-border bg-muted text-muted-foreground',
}

const MACRO_COLORS = ['hsl(18 100% 55%)', 'hsl(210 90% 60%)', 'hsl(45 95% 55%)']

export function NutritionSection(app: AppStateHook) {
  const {
    profile,
    nutrition,
    updateNutrition,
    calTarget,
    macros,
    fueling,
    raceWeek,
    plan,
    mealsDone,
    toggleMeal,
    resetNutrition,
    excludedFoods,
    toggleFoodExcluded,
    setFoodsExcluded,
  } = app
  const [activeWeek, setActiveWeek] = useState(1)
  const week = plan[Math.min(activeWeek, plan.length) - 1]

  const foodFilter = useMemo(() => filterFromExcluded(excludedFoods), [excludedFoods])

  // 当前周的逐日目标与配餐（仅使用未禁忌的食材）
  const days = useMemo(() => {
    if (!week) return []
    const targets = dayTargets(week.days, macros)
    return targets.map((t, di) => ({
      target: t,
      slots: mealSlots(t.type),
      meals: composeDayMeals(t, mealSlots(t.type), di, foodFilter),
      key: mealKey(week.week, di),
      done: !!mealsDone[mealKey(week.week, di)],
    }))
  }, [week, macros, mealsDone, foodFilter])

  const macroPie = [
    { name: `碳水 ${macros.carbG}g`, value: macros.carbKcal },
    { name: `蛋白质 ${macros.proteinG}g`, value: macros.proteinKcal },
    { name: `脂肪 ${macros.fatG}g`, value: macros.fatKcal },
  ]

  const weekChart = days.map((d) => ({
    name: d.target.dayLabel,
    热量: d.target.kcal,
    碳水: d.target.carbG,
    type: d.target.type,
  }))

  const trainingSlots = mealSlots('normal')
  const restSlots = mealSlots('rest')

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            <UtensilsCrossed className="mr-2 inline h-5 w-5 text-primary" />
            饮食计划 · 热量与配餐
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            与训练计划联动：高强度日碳水 +15%，休息日 −20%。所有数值随个人资料实时更新。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-sm',
              calTarget.mode === 'cut'
                ? 'border-amber-500/50 text-amber-400'
                : 'border-emerald-500/50 text-emerald-400',
            )}
          >
            {calTarget.mode === 'cut' ? `减重模式 · 缺口 ${calTarget.appliedDeficit} kcal/天` : '维持模式'}
          </Badge>
          <Button variant="outline" size="sm" onClick={resetNutrition}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            重置营养数据
          </Button>
        </div>
      </div>

      {/* ── 顶部指标卡 ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">基础代谢 BMR</div>
            <div className="font-num mt-1 text-2xl font-bold">{calTarget.bmr.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground">kcal/天 · Mifflin-St Jeor</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">每日总消耗 TDEE</div>
            <div className="font-num mt-1 text-2xl font-bold">{calTarget.tdee.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground">
              kcal/天 · 活动系数 ×{ACTIVITY_FACTORS[Math.max(3, Math.min(7, profile.daysPerWeek))].toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="card-glow border-primary/50">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">每日热量目标</div>
            <div className="font-num mt-1 text-2xl font-extrabold text-primary text-glow">
              {calTarget.kcal.toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground">
              kcal/天{calTarget.floored ? ` · 已触及下限 ${calTarget.floorKcal}` : ''}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">三大营养素（基准日）</div>
            <div className="font-num mt-1 text-sm font-bold leading-6">
              <span className="text-primary">碳 {macros.carbG}g</span>
              {' · '}
              <span className="text-sky-400">蛋 {macros.proteinG}g</span>
              {' · '}
              <span className="text-yellow-400">脂 {macros.fatG}g</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              占比 {macros.carbPct}% / {macros.proteinPct}% / {macros.fatPct}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── 目标调节 ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">目标调节</CardTitle>
            <CardDescription>调整后全部热量、宏量与配餐实时重算</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">每日热量缺口（减重模式生效）</Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateNutrition({ deficitKcal: Math.max(0, nutrition.deficitKcal - 50) })}
                  >
                    −
                  </Button>
                  <span className="font-num w-16 text-center text-sm font-bold text-primary">
                    {nutrition.deficitKcal} kcal
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => updateNutrition({ deficitKcal: Math.min(750, nutrition.deficitKcal + 50) })}
                  >
                    +
                  </Button>
                </div>
              </div>
              {calTarget.deficitWarning && (
                <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  缺口超过 500 kcal/天 的安全指南，可能牺牲训练质量与肌肉量，请谨慎。
                </p>
              )}
              {calTarget.mode !== 'cut' && (
                <p className="text-[11px] text-muted-foreground">当前为维持模式（无需减重），缺口设置暂不生效。</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">蛋白质</Label>
                <span className="font-num text-sm font-bold text-sky-400">
                  {nutrition.proteinGPerKg.toFixed(1)} g/kg · {macros.proteinG}g/天
                </span>
              </div>
              <Slider
                value={[nutrition.proteinGPerKg]}
                min={1.6}
                max={2.2}
                step={0.1}
                onValueChange={([v]) => updateNutrition({ proteinGPerKg: Math.round(v * 10) / 10 })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">脂肪</Label>
                <span className="font-num text-sm font-bold text-yellow-400">
                  {nutrition.fatGPerKg.toFixed(1)} g/kg · {macros.fatG}g/天
                </span>
              </div>
              <Slider
                value={[nutrition.fatGPerKg]}
                min={0.8}
                max={1.0}
                step={0.05}
                onValueChange={([v]) => updateNutrition({ fatGPerKg: Math.round(v * 20) / 20 })}
              />
            </div>
            <Separator />
            {/* 餐次分配表 */}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">餐次热量分配</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div>
                  <div className="mb-1 font-medium text-foreground/80">训练日</div>
                  {trainingSlots.map((s) => (
                    <div key={s.name} className="flex justify-between text-muted-foreground">
                      <span>{s.name}</span>
                      <span className="font-num">{Math.round(s.pct * 100)}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-1 font-medium text-foreground/80">休息日</div>
                  {restSlots.map((s) => (
                    <div key={s.name} className="flex justify-between text-muted-foreground">
                      <span>{s.name}</span>
                      <span className="font-num">{Math.round(s.pct * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── 宏量环形图 + 每周碳水柱图 ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">宏量营养素占比（按热量）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {macroPie.map((_, i) => (
                        <Cell key={i} fill={MACRO_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(240 6% 8%)',
                        border: '1px solid hsl(240 4% 18%)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: number | string) => `${v} kcal`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">第 {week?.week} 周逐日目标 · 碳水周期化</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekChart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(240 5% 60%)' }} />
                    <YAxis yAxisId="kcal" tick={{ fontSize: 11, fill: 'hsl(240 5% 60%)' }} />
                    <YAxis yAxisId="carb" orientation="right" tick={{ fontSize: 11, fill: 'hsl(240 5% 60%)' }} unit="g" width={48} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(240 6% 8%)',
                        border: '1px solid hsl(240 4% 18%)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="kcal" dataKey="热量" fill="hsl(240 5% 45%)" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="carb" dataKey="碳水" fill="hsl(18 100% 55%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                <span className="text-red-400">■ 高强度日 碳水×1.15</span>
                <span className="text-sky-400">■ 普通训练日 基准</span>
                <span>■ 休息日 碳水×0.8</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── 饮食偏好/禁忌 ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">饮食偏好 / 禁忌</CardTitle>
          <CardDescription>
            被排除的食材不会出现在配餐中（默认已排除牛肉；点击类别可整类排除/恢复）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {FOOD_TAGS.map((tag) => {
            const foods = foodsByTag(tag)
            const allExcluded = foods.every((f) => excludedFoods.includes(f.id))
            return (
              <div key={tag} className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setFoodsExcluded(foods.map((f) => f.id), !allExcluded)}
                  className={cn(
                    'mr-1 w-14 shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                    allExcluded
                      ? 'border-red-500/50 bg-red-500/10 text-red-400'
                      : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400',
                  )}
                >
                  {tag}
                </button>
                {foods.map((f) => {
                  const excluded = excludedFoods.includes(f.id)
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFoodExcluded(f.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
                        excluded
                          ? 'border-red-500/40 bg-red-500/10 text-red-400/80 line-through'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                      )}
                    >
                      {f.name}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── 7 天配餐 ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold">
            <Apple className="mr-1.5 inline h-4 w-4 text-primary" />
            一周配餐（第 {week?.week} 周 · {week?.phaseLabel}）
          </h3>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {plan.map((w) => (
              <Button
                key={w.week}
                variant={w.week === week?.week ? 'default' : 'outline'}
                size="sm"
                className="font-num h-8 w-11 p-0"
                onClick={() => setActiveWeek(w.week)}
              >
                W{w.week}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {days.map((d) => {
            const totals = dayMealTotals(d.meals)
            return (
              <Card
                key={d.key}
                onClick={() => toggleMeal(d.key)}
                className={cn(
                  'cursor-pointer transition-colors hover:border-primary/50',
                  d.done && 'border-emerald-500/50 bg-emerald-500/5',
                )}
              >
                <CardContent className="space-y-2.5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{d.target.dayLabel}</span>
                      <Badge variant="outline" className={cn('text-[10px]', DAY_TYPE_STYLE[d.target.type])}>
                        {DAY_TYPE_LABEL[d.target.type]}
                      </Badge>
                    </div>
                    {d.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    训练：{d.target.sessionName}
                  </div>
                  <div className="font-num text-xs">
                    目标 <span className="font-bold text-primary">{d.target.kcal.toLocaleString()} kcal</span>
                    {' · '}碳水 {d.target.carbG}g · 蛋白 {d.target.proteinG}g · 脂肪 {d.target.fatG}g
                  </div>
                  <div className="space-y-2 border-t pt-2">
                    {d.meals.map((m) => (
                      <div key={m.slotName}>
                        <div className="flex justify-between text-xs">
                          <span className="font-medium">{m.slotName}</span>
                          <span className="font-num text-muted-foreground">{m.kcal} kcal</span>
                        </div>
                        <div className="text-[11px] leading-relaxed text-muted-foreground">
                          {m.items.map((i) => `${i.name} ${i.amountG}g`).join('、') || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="font-num border-t pt-1.5 text-[11px] text-muted-foreground">
                    配餐合计 ≈ {totals.kcal.toLocaleString()} kcal · 碳 {totals.carbG}g / 蛋 {totals.proteinG}g / 脂 {totals.fatG}g
                  </div>
                  {totals.proteinG < d.target.proteinG * 0.9 && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] leading-relaxed text-amber-300">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      当前禁忌设置下配餐蛋白质不足（{totals.proteinG}g / 目标 {d.target.proteinG}g），建议放宽部分蛋白类食材或额外补充乳清蛋白。
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          配餐由食材库按目标自动组合（份量按 25g 步进取整），可等量替换同类食材；点击卡片标记当天饮食「已执行」。
        </p>
      </div>

      {/* ── 补给指南 / 比赛周策略 / 补剂 ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplets className="h-4 w-4 text-sky-400" />
              训练日补给指南
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-num font-bold text-primary">
                {fueling.preCarbG[0]}–{fueling.preCarbG[1]}g 碳水
              </div>
              <div className="text-xs text-muted-foreground">{fueling.preText}</div>
            </div>
            <div>
              <div className="font-num font-bold text-primary">
                {fueling.duringCarbPerHour[0]}–{fueling.duringCarbPerHour[1]}g/小时
              </div>
              <div className="text-xs text-muted-foreground">{fueling.duringText}</div>
            </div>
            <div>
              <div className="font-num font-bold text-primary">
                {fueling.postProteinG}g 蛋白 + {fueling.postCarbG}g 碳水
              </div>
              <div className="text-xs text-muted-foreground">{fueling.postText}</div>
            </div>
            <Separator />
            <div>
              <div className="font-num font-bold text-sky-400">
                {fueling.waterMl[0].toLocaleString()}–{fueling.waterMl[1].toLocaleString()} ml/天
              </div>
              <div className="text-xs text-muted-foreground">
                每日饮水 35–40 ml/kg；训练每 30 分钟额外补液 300–500 ml，大量出汗时加电解质。
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Flag className="h-4 w-4 text-primary" />
              比赛周营养策略
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-num font-bold text-primary">
                碳水加载 {raceWeek.carbLoadG[0]}–{raceWeek.carbLoadG[1]}g/天
              </div>
              <div className="text-xs text-muted-foreground">
                赛前 3 天：碳水 8–10 g/kg/天，同时减少训练量与膳食纤维/脂肪摄入。
              </div>
            </div>
            <div>
              <div className="font-bold">比赛日早餐时间线</div>
              <div className="text-xs leading-relaxed text-muted-foreground">
                赛前 3h：正餐（米饭/馒头 + 鸡蛋 + 香蕉，约 {Math.round(profile.weightKg * 2)}g 碳水）→
                赛前 60min：香蕉或能量胶 1 支 → 赛前 15min：小口运动饮料。
              </div>
            </div>
            <div>
              <div className="font-bold">赛中补给</div>
              <div className="text-xs leading-relaxed text-muted-foreground">
                第 3 站（拉雪橇）后：能量胶 1 支；第 5 站（划船）后：电解质饮料小口；第 6 站（农夫行走）后：能量胶 1 支。 Roxzone 走动时完成补给，勿在站点中进食。
              </div>
            </div>
            <div>
              <div className="font-bold">赛后恢复</div>
              <div className="text-xs text-muted-foreground">
                完赛 30 分钟内：蛋白 {fueling.postProteinG}g + 碳水 {fueling.postCarbG}g；2 小时内正餐；持续补液至尿液清亮。
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="h-4 w-4 text-violet-400" />
              补剂建议（保守）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-num font-bold">肌酸 3–5 g/天</div>
              <div className="text-xs text-muted-foreground">
                证据最充分的力量/爆发力补剂，每日任意时间服用，无需冲击期。
              </div>
            </div>
            <div>
              <div className="font-num font-bold">
                咖啡因 {raceWeek.caffeineMg[0]}–{raceWeek.caffeineMg[1]} mg
              </div>
              <div className="text-xs text-muted-foreground">
                赛前 45–60 分钟（3–6 mg/kg）。日常训练中先测试耐受，避免影响睡眠。
              </div>
            </div>
            <div>
              <div className="font-num font-bold">乳清蛋白</div>
              <div className="text-xs text-muted-foreground">
                仅作为饮食不足时的便捷补充，优先从天然食物获取蛋白质。
              </div>
            </div>
            <Separator />
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Dumbbell className="mt-0.5 h-3 w-3 shrink-0" />
              以上为通用运动营养建议，存在个体差异；如有基础疾病、孕期或正在服药，请先咨询医生或注册营养师。
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
