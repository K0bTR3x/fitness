<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, X } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import BackButton from '../components/BackButton.vue'
import Bar from '../components/Bar.vue'
import { SLOTS, type FoodLog, type Recipe, type Slot } from '../lib/types'
import { addDays, isoWeekday, longDate } from '../lib/dates'
import { isAdherent, kcalState, logFromFood, logFromRecipe, logsTotals, planFor, recipeMacros, roundM } from '../lib/nutrition'

const app = useApp()
const route = useRoute()
const router = useRouter()
const date = computed(() => (route.params.date as string) || app.today)
const cat = computed(() => app.catalog!)
const g = computed(() => app.goals!)

type RowState = { slot: Slot; time: string; label: string; plan: Recipe; kind: 'plan' | 'skip' | 'other' | 'out'; portion: number; recipe: Recipe; outKcal: number; outProtein: number }
const rows = ref<RowState[]>([])
const extras = ref<FoodLog[]>([])
const openIdx = ref(-1)
const closed = ref(false)
const busy = ref(false)
const picker = ref<null | { type: 'recipe'; idx: number } | { type: 'extra' }>(null)
const err = ref('')

onMounted(async () => {
  const [logs, cl] = await Promise.all([repo.getFoodLogs(date.value, date.value), repo.getClosures(date.value, date.value)])
  closed.value = cl.length > 0
  const plan = planFor(cat.value, isoWeekday(date.value))
  rows.value = SLOTS.filter((s) => plan.some((p) => p.slot === s.slot)).map((s) => {
    const p = plan.find((x) => x.slot === s.slot)!.recipe
    const log = logs.find((l) => l.slot === s.slot)
    const base: RowState = { slot: s.slot, time: s.time, label: s.label, plan: p, kind: 'plan', portion: 1, recipe: p, outKcal: 600, outProtein: 30 }
    // gün bağlanıbsa və qeyd yoxdursa: "yemədim"; bağlanmayıbsa plan hazır işarəli gəlir
    if (!log) return closed.value ? { ...base, kind: 'skip', portion: 0 } : base
    if (log.source === 'kenarda') return { ...base, kind: 'out', outKcal: log.kcal, outProtein: log.protein }
    const r = cat.value.recipes.find((x) => x.id === log.recipe_id) ?? p
    return { ...base, kind: r.id === p.id ? 'plan' : 'other', recipe: r, portion: log.portion ?? 1 }
  })
  extras.value = logs.filter((l) => l.slot === 'elave')
})

function rowLog(r: RowState): FoodLog | null {
  if (r.kind === 'skip') return null
  if (r.kind === 'out') return { date: date.value, slot: r.slot, recipe_id: null, food_id: null, portion: null, grams: null, name: 'Kənarda yemək', source: 'kenarda', kcal_is_estimate: true, kcal: r.outKcal, protein: r.outProtein, fat: 0, carb: 0 }
  return logFromRecipe(cat.value, date.value, r.slot, r.recipe, r.portion, r.kind === 'other' ? 'diger' : 'plan')
}
const allLogs = computed(() => [...rows.value.map(rowLog).filter(Boolean) as FoodLog[], ...extras.value])
const totals = computed(() => roundM(logsTotals(allLogs.value)))
const ok = computed(() => isAdherent(totals.value, g.value))
const P: [number, string][] = [[0.5, '½'], [0.75, '¾'], [1, '1'], [1.25, '1¼'], [1.5, '1½']]
const portionLabel = (p: number) => P.find((x) => x[0] === p)?.[1] ?? String(p)
function note(r: RowState) {
  if (r.kind === 'skip') return 'Yemədim'
  if (r.kind === 'out') return 'Kənarda yedim · təxmini'
  if (r.kind === 'other') return 'Başqa yemək' + (r.portion !== 1 ? ' · porsiya ' + portionLabel(r.portion) : '')
  return r.portion !== 1 ? 'Porsiya ' + portionLabel(r.portion) : ''
}
const kcalOf = (r: RowState) => Math.round(rowLog(r)?.kcal ?? 0)

