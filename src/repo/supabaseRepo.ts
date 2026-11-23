import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Catalog, Checkpoint, DayClosure, FoodLog, Goals, Profile, SetLog, WaterLog } from '../lib/types'
import type { Repo } from './types'

const CATALOG_CACHE = 'fd-catalog-v1'
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))

function check<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message)
  return (r.data ?? []) as NonNullable<T>
}
// Qida qeydi: tətbiqdəki adlar (protein) ↔ bazadakı sütunlar (protein_g)
const toRow = (l: FoodLog) => ({
  date: l.date, slot: l.slot, recipe_id: l.recipe_id, food_id: l.food_id, portion: l.portion, grams: l.grams, name: l.name,
  kcal: l.kcal, protein_g: l.protein, fat_g: l.fat, carb_g: l.carb, source: l.source, kcal_is_estimate: l.kcal_is_estimate,
})
const fromRow = (r: any): FoodLog => ({
  id: r.id, date: r.date, slot: r.slot, recipe_id: r.recipe_id, food_id: r.food_id, portion: n(r.portion), grams: n(r.grams), name: r.name,
  kcal: Number(r.kcal), protein: Number(r.protein_g), fat: Number(r.fat_g), carb: Number(r.carb_g), source: r.source, kcal_is_estimate: r.kcal_is_estimate,
})

