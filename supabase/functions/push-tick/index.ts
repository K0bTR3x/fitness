// Supabase Edge Function: push-tick
// Hər 5 dəqiqədən bir pg_cron çağırır (x-cron-secret ilə). Vaxtı çatan xatırlatmaları göndərir.
// Tətbiqdən {test:true} + istifadəçi tokeni ilə çağırılsa, sınaq bildirişi göndərir.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET (SUPABASE_URL və SUPABASE_SERVICE_ROLE_KEY özü var).
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const TZ = 'Asia/Baku'
const WINDOW_MIN = 10 // cron 5 dəqiqədən bir: bir dəfə qaçırılsa belə, növbətidə tutulur
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

webpush.setVapidDetails('mailto:noreply@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

type Msg = { key: string; at: string; title: string; body: string; url: string; skip?: boolean }
type Sub = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string }

function bakuNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]))
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), weekday: wd }
}
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))

const SLOTS: Record<string, { at: string; label: string }> = {
  seher: { at: '07:30', label: 'Səhər yeməyi' },
  ara_1: { at: '10:30', label: 'Meyvə vaxtı' },
  nahar: { at: '13:00', label: 'Nahar' },
  ara_2: { at: '16:30', label: 'Meyvə vaxtı' },
  axsam: { at: '20:15', label: 'Axşam yeməyi' },
}
const WATER = ['09:30', '11:00', '12:30', '14:30', '16:00', '17:30']
const MOVE = ['11:30', '15:30']

async function buildMessages(userId: string, date: string, weekday: number): Promise<Msg[]> {
  const [plan, tpl, weight, foods, water, closed, goals] = await Promise.all([
    db.from('meal_plan_items').select('slot, recipes(name), meal_plans!inner(is_active)').eq('weekday', weekday).eq('meal_plans.is_active', true),
    db.from('workout_templates').select('code, name, kind').eq('weekday', weekday).maybeSingle(),
    db.from('weight_entries').select('id').eq('user_id', userId).eq('date', date).maybeSingle(),
    db.from('food_logs').select('slot').eq('user_id', userId).eq('date', date),
    db.from('water_logs').select('ml').eq('user_id', userId).eq('date', date),
    db.from('day_closures').select('date').eq('user_id', userId).eq('date', date).maybeSingle(),
    db.from('goal_settings').select('water_ml, water_training_bonus_ml').eq('user_id', userId).lte('effective_from', date).order('effective_from', { ascending: false }).limit(1).maybeSingle(),
  ])
  const eaten = new Set((foods.data ?? []).map((f) => f.slot))
  const waterMl = (water.data ?? []).reduce((s, w) => s + w.ml, 0)
  const training = tpl.data && tpl.data.kind !== 'istirahet'
  const waterGoal = (goals.data?.water_ml ?? 2500) + (tpl.data?.kind === 'guc' ? goals.data?.water_training_bonus_ml ?? 500 : 0)
  const workday = weekday <= 5
  const msgs: Msg[] = [
    { key: 'ceki', at: '07:15', title: 'Səhər çəkisi ⚖️', body: 'Tualetdən sonra, yeməkdən əvvəl çəkil. 10 saniyəlik iş.', url: '#/seher', skip: !!weight.data },
  ]
  for (const p of plan.data ?? []) {
    const s = SLOTS[p.slot]
    // deno-lint-ignore no-explicit-any
    const name = (p as any).recipes?.name ?? ''
    msgs.push({ key: `yemek_${p.slot}`, at: s.at, title: `${s.label} · ${s.at}`, body: `${name}. Yedinsə, "Yedim" bas.`, url: '#/', skip: eaten.has(p.slot) })
  }
  if (workday) {
    for (const at of WATER) msgs.push({ key: `su_${at}`, at, title: 'Su vaxtı 💧', body: `Bir stəkan su iç. Bu gün: ${(waterMl / 1000).toFixed(1)} / ${(waterGoal / 1000).toFixed(1)} L`, url: '#/qeyd', skip: waterMl >= waterGoal })
    for (const at of MOVE) msgs.push({ key: `herekat_${at}`, at, title: 'Qalx, bir az hərəkət et 🚶', body: '3 dəqiqə gəz, çiyinlərini və belini aç.', url: '#/' })
  }
  if (training) msgs.push({ key: 'zal', at: '18:30', title: `Bu gün: ${tpl.data!.name}`, body: tpl.data!.kind === 'guc' ? 'Zal rejimini aç, istirahət taymeri hazırdır.' : 'Yüngül gün: gəzinti və press.', url: '#/zal' })
  msgs.push({ key: 'gunu_bagla', at: '21:30', title: 'Günü bağla 🌙', body: 'Bu gün nə yedin? 1 dəqiqəlik yoxlama.', url: '#/gunu-bagla', skip: !!closed.data })
  return msgs
}

async function send(sub: Sub, payload: object) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600 })
    return true
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const code = (e as any)?.statusCode
    if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', sub.id)
    console.error('push failed', code, String(e))
    return false
  }
}

async function tick() {
  const now = bakuNow()
  const { data: subs } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth')
  const byUser = new Map<string, Sub[]>()
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
  let sent = 0
  for (const [userId, list] of byUser) {
    const due = (await buildMessages(userId, now.date, now.weekday)).filter((m) => {
      const d = now.min - toMin(m.at)
      return d >= 0 && d < WINDOW_MIN
    })
    for (const m of due) {
      // Jurnal: eyni açar gündə 1 dəfə. Insert uğursuzdursa, artıq göndərilib.
      const { error } = await db.from('push_log').insert({ user_id: userId, day: now.date, key: m.key })
      if (error || m.skip) continue
      for (const s of list) if (await send(s, { title: m.title, body: m.body, url: m.url, tag: m.key })) sent++
    }
  }
  return { sent, at: now }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    if (req.headers.get('x-cron-secret')) {
      if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'forbidden' }, 403)
      return json(await tick())
    }
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = await db.auth.getUser(token)
    if (!u?.user) return json({ error: 'unauthorized' }, 401)
    const { data: subs } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').eq('user_id', u.user.id)
    let sent = 0
    for (const s of subs ?? []) if (await send(s, { title: 'Sınaq bildirişi ✅', body: 'Bildirişlər işləyir. Xatırlatmalar vaxtında gələcək.', url: '#/', tag: 'test' })) sent++
    return json({ sent, subscriptions: subs?.length ?? 0 })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})
