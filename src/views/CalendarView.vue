<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, ChevronRight as Go, Check } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import BackButton from '../components/BackButton.vue'
import { SLOTS, type DayClosure, type FoodLog } from '../lib/types'
import { addDays, dayNum, isoWeekday, longDate, monthTitle, programWeek, WD_SHORT, weekDays } from '../lib/dates'
import { fmt, fmtL } from '../lib/format'
import { itemLabel, logsTotals, planFor, recipeMacros, roundM } from '../lib/nutrition'

const app = useApp()
const route = useRoute()
const router = useRouter()
const sel = computed(() => (route.params.date as string) || app.today)
const cat = computed(() => app.catalog!)
const start = computed(() => app.profile!.start_date)

const logs = ref<FoodLog[]>([])
const closure = ref<DayClosure | null>(null)
const weight = ref<number | null>(null)
const waterMl = ref(0)
const workout = ref<{ status: string } | null>(null)
const loading = ref(false)

watch(sel, async (d) => {
  loading.value = true
  try {
    const [l, c, w, wa, wo] = await Promise.all([
      repo.getFoodLogs(d, d), repo.getClosures(d, d), repo.getWeights(d, d),
      d <= app.today ? repo.getWater(d) : Promise.resolve([]), repo.getWorkouts(d, d),
    ])
    logs.value = l; closure.value = c[0] ?? null; weight.value = w[0]?.weight_kg ?? null
    waterMl.value = wa.reduce((s, x) => s + x.ml, 0); workout.value = wo[0] ?? null
  } finally { loading.value = false }
}, { immediate: true })

const isPast = computed(() => sel.value < app.today)
const isToday = computed(() => sel.value === app.today)
const wd = computed(() => isoWeekday(sel.value))
const tpl = computed(() => cat.value.workout_templates.find((t) => t.weekday === wd.value)!)
const plan = computed(() => planFor(cat.value, wd.value))
const planT = computed(() => roundM(plan.value.reduce((t, p) => { const m = recipeMacros(cat.value, p.recipe); return { kcal: t.kcal + m.kcal, protein: t.protein + m.protein, fat: 0, carb: 0 } }, { kcal: 0, protein: 0, fat: 0, carb: 0 })))
const factT = computed(() => roundM(logsTotals(logs.value)))
const waterGoal = computed(() => app.goals!.water_ml + (tpl.value.kind === 'guc' ? app.goals!.water_training_bonus_ml : 0))

const strip = computed(() => weekDays(sel.value).map((d) => {
  const t = cat.value.workout_templates.find((x) => x.weekday === isoWeekday(d))
  return { d, wd: WD_SHORT[isoWeekday(d) - 1], n: dayNum(d), sel: d === sel.value, today: d === app.today, kind: t?.kind }
}))
const go = (d: string) => router.replace('/teqvim/' + d)
let touchX = 0
const onTouchStart = (e: TouchEvent) => (touchX = e.touches[0].clientX)
const onTouchEnd = (e: TouchEvent) => { const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 60) go(addDays(sel.value, dx < 0 ? 7 : -7)) }

