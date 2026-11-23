import { describe, expect, it } from 'vitest'
import seed from '../data/seed.json'
import type { Catalog, Goals } from './types'
import { isAdherent, kcalState, logFromRecipe, planFor, planTotals, roundM } from './nutrition'
import { addDays, isoWeekday, programWeek, weekStart } from './dates'
import { nextCheckpoint, progressTo, weekAverage } from './weight'

const cat = seed as unknown as Catalog
const goals = seed.goals as Goals

describe('menyu', () => {
  it('hər gün 5 yemək və 2300 ± 100 kcal, zülal ≥ 170 q', () => {
    for (let d = 1; d <= 7; d++) {
      expect(planFor(cat, d)).toHaveLength(5)
      const t = roundM(planTotals(cat, d))
      expect(Math.abs(t.kcal - 2300)).toBeLessThanOrEqual(100)
      expect(t.protein).toBeGreaterThanOrEqual(170)
    }
  })
  it('bazar ertəsi prototiplə eynidir: 2297 kcal, 178 q zülal', () => {
    expect(roundM(planTotals(cat, 1))).toMatchObject({ kcal: 2297, protein: 178 })
  })
  it('istəmədiyi ərzaqlar menyuda yoxdur', () => {
    const banned = /balıq|brokoli|kələm|kahı|bulqur|kabaq|quzu|şəkər/i
    for (const f of cat.foods) expect(f.name).not.toMatch(banned)
  })
  it('gündə ən çox 2 yumurta', () => {
    for (let d = 1; d <= 7; d++) {
      const g = planFor(cat, d).flatMap((p) => p.recipe.items).filter((i) => i.food_id === 'yumurta').reduce((s, i) => s + i.grams, 0)
      expect(g).toBeLessThanOrEqual(110)
    }
  })
  it('porsiya makroları mütənasib dəyişir', () => {
    const r = planFor(cat, 1)[0].recipe
    const a = logFromRecipe(cat, '2026-11-23', 'seher', r, 1)
    const b = logFromRecipe(cat, '2026-11-23', 'seher', r, 0.5)
    expect(b.kcal).toBeCloseTo(a.kcal / 2, 0)
  })
})

describe('uyğunluq', () => {
  it('2200–2400 kcal və zülal ≥ 153 q uyğundur', () => {
    expect(isAdherent({ kcal: 2200, protein: 153, fat: 0, carb: 0 }, goals)).toBe(true)
    expect(isAdherent({ kcal: 2401, protein: 180, fat: 0, carb: 0 }, goals)).toBe(false)
    expect(isAdherent({ kcal: 2300, protein: 150, fat: 0, carb: 0 }, goals)).toBe(false)
    expect(kcalState(2150, goals)).toBe('Az')
  })
})

describe('tarix və çəki', () => {
  it('həftə bazar ertəsi başlayır', () => {
    expect(isoWeekday('2026-11-23')).toBe(1)
    expect(weekStart('2026-11-29')).toBe('2026-11-23')
    expect(weekStart('2026-11-30')).toBe('2026-11-30')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(programWeek('2026-11-23', '2027-02-14')).toBe(12)
  })
  it('həftəlik ortalama 0,1 kq-a yuvarlanır', () => {
    const e = [100.6, 100.2, 99.9].map((w, i) => ({ date: addDays('2026-11-23', i), weight_kg: w }))
    expect(weekAverage(e, '2026-11-26')).toEqual({ avg: 100.2, count: 3 })
  })
  it('növbəti checkpoint və irəliləyiş', () => {
    const cps = seed.checkpoints.map((c, i) => ({ ...c, id: i, status: i === 0 ? 'hedefe_catildi' : 'gozleyir', reached_week: null, reached_avg_kg: null })) as any
    expect(nextCheckpoint(cps)?.target_kg).toBe(94)
    expect(progressTo(101, 99, 97)).toBe(50)
  })
})
