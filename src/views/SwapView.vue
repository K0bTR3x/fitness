<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, Ban } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import BackButton from '../components/BackButton.vue'
import type { Recipe, Slot } from '../lib/types'
import { SLOTS } from '../lib/types'
import { recipeMacros, roundM } from '../lib/nutrition'
import { isoWeekday, longDate, WD_FULL } from '../lib/dates'
import { signed } from '../lib/format'

const app = useApp()
const route = useRoute()
const router = useRouter()
const cat = computed(() => app.catalog!)
const date = computed(() => (route.query.date as string) || app.today)
const slot = ref<Slot>((route.params.slot as Slot) || 'nahar')
watch(() => route.params.slot, (s) => { if (s) slot.value = s as Slot })
const wd = computed(() => isoWeekday(date.value))
const plan = computed(() => app.planOn(date.value))
const cur = computed(() => plan.value.find((p) => p.slot === slot.value)?.recipe ?? null)
const curM = computed(() => (cur.value ? roundM(recipeMacros(cat.value, cur.value)) : null))
const ing = (r: Recipe) => r.items.map((it) => `${cat.value.foods.find((f) => f.id === it.food_id)!.name} ${Math.round(it.grams)} q`).join(', ')
const override = computed(() => app.overrides.find((o) => o.slot === slot.value && (o.date === date.value || (o.weekday === wd.value && !o.date))) ?? null)

const isFruit = (s: Slot) => s === 'ara_1' || s === 'ara_2'
const alts = computed(() => {
  if (!cur.value || !curM.value) return []
  const k0 = curM.value.kcal, p0 = curM.value.protein
  const seen = new Set<string>([cur.value.name])
  return cat.value.recipes
    .filter((r) => (isFruit(slot.value) ? isFruit(r.slot) : r.slot === slot.value))
    .filter((r) => { if (seen.has(r.name)) return false; seen.add(r.name); return true })
    .map((r) => ({ r, m: roundM(recipeMacros(cat.value, r)) }))
    .filter((x) => Math.abs(x.m.kcal - k0) <= Math.max(40, k0 * 0.15))
    .sort((a, b) => (Math.abs(a.m.kcal - k0) + Math.abs(a.m.protein - p0) * 4) - (Math.abs(b.m.kcal - k0) + Math.abs(b.m.protein - p0) * 4))
    .slice(0, 4)
})