const recipeChoices = computed(() => {
  if (!picker.value || picker.value.type !== 'recipe') return []
  const slot = rows.value[picker.value.idx].slot
  const group = slot === 'ara_1' || slot === 'ara_2' ? ['ara_1', 'ara_2'] : [slot]
  const seen = new Set<string>()
  return cat.value.recipes.filter((r) => group.includes(r.slot)).filter((r) => { const k = r.name; if (seen.has(k)) return false; seen.add(k); return true })
    .map((r) => ({ r, m: roundM(recipeMacros(cat.value, r)) }))
})
const extraChoices = computed(() => {
  const portions: Record<string, number> = { alma: 150, armud: 200, naringi: 150, portagal: 200, kivi: 80, xurma: 100, nar_denesi: 100, banan: 120 }
  return cat.value.foods.map((f) => { const gr = portions[f.id] ?? f.unit_grams ?? 100; return { f, gr, kcal: Math.round((f.kcal_100g * gr) / 100) } })
})

async function close() {
  busy.value = true; err.value = ''
  try {
    await repo.closeDay(date.value, allLogs.value, { date: date.value, kcal_total: totals.value.kcal, protein_total: totals.value.protein, adherent: ok.value })
    closed.value = true; openIdx.value = -1
    await app.refresh()
  } catch (e: any) { err.value = 'Yadda saxlanmadı: ' + e.message } finally { busy.value = false }
}
async function reopen() { await repo.reopenDay(date.value); closed.value = false; await app.refresh() }

const tomorrow = computed(() => {
  const plan = planFor(cat.value, isoWeekday(addDays(date.value, 1)))
  const lunch = plan.find((p) => p.slot === 'nahar')
  const fruits = plan.filter((p) => p.slot === 'ara_1' || p.slot === 'ara_2').map((p) => p.recipe.name.toLowerCase())
  return lunch ? `İşə apar: ${lunch.recipe.name.toLowerCase()} (${Math.round(recipeMacros(cat.value, lunch.recipe).kcal)} kcal), ${fruits.join(', ')}.` : ''
})
const closedLine = computed(() => `${totals.value.kcal} kcal · ${totals.value.protein} q zülal. ` + (ok.value
  ? (totals.value.protein >= g.value.protein_g ? 'Zülal hədəfi də tamamdır. Yaxşı iş!' : 'Kalori hədəfdədir. Sabah zülala bir az diqqət.')
  : `Problem deyil, sabah ${g.value.kcal} kcal planına qayıdırıq. Bir gün nəticəni dəyişmir.`))
</script>

