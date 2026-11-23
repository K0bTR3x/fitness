<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { X, Check, ChevronRight, Search, GlassWater, Milk, CupSoda } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { SLOTS, type FoodLog, type WaterLog } from '../lib/types'
import { fmt, fmtL, signed } from '../lib/format'
import { logFromFood, recipeMacros, roundM } from '../lib/nutrition'

const app = useApp()
const route = useRoute()
const router = useRouter()
const tab = ref<'w' | 's' | 'y'>((route.query.tab as any) || (app.todayWeight ? 's' : 'w'))
const saved = ref('')
const close = () => (window.history.state?.back ? router.back() : router.replace('/'))

// çəki: 0,1 kq addımla
const base = app.todayWeight?.weight_kg ?? app.lastWeight?.weight_kg ?? app.profile!.start_weight_kg
const w10 = ref(Math.round(base * 10))
const ref10 = app.lastWeight ? Math.round(app.lastWeight.weight_kg * 10) : null
const step = (d: number) => (w10.value = Math.max(400, Math.min(2500, w10.value + d)))
const diffTxt = computed(() => (ref10 === null ? 'Başlanğıc: ' + fmt(app.profile!.start_weight_kg) + ' kq' : `Son çəki ${fmt(ref10 / 10)} kq · ${signed((w10.value - ref10) / 10)} kq`))
const busy = ref(false)
async function saveWeight() {
  busy.value = true
  try {
    await app.saveWeight(app.today, w10.value / 10)
    saved.value = `${fmt(w10.value / 10)} kq bu günün səhər çəkisi kimi yazıldı. Həftəlik ortalamaya əlavə olundu.`
  } finally { busy.value = false }
}

// su
const lastWater = ref<WaterLog | null>(null)
const cups = [{ ml: 250, name: 'stəkan', icon: GlassWater }, { ml: 500, name: 'şüşə', icon: CupSoda }, { ml: 750, name: 'termos', icon: Milk }]
async function addWater(ml: number) { lastWater.value = await app.addWater(ml) }
async function undoWater() { if (lastWater.value) { await app.undoWater(lastWater.value.id); lastWater.value = null } }

// yemək
const meals = computed(() => SLOTS.map((s) => {
  const p = app.todayPlan.find((x) => x.slot === s.slot)
  const m = p ? roundM(recipeMacros(app.catalog!, p.recipe)) : null
  return { ...s, plan: p, m, eaten: !!app.slotLog(s.slot) }
}).filter((x) => x.plan))
const q = ref('')
const fruitPortions: Record<string, number> = { alma: 150, armud: 200, naringi: 150, portagal: 200, kivi: 80, xurma: 100, nar_denesi: 100, banan: 120 }
const extrasCatalog = computed(() => {
  const foods = app.catalog!.foods
  const list = q.value.trim()
    ? foods.filter((f) => f.name.toLowerCase().includes(q.value.trim().toLowerCase()))
    : foods.filter((f) => f.is_fruit || ['kesmik_5', 'qatiq_2_5', 'covdar_coreyi', 'yumurta'].includes(f.id))
  return list.slice(0, 8).map((f) => {
    const g = fruitPortions[f.id] ?? f.unit_grams ?? 100
    return { f, g, kcal: Math.round((f.kcal_100g * g) / 100) }
  })
})
const extrasToday = computed(() => app.foodToday.filter((f) => f.slot === 'elave'))
async function addExtra(x: { f: any; g: number }) { await app.addExtra(logFromFood(app.today, x.f, x.g) as FoodLog) }
const total = computed(() => roundM(app.totalsToday))
async function toggle(slot: any) { busy.value = true; try { await app.toggleEaten(slot) } finally { busy.value = false } }
</script>

