<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronRight, Clock, Briefcase, UtensilsCrossed, Apple } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import BackButton from '../components/BackButton.vue'
import type { Recipe, Slot } from '../lib/types'
import { recipeMacros, roundM } from '../lib/nutrition'
import { guideFor } from '../data/recipeSteps'
import { WD_SHORT } from '../lib/dates'
import { fmt } from '../lib/format'

const app = useApp()
const route = useRoute()
const cat = computed(() => app.catalog!)
const SLOT_TXT: Record<Slot, string> = { seher: 'Səhər yeməyi', ara_1: 'Meyvə', nahar: 'Nahar', ara_2: 'Meyvə', axsam: 'Axşam yeməyi' }
const FILTERS = [
  { label: 'Hamısı', slots: null },
  { label: 'Səhər', slots: ['seher'] },
  { label: 'Nahar', slots: ['nahar'] },
  { label: 'Axşam', slots: ['axsam'] },
  { label: 'Meyvə', slots: ['ara_1', 'ara_2'] },
] as const
const filter = ref(0)

// Eyni adlı reseptlər (menyuda bir neçə gün) bir dəfə göstərilir
const unique = computed(() => {
  const seen = new Map<string, Recipe>()
  for (const r of cat.value.recipes) if (!seen.has(r.name + r.slot.replace(/_\d/, ''))) seen.set(r.name + r.slot.replace(/_\d/, ''), r)
  return [...seen.values()]
})
const list = computed(() => {
  const f = FILTERS[filter.value].slots as readonly string[] | null
  return unique.value.filter((r) => !f || f.includes(r.slot)).map((r) => ({ r, m: roundM(recipeMacros(cat.value, r)) }))
})
const isFruit = (s: Slot) => s === 'ara_1' || s === 'ara_2'

// detal
const cur = computed(() => (route.params.id ? cat.value.recipes.find((r) => r.id === route.params.id) ?? null : null))
const curM = computed(() => (cur.value ? roundM(recipeMacros(cat.value, cur.value)) : null))
const guide = computed(() => (cur.value ? guideFor(cur.value.id, cur.value.slot) : null))
const items = computed(() => cur.value?.items.map((it) => {
  const f = cat.value.foods.find((x) => x.id === it.food_id)!
  const units = f.unit_grams && f.unit_name ? ` (${Math.round(it.grams / f.unit_grams)} ${f.unit_name})` : ''
  return { name: f.name, g: `${Math.round(it.grams)} q${units}`, tag: f.state === 'hazır' ? '' : f.state }
}) ?? [])
const hasOil = computed(() => !!cur.value?.items.some((i) => i.food_id === 'bitki_yagi'))
const onDays = computed(() => {
  if (!cur.value) return ''
  const same = cat.value.recipes.filter((r) => r.name === cur.value!.name).map((r) => r.id)
  return [...new Set(cat.value.meal_plan.filter((p) => same.includes(p.recipe_id)).map((p) => p.weekday))].sort().map((d) => WD_SHORT[d - 1]).join(', ')
})
const tagCls = (t: string) => t === 'çiy' ? 'bg-warn-bg text-warn' : t === 'quru' ? 'bg-soft text-on-soft' : 'bg-panel text-ink-2'
</script>

