import { describe, expect, it } from 'vitest'
import { computeBadges, forecastDate, pacePerWeek, paceTone, rolling7, strengthWeeks, weeklyAverages } from './progress'
import { addDays } from './dates'

const days = (start: string, vals: number[]) => vals.map((v, i) => ({ date: addDays(start, i), weight_kg: v }))

describe('progress', () => {
  it('rolling7 averages last 7 days', () => {
    const r = rolling7(days('2026-11-23', [101, 100, 99]))
    expect(r.map((x) => x.avg)).toEqual([101, 100.5, 100])
  })
  it('weekly averages and pace', () => {
    const ws = days('2026-11-23', [...Array(7).fill(101), ...Array(7).fill(100), ...Array(7).fill(99)])
    const w = weeklyAverages(ws)
    expect(w.map((x) => [x.avg, x.count])).toEqual([[101, 7], [100, 7], [99, 7]])
    expect(pacePerWeek(w)).toBe(-1)
  })
  it('forecast and tone', () => {
    expect(forecastDate(96, 93, -1, '2026-12-28')).toBe('2027-01-18')
    expect(forecastDate(96, 93, 0.2, '2026-12-28')).toBeNull()
    expect(paceTone(-0.9, 96.5).tone).toBe('normal')
    expect(paceTone(-1.5, 96.5).tone).toBe('suretli')
  })
  it('strength weeks need all strength days done', () => {
    const s = [{ date: '2026-11-23', status: 'tamamlandi' }, { date: '2026-11-25', status: 'tamamlandi' }, { date: '2026-11-27', status: 'tamamlandi' },
      { date: '2026-11-30', status: 'tamamlandi' }, { date: '2026-12-02', status: 'qismen' }]
    expect(strengthWeeks(s, [1, 3, 5], '2026-11-23', '2026-12-10')).toBe(1)
  })
  it('badges tiers', () => {
    const b = computeBadges({ weights: days('2026-11-23', Array(14).fill(100)), closures: [], proteinGoal: 170, strengthWeeksDone: 4, waterDays: 3, startWeight: 101, waistDrop: 3, programWeeks: 2 }, (n) => String(n))
    const by = Object.fromEntries(b.map((x) => [x.id, x]))
    expect(by.ilk.tier).toBe(1); expect(by.tam_hefte.tier).toBe(1); expect(by.zal.tier).toBe(2)
    expect(by.su.tier).toBe(0); expect(by.su.sub).toBe('3 / 7 gün'); expect(by.bel.tier).toBe(1); expect(by.ilk5.tier).toBe(0)
  })
})

import { advise, epley, strengthHistory } from './strength'
describe('strength', () => {
  const rows = [
    ...[1, 2, 3].map((n) => ({ date: '2026-11-24', exercise_id: 'leg_press', set_no: n, reps: 10, weight_kg: 60 })),
    ...[1, 2, 3].map((n) => ({ date: '2026-11-27', exercise_id: 'leg_press', set_no: n, reps: 12, weight_kg: 60 })),
    { date: '2026-11-27', exercise_id: 'plank', set_no: 1, reps: null, weight_kg: null },
  ]
  it('groups sessions, marks PR and advises increase', () => {
    const [h] = strengthHistory(rows)
    expect(h.sessions.length).toBe(2)
    expect(h.sessions[1].pr).toBe(true)
    expect(h.bestE1rm).toBeCloseTo(epley(60, 12))
    expect(advise(h, 12, 5, String).kind).toBe('artir')
  })
})
