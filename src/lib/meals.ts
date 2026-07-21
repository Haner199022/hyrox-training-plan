// 每日配餐生成器：按餐次目标贪心组合中式食材（纯函数，确定性轮换保证多样性）
// 支持饮食禁忌：excluded 中的食材 id 不会出现在任何配餐中。
import { FOODS, foodById, STAPLES, VEGGIES, type Food } from './foods'
import type { DayTarget, MealSlot } from './nutrition'

export interface MealItem {
  name: string
  amountG: number
  kcal: number
  protein: number
  carb: number
  fat: number
}

export interface ComposedMeal {
  slotName: string
  hint: string
  items: MealItem[]
  kcal: number
  proteinG: number
  carbG: number
  fatG: number
}

export type FoodFilter = (id: string) => boolean

/** 全部食材可用 */
export const ALLOW_ALL: FoodFilter = () => true

export function filterFromExcluded(excluded: string[]): FoodFilter {
  const set = new Set(excluded)
  return (id) => !set.has(id)
}

const round25 = (g: number) => Math.max(0, Math.round(g / 25) * 25)

function item(food: Food, amountG: number): MealItem {
  const r = amountG / 100
  return {
    name: food.name,
    amountG,
    kcal: Math.round(food.kcal * r),
    protein: Math.round(food.protein * r * 10) / 10,
    carb: Math.round(food.carb * r * 10) / 10,
    fat: Math.round(food.fat * r * 10) / 10,
  }
}

function sum(items: MealItem[]) {
  return {
    kcal: items.reduce((a, i) => a + i.kcal, 0),
    proteinG: Math.round(items.reduce((a, i) => a + i.protein, 0)),
    carbG: Math.round(items.reduce((a, i) => a + i.carb, 0)),
    fatG: Math.round(items.reduce((a, i) => a + i.fat, 0)),
  }
}

// 轮换池：高蛋白主菜按餐次轮换，避免天天鸡胸肉（含猪里脊，牛肉可被禁忌过滤）
const PROTEIN_ROTATION = ['chicken', 'pork', 'seabass', 'shrimp', 'tofu', 'salmon', 'beef', 'chicken']

/** 在候选列表中找第一个可用食材；全部不可用时返回 null */
function pick(ok: FoodFilter, candidates: string[]): Food | null {
  for (const id of candidates) {
    if (ok(id)) return foodById(id)
  }
  return null
}

