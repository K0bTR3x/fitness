import type { DayClosure, WeightEntry } from './types'
import { addDays, diffDays, isoWeekday, weekStart } from './dates'
import { round1 } from './weight'

/** Hər gün üçün son 7 günün (o gün daxil) çəki ortalaması. */
export function rolling7(ws: WeightEntry[]): { date: string; avg: number }[] {
  const xs = [...ws].sort((a, b) => a.date.localeCompare(b.date))
  return xs.map((w) => {
    const win = xs.filter((v) => v.date <= w.date && diffDays(w.date, v.date) < 7)
    return { date: w.date, avg: round1(win.reduce((s, v) => s + v.weight_kg, 0) / win.length) }
  })
}

/** Həftəlik ortalamalar (B.e.–Baz.), yalnız çəki olan həftələr. */
export function weeklyAverages(ws: WeightEntry[]): { week: string; avg: number; count: number }[] {
  const m = new Map<string, number[]>()
  for (const w of ws) { const k = weekStart(w.date); m.set(k, [...(m.get(k) ?? []), w.weight_kg]) }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({ week, avg: round1(v.reduce((s, x) => s + x, 0) / v.length), count: v.length }))
}

/** Son 2 həftənin tempi (kq/həftə, mənfi = itki): son həftəlik ortalama ilə 2 həftə əvvəlki arasında. */
export function pacePerWeek(weekly: { week: string; avg: number }[]): number | null {
  if (weekly.length < 2) return null
  const last = weekly[weekly.length - 1]
  const prev = weekly.find((w) => w.week === addDays(last.week, -14)) ?? weekly[Math.max(0, weekly.length - 3)]
  const weeks = diffDays(last.week, prev.week) / 7
  return weeks > 0 ? round1((last.avg - prev.avg) / weeks) : null
}

/** Bu tempdə hədəfə təxmini tarix (temp itki deyilsə null). */
export function forecastDate(current: number, target: number, pace: number | null, fromISO: string): string | null {
  if (pace === null || pace >= -0.05) return null
  if (current <= target) return fromISO
  const weeks = (current - target) / -pace
  if (weeks > 104) return null
  return addDays(fromISO, Math.round(weeks * 7))
}

export type PaceTone = 'yavas' | 'normal' | 'suretli'
/** Həftədə bədən çəkisinin 0,5–1%-i normal sayılır. */
export function paceTone(pace: number, weight: number): { pct: number; tone: PaceTone } {
  const pct = round1((-pace / weight) * 100)
  return { pct, tone: pct > 1.0 ? 'suretli' : pct < 0.5 ? 'yavas' : 'normal' }
}

/** Ardıcıl 7/7 çəki olan tam həftələrin sayı. */
export function fullWeeks(weekly: { count: number }[]): number { return weekly.filter((w) => w.count >= 7).length }

export interface Badge { id: string; name: string; tier: 0 | 1 | 2 | 3; progress: number; sub: string }
const TIER_TXT = ['', '1-ci səviyyə', '2-ci səviyyə', '3-cü səviyyə']

/** Səviyyəli nişan: steps = [1-ci, 2-ci, 3-cü səviyyə həddi]. */
function tiered(id: string, name: string, value: number, steps: [number, number, number], unit: string): Badge {
  const tier = (value >= steps[2] ? 3 : value >= steps[1] ? 2 : value >= steps[0] ? 1 : 0) as Badge['tier']
  const next = steps[Math.min(tier, 2)]
  return {
    id, name, tier, progress: Math.min(1, value / steps[0]),
    sub: tier === 0 ? `${value} / ${steps[0]} ${unit}` : tier === 3 ? `${TIER_TXT[3]} · ${value} ${unit}` : `${TIER_TXT[tier]} · ${value}/${next} ${unit}`,
  }
}
function oneShot(id: string, name: string, value: number, goal: number, fmtv: (n: number) => string): Badge {
  const done = value >= goal
  return { id, name, tier: done ? 1 : 0, progress: Math.max(0, Math.min(1, value / goal)), sub: done ? 'Qazanıldı' : `${fmtv(Math.max(0, value))} / ${fmtv(goal)}` }
}

export interface BadgeInput {
  weights: WeightEntry[]; closures: DayClosure[]; proteinGoal: number
  strengthWeeksDone: number; waterDays: number; startWeight: number; waistDrop: number; programWeeks: number
}
export function computeBadges(i: BadgeInput, f1: (n: number) => string): Badge[] {
  const weekly = weeklyAverages(i.weights)
  const lastAvg = weekly.length ? weekly[weekly.length - 1].avg : i.startWeight
  const proteinDays = i.closures.filter((c) => c.protein_total >= i.proteinGoal).length
  return [
    oneShot('ilk', 'İlk addım', i.weights.length, 1, (n) => String(n)),
    tiered('tam_hefte', '7/7 həftə', fullWeeks(weekly), [1, 4, 8], 'həftə'),
    tiered('zulal', 'Zülal ustası', proteinDays, [7, 30, 60], 'gün'),
    tiered('zal', 'Zalın adamı', i.strengthWeeksDone, [1, 4, 8], 'həftə'),
    tiered('su', 'Su balansı', i.waterDays, [7, 14, 30], 'gün'),
    oneShot('ilk5', 'İlk 5 kq', round1(i.startWeight - lastAvg), 5, (n) => f1(n) + ' kq'),
    oneShot('bel', 'Bel −3 sm', round1(i.waistDrop), 3, (n) => f1(n) + ' sm'),
    oneShot('12', '12 həftə', Math.min(12, i.programWeeks), 12, (n) => `${n}`),
  ]
}

/** Həftədə bütün güc günləri tamamlanıbsa, o həftə sayılır. */
export function strengthWeeks(sessions: { date: string; status: string }[], strengthWeekdays: number[], start: string, today: string): number {
  let n = 0
  for (let ws = weekStart(start); addDays(ws, 6) < today; ws = addDays(ws, 7)) {
    const ok = strengthWeekdays.every((wd) => sessions.some((s) => s.date === addDays(ws, wd - 1) && s.status === 'tamamlandi'))
    if (ok && strengthWeekdays.length) n++
  }
  return n
}
export { isoWeekday }