export function makeSupabaseRepo(url: string, key: string): Repo {
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  const uid = async () => {
    const { data } = await sb.auth.getSession()
    if (!data.session) throw new Error('Giriş lazımdır')
    return data.session.user.id
  }
  return {
    mode: 'supabase',
    async currentEmail() { const { data } = await sb.auth.getSession(); return data.session?.user.email ?? null },
    async sendCode(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
      if (error) throw new Error(error.message)
    },
    async verifyCode(email, token) {
      const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' })
      if (error) throw new Error('Kod səhvdir və ya vaxtı keçib')
    },
    async signOut() { await sb.auth.signOut() },
    async ensureUser() { check(await sb.rpc('init_user')) },
    async loadCatalog() {
      try {
        const [foods, recipes, items, plans, planItems, exercises, templates, tItems] = await Promise.all([
          sb.from('foods').select('*'), sb.from('recipes').select('*'), sb.from('recipe_items').select('*').order('sort'),
          sb.from('meal_plans').select('*').eq('is_active', true), sb.from('meal_plan_items').select('*'),
          sb.from('exercises').select('*'), sb.from('workout_templates').select('*'), sb.from('workout_template_items').select('*').order('sort'),
        ])
        const active = check(plans)[0]?.id
        const cat: Catalog = {
          foods: check(foods).map((f: any) => ({ ...f, kcal_100g: +f.kcal_100g, protein_100g: +f.protein_100g, fat_100g: +f.fat_100g, carb_100g: +f.carb_100g, unit_grams: n(f.unit_grams) })),
          recipes: check(recipes).map((r: any) => ({ ...r, items: check(items).filter((i: any) => i.recipe_id === r.id).map((i: any) => ({ food_id: i.food_id, grams: +i.grams })) })),
          meal_plan: check(planItems).filter((p: any) => p.meal_plan_id === active).map((p: any) => ({ weekday: p.weekday, slot: p.slot, recipe_id: p.recipe_id })),
          exercises: check(exercises),
          workout_templates: check(templates).map((t: any) => ({ ...t, items: check(tItems).filter((i: any) => i.template_id === t.id) })),
        }
        try { localStorage.setItem(CATALOG_CACHE, JSON.stringify(cat)) } catch {}
        return cat
      } catch (e) {
        const raw = (() => { try { return localStorage.getItem(CATALOG_CACHE) } catch { return null } })()
        if (raw) return JSON.parse(raw) as Catalog
        throw e
      }
    },
    async getProfile() {
      const r: any = check(await sb.from('profiles').select('*').single())
      return { start_date: r.start_date, start_weight_kg: +r.start_weight_kg, target_12w_kg: +r.target_12w_kg, height_cm: +r.height_cm, est_body_fat_pct: n(r.est_body_fat_pct) } as Profile
    },
    async getGoals(date) {
      const r: any = check(await sb.from('goal_settings').select('*').lte('effective_from', date).order('effective_from', { ascending: false }).limit(1).single())
      return r as Goals
    },
    async getCheckpoints() {
      return check(await sb.from('checkpoints').select('*').order('sort')).map((c: any) => ({ ...c, target_kg: +c.target_kg, reached_avg_kg: n(c.reached_avg_kg) })) as Checkpoint[]
    },
    async getWeights(a, b) {
      return check(await sb.from('weight_entries').select('date, weight_kg').gte('date', a).lte('date', b).order('date')).map((w: any) => ({ date: w.date, weight_kg: +w.weight_kg }))
    },
    async upsertWeight(date, kg) {
      check(await sb.from('weight_entries').upsert({ user_id: await uid(), date, weight_kg: kg }, { onConflict: 'user_id,date' }))
    },
    async getWaist(upTo) {
      return check(await sb.from('body_measurements').select('date, waist_cm').lte('date', upTo).not('waist_cm', 'is', null).order('date')).map((w: any) => ({ date: w.date, waist_cm: +w.waist_cm }))
    },
    async upsertWaist(date, cm) {
      check(await sb.from('body_measurements').upsert({ user_id: await uid(), date, waist_cm: cm }, { onConflict: 'user_id,date' }))
    },
    async getSleep(date) {
      const r: any = check(await sb.from('daily_checkins').select('sleep_hours, sleep_confirmed').eq('date', date).maybeSingle())
      return { hours: n(r?.sleep_hours), confirmed: !!r?.sleep_confirmed }
    },
    async upsertSleep(date, hours, confirmed) {
      check(await sb.from('daily_checkins').upsert({ user_id: await uid(), date, sleep_hours: hours, sleep_confirmed: confirmed, sleep_source: 'manual' }, { onConflict: 'user_id,date' }))
    },
    async getWater(date) {
      return check(await sb.from('water_logs').select('id, date, ml, logged_at').eq('date', date).order('logged_at')) as WaterLog[]
    },
    async addWater(date, ml) {
      return check(await sb.from('water_logs').insert({ date, ml }).select('id, date, ml, logged_at').single()) as WaterLog
    },
    async deleteWater(id) { check(await sb.from('water_logs').delete().eq('id', id)) },
    async getFoodLogs(a, b) {
      return check(await sb.from('food_logs').select('*').gte('date', a).lte('date', b).order('logged_at')).map(fromRow)
    },
    async setSlotLog(date, slot, log) {
      check(await sb.from('food_logs').delete().eq('date', date).eq('slot', slot))
      if (log) check(await sb.from('food_logs').insert(toRow(log)))
    },
    async addExtraLog(log) {
      return fromRow(check(await sb.from('food_logs').insert(toRow(log)).select('*').single()))
    },
    async deleteLog(id) { check(await sb.from('food_logs').delete().eq('id', id)) },
    async closeDay(date, logs, c) {
      check(await sb.from('food_logs').delete().eq('date', date))
      if (logs.length) check(await sb.from('food_logs').insert(logs.map(toRow)))
      check(await sb.from('day_closures').upsert({ user_id: await uid(), date, kcal_total: c.kcal_total, protein_total: c.protein_total, adherent: c.adherent, closed_at: new Date().toISOString() }, { onConflict: 'user_id,date' }))
    },
    async reopenDay(date) { check(await sb.from('day_closures').delete().eq('date', date)) },
    async getClosures(a, b) {
      return check(await sb.from('day_closures').select('date, kcal_total, protein_total, adherent').gte('date', a).lte('date', b)).map((c: any) => ({ ...c, kcal_total: +c.kcal_total, protein_total: +c.protein_total })) as DayClosure[]
    },
    async getWorkouts(a, b) {
      return check(await sb.from('workout_sessions').select('date, template_id, status').gte('date', a).lte('date', b))
    },
    async saveWorkout(s) {
      const sess: any = check(await sb.from('workout_sessions').upsert({ user_id: await uid(), date: s.date, template_id: s.template_id, status: s.status, finished_at: new Date().toISOString() }, { onConflict: 'user_id,date' }).select('id').single())
      check(await sb.from('workout_sets').delete().eq('session_id', sess.id))
      if (s.sets.length) check(await sb.from('workout_sets').insert(s.sets.map((x) => ({ ...x, session_id: sess.id }))))
    },
    async lastSets(ids) {
      if (!ids.length) return {}
      const rows: any[] = check(await sb.from('workout_sets').select('exercise_id, set_no, reps, weight_kg, seconds, minutes, incline_pct, speed_kmh, done_at').in('exercise_id', ids).order('done_at', { ascending: false }).limit(200))
      const out: Record<string, SetLog> = {}
      for (const r of rows) if (!out[r.exercise_id]) out[r.exercise_id] = { ...r, weight_kg: n(r.weight_kg), incline_pct: n(r.incline_pct), speed_kmh: n(r.speed_kmh), minutes: n(r.minutes) }
      return out
    },
    async evaluateLastWeek() { return Number(check(await sb.rpc('evaluate_last_week'))) || 0 },
    async savePushSubscription(sub) {
      const k = sub.keys ?? {}
      if (!sub.endpoint || !k.p256dh || !k.auth) throw new Error('Abunə məlumatı natamamdır.')
      check(await sb.from('push_subscriptions').upsert(
        { endpoint: sub.endpoint, p256dh: k.p256dh, auth: k.auth, user_agent: navigator.userAgent.slice(0, 200) },
        { onConflict: 'endpoint' }).select('id'))
    },
    async deletePushSubscription(endpoint) { check(await sb.from('push_subscriptions').delete().eq('endpoint', endpoint).select('id')) },
    async sendTestPush() {
      const { data, error } = await sb.functions.invoke('push-tick', { body: { test: true } })
      if (error) throw new Error('Funksiya cavab vermədi. Supabase-də push-tick funksiyası qurulubmu?')
      return Number((data as { sent?: number })?.sent ?? 0)
    },
  }
}