const tagClass = (s: string) => s === 'çiy' ? 'text-[#9A3412] bg-[#FFEDD5] dark:text-[#FDBA74] dark:bg-[#3B2412]' : s === 'quru' ? 'text-[#1E40AF] bg-[#DBEAFE] dark:text-[#93C5FD] dark:bg-[#172554]' : 'text-ink-2 bg-panel'
type Row = { time: string; slot: string; name: string; macro?: string; items: { name: string; g: string; tag?: string }[]; carry?: boolean; workout?: boolean; status?: string; strong?: boolean }
const rows = computed<Row[]>(() => {
  const out: Row[] = [{ time: '07:05', slot: 'Çəki', name: weight.value !== null ? `${fmt(weight.value)} kq · yazıldı` : isPast.value ? 'yazılmayıb' : 'Ac qarına, tualetdən sonra', items: [] }]
  SLOTS.forEach((s) => {
    const p = plan.value.find((x) => x.slot === s.slot)
    if (!p) return
    const m = roundM(recipeMacros(cat.value, p.recipe))
    const log = logs.value.find((l) => l.slot === s.slot)
    let status: string | undefined
    if (log) status = log.recipe_id === p.recipe.id && log.portion === 1 ? '✓ Yedim' : `✓ ${log.source === 'kenarda' ? 'Kənarda' : log.portion && log.portion !== 1 ? 'Porsiya ' + fmt(log.portion, 2).replace(/,?0+$/, '') : log.name} · ${Math.round(log.kcal)} kcal`
    else if (isPast.value && closure.value) status = 'Yemədim'
    out.push({
      time: s.time, slot: s.label, name: p.recipe.name, macro: `${m.kcal} kcal · ${m.protein} q zülal`, carry: s.slot === 'nahar', status,
      items: p.recipe.items.map((i) => { const f = cat.value.foods.find((x) => x.id === i.food_id)!; return { name: itemLabel(f, i.grams), g: `${i.grams} q`, tag: f.state } }),
    })
    if (s.slot === 'ara_2') {
      out.push({
        time: '19:00', slot: 'Məşq', name: tpl.value.name, workout: tpl.value.kind === 'guc' && isToday.value, strong: tpl.value.kind === 'guc',
        status: workout.value ? '✓ Tamamlandı' : undefined,
        items: tpl.value.items.map((i) => {
          const e = cat.value.exercises.find((x) => x.id === i.exercise_id)!
          const g = i.sets ? `${i.sets} × ${i.reps_min ? i.reps_min + (i.reps_max && i.reps_max !== i.reps_min ? '–' + i.reps_max : '') : `${i.sec_min}–${i.sec_max} san`}`
            : i.minutes ? `${i.minutes}${i.minutes_max ? '–' + i.minutes_max : ''} dəq${i.note ? ' · ' + i.note : ''}` : (i.note ?? '')
          return { name: e.name, g }
        }),
      })
    }
  })
  return out
})
const extras = computed(() => logs.value.filter((l) => l.slot === 'elave'))
</script>