// seçim → müddət → yaz
const pick = ref<Recipe | null>(null)
const busy = ref(false)
const err = ref('')
const done = ref(false)
watch(slot, () => { pick.value = null; done.value = false; err.value = '' })
const pickM = computed(() => (pick.value ? roundM(recipeMacros(cat.value, pick.value)) : null))
const dayTotal = computed(() => {
  const t = plan.value.reduce((s, p) => s + recipeMacros(cat.value, p.slot === slot.value && pick.value ? pick.value : p.recipe).kcal, 0)
  return Math.round(t)
})
const band = computed(() => {
  const g = app.goals!
  return Math.abs(dayTotal.value - g.kcal) <= g.kcal_tolerance ? 'hədəf zolağındadır' : dayTotal.value < g.kcal ? 'hədəfdən bir az azdır' : 'hədəfdən bir az çoxdur'
})
async function save(scope: 'day' | 'week') {
  if (!pick.value) return
  busy.value = true; err.value = ''
  try {
    await app.swapMeal(scope === 'day'
      ? { date: date.value, weekday: null, slot: slot.value, recipe_id: pick.value.id }
      : { date: null, weekday: wd.value, slot: slot.value, recipe_id: pick.value.id }, scope === 'week' ? date.value : null)
    done.value = true
  } catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { busy.value = false }
}
async function reset() {
  if (!override.value) return
  busy.value = true; err.value = ''
  try { await app.resetMeal(override.value); pick.value = null; done.value = false }
  catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { busy.value = false }
}
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pb-[120px]" style="padding-top: max(16px, calc(env(safe-area-inset-top) + 8px))">
    <div class="flex items-center gap-3">
      <BackButton to="/" />
      <div class="flex flex-col">
        <h1 class="m-0 text-[26px] font-bold tracking-tight">Yeməyi dəyiş</h1>
        <span class="text-[13px] text-muted">{{ longDate(date) }}</span>
      </div>
    </div>

    <div role="tablist" aria-label="Yemək" class="grid grid-cols-5 gap-1.5">
      <button v-for="s in SLOTS" :key="s.slot" type="button" role="tab" :aria-selected="slot === s.slot"
        class="h-14 min-w-0 px-1 rounded-xl border flex flex-col items-center justify-center"
        :class="slot === s.slot ? 'bg-primary border-primary text-white' : 'bg-surface border-line text-ink'" @click="router.replace({ path: '/deyis/' + s.slot, query: route.query })">
        <span class="num text-xs opacity-80">{{ s.time }}</span><span class="text-[13px] font-semibold">{{ s.label.replace(' yeməyi', '') }}</span>
      </button>
    </div>

    <template v-if="cur && curM && !done">
      <section v-if="!pick" class="flex flex-col gap-3">
        <div class="card p-4 flex flex-col gap-1">
          <span class="eyebrow">{{ override ? 'Dəyişdirilmiş plan' : 'İndiki plan' }}</span>
          <span class="text-lg font-semibold leading-snug">{{ cur.name }}</span>
          <span class="num text-sm text-ink-2">{{ curM.kcal }} kcal · {{ curM.protein }} q zülal</span>
          <span class="text-[13px] text-muted leading-snug">{{ ing(cur) }}</span>
          <button v-if="override" type="button" :disabled="busy" class="self-start mt-1 h-10 px-0 border-0 bg-transparent text-primary-strong text-sm font-semibold" @click="reset">
            Əsas menyuya qaytar{{ override.weekday ? ` (hər ${WD_FULL[override.weekday - 1].toLowerCase()})` : '' }}
          </button>
        </div>
        <div class="flex justify-between items-baseline px-1">
          <span class="text-lg font-semibold">Alternativlər</span>
          <span class="text-[13px] text-muted">kalori yaxın, zülal oxşar</span>
        </div>
        <div v-for="a in alts" :key="a.r.id" class="card p-4 flex flex-col gap-2">
          <span class="text-base font-semibold leading-snug">{{ a.r.name }}</span>
          <div class="flex gap-3 flex-wrap num text-sm">
            <span>{{ a.m.kcal }} kcal</span><span>{{ a.m.protein }} q zülal</span>
            <span :class="Math.abs(a.m.kcal - curM.kcal) <= 50 ? 'text-primary-strong' : 'text-muted'">{{ signed(a.m.kcal - curM.kcal, 0) }} kcal</span>
          </div>
          <span class="text-[13px] text-muted leading-snug">{{ ing(a.r) }}</span>
          <button type="button" class="h-11 rounded-xl border border-primary bg-surface text-primary-strong text-[15px] font-semibold" @click="pick = a.r">Bununla dəyiş</button>
        </div>
        <p v-if="!alts.length" class="m-0 card p-4 text-[15px] text-ink-2">Bu yemək üçün kalorisi yaxın alternativ yoxdur.</p>
        <div class="rounded-2xl bg-panel border border-line p-3.5 flex gap-2.5 items-start text-[13px] text-ink-2 leading-snug">
          <Ban :size="18" class="shrink-0 mt-px" /><span>Balıq, brokoli, kələm, kahı, bulqur, balqabaq, quzu əti və şirniyyat təklif olunmur.</span>
        </div>
      </section>

      <section v-else class="flex flex-col gap-3">
        <div class="card p-4 flex flex-col gap-1">
          <span class="eyebrow">Yeni seçim</span>
          <span class="text-lg font-semibold leading-snug">{{ pick.name }}</span>
          <span class="num text-sm text-ink-2">{{ pickM?.kcal }} kcal · {{ pickM?.protein }} q zülal</span>
        </div>
        <div class="card p-4 flex flex-col gap-1">
          <span class="text-sm text-muted">Günün yeni cəmi</span>
          <span class="num text-2xl font-bold">{{ dayTotal }} kcal</span>
          <span class="text-sm text-ink-2">{{ band }}</span>
        </div>
        <span class="text-base font-semibold px-1">Nə vaxta qədər?</span>
        <button type="button" :disabled="busy" class="h-14 rounded-xl border-0 bg-primary text-white text-base font-bold disabled:opacity-60" @click="save('day')">Yalnız bu gün</button>
        <button type="button" :disabled="busy" class="h-14 rounded-xl border border-line bg-surface text-ink text-base font-semibold disabled:opacity-60" @click="save('week')">Hər {{ WD_FULL[wd - 1].toLowerCase() }}</button>
        <button type="button" :disabled="busy" class="h-11 border-0 bg-transparent text-muted text-[15px] font-semibold" @click="pick = null">Geri</button>
        <span v-if="err" class="text-sm text-danger font-semibold" role="alert">{{ err }}</span>
      </section>
    </template>

    <section v-else-if="done && pick" class="flex flex-col gap-3 items-stretch">
      <div class="card p-5 flex flex-col items-center gap-2 text-center">
        <span class="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center"><Check :size="30" :stroke-width="3" /></span>
        <span class="text-lg font-semibold">Plan dəyişdi</span>
        <span class="text-[15px] text-ink-2">{{ pick.name }}</span>
        <span class="num text-sm text-muted">Günün cəmi: {{ dayTotal }} kcal · {{ band }}</span>
      </div>
      <RouterLink to="/alis-veris" class="card p-3.5 flex items-center gap-2.5 text-ink no-underline text-[15px]">🛒 <span>Alış-veriş siyahısı da yeniləndi. <b class="text-primary-strong">Siyahıya bax</b></span></RouterLink>
      <RouterLink to="/" class="h-14 rounded-xl bg-primary text-white text-base font-bold flex items-center justify-center no-underline">Hazır</RouterLink>
    </section>
  </main>
</template>