<template>
  <!-- Detal -->
  <main v-if="cur && curM && guide" class="flex flex-col gap-4 px-4 pb-[140px]" style="padding-top: max(16px, calc(env(safe-area-inset-top) + 8px))">
    <div class="flex items-center gap-3">
      <BackButton to="/reseptler" label="Reseptlərə qayıt" />
      <span class="eyebrow">{{ SLOT_TXT[cur.slot] }}</span>
    </div>
    <div class="rounded-2xl bg-soft h-[132px] flex items-center justify-center text-primary-strong" aria-hidden="true">
      <component :is="isFruit(cur.slot) ? Apple : UtensilsCrossed" :size="56" :stroke-width="1.5" />
    </div>
    <h1 class="m-0 text-[26px] font-bold leading-tight tracking-tight" style="text-wrap: balance">{{ cur.name }}</h1>

    <div class="grid grid-cols-3 gap-2">
      <div class="card px-3 py-2.5 flex flex-col"><span class="text-xs text-muted">1 porsiya</span><span class="num text-lg font-bold">{{ curM.kcal }} kcal</span></div>
      <div class="card px-3 py-2.5 flex flex-col"><span class="text-xs text-muted">Zülal</span><span class="num text-lg font-bold">{{ curM.protein }} q</span></div>
      <div class="card px-3 py-2.5 flex flex-col"><span class="text-xs text-muted">Vaxt</span><span class="num text-lg font-bold flex items-center gap-1"><Clock :size="15" class="text-muted" />{{ guide.time }}</span></div>
    </div>

    <div v-if="cur.is_portable" class="rounded-2xl bg-soft p-3.5 flex gap-2.5 items-start text-[15px] leading-snug text-on-soft">
      <Briefcase :size="20" class="shrink-0 mt-0.5" />
      <span>İşə aparmaq olar: axşamdan bişirib qaba qoy. Salatı ayrıca qabda, yağsız apar.</span>
    </div>

    <section class="card overflow-hidden">
      <div class="flex justify-between items-baseline px-4 pt-3.5 pb-2">
        <span class="text-lg font-semibold">Ərzaqlar</span>
        <span class="text-[13px] text-muted">bişirməmişdən əvvəl</span>
      </div>
      <div v-for="(it, i) in items" :key="i" class="flex justify-between items-center gap-3 px-4 py-2.5 border-t border-line">
        <span class="text-[15px]">{{ it.name }}</span>
        <span class="num text-[15px] font-semibold whitespace-nowrap">{{ it.g }}<span v-if="it.tag" class="ml-1.5 text-[11px] font-semibold rounded-md px-1.5 py-px" :class="tagCls(it.tag)">{{ it.tag }}</span></span>
      </div>
    </section>

    <section class="card px-4 py-3.5 flex flex-col gap-3">
      <span class="text-lg font-semibold">Hazırlanması</span>
      <ol class="m-0 p-0 list-none flex flex-col gap-3">
        <li v-for="(st, i) in guide.steps" :key="i" class="flex gap-3 items-start">
          <span class="num w-7 h-7 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shrink-0">{{ i + 1 }}</span>
          <span class="text-[15px] leading-snug pt-0.5">{{ st }}</span>
        </li>
      </ol>
      <span v-if="guide.tip" class="text-sm text-ink-2">💡 {{ guide.tip }}</span>
    </section>

    <span v-if="hasOil" class="text-[13px] text-muted">Yağı ölçü qaşığı ilə ölç: 1 xörək qaşığı ≈ 10 q ≈ 88 kcal.</span>
    <span v-if="onDays" class="text-[13px] text-muted">Menyuda: {{ onDays }}</span>
  </main>

  <!-- Siyahı -->
  <main v-else class="flex flex-col gap-4 px-4 pb-[140px]" style="padding-top: max(16px, calc(env(safe-area-inset-top) + 8px))">
    <div class="flex items-center gap-3">
      <BackButton to="/teqvim" />
      <div class="flex flex-col">
        <h1 class="m-0 text-[26px] font-bold tracking-tight">Reseptlər</h1>
        <span class="num text-[13px] text-muted">{{ unique.length }} resept · 7 günlük menyudan</span>
      </div>
    </div>
    <div role="group" aria-label="Süzgəc" class="grid grid-cols-5 gap-1 bg-panel border border-line rounded-xl p-1">
      <button v-for="(f, i) in FILTERS" :key="f.label" type="button" :aria-pressed="filter === i"
        class="h-10 rounded-[9px] border-0 text-[13px] font-semibold"
        :class="filter === i ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'bg-transparent text-muted'" @click="filter = i">{{ f.label }}</button>
    </div>
    <div class="flex flex-col gap-2">
      <RouterLink v-for="x in list" :key="x.r.id" :to="'/reseptler/' + x.r.id" class="card px-3 py-3 flex items-center gap-3 text-ink no-underline">
        <span class="w-12 h-12 rounded-xl bg-soft text-primary-strong flex items-center justify-center shrink-0" aria-hidden="true">
          <component :is="isFruit(x.r.slot) ? Apple : UtensilsCrossed" :size="22" />
        </span>
        <span class="flex-1 min-w-0 flex flex-col gap-0.5">
          <span class="text-base font-semibold leading-snug">{{ x.r.name }}</span>
          <span class="num text-[13px] text-muted">{{ SLOT_TXT[x.r.slot] }} · {{ x.m.kcal }} kcal · <span class="text-primary-strong font-semibold">{{ fmt(x.m.protein, 0) }} q zülal</span></span>
        </span>
        <ChevronRight :size="20" class="text-muted shrink-0" />
      </RouterLink>
    </div>
  </main>
</template>
