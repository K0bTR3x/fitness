import type { Catalog, Food, Recipe, Slot } from './types'
import { fmt } from './format'

export const GROUPS: { id: string; icon: string; name: string; foods: string[] }[] = [
  { id: 'et', icon: '🍗', name: 'Ət və yumurta', foods: ['toyuq_filesi', 'yumurta'] },
  { id: 'sud', icon: '🥛', name: 'Süd məhsulları', foods: ['kesmik_5', 'qatiq_2_5', 'sud_2_5', 'ag_pendir'] },
  { id: 'taxil', icon: '🌾', name: 'Taxıl və çörək', foods: ['duyu', 'yulaf', 'qarabasaq', 'covdar_coreyi'] },
  { id: 'terevez', icon: '🥒', name: 'Tərəvəz', foods: ['xiyar', 'pomidor', 'kartof', 'bolqar_biberi', 'sogan', 'goyerti', 'limon_siresi'] },
  { id: 'meyve', icon: '🍎', name: 'Meyvə', foods: ['armud', 'portagal', 'naringi', 'alma', 'xurma', 'banan', 'kivi', 'nar_denesi'] },
  { id: 'diger', icon: '🫙', name: 'Digər', foods: ['bitki_yagi'] },
]
// Qabıq və tullantı üçün əlavə (çiy tərəvəz və meyvə)
const WASTE = new Set(['xiyar', 'pomidor', 'kartof', 'bolqar_biberi', 'sogan', 'armud', 'portagal', 'naringi', 'alma', 'xurma', 'banan', 'kivi', 'nar_denesi'])

export interface ShopItem { food_id: string; name: string; qty: string; note: string; grams: number; meals: number }
export interface ShopGroup { id: string; icon: string; name: string; items: ShopItem[] }

function qtyText(f: Food, grams: number): { qty: string; note: string } {
  const g = Math.round(grams)
  if (f.id === 'yumurta') { const n = Math.ceil(grams / (f.unit_grams ?? 55)); return { qty: `${n} ədəd`, note: `menyuda ${n} ədəd (${g} q)` } }
  if (f.id === 'covdar_coreyi') { const n = Math.ceil(grams / (f.unit_grams ?? 35)); return { qty: '1 çörək', note: `menyuda ${n} dilim (${g} q)` } }
  if (f.id === 'limon_siresi') return { qty: `${Math.max(1, Math.ceil(grams / 40))} ədəd limon`, note: `şirə ${g} q` }
  if (f.id === 'goyerti') return { qty: `${Math.max(1, Math.ceil(grams / 60))} dəstə`, note: 'şüyüd, cəfəri' }
  if (f.id === 'bitki_yagi') return { qty: `${g} q`, note: 'evdə yoxla' }
  const buy = WASTE.has(f.id) ? grams * 1.15 : grams
  const qty = buy >= 1000 ? `${fmt(Math.ceil(buy / 50) * 50 / 1000, 2).replace(/0$/, '').replace(/,$/, '')} kq` : `${Math.ceil(buy / 10) * 10} q`
  const state = f.state === 'quru' ? 'quru çəki' : f.state === 'çiy' ? 'çiy' : ''
  return { qty, note: [`menyuda ${g} q`, state].filter(Boolean).join(', ') }
}

/** Günlərin planından ərzaq siyahısı (qram cəmi + insan dilində miqdar). */
export function shoppingList(cat: Catalog, days: { slot: Slot; recipe: Recipe }[][]): ShopGroup[] {
  const sum = new Map<string, { grams: number; meals: number }>()
  for (const day of days) for (const p of day) for (const it of p.recipe.items) {
    const cur = sum.get(it.food_id) ?? { grams: 0, meals: 0 }
    sum.set(it.food_id, { grams: cur.grams + it.grams, meals: cur.meals + 1 })
  }
  const known = new Set(GROUPS.flatMap((g) => g.foods))
  const groups = GROUPS.map((g) => ({ ...g, foods: [...g.foods, ...(g.id === 'diger' ? [...sum.keys()].filter((k) => !known.has(k)) : [])] }))
  return groups.map((g) => ({
    id: g.id, icon: g.icon, name: g.name,
    items: g.foods.filter((id) => sum.has(id)).map((id) => {
      const f = cat.foods.find((x) => x.id === id)!
      const s = sum.get(id)!
      return { food_id: id, name: f.name, grams: s.grams, meals: s.meals, ...qtyText(f, s.grams) }
    }).sort((a, b) => b.grams - a.grams),
  })).filter((g) => g.items.length)
}

export function shoppingText(groups: ShopGroup[], title: string, got: Record<string, boolean>): string {
  const lines = [title]
  for (const g of groups) {
    const left = g.items.filter((i) => !got[i.food_id])
    if (!left.length) continue
    lines.push('', `${g.icon} ${g.name}`)
    for (const i of left) lines.push(`• ${i.name} — ${i.qty}`)
  }
  return lines.join('\n')
}
