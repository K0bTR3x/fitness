import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { repo } from '../repo'
import type { Catalog, Checkpoint, DayClosure, FoodLog, Goals, MealOverride, Profile, Slot, WaterLog, WeightEntry } from '../lib/types'
import { addDays, isoWeekday, todayISO, weekStart } from '../lib/dates'
import { logFromRecipe, logsTotals, planForDate } from '../lib/nutrition'

export const useApp = defineStore('app', () => {
  const email = ref<string | null>(null)
  const booted = ref(false)
  const error = ref<string | null>(null)
  const catalog = ref<Catalog | null>(null)
  const profile = ref<Profile | null>(null)
  const goals = ref<Goals | null>(null)
  const checkpoints = ref<Checkpoint[]>([])
  const today = ref(todayISO())
  const weights = ref<WeightEntry[]>([])
  const water = ref<WaterLog[]>([])
  const foodToday = ref<FoodLog[]>([])
  const closures = ref<DayClosure[]>([])
  const justOpened = ref(0)
  const overrides = ref<MealOverride[]>([])

  async function checkSession() {
    email.value = await repo.currentEmail()
    return email.value
  }

  async function boot() {
    error.value = null
    today.value = todayISO()
    await repo.ensureUser()
    const [cat, prof, g] = await Promise.all([repo.loadCatalog(), repo.getProfile(), repo.getGoals(today.value)])
    catalog.value = cat; profile.value = prof; goals.value = g
    try { justOpened.value = await repo.evaluateLastWeek() } catch { /* sonra yenidən */ }
    await refresh()
    booted.value = true
  }

  async function refresh() {
    today.value = todayISO()
    const from = addDays(weekStart(today.value), -35)
    const [w, wa, f, cps, cl, ov] = await Promise.all([
      repo.getWeights(from, today.value), repo.getWater(today.value),
      repo.getFoodLogs(today.value, today.value), repo.getCheckpoints(),
      repo.getClosures(addDays(today.value, -7), today.value),
      repo.getOverrides().catch(() => [] as MealOverride[]),
    ])
    weights.value = w; water.value = wa; foodToday.value = f; checkpoints.value = cps; closures.value = cl; overrides.value = ov
  }

  const todayPlan = computed(() => (catalog.value ? planForDate(catalog.value, today.value, overrides.value) : []))
  const planOn = (date: string) => (catalog.value ? planForDate(catalog.value, date, overrides.value) : [])
  async function swapMeal(o: Omit<MealOverride, 'id'>, alsoToday: string | null) {
    await repo.setOverride(o)
    if (alsoToday) await repo.deleteOverride({ date: alsoToday, weekday: null, slot: o.slot })
    overrides.value = await repo.getOverrides()
  }
  async function resetMeal(o: Pick<MealOverride, 'date' | 'weekday' | 'slot'>) {
    await repo.deleteOverride(o)
    overrides.value = await repo.getOverrides()
  }
  const todayTemplate = computed(() => catalog.value?.workout_templates.find((t) => t.weekday === isoWeekday(today.value)) ?? null)
  const isTrainingDay = computed(() => todayTemplate.value?.kind === 'guc')
  const waterMl = computed(() => water.value.reduce((s, w) => s + w.ml, 0))
  const waterGoal = computed(() => (goals.value ? goals.value.water_ml + (isTrainingDay.value ? goals.value.water_training_bonus_ml : 0) : 2500))
  const totalsToday = computed(() => logsTotals(foodToday.value))
  const todayWeight = computed(() => weights.value.find((w) => w.date === today.value) ?? null)
  const lastWeight = computed(() => [...weights.value].filter((w) => w.date < today.value).pop() ?? null)

  async function addWater(ml: number) {
    const w = await repo.addWater(today.value, ml)
    water.value = [...water.value, w]
    return w
  }
  async function undoWater(id: WaterLog['id']) {
    await repo.deleteWater(id)
    water.value = water.value.filter((w) => w.id !== id)
  }
  /** Su stəkanlarına toxunanda: hədəf sayına qədər əlavə et və ya sonuncunu sil */
  async function setGlasses(n: number) {
    const cur = Math.round(waterMl.value / 250)
    if (n > cur) for (let i = cur; i < n; i++) await addWater(250)
    else if (n < cur) {
      const last = [...water.value].reverse()
      for (let i = 0; i < cur - n && last[i]; i++) await undoWater(last[i].id)
    }
  }
  function slotLog(slot: Slot) { return foodToday.value.find((f) => f.slot === slot) ?? null }
  async function toggleEaten(slot: Slot) {
    const cat = catalog.value!
    const p = todayPlan.value.find((x) => x.slot === slot)
    if (!p) return
    const cur = slotLog(slot)
    await repo.setSlotLog(today.value, slot, cur ? null : logFromRecipe(cat, today.value, slot, p.recipe))
    foodToday.value = await repo.getFoodLogs(today.value, today.value)
  }
  async function addExtra(log: FoodLog) {
    const l = await repo.addExtraLog(log)
    foodToday.value = [...foodToday.value, l]
  }
  async function removeLog(id: NonNullable<FoodLog['id']>) {
    await repo.deleteLog(id)
    foodToday.value = foodToday.value.filter((f) => f.id !== id)
  }
  async function saveWeight(date: string, kg: number) {
    await repo.upsertWeight(date, kg)
    weights.value = [...weights.value.filter((w) => w.date !== date), { date, weight_kg: kg }].sort((a, b) => a.date.localeCompare(b.date))
    checkpoints.value = await repo.getCheckpoints()
  }
  async function signOut() {
    await repo.signOut()
    email.value = null; booted.value = false
  }

  return {
    email, booted, error, catalog, profile, goals, checkpoints, today, weights, water, foodToday, closures, justOpened, overrides, planOn, swapMeal, resetMeal,
    todayPlan, todayTemplate, isTrainingDay, waterMl, waterGoal, totalsToday, todayWeight, lastWeight,
    checkSession, boot, refresh, addWater, undoWater, setGlasses, slotLog, toggleEaten, addExtra, removeLog, saveWeight, signOut,
  }
})
