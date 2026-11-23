// Güc rekordları: hər hərəkət üçün məşq günləri, iş çəkisi, təxmini 1RM və məsləhət.
import type { SetRow } from './types'

export interface ExSession { date: string; work: number; reps: number[]; e1rm: number; pr: boolean }
export interface ExHistory { id: string; sessions: ExSession[]; best: number; bestE1rm: number }

/** Epley: çəki × (1 + təkrar / 30) */
export const epley = (w: number, reps: number) => (reps <= 1 ? w : w * (1 + reps / 30))

export function strengthHistory(rows: SetRow[]): ExHistory[] {
  const byEx = new Map<string, Map<string, SetRow[]>>()
  for (const r of rows) {
    if (r.weight_kg == null || !r.reps) continue
    const days = byEx.get(r.exercise_id) ?? new Map<string, SetRow[]>()
    days.set(r.date, [...(days.get(r.date) ?? []), r])
    byEx.set(r.exercise_id, days)
  }
  const out: ExHistory[] = []
  for (const [id, days] of byEx) {
    let bestE = 0, best = 0
    const sessions = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, sets]) => {
      const ordered = [...sets].sort((a, b) => a.set_no - b.set_no)
      const work = Math.max(...ordered.map((s) => s.weight_kg!))
      const e1rm = Math.max(...ordered.map((s) => epley(s.weight_kg!, s.reps!)))
      const pr = bestE > 0 && e1rm > bestE + 0.05
      bestE = Math.max(bestE, e1rm); best = Math.max(best, work)
      return { date, work, reps: ordered.filter((s) => s.weight_kg === work).map((s) => s.reps!), e1rm, pr }
    })
    out.push({ id, sessions, best, bestE1rm: bestE })
  }
  return out
}

/** Aşağı bədən hərəkətləri daha böyük addımla artır. */
export const stepFor = (id: string) => (/leg_press|squat|deadlift/.test(id) ? 5 : 2.5)

export type Advice = { kind: 'artir' | 'tekrar' | 'saxla' | 'dayaniq'; text: string }
export function advise(h: ExHistory, repsMax: number | null, step: number, f: (n: number) => string): Advice {
  const s = h.sessions, last = s[s.length - 1]
  if (!last) return { kind: 'saxla', text: 'İlk məşqdə rahat çəki seç: son 2 təkrar çətin olsun, amma texnika pozulmasın.' }
  const top = repsMax ?? 12
  if (last.reps.length && last.reps.every((r) => r >= top))
    return { kind: 'artir', text: `Son dəfə bütün setlərdə ${top} təkrar etdin. Növbəti məşqdə ${f(last.work + step)} kq ilə başla.` }
  const same = s.slice(-3)
  if (same.length === 3 && same.every((x) => x.work === last.work) && same[2].e1rm <= same[0].e1rm + 0.05)
    return { kind: 'dayaniq', text: `${f(last.work)} kq 3 məşqdir dəyişmir. Bu həftə bir az yüngül (${f(Math.max(0, last.work - step))} kq) et, gələn həftə yenidən cəhd et. Yuxu və zülala da bax.` }
  return { kind: 'tekrar', text: `${f(last.work)} kq ilə qal və hər setdə 1 təkrar artırmağa çalış. ${top} təkrara çatanda çəkini artıracağıq.` }
}