<template>
  <main class="pb-[180px]">
    <div class="bg-surface border-b border-line px-4 pb-3 flex flex-col gap-3 sticky top-0 z-10" style="padding-top: max(20px, calc(env(safe-area-inset-top) + 8px))">
      <div class="flex items-center justify-between">
        <BackButton />
        <div class="flex flex-col items-center">
          <span class="text-xl font-semibold">{{ monthTitle(sel) }}</span>
          <span class="text-[13px] text-muted">{{ programWeek(start, sel) >= 1 && programWeek(start, sel) <= 12 ? programWeek(start, sel) + '-ci həftə / 12' : programWeek(start, sel) < 1 ? 'proqramdan əvvəl' : programWeek(start, sel) + '-ci həftə' }}</span>
        </div>
        <div class="flex gap-1.5">
          <button type="button" aria-label="Əvvəlki həftə" class="w-11 h-11 rounded-full bg-panel border-0 text-ink flex items-center justify-center" @click="go(addDays(sel, -7))"><ChevronLeft :size="22" /></button>
          <button type="button" aria-label="Növbəti həftə" class="w-11 h-11 rounded-full bg-panel border-0 text-ink flex items-center justify-center" @click="go(addDays(sel, 7))"><ChevronRight :size="22" /></button>
        </div>
      </div>
      <div class="grid grid-cols-7 gap-1.5" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
        <button v-for="d in strip" :key="d.d" type="button" :aria-label="longDate(d.d)" :aria-pressed="d.sel"
          class="h-[66px] rounded-[14px] flex flex-col items-center justify-center gap-0.5 p-0 border"
          :class="d.sel ? 'bg-primary text-white border-primary' : d.today ? 'bg-soft text-primary-strong border-soft-line' : 'bg-surface text-ink border-line'" @click="go(d.d)">
          <span class="text-xs font-medium">{{ d.wd }}</span>
          <span class="num text-[17px] font-bold">{{ d.n }}</span>
          <span class="w-1.5 h-1.5 rounded-full" :class="d.kind === 'guc' ? (d.sel ? 'bg-white' : 'bg-primary') : d.kind === 'yungul' ? 'bg-faint' : 'bg-transparent'" />
        </button>
      </div>
    </div>

    <div class="px-4 pt-4 flex flex-col gap-3.5" :class="loading ? 'opacity-60' : ''">
      <section class="card px-4 py-3.5 flex flex-col gap-2.5">
        <div class="flex justify-between items-baseline gap-2">
          <span class="text-xl font-semibold">{{ longDate(sel) }}</span>
          <span class="text-[13px] text-muted whitespace-nowrap">{{ tpl.kind === 'guc' ? 'Güc məşqi' : tpl.kind === 'yungul' ? tpl.name : 'İstirahət' }}</span>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-panel rounded-xl px-2.5 py-2 flex flex-col gap-0.5">
            <span class="text-xs text-muted">{{ isPast || isToday ? 'Fakt / plan kcal' : 'Plan kcal' }}</span>
            <span class="num text-lg font-bold">{{ isPast || isToday ? factT.kcal + ' / ' : '' }}{{ planT.kcal }}</span>
          </div>
          <div class="bg-panel rounded-xl px-2.5 py-2 flex flex-col gap-0.5">
            <span class="text-xs text-muted">Zülal</span>
            <span class="num text-lg font-bold">{{ isPast || isToday ? factT.protein + ' / ' : '' }}{{ planT.protein }} q</span>
          </div>
          <div class="bg-panel rounded-xl px-2.5 py-2 flex flex-col gap-0.5">
            <span class="text-xs text-muted">Su</span>
            <span class="num text-lg font-bold">{{ isPast || isToday ? fmtL(waterMl) + ' / ' : '' }}{{ fmtL(waterGoal) }} L</span>
          </div>
        </div>
        <span v-if="closure" class="text-[13px] font-semibold" :class="closure.adherent ? 'text-primary-strong' : 'text-muted'">Gün bağlanıb · {{ closure.adherent ? 'uyğun gün' : 'hədəfdən kənar gün' }}</span>
        <span v-else class="text-[13px] text-muted">Bütün çəkilər çiy və ya quru çəkidir (nişana bax).</span>
      </section>

      <div class="flex flex-col">
        <div v-for="(r, i) in rows" :key="i" class="grid grid-cols-[52px_minmax(0,1fr)] gap-2.5">
          <div class="flex flex-col items-center">
            <span class="num text-sm font-semibold text-ink-2 pt-3.5">{{ r.time }}</span>
            <span class="flex-1 w-0.5 bg-line mt-1.5" />
          </div>
          <div class="pb-3">
            <div class="card px-3.5 py-3 flex flex-col gap-1.5" :class="r.strong ? '!border-[#86EFAC] dark:!border-[#1E4D33]' : ''">
              <div class="flex justify-between items-center gap-2">
                <span class="eyebrow">{{ r.slot }}</span>
                <span v-if="r.status" class="text-xs font-semibold rounded-full px-2 py-0.5" :class="r.status === 'Yemədim' ? 'bg-panel text-muted' : 'bg-soft text-primary-strong'">{{ r.status }}</span>
                <span v-else-if="r.carry" class="text-xs font-semibold text-primary-strong bg-soft rounded-full px-2 py-0.5">İşə apar</span>
              </div>
              <span class="text-[17px] font-semibold leading-snug">{{ r.name }}</span>
              <span v-if="r.macro" class="num text-[15px] font-semibold text-primary-strong">{{ r.macro }}</span>
              <div v-for="(it, j) in r.items" :key="j" class="flex justify-between gap-2 text-sm text-ink-2 border-t border-panel pt-1.5">
                <span>{{ it.name }}</span>
                <span class="num whitespace-nowrap text-muted">{{ it.g }}<span v-if="it.tag" class="text-[11px] font-semibold rounded-md px-1.5 py-px ml-1" :class="tagClass(it.tag)">{{ it.tag }}</span></span>
              </div>
              <RouterLink v-if="r.workout" to="/zal" class="mt-1 h-[52px] rounded-[14px] bg-primary text-white text-base font-semibold flex items-center justify-center no-underline">Məşqə başla</RouterLink>
            </div>
          </div>
        </div>
      </div>

      <section v-if="extras.length" class="card p-3.5 flex flex-col gap-1.5">
        <span class="eyebrow">Plandan kənar</span>
        <div v-for="x in extras" :key="String(x.id)" class="flex justify-between text-sm"><span>{{ x.name }}</span><span class="num text-muted">{{ Math.round(x.kcal) }} kcal</span></div>
      </section>

      <RouterLink v-if="sel <= app.today" :to="'/gunu-bagla/' + sel" class="card px-4 py-3.5 flex items-center justify-between text-ink no-underline">
        <span class="flex flex-col gap-0.5">
          <span class="text-base font-semibold">{{ closure ? 'Gün bağlanıb' : '21:30 · Günü bağla' }}</span>
          <span class="text-[13px] text-muted">{{ closure ? 'Dəyişmək üçün aç' : 'Bu günün yeməklərini təsdiqlə' }}</span>
        </span>
        <Check v-if="closure" :size="22" class="text-primary" /><Go v-else :size="22" class="text-muted" />
      </RouterLink>
    </div>
  </main>
</template>
