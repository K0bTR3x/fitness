import type { Exercise, SetLog, TemplateItem } from './types'

export interface GymStep {
  exercise: Exercise; item: TemplateItem; sets: number; rest: number
  aLabel: string; aStep: number; a: number; hasB: boolean; bLabel: string; bStep: number; b: number; target: string
}
const DEFAULT_KG: Record<string, number> = { leg_press: 60, chest_press: 25, lat_pulldown: 30, leg_curl: 20, shoulder_press: 15, cable_crunch: 15, goblet_squat: 12, seated_cable_row: 30, incline_chest_press: 20, romanian_deadlift: 10, leg_extension: 20, db_biceps_curl: 8, triceps_pushdown: 15 }

/** Şablondan zal addımları; çəki və təkrar keçən sessiyadan doldurulur. */
export function buildSteps(items: TemplateItem[], exercises: Exercise[], last: Record<string, SetLog>): GymStep[] {
  return items.map((it) => {
    const e = exercises.find((x) => x.id === it.exercise_id)!
    const l = last[e.id]
    if (e.measure === 'saniye') {
      return { exercise: e, item: it, sets: it.sets ?? 1, rest: e.rest_seconds, aLabel: 'Müddət, san', aStep: 5, a: l?.seconds ?? it.sec_min ?? 30, hasB: false, bLabel: '', bStep: 0, b: 0, target: `${it.sec_min}–${it.sec_max} san` }
    }
    if (e.measure === 'deqiqe') {
      return { exercise: e, item: it, sets: 1, rest: 0, aLabel: 'Dəqiqə', aStep: 1, a: it.minutes ?? 20, hasB: e.category === 'kardio', bLabel: 'Meyil, %', bStep: 1, b: Math.min(l?.incline_pct ?? 2, 3), target: `${it.minutes}${it.minutes_max ? '–' + it.minutes_max : ''} dəq · 5,0–5,5 km/s` }
    }
    const reps = it.reps_min === it.reps_max ? `${it.reps_min}` : `${it.reps_min}–${it.reps_max}`
    return { exercise: e, item: it, sets: it.sets ?? 1, rest: e.rest_seconds, aLabel: 'Çəki, kq', aStep: e.id === 'leg_press' ? 5 : 2.5, a: l?.weight_kg ?? DEFAULT_KG[e.id] ?? 0, hasB: true, bLabel: 'Təkrar', bStep: 1, b: l?.reps ?? it.reps_min ?? 10, target: `${reps} təkrar` }
  })
}
export function toSetLog(s: GymStep, setNo: number, a: number, b: number): SetLog {
  const e = s.exercise
  if (e.measure === 'saniye') return { exercise_id: e.id, set_no: setNo, reps: null, weight_kg: null, seconds: a, minutes: null, incline_pct: null, speed_kmh: null }
  if (e.measure === 'deqiqe') return { exercise_id: e.id, set_no: setNo, reps: null, weight_kg: null, seconds: null, minutes: a, incline_pct: s.hasB ? b : null, speed_kmh: null }
  return { exercise_id: e.id, set_no: setNo, reps: b, weight_kg: a, seconds: null, minutes: null, incline_pct: null, speed_kmh: null }
}
