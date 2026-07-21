// 中式常见食材数据库（每 100g 可食部的近似宏量营养素）
// 数值为常见食物成分表的近似值，用于膳食组合的估算，不构成精确营养指导。

export type FoodCategory = 'staple' | 'protein' | 'veg' | 'fruit' | 'dairy' | 'fat'

/** 饮食偏好/禁忌用的中文分类标签 */
export type FoodTag = '畜肉' | '禽肉' | '水产' | '蛋奶' | '豆制品' | '主食' | '蔬菜' | '水果' | '油脂'

export const FOOD_TAGS: FoodTag[] = ['畜肉', '禽肉', '水产', '蛋奶', '豆制品', '主食', '蔬菜', '水果', '油脂']

export interface Food {
  id: string
  name: string
  category: FoodCategory
  tag: FoodTag
  kcal: number
  protein: number
  carb: number
  fat: number
  /** 展示用的常见份量提示 */
  note?: string
}

export const FOODS: Food[] = [
  // ── 主食（碳水来源）──
  { id: 'rice', name: '米饭（熟）', category: 'staple', tag: '主食', kcal: 116, protein: 2.6, carb: 25.9, fat: 0.3 },
  { id: 'brownrice', name: '糙米饭（熟）', category: 'staple', tag: '主食', kcal: 112, protein: 2.6, carb: 23.0, fat: 0.9 },
  { id: 'oats', name: '燕麦片（干）', category: 'staple', tag: '主食', kcal: 367, protein: 15.0, carb: 62.0, fat: 7.0 },
  { id: 'sweetpotato', name: '红薯（蒸）', category: 'staple', tag: '主食', kcal: 86, protein: 1.6, carb: 20.1, fat: 0.1 },
  { id: 'wholewheatbread', name: '全麦面包', category: 'staple', tag: '主食', kcal: 246, protein: 8.5, carb: 44.0, fat: 3.4 },
  { id: 'mantou', name: '馒头', category: 'staple', tag: '主食', kcal: 223, protein: 7.0, carb: 47.0, fat: 1.1 },
  { id: 'noodles', name: '面条（熟）', category: 'staple', tag: '主食', kcal: 110, protein: 3.5, carb: 22.0, fat: 0.6 },
  { id: 'corn', name: '玉米（鲜）', category: 'staple', tag: '主食', kcal: 112, protein: 4.0, carb: 22.8, fat: 1.2 },
  // ── 蛋白质来源 ──
  { id: 'chicken', name: '鸡胸肉（熟）', category: 'protein', tag: '禽肉', kcal: 165, protein: 31.0, carb: 0, fat: 3.6 },
  { id: 'pork', name: '猪里脊（熟）', category: 'protein', tag: '畜肉', kcal: 150, protein: 21.0, carb: 0, fat: 5.0 },
  { id: 'egg', name: '鸡蛋', category: 'protein', tag: '蛋奶', kcal: 143, protein: 12.6, carb: 0.7, fat: 9.5, note: '1 个约 55g' },
  { id: 'beef', name: '瘦牛肉（熟）', category: 'protein', tag: '畜肉', kcal: 175, protein: 26.0, carb: 0, fat: 7.5 },
  { id: 'salmon', name: '三文鱼', category: 'protein', tag: '水产', kcal: 208, protein: 20.0, carb: 0, fat: 13.0 },
  { id: 'seabass', name: '鲈鱼（蒸）', category: 'protein', tag: '水产', kcal: 118, protein: 20.5, carb: 0, fat: 3.4 },
  { id: 'shrimp', name: '虾仁', category: 'protein', tag: '水产', kcal: 87, protein: 18.6, carb: 0.9, fat: 0.8 },
  { id: 'tofu', name: '北豆腐', category: 'protein', tag: '豆制品', kcal: 98, protein: 12.2, carb: 2.0, fat: 4.8 },
  { id: 'whey', name: '乳清蛋白粉', category: 'protein', tag: '蛋奶', kcal: 380, protein: 78.0, carb: 8.0, fat: 4.0, note: '1 勺约 30g' },
  // ── 奶制品 ──
  { id: 'milk', name: '牛奶', category: 'dairy', tag: '蛋奶', kcal: 54, protein: 3.0, carb: 3.4, fat: 3.2, note: '1 盒 250ml' },
  { id: 'greekyogurt', name: '无糖希腊酸奶', category: 'dairy', tag: '蛋奶', kcal: 97, protein: 9.0, carb: 3.6, fat: 5.0 },
  // ── 蔬菜 ──
  { id: 'broccoli', name: '西兰花', category: 'veg', tag: '蔬菜', kcal: 36, protein: 4.1, carb: 4.3, fat: 0.6 },
  { id: 'spinach', name: '菠菜', category: 'veg', tag: '蔬菜', kcal: 23, protein: 2.6, carb: 3.6, fat: 0.3 },
  { id: 'tomato', name: '番茄', category: 'veg', tag: '蔬菜', kcal: 20, protein: 0.9, carb: 4.0, fat: 0.2 },
  { id: 'mixedveg', name: '混合时蔬', category: 'veg', tag: '蔬菜', kcal: 30, protein: 2.0, carb: 5.0, fat: 0.3 },
  // ── 水果 ──
  { id: 'banana', name: '香蕉', category: 'fruit', tag: '水果', kcal: 93, protein: 1.4, carb: 22.0, fat: 0.2, note: '1 根约 120g' },
  { id: 'apple', name: '苹果', category: 'fruit', tag: '水果', kcal: 53, protein: 0.4, carb: 13.7, fat: 0.2 },
  // ── 脂肪来源 ──
  { id: 'nuts', name: '混合坚果', category: 'fat', tag: '油脂', kcal: 607, protein: 20.0, carb: 21.0, fat: 54.0 },
  { id: 'avocado', name: '牛油果', category: 'fat', tag: '油脂', kcal: 160, protein: 2.0, carb: 7.4, fat: 15.3 },
  { id: 'peanutbutter', name: '花生酱', category: 'fat', tag: '油脂', kcal: 600, protein: 25.0, carb: 20.0, fat: 50.0 },
  { id: 'oliveoil', name: '橄榄油', category: 'fat', tag: '油脂', kcal: 899, protein: 0, carb: 0, fat: 99.9 },
]

export function foodById(id: string): Food {
  const f = FOODS.find((x) => x.id === id)
  if (!f) throw new Error(`unknown food: ${id}`)
  return f
}

export const STAPLES = FOODS.filter((f) => f.category === 'staple')
export const PROTEINS = FOODS.filter((f) => f.category === 'protein')
export const VEGGIES = FOODS.filter((f) => f.category === 'veg')
export const FRUITS = FOODS.filter((f) => f.category === 'fruit')

/** 按标签分组（供禁忌编辑器展示） */
export function foodsByTag(tag: FoodTag): Food[] {
  return FOODS.filter((f) => f.tag === tag)
}