<template>
  <div class="fixed inset-0 z-30 bg-black/40" @click.self="close">
    <div class="absolute left-1/2 -translate-x-1/2 w-full max-w-[480px] bottom-0 bg-surface rounded-t-[28px] flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.12)]" style="top: max(48px, env(safe-area-inset-top))">
      <div class="flex justify-center pt-2"><span class="w-10 h-[5px] rounded bg-line" /></div>
      <div class="flex justify-between items-center px-4 pt-2 pb-3">
        <h1 class="m-0 text-2xl font-bold">Tez qeyd</h1>
        <button type="button" aria-label="Bağla" class="w-11 h-11 rounded-full bg-panel border-0 text-ink flex items-center justify-center" @click="close"><X :size="22" /></button>
      </div>
      <div role="tablist" class="mx-4 p-1 rounded-[14px] bg-panel grid grid-cols-3 gap-1">
        <button v-for="t in [['w', 'Çəki'], ['s', 'Su'], ['y', 'Yemək']]" :key="t[0]" type="button" role="tab" :aria-selected="tab === t[0]"
          class="h-12 rounded-[10px] border-0 text-base font-semibold"
          :class="tab === t[0] ? 'bg-surface text-ink shadow-sm' : 'bg-transparent text-muted'" @click="tab = t[0] as any; saved = ''">{{ t[1] }}</button>
      </div>

      <div class="scroll flex-1 overflow-y-auto px-4 pt-4 pb-6 flex flex-col gap-3.5">
        <div v-if="saved" class="flex-1 flex flex-col items-center justify-center gap-3.5 text-center py-10 px-2">
          <div class="w-[88px] h-[88px] rounded-full bg-primary text-white flex items-center justify-center pop"><Check :size="44" :stroke-width="3" /></div>
          <span class="text-2xl font-bold">Yazıldı</span>
          <span class="text-base text-muted leading-snug">{{ saved }}</span>
          <button type="button" class="mt-3 w-full h-[60px] rounded-[14px] border-0 bg-primary text-white text-[17px] font-semibold" @click="close">Bu günə qayıt</button>
        </div>

        <template v-else-if="tab === 'w'">
          <div class="bg-panel rounded-2xl px-4 py-5 flex flex-col items-center gap-1.5">
            <span class="eyebrow">Bu səhərki çəki</span>
            <div class="flex items-baseline gap-1.5">
              <span class="num text-[64px] font-extrabold tracking-tight text-primary-strong">{{ fmt(w10 / 10) }}</span>
              <span class="text-xl text-muted">kq</span>
            </div>
            <span class="num text-[15px] text-muted">{{ diffTxt }}</span>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <button v-for="d in [-10, -1, 1, 10]" :key="d" type="button" class="num h-16 rounded-[14px] border border-line bg-surface text-ink text-lg font-bold" @click="step(d)">
              {{ d > 0 ? '+' : '−' }}{{ Math.abs(d) === 10 ? '1' : '0,1' }}
            </button>
          </div>
          <p class="m-0 text-sm leading-snug text-muted">Tualetdən sonra, yeməkdən əvvəl çəkil. Bir günlük dəyişmə çox vaxt sudur: checkpoint həftəlik ortalamaya baxır.</p>
          <RouterLink to="/seher" replace class="bg-surface border border-line rounded-[14px] px-3.5 py-3 flex items-center justify-between text-ink no-underline">
            <span class="flex flex-col gap-0.5"><span class="text-base font-semibold">Tam səhər ölçüsü</span><span class="text-[13px] text-muted">çəki + bel + yuxu</span></span>
            <ChevronRight :size="20" class="text-muted" />
          </RouterLink>
        </template>

        <template v-else-if="tab === 's'">
          <div class="bg-panel rounded-2xl px-4 py-4 flex flex-col gap-2.5">
            <div class="flex justify-between items-baseline"><span class="eyebrow">Bu gün içilib</span><span class="num text-[15px] text-muted">hədəf {{ fmtL(app.waterGoal) }} L</span></div>
            <span class="num text-5xl font-extrabold tracking-tight text-primary-strong">{{ fmtL(app.waterMl) }} <span class="text-xl font-medium text-muted">L</span></span>
            <div class="h-3.5 rounded-full bg-track overflow-hidden"><div class="h-full bg-primary rounded-full transition-all" :style="{ width: Math.min(100, Math.round((app.waterMl / app.waterGoal) * 100)) + '%' }" /></div>
            <span class="text-sm text-ink-2">{{ app.waterMl >= app.waterGoal ? 'Hədəfə çatdın, əla!' : 'Qalıb: ' + fmtL(app.waterGoal - app.waterMl) + ' L' }}</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="c in cups" :key="c.ml" type="button" class="h-[104px] rounded-2xl border border-line bg-surface text-ink flex flex-col items-center justify-center gap-1.5" @click="addWater(c.ml)">
              <component :is="c.icon" :size="28" class="text-primary" />
              <span class="num text-lg font-bold">{{ c.ml }} ml</span>
              <span class="text-xs text-muted">{{ c.name }}</span>
            </button>
          </div>
          <div v-if="lastWater" class="bg-soft rounded-[14px] px-3 py-2.5 flex items-center justify-between gap-2">
            <span class="num text-[15px] font-semibold text-primary-strong">+{{ lastWater.ml }} ml yazıldı</span>
            <button type="button" class="h-11 px-3.5 rounded-xl border border-soft-line bg-transparent text-primary-strong text-[15px] font-semibold" @click="undoWater">Geri al</button>
          </div>
          <p class="m-0 text-sm leading-snug text-muted">Hər toxunuş dərhal yazılır.</p>
        </template>

        <template v-else>
          <span class="eyebrow">Bu günün planı</span>
          <div class="shrink-0 bg-surface border border-line rounded-2xl overflow-hidden">
            <div v-for="(m, i) in meals" :key="m.slot" class="flex items-center gap-2.5 px-3 py-2.5" :class="i ? 'border-t border-line' : ''">
              <span class="num w-11 text-sm font-semibold text-muted shrink-0">{{ m.time }}</span>
              <span class="flex-1 min-w-0 flex flex-col gap-0.5">
                <span class="text-base font-semibold leading-tight">{{ m.plan!.recipe.name }}</span>
                <span class="num text-[13px] text-muted">{{ m.m!.kcal }} kcal · {{ m.m!.protein }} q zülal</span>
              </span>
              <button type="button" :disabled="busy" :aria-label="m.eaten ? m.plan!.recipe.name + ': yedim, geri al' : m.plan!.recipe.name + ': yedim kimi qeyd et'"
                class="h-11 min-w-[88px] px-3 rounded-xl text-[15px] font-semibold shrink-0"
                :class="m.eaten ? 'border border-soft-line bg-soft text-primary-strong' : 'border-0 bg-primary text-white'" @click="toggle(m.slot)">
                {{ m.eaten ? '✓ Yedim' : 'Yedim' }}
              </button>
            </div>
          </div>
          <span class="eyebrow mt-1">Plandan kənar</span>
          <div v-for="x in extrasToday" :key="String(x.id)" class="bg-soft rounded-[14px] px-3 py-2 flex items-center justify-between">
            <span class="num text-[15px] font-semibold text-primary-strong">✓ {{ x.name }} · {{ Math.round(x.kcal) }} kcal</span>
            <button type="button" class="h-10 px-3 rounded-lg border-0 bg-transparent text-primary-strong text-sm font-semibold" @click="app.removeLog(x.id!)">Sil</button>
          </div>
          <div class="h-[52px] rounded-xl border border-line bg-panel flex items-center gap-2.5 px-3">
            <Search :size="20" class="text-muted" />
            <input v-model="q" type="search" placeholder="Axtar: alma, kəsmik, pendir…" class="flex-1 min-w-0 border-0 outline-none bg-transparent text-base text-ink" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="x in extrasCatalog" :key="x.f.id" type="button" class="min-h-16 text-left px-3 py-2.5 rounded-[14px] border border-line bg-surface text-ink" @click="addExtra(x)">
              <span class="block text-[15px] font-semibold">+ {{ x.f.name }}</span>
              <span class="num block text-[13px] text-muted mt-0.5">{{ x.g }} q · {{ x.kcal }} kcal</span>
            </button>
          </div>
          <div class="bg-panel rounded-[14px] px-3.5 py-3 flex justify-between items-center">
            <span class="text-sm text-muted">Bu gün cəmi</span>
            <span class="num text-[17px] font-bold">{{ total.kcal }} kcal · {{ total.protein }} q zülal</span>
          </div>
        </template>
      </div>

      <div v-if="!saved && tab === 'w'" class="px-4 pt-3 border-t border-line bg-surface safe-bottom">
        <button type="button" :disabled="busy" class="w-full h-16 rounded-2xl border-0 bg-primary text-white text-lg font-bold disabled:opacity-60" @click="saveWeight">Çəkini yadda saxla</button>
      </div>
    </div>
  </div>
</template>