<template>
  <main class="h-dvh flex flex-col">
    <div v-if="closed" class="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center bg-surface">
      <div class="w-[104px] h-[104px] rounded-full bg-soft text-primary flex items-center justify-center pop"><Check :size="52" :stroke-width="2.5" /></div>
      <h1 class="m-0 text-[28px] font-bold">Gün bağlandı</h1>
      <span class="text-[15px] font-bold rounded-full px-3.5 py-1.5" :class="ok ? 'bg-soft text-primary-strong' : 'bg-panel text-ink-2'">{{ ok ? 'Uyğun gün' : 'Hədəfdən kənar gün' }}</span>
      <p class="num m-0 text-[17px] text-ink-2 leading-normal">{{ closedLine }}</p>
      <div v-if="tomorrow" class="bg-panel rounded-2xl px-4 py-3.5 text-left w-full flex flex-col gap-1">
        <span class="eyebrow">Sabahın planı</span>
        <span class="text-[15px] leading-snug">{{ tomorrow }}</span>
      </div>
      <button type="button" class="w-full h-[60px] rounded-2xl border-0 bg-primary text-white text-lg font-bold" @click="router.replace('/')">Bu günə qayıt</button>
      <button type="button" class="h-11 border-0 bg-transparent text-muted text-[15px]" @click="reopen">Yenidən aç</button>
    </div>

    <template v-else>
      <div class="bg-surface border-b border-line px-4 pb-3.5 flex flex-col gap-3" style="padding-top: max(20px, calc(env(safe-area-inset-top) + 8px))">
        <div class="flex items-center gap-3">
          <BackButton />
          <div class="flex flex-col"><h1 class="m-0 text-[22px] font-bold">{{ date === app.today ? 'Günü bağla' : 'Dünəni bağla' }}</h1><span class="text-[13px] text-muted">{{ longDate(date) }}</span></div>
        </div>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="bg-panel rounded-[14px] px-3 py-2.5 flex flex-col gap-1.5">
            <div class="flex justify-between items-baseline"><span class="text-[13px] text-muted">Kalori</span>
              <span class="text-xs font-bold rounded-full px-2 py-0.5" :class="kcalState(totals.kcal, g) === 'Uyğun' ? 'bg-soft text-primary-strong' : 'bg-track text-ink-2'">{{ kcalState(totals.kcal, g) }}</span></div>
            <span class="num text-2xl font-bold">{{ totals.kcal }} <span class="text-sm text-muted font-medium">/ {{ g.kcal }}</span></span>
            <Bar :value="totals.kcal" :max="g.kcal" :h="8" />
          </div>
          <div class="bg-panel rounded-[14px] px-3 py-2.5 flex flex-col gap-1.5">
            <span class="text-[13px] text-muted">Zülal</span>
            <span class="num text-2xl font-bold">{{ totals.protein }} <span class="text-sm text-muted font-medium">/ {{ g.protein_g }} q</span></span>
            <Bar :value="totals.protein" :max="g.protein_g" :h="8" />
          </div>
        </div>
      </div>

      <div class="scroll flex-1 overflow-y-auto px-4 pt-4 pb-6 flex flex-col gap-2.5">
        <span class="text-[15px] text-ink-2 leading-snug">Plan üzrə yemisənsə, heç nə etmə. Fərqli olan sətirə toxun.</span>
        <div v-for="(r, i) in rows" :key="r.slot" class="bg-surface rounded-2xl border overflow-hidden" :class="openIdx === i ? 'border-primary' : 'border-line'">
          <button type="button" :aria-expanded="openIdx === i" class="flex items-center gap-3 w-full min-h-16 px-3 py-2.5 border-0 bg-transparent text-left text-ink" @click="openIdx = openIdx === i ? -1 : i">
            <span class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center box-border" :class="r.kind !== 'skip' ? 'bg-primary text-white' : 'bg-surface border-2 border-line'">
              <Check v-if="r.kind !== 'skip'" :size="18" :stroke-width="3" />
            </span>
            <span class="flex-1 flex flex-col gap-0.5 min-w-0">
              <span class="num text-[13px] text-muted">{{ r.time }} · {{ r.label }}</span>
              <span class="text-base font-semibold leading-tight" :class="r.kind === 'skip' ? 'text-faint line-through' : ''">{{ r.kind === 'out' ? 'Kənarda yemək' : r.recipe.name }}</span>
              <span v-if="note(r)" class="text-[13px] text-primary-strong font-semibold">{{ note(r) }}</span>
            </span>
            <span class="num text-[15px] font-semibold whitespace-nowrap text-ink-2">{{ kcalOf(r) }} kcal</span>
          </button>
          <div v-if="openIdx === i" class="px-3 pb-3 flex flex-col gap-2.5">
            <template v-if="r.kind === 'out'">
              <span class="text-[13px] text-muted font-semibold">Təxmini kalori və zülal</span>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex flex-col gap-1 text-[13px] text-muted">kcal<input v-model.number="r.outKcal" type="number" inputmode="numeric" class="num h-12 rounded-xl border border-line bg-panel text-ink text-lg font-bold px-3" /></label>
                <label class="flex flex-col gap-1 text-[13px] text-muted">zülal, q<input v-model.number="r.outProtein" type="number" inputmode="numeric" class="num h-12 rounded-xl border border-line bg-panel text-ink text-lg font-bold px-3" /></label>
              </div>
              <span class="text-xs text-muted">Nümunə: dönər (orta) ≈ 600 kcal · 30 q zülal. Ac qalaraq kompensasiya etmə: axşam yeməyini toyuq + qatıq saxla.</span>
            </template>
            <template v-else-if="r.kind !== 'skip'">
              <span class="text-[13px] text-muted font-semibold">Porsiya</span>
              <div class="grid grid-cols-5 gap-1.5">
                <button v-for="p in P" :key="p[0]" type="button" class="h-12 rounded-xl text-[17px] font-bold border" :class="r.portion === p[0] ? 'bg-primary text-white border-primary' : 'bg-panel text-ink border-line'" @click="r.portion = p[0]">{{ p[1] }}</button>
              </div>
            </template>
            <div class="grid grid-cols-3 gap-1.5">
              <button type="button" class="h-12 rounded-xl border text-sm font-semibold" :class="r.kind === 'skip' ? 'bg-soft border-soft-line text-primary-strong' : 'bg-surface border-line text-ink'"
                @click="r.kind === 'skip' ? Object.assign(r, { kind: 'plan', portion: 1, recipe: r.plan }) : Object.assign(r, { kind: 'skip', portion: 0 }); openIdx = -1">{{ r.kind === 'skip' ? 'Yedim' : 'Yemədim' }}</button>
              <button type="button" class="h-12 rounded-xl border border-line bg-surface text-ink text-sm font-semibold" @click="picker = { type: 'recipe', idx: i }">Başqa yemək</button>
              <button type="button" class="h-12 rounded-xl border text-sm font-semibold" :class="r.kind === 'out' ? 'bg-soft border-soft-line text-primary-strong' : 'bg-surface border-line text-ink'" @click="Object.assign(r, { kind: 'out' })">Kənarda yedim</button>
            </div>
          </div>
        </div>

        <div v-for="(x, j) in extras" :key="j" class="bg-surface rounded-2xl border border-line min-h-16 px-3 py-2.5 flex items-center gap-3">
          <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0"><Check :size="18" :stroke-width="3" /></span>
          <span class="flex-1 flex flex-col gap-0.5"><span class="text-[13px] text-muted">Plandan kənar</span><span class="text-base font-semibold">{{ x.name }}</span></span>
          <span class="num text-[15px] font-semibold text-ink-2">{{ Math.round(x.kcal) }} kcal</span>
          <button type="button" aria-label="Sil" class="w-11 h-11 rounded-full border-0 bg-panel text-muted flex items-center justify-center" @click="extras.splice(j, 1)"><X :size="18" /></button>
        </div>
        <button type="button" class="h-[52px] rounded-[14px] border-[1.5px] border-dashed border-faint bg-transparent text-ink-2 text-base font-semibold" @click="picker = { type: 'extra' }">+ Əlavə</button>
        <span v-if="err" class="text-sm text-danger font-semibold">{{ err }}</span>
      </div>

      <div class="bg-surface border-t border-line px-4 pt-3 safe-bottom">
        <button type="button" :disabled="busy" class="w-full h-16 rounded-2xl border-0 bg-primary text-white text-xl font-bold disabled:opacity-60" @click="close">{{ busy ? 'Yazılır…' : 'Günü bağla' }}</button>
      </div>
    </template>

    <!-- seçim pəncərəsi -->
    <div v-if="picker" class="fixed inset-0 z-30 bg-black/40" @click.self="picker = null">
      <div class="absolute left-1/2 -translate-x-1/2 w-full max-w-[480px] bottom-0 max-h-[75dvh] bg-surface rounded-t-[28px] flex flex-col safe-bottom">
        <div class="flex justify-between items-center px-4 pt-4 pb-2">
          <h2 class="m-0 text-xl font-bold">{{ picker.type === 'recipe' ? 'Başqa yemək seç' : 'Plandan kənar əlavə' }}</h2>
          <button type="button" aria-label="Bağla" class="w-11 h-11 rounded-full bg-panel border-0 text-ink flex items-center justify-center" @click="picker = null"><X :size="20" /></button>
        </div>
        <div class="scroll overflow-y-auto px-4 pb-4 flex flex-col gap-2">
          <template v-if="picker.type === 'recipe'">
            <button v-for="c in recipeChoices" :key="c.r.id" type="button" class="text-left px-3.5 py-3 rounded-[14px] border border-line bg-surface text-ink"
              @click="Object.assign(rows[(picker as any).idx], { kind: c.r.id === rows[(picker as any).idx].plan.id ? 'plan' : 'other', recipe: c.r, portion: 1 }); picker = null; openIdx = -1">
              <span class="block text-base font-semibold">{{ c.r.name }}</span>
              <span class="num block text-[13px] text-muted">{{ c.m.kcal }} kcal · {{ c.m.protein }} q zülal</span>
            </button>
          </template>
          <template v-else>
            <button v-for="c in extraChoices" :key="c.f.id" type="button" class="text-left px-3.5 py-3 rounded-[14px] border border-line bg-surface text-ink flex justify-between items-center"
              @click="extras.push(logFromFood(date, c.f, c.gr)); picker = null">
              <span class="text-base font-semibold">{{ c.f.name }}</span>
              <span class="num text-[13px] text-muted">{{ c.gr }} q · {{ c.kcal }} kcal</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </main>
</template>
