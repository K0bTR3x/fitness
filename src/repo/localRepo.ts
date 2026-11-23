// Demo rejimi: Supabase olmadan, hər şey bu telefonun yaddaşında (localStorage).
import seed from '../data/seed.json'
import type { Catalog, Checkpoint, DayClosure, FoodLog, Goals, Profile, SetLog, WaterLog, WeightEntry } from '../lib/types'
import type { Repo } from './types'
import { addDays, todayISO, weekStart } from '../lib/dates'

interface DB {
  email: string | null
  weights: WeightEntry[]; waist: { date: string; waist_cm: number }[]
  sleep: Record<string, { hours: number | null; confirmed: boolean }>
  water: WaterLog[]; food: FoodLog[]; closures: DayClosure[]
  workouts: { date: string; template_id: string; status: string; sets: SetLog[] }[]
  checkpoints: Checkpoint[]; seq: number
}
const KEY = 'fd-demo-v1'
let mem: DB | null = null

function fresh(): DB {
  return {
    email: null, weights: [], waist: [], sleep: {}, water: [], food: [], closures: [], workouts: [], seq: 1,
    checkpoints: seed.checkpoints.map((c, i) => ({ ...c, id: i + 1, status: 'gozleyir', reached_week: null, reached_avg_kg: null })) as Checkpoint[],
  }
}
function load(): DB {
  if (mem) return mem
  try { const raw = localStorage.getItem(KEY); mem = raw ? { ...fresh(), ...JSON.parse(raw) } : fresh() } catch { mem = fresh() }
  return mem!
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch { /* yaddaş yoxdursa, yalnız bu sessiya */ } }
const tx = <T>(fn: (db: DB) => T): Promise<T> => { const db = load(); const r = fn(db); save(); return Promise.resolve(r) }
const between = (d: string, a: string, b: string) => d >= a && d <= b

export const localRepo: Repo = {
  mode: 'demo',
  currentEmail: () => tx((db) => db.email),
  sendCode: async () => { await new Promise((r) => setTimeout(r, 400)) },
  verifyCode: (email, code) => tx((db) => { if (!/^\d{6}$/.test(code)) throw new Error('Kod səhvdir'); db.email = email }),
  signOut: () => tx((db) => { db.email = null }),
  ensureUser: async () => {},
  loadCatalog: async () => seed as unknown as Catalog,
  getProfile: async () => seed.profile as Profile,
  getGoals: async () => seed.goals as Goals,
  getCheckpoints: () => tx((db) => db.checkpoints),
  getWeights: (a, b) => tx((db) => db.weights.filter((w) => between(w.date, a, b)).sort((x, y) => x.date.localeCompare(y.date))),
  upsertWeight: (date, kg) => tx((db) => { db.weights = db.weights.filter((w) => w.date !== date).concat({ date, weight_kg: kg }) }),
  getWaist: (upTo) => tx((db) => db.waist.filter((w) => w.date <= upTo).sort((x, y) => x.date.localeCompare(y.date))),
  upsertWaist: (date, cm) => tx((db) => { db.waist = db.waist.filter((w) => w.date !== date).concat({ date, waist_cm: cm }) }),
  getSleep: (date) => tx((db) => db.sleep[date] ?? { hours: null, confirmed: false }),
  upsertSleep: (date, hours, confirmed) => tx((db) => { db.sleep[date] = { hours, confirmed } }),
  getWater: (date) => tx((db) => db.water.filter((w) => w.date === date)),
  addWater: (date, ml) => tx((db) => { const w = { id: db.seq++, date, ml, logged_at: new Date().toISOString() }; db.water.push(w); return w }),
  deleteWater: (id) => tx((db) => { db.water = db.water.filter((w) => w.id !== id) }),
  getFoodLogs: (a, b) => tx((db) => db.food.filter((f) => between(f.date, a, b))),
  setSlotLog: (date, slot, log) => tx((db) => {
    db.food = db.food.filter((f) => !(f.date === date && f.slot === slot))
    if (log) db.food.push({ ...log, id: db.seq++ })
  }),
  addExtraLog: (log) => tx((db) => { const l = { ...log, id: db.seq++ }; db.food.push(l); return l }),
  deleteLog: (id) => tx((db) => { db.food = db.food.filter((f) => f.id !== id) }),
  closeDay: (date, logs, closure) => tx((db) => {
    db.food = db.food.filter((f) => f.date !== date).concat(logs.map((l) => ({ ...l, id: db.seq++ })))
    db.closures = db.closures.filter((c) => c.date !== date).concat(closure)
  }),
  reopenDay: (date) => tx((db) => { db.closures = db.closures.filter((c) => c.date !== date) }),
  getClosures: (a, b) => tx((db) => db.closures.filter((c) => between(c.date, a, b))),
  getWorkouts: (a, b) => tx((db) => db.workouts.filter((w) => between(w.date, a, b)).map(({ sets, ...w }) => w)),
  saveWorkout: (s) => tx((db) => { db.workouts = db.workouts.filter((w) => w.date !== s.date).concat(s) }),
  lastSets: (ids) => tx((db) => {
    const out: Record<string, SetLog> = {}
    for (const w of [...db.workouts].sort((a, b) => b.date.localeCompare(a.date)))
      for (const st of w.sets) if (ids.includes(st.exercise_id) && !out[st.exercise_id]) out[st.exercise_id] = st
    return out
  }),
  // Supabase versiyası ilə eyni qayda: 7/7 çəki, ortalama ≤ hədəf
  evaluateLastWeek: () => tx((db) => {
    const ws = addDays(weekStart(todayISO()), -7)
    const xs = db.weights.filter((w) => weekStart(w.date) === ws)
    if (xs.length < 7) return 0
    const avg = Math.round((xs.reduce((s, w) => s + w.weight_kg, 0) / 7) * 10) / 10
    let n = 0
    for (const c of db.checkpoints) if (c.status === 'gozleyir' && c.target_kg >= avg) { c.status = 'hedefe_catildi'; c.reached_week = ws; c.reached_avg_kg = avg; n++ }
    return n
  }),
}