/** 组合一餐：1 份蛋白主菜 + 1 份主食 + (正餐加蔬菜)，份量取 25g 步进 */
function composeSlot(
  slot: MealSlot,
  slotKcal: number,
  slotProteinG: number,
  slotCarbG: number,
  seed: number,
  ok: FoodFilter,
): ComposedMeal {
  const items: MealItem[] = []
  const isSnack = slot.name.includes('加餐')
  const isBreakfast = slot.name === '早餐'
  const allowedStaples = STAPLES.filter((f) => ok(f.id))
  const allowedVeggies = VEGGIES.filter((f) => ok(f.id))
  const rotation = PROTEIN_ROTATION.filter(ok)

  if (slot.name === '训练后加餐') {
    // 训练后：快速吸收优先 —— 乳清（或替代品）+ 快碳
    const proteinSrc = pick(ok, ['whey', 'greekyogurt', 'egg', 'chicken'])
    if (proteinSrc) {
      const cap = proteinSrc.id === 'whey' ? 45 : 150
      const g = Math.min(cap, Math.max(proteinSrc.id === 'whey' ? 30 : 75, round25(slotProteinG / (proteinSrc.protein / 100))))
      items.push(item(proteinSrc, g))
    }
    const fast = pick(ok, seed % 2 === 0 ? ['banana', 'mantou'] : ['mantou', 'banana'])
    if (fast) {
      const fastG = round25(Math.max(0, slotCarbG - (items[0]?.carb ?? 0)) / (fast.carb / 100))
      if (fastG >= 50) items.push(item(fast, fastG))
    }
  } else if (isSnack) {
    // 训练前/普通加餐：易消化碳水 + 少量蛋白
    const carbSrc = pick(ok, seed % 2 === 0 ? ['banana', 'wholewheatbread'] : ['wholewheatbread', 'banana'])
    if (carbSrc) {
      const carbG = round25(slotCarbG / (carbSrc.carb / 100))
      if (carbG >= 50) items.push(item(carbSrc, carbG))
    }
    if (slot.name === '加餐') {
      const extra = pick(ok, ['greekyogurt', 'milk', 'apple'])
      if (extra) items.push(item(extra, extra.id === 'apple' ? 150 : extra.id === 'milk' ? 250 : 150))
    }
  } else if (isBreakfast) {
    // 早餐：燕麦/全麦面包 + 鸡蛋 + 牛奶
    const staple = allowedStaples.length
      ? (pick(ok, seed % 2 === 0 ? ['oats', 'wholewheatbread'] : ['wholewheatbread', 'oats']) ?? allowedStaples[0])
      : null
    if (staple) {
      const stapleG = round25((slotCarbG * 0.75) / (staple.carb / 100))
      if (stapleG >= 50) items.push(item(staple, stapleG))
    }
    if (ok('egg')) {
      const egg = foodById('egg')
      const eggG = Math.min(165, Math.max(55, round25((slotProteinG * 0.5) / (egg.protein / 100))))
      items.push(item(egg, eggG))
    }
    if (ok('milk')) items.push(item(foodById('milk'), 250))
    // 主食不足部分用香蕉/红薯补足
    const filled = sum(items)
    const gap = slotCarbG - filled.carbG
    if (gap > 20) {
      const filler = pick(ok, ['banana', 'sweetpotato', 'mantou'])
      if (filler) {
        const g = round25(gap / (filler.carb / 100))
        if (g >= 75) items.push(item(filler, g))
      }
    }
  } else {
    // 正餐（午/晚）：蛋白主菜 + 主食 + 蔬菜
    const proteinFood = rotation.length ? foodById(rotation[seed % rotation.length]) : pick(ok, ['egg', 'tofu'])
    if (proteinFood) {
      const pG = Math.min(300, Math.max(75, round25((slotProteinG * 0.85) / (proteinFood.protein / 100))))
      items.push(item(proteinFood, pG))
    }

    const filledP = sum(items)
    const carbLeft = Math.max(0, slotCarbG - filledP.carbG - 8) // 预留蔬菜碳水
    if (allowedStaples.length) {
      const staple = allowedStaples[seed % allowedStaples.length]
      const sG = Math.min(350, round25(carbLeft / (staple.carb / 100)))
      if (sG >= 50) items.push(item(staple, sG))
    }

    if (allowedVeggies.length) {
      items.push(item(allowedVeggies[seed % allowedVeggies.length], 150))
    }

    // 蛋白仍不足 → 依次加鸡蛋/豆腐/酸奶；热量偏低 → 补一小份橄榄油
    const filled = sum(items)
    if (filled.proteinG < slotProteinG * 0.75) {
      const booster = pick(ok, ['egg', 'tofu', 'greekyogurt'])
      if (booster) items.push(item(booster, booster.id === 'egg' ? 55 : 150))
    }
    const afterBoost = sum(items)
    if (afterBoost.kcal < slotKcal * 0.8 && ok('oliveoil')) {
      items.push(item(foodById('oliveoil'), 10))
    }
  }

  const totals = sum(items)
  return { slotName: slot.name, hint: slot.hint, items, ...totals }
}

/** 生成一天全部餐次 */
export function composeDayMeals(
  day: DayTarget,
  slots: MealSlot[],
  dayIndex: number,
  ok: FoodFilter = ALLOW_ALL,
): ComposedMeal[] {
  return slots.map((slot, si) =>
    composeSlot(
      slot,
      Math.round(day.kcal * slot.pct),
      Math.round(day.proteinG * slot.pct),
      Math.round(day.carbG * slot.pct),
      dayIndex * 7 + si,
      ok,
    ),
  )
}

export function dayMealTotals(meals: ComposedMeal[]) {
  return {
    kcal: meals.reduce((a, m) => a + m.kcal, 0),
    proteinG: meals.reduce((a, m) => a + m.proteinG, 0),
    carbG: meals.reduce((a, m) => a + m.carbG, 0),
    fatG: meals.reduce((a, m) => a + m.fatG, 0),
  }
}

/** 食物库检索（供 UI 展示参考食材表） */
export { FOODS }
