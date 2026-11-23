import type { Catalog, Food, FoodLog, Goals, Macros, Recipe, Slot } from './types'

export const ZERO: Macros = { kcal: 0, protein: 0, fat: 0, carb: 0 }

export function foodMacros(f: Food, grams: number): Macros {
  const k = grams / 100
  return { kcal: f.kcal_100g * k, protein: f.protein_100g * k, fat: f.fat_100g * k, carb: f.carb_100g * k }
}
export function addM(a: Macros, b: Macros, times = 1): Macros {
  return { kcal: a.kcal + b.kcal * times, protein: a.protein + b.protein * times, fat: a.fat + b.fat * times, carb: a.carb + b.carb * times }
}
export function roundM(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), protein: Math.round(m.protein), fat: Math.round(m.fat), carb: Math.round(m.carb) }
}
export function recipeMacros(cat: Catalog, r: Recipe, portion = 1): Macros {
  let t = ZERO
  for (const it of r.items) {
    const f = cat.foods.find((x) => x.id === it.food_id)
    if (f) t = addM(t, foodMacros(f, it.grams))
  }
  return { kcal: t.kcal * portion, protein: t.protein * portion, fat: t.fat * portion, carb: t.carb * portion }
}
export function planFor(cat: Catalog, weekday: number): { slot: Slot; recipe: Recipe }[] {
  return cat.meal_plan
    .filter((p) => p.weekday === weekday)
    .map((p) => ({ slot: p.slot, recipe: cat.recipes.find((r) => r.id === p.recipe_id)! }))
    .filter((x) => x.recipe)
}
export function planTotals(cat: Catalog, weekday: number): Macros {
  return planFor(cat, weekday).reduce((t, p) => addM(t, recipeMacros(cat, p.recipe)), ZERO)
}
export function logsTotals(logs: Pick<FoodLog, 'kcal' | 'protein' | 'fat' | 'carb'>[]): Macros {
  return logs.reduce((t, l) => addM(t, l), ZERO)
}
/** Plan qeydi: resept + porsiya → makrolar yazılan anda hesablanıb saxlanılır */
export function logFromRecipe(cat: Catalog, date: string, slot: Slot, r: Recipe, portion = 1, source: FoodLog['source'] = 'plan'): FoodLog {
  const m = roundM1(recipeMacros(cat, r, portion))
  return { date, slot, recipe_id: r.id, food_id: null, portion, grams: null, name: r.name, source, kcal_is_estimate: false, ...m }
}
export function logFromFood(date: string, f: Food, grams: number): FoodLog {
  const m = roundM1(foodMacros(f, grams))
  return { date, slot: 'elave', recipe_id: null, food_id: f.id, portion: null, grams, name: `${f.name} ${grams} q`, source: 'elave', kcal_is_estimate: false, ...m }
}
function roundM1(m: Macros): Macros {
  const r = (v: number) => Math.round(v * 10) / 10
  return { kcal: r(m.kcal), protein: r(m.protein), fat: r(m.fat), carb: r(m.carb) }
}
/** Gün "uyğun": kalori hədəf ±tolerans daxilində və zülal ≥ 90% (spesifikasiya, 4-cü qayda) */
export function isAdherent(t: Macros, g: Goals): boolean {
  return Math.abs(t.kcal - g.kcal) <= g.kcal_tolerance && t.protein >= g.protein_g * 0.9
}
export function kcalState(kcal: number, g: Goals): 'Uyğun' | 'Az' | 'Çox' {
  if (kcal < g.kcal - g.kcal_tolerance) return 'Az'
  if (kcal > g.kcal + g.kcal_tolerance) return 'Çox'
  return 'Uyğun'
}
/** "Yumurta (2 ədəd)" kimi göstəriş */
export function itemLabel(f: Food, grams: number): string {
  if (f.unit_grams) {
    const n = Math.round((grams / f.unit_grams) * 2) / 2
    return `${f.name} (${String(n).replace('.', ',')} ${f.unit_name})`
  }
  return f.name
}
