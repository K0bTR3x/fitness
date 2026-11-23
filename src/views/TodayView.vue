<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Moon, Sun, MessageSquare, Calendar, Check, ChevronRight, Plus, Footprints, Dumbbell, Ruler } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import Bar from '../components/Bar.vue'
import NotificationsCard from '../components/NotificationsCard.vue'
import { SLOTS } from '../lib/types'
import { addDays, diffDays, isoWeekday, longDate, nowHM, programDay, WD_SHORT, weekDays, weekStart, dayNum } from '../lib/dates'
import { fmt, fmtL } from '../lib/format'
import { recipeMacros, roundM } from '../lib/nutrition'
import { nextCheckpoint, progressTo, weekAverage } from '../lib/weight'
import { isDark, toggleTheme } from '../lib/theme'

const app = useApp()
const TEAM_URL = 'https://claude.ai/code/project/chan_01Qcmjy4qBT9B4AscRnWRoK9'
const g = computed(() => app.goals!)
const prof = computed(() => app.profile!)

const dayN = computed(() => programDay(prof.value.start_date, app.today))
const week = computed(() =>
  weekDays(app.today).map((d) => {
    const t = app.catalog!.workout_templates.find((x) => x.weekday === isoWeekday(d))
    return { d, wd: WD_SHORT[isoWeekday(d) - 1], n: dayNum(d), today: d === app.today, kind: t?.kind ?? 'istirahet' }
  }),
)

// çəki
const curWeight = computed(() => app.todayWeight?.weight_kg ?? app.lastWeight?.weight_kg ?? prof.value.start_weight_kg)
const toTarget = computed(() => Math.max(0, curWeight.value - prof.value.target_12w_kg))
const waist = ref<{ date: string; waist_cm: number }[]>([])
const waistThisWeek = computed(() => waist.value.find((w) => w.date >= weekStart(app.today)))
onMounted(async () => { waist.value = await repo.getWaist(app.today).catch(() => []) })

// qida
const totals = computed(() => roundM(app.totalsToday))
const C = 2 * Math.PI * 58
const ringDash = computed(() => `${(Math.min(1, totals.value.kcal / g.value.kcal) * C).toFixed(1)} ${C.toFixed(1)}`)
const coachLine = computed(() => {
  const leftK = g.value.kcal - totals.value.kcal
  const leftP = g.value.protein_g - totals.value.protein
  if (totals.value.kcal === 0) return `Plan: ${g.value.kcal} kcal və ${g.value.protein_g} q zülal. Yeməyi yeyəndə "Yedim" bas, ya da axşam günü bir dəfədə bağla.`
  if (leftK <= g.value.kcal_tolerance && leftP <= 0) return 'Bu günün kalori və zülal hədəfi tamamdır. Əla iş!'
  const dinner = app.todayPlan.find((p) => p.slot === 'axsam')
  const dinnerEaten = !!app.slotLog('axsam')
  const dp = dinner ? Math.round(recipeMacros(app.catalog!, dinner.recipe).protein) : 0
  let s = `Qalan: ${Math.max(0, leftK)} kcal və ${Math.max(0, leftP)} q zülal.`
  if (!dinnerEaten && dinner && leftP > 0) s += ` Axşam yeməyi (${dinner.recipe.name.toLowerCase()}, ${dp} q zülal) ${dp >= leftP ? 'ilə zülal hədəfinə çatacaqsan.' : 'zülalın çoxunu bağlayacaq.'}`
  return s
})
const nextMeal = computed(() => {
  const now = nowHM()
  const list = SLOTS.map((s) => ({ ...s, plan: app.todayPlan.find((p) => p.slot === s.slot) })).filter((s) => s.plan)
  return list.find((s) => !app.slotLog(s.slot) && s.time >= now) ?? list.find((s) => !app.slotLog(s.slot)) ?? null
})
const nextMealMacros = computed(() => (nextMeal.value?.plan ? roundM(recipeMacros(app.catalog!, nextMeal.value.plan.recipe)) : null))
const nextMealItems = computed(() => {
  const r = nextMeal.value?.plan?.recipe
  if (!r) return ''
  return r.items.map((i) => { const f = app.catalog!.foods.find((x) => x.id === i.food_id); return `${f?.name.toLowerCase()} ${i.grams} q` }).join(', ')
})
const busySlot = ref(false)
async function eat(slot: any) { busySlot.value = true; try { await app.toggleEaten(slot) } finally { busySlot.value = false } }

// su
const glassCount = computed(() => Math.round(app.waterGoal / 250))
const glassesOn = computed(() => Math.round(app.waterMl / 250))
const waterBusy = ref(false)
async function pickGlass(i: number) {
  if (waterBusy.value) return
  waterBusy.value = true
  try { await app.setGlasses(glassesOn.value === i + 1 ? i : i + 1) } finally { waterBusy.value = false }
}
async function add250() { waterBusy.value = true; try { await app.addWater(250) } finally { waterBusy.value = false } }

// məşq
const tpl = computed(() => app.todayTemplate)
const tplLine = computed(() => tpl.value?.items.map((i) => {
  const e = app.catalog!.exercises.find((x) => x.id === i.exercise_id)
  return e?.category === 'kardio' && i.minutes ? `kardio ${i.minutes}${i.minutes_max ? '–' + i.minutes_max : ''} dəq` : e?.name
}).join(' · '))
const workoutDone = ref(false)
onMounted(async () => { workoutDone.value = (await repo.getWorkouts(app.today, app.today).catch(() => [])).length > 0 })

// checkpoint
const cp = computed(() => nextCheckpoint(app.checkpoints))
const wkAvg = computed(() => weekAverage(app.weights, app.today))
const lastWkAvg = computed(() => weekAverage(app.weights, addDays(app.today, -7)))
const avgForCp = computed(() => wkAvg.value.avg ?? lastWkAvg.value.avg ?? prof.value.start_weight_kg)
const unused = computed(() => app.checkpoints.filter((c) => c.status === 'hedefe_catildi'))

// kartlar
const yesterday = computed(() => addDays(app.today, -1))
const yesterdayOpen = computed(() => diffDays(yesterday.value, prof.value.start_date) >= 0 && !app.closures.some((c) => c.date === yesterday.value))
const todayClosed = computed(() => app.closures.some((c) => c.date === app.today))
const isEvening = computed(() => nowHM() >= '20:30')
const smallStep = computed(() => {
  if (!app.todayWeight) return 'Səhər ac qarına, tualetdən sonra çəkini yaz. Bir günlük rəqəm yox, həftəlik ortalama önəmlidir.'
  if (isoWeekday(app.today) === 1 && !waistThisWeek.value) return 'Bu gün bel ölçmə günüdür: göbək səviyyəsində, normal nəfəs verdikdən sonra ölç.'
  if (!waist.value.length) return 'İlk bel ölçünü yaz: göbək səviyyəsində, səhər, normal nəfəs verdikdən sonra.'
  if (app.waterMl < app.waterGoal / 2 && nowHM() >= '14:00') return `Suya diqqət: hələ ${fmtL(app.waterMl)} L. İndi bir stəkan iç.`
  if (tpl.value?.kind === 'guc') return 'Məşqə 19:00-da get. İlk 2 həftə hər setdə 3 təkrar ehtiyat saxla, texnika birinci.'
  if (tpl.value?.kind === 'yungul') return 'Bu gün yüngül gündür: 30–40 dəqiqə gəzinti kifayətdir.'
  return 'Bu gün istirahət günüdür. 7–8 saat yat, sabah yeni həftə başlayır.'
})
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pb-[180px] safe-top" style="padding-top: max(24px, calc(env(safe-area-inset-top) + 12px))">
    <span class="text-[13px] text-muted -mb-3">{{ longDate(app.today) }}<template v-if="dayN >= 1"> · {{ dayN }}-ci gün</template></span>
    <header class="flex items-end justify-between">
      <h1 class="m-0 text-[28px] font-bold tracking-tight">Bu gün</h1>
      <div class="flex gap-2">
        <button type="button" :aria-label="isDark ? 'Açıq rejimə keç' : 'Qaranlıq rejimə keç'" class="w-11 h-11 rounded-full bg-surface border border-line text-ink flex items-center justify-center" @click="toggleTheme">
          <Sun v-if="isDark" :size="20" /><Moon v-else :size="20" />
        </button>
        <a :href="TEAM_URL" target="_blank" rel="noopener" aria-label="Komanda ilə danış" class="h-11 px-3 rounded-full bg-primary text-white flex items-center gap-1.5 text-sm font-semibold no-underline">
          <MessageSquare :size="20" />Komanda
        </a>
        <RouterLink to="/teqvim" aria-label="Təqvimi aç" class="w-11 h-11 rounded-full bg-surface border border-line text-ink flex items-center justify-center">
          <Calendar :size="22" />
        </RouterLink>
      </div>
    </header>

    <div class="grid grid-cols-7 gap-1.5">
      <RouterLink v-for="d in week" :key="d.d" :to="'/teqvim/' + d.d" :aria-label="longDate(d.d)"
        class="h-[72px] rounded-[14px] flex flex-col items-center justify-center gap-0.5 no-underline"
        :class="d.today ? 'bg-primary text-white' : 'bg-surface text-ink border border-line'">
        <span class="text-xs font-medium opacity-85">{{ d.wd }}</span>
        <span class="num text-[17px] font-bold">{{ d.n }}</span>
        <span class="w-1.5 h-1.5 rounded-full" :class="d.kind === 'guc' ? (d.today ? 'bg-white' : 'bg-primary') : d.kind === 'yungul' ? 'bg-faint' : 'bg-transparent'" />
      </RouterLink>
    </div>

    <!-- checkpoint açıldı -->
    <RouterLink v-if="unused.length" to="/mukafatlar" class="rounded-2xl bg-soft p-4 flex flex-col gap-1 no-underline">
      <span class="text-[13px] font-bold text-primary-strong uppercase tracking-wide">Hədəfə çatıldı!</span>
      <span class="text-[15px] leading-snug text-on-soft">{{ unused[0].label }} açıldı: həftəlik ortalama {{ fmt(unused[0].reached_avg_kg ?? 0) }} kq. Mükafat: {{ unused[0].reward_text }}.</span>
    </RouterLink>

    <!-- dünəni bağla -->
    <RouterLink v-if="yesterdayOpen" :to="'/gunu-bagla/' + yesterday" class="card px-4 py-3.5 flex items-center justify-between no-underline text-ink border-soft-line">
      <span class="flex flex-col gap-0.5"><span class="text-base font-semibold">Dünəni bağla</span><span class="text-[13px] text-muted">Dünənki yeməkləri 30 saniyəyə təsdiqlə</span></span>
      <ChevronRight :size="22" class="text-muted" />
    </RouterLink>

    <!-- çəki -->
    <section class="card p-4 flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <span class="eyebrow">Səhər çəkisi</span>
        <RouterLink v-if="app.todayWeight" to="/seher" class="text-[13px] text-primary-strong font-semibold bg-soft px-2.5 py-1 rounded-full no-underline">yazıldı · düzəlt</RouterLink>
      </div>
      <template v-if="app.todayWeight">
        <div class="flex items-baseline gap-1.5">
          <span class="num text-[40px] font-bold text-primary-strong tracking-tight">{{ fmt(app.todayWeight.weight_kg) }}</span>
          <span class="text-base text-muted">kq</span>
        </div>
      </template>
      <RouterLink v-else to="/seher" class="h-14 rounded-[14px] bg-primary text-white text-[17px] font-semibold flex items-center justify-center gap-2 no-underline">
        <Plus :size="22" />Bu səhərki çəkini yaz
      </RouterLink>
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-panel rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
          <span class="text-[13px] text-muted">12 həftəlik hədəf</span>
          <span class="num text-base font-semibold">{{ fmt(prof.target_12w_kg, 0) }} kq · {{ fmt(toTarget) }} qalıb</span>
        </div>
        <RouterLink to="/seher?f=bel" class="bg-panel rounded-xl px-3 py-2.5 flex items-center gap-2 text-ink no-underline">
          <Ruler :size="20" class="text-primary shrink-0" />
          <span class="flex flex-col gap-0.5"><span class="text-[13px] text-muted">Bel çevrəsi</span>
            <span class="num text-base font-semibold">{{ waist.length ? fmt(waist[waist.length - 1].waist_cm) + ' sm' : 'İlk ölçünü yaz' }}</span></span>
        </RouterLink>
      </div>
    </section>

    <!-- kalori və makro -->
    <section class="card p-4 flex flex-col gap-4">
      <div class="flex gap-4 items-center">
        <div class="relative w-[136px] h-[136px] shrink-0">
          <svg width="136" height="136" viewBox="0 0 136 136" aria-hidden="true">
            <circle cx="68" cy="68" r="58" fill="none" stroke="var(--soft)" stroke-width="12" />
            <circle v-if="totals.kcal > 0" cx="68" cy="68" r="58" fill="none" stroke="var(--primary)" stroke-width="12" stroke-linecap="round" :stroke-dasharray="ringDash" transform="rotate(-90 68 68)" class="transition-all duration-500" />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="num text-[30px] font-bold tracking-tight">{{ totals.kcal }}</span>
            <span class="num text-[13px] text-muted">/ {{ g.kcal }} kcal</span>
          </div>
        </div>
        <div class="flex-1 flex flex-col gap-3 min-w-0">
          <div v-for="m in [{ l: 'Zülal', v: totals.protein, max: g.protein_g }, { l: 'Yağ', v: totals.fat, max: g.fat_g }, { l: 'Karbohidrat', v: totals.carb, max: g.carb_g }]" :key="m.l" class="flex flex-col gap-1.5">
            <div class="flex justify-between text-[13px]"><span class="font-semibold">{{ m.l }}</span><span class="num text-muted">{{ m.v }} / {{ m.max }} q</span></div>
            <Bar :value="m.v" :max="m.max" />
          </div>
        </div>
      </div>
      <p class="m-0 text-[15px] leading-snug text-ink-2">{{ coachLine }}</p>
    </section>

    <!-- növbəti yemək -->
    <section v-if="nextMeal && nextMeal.plan" class="card p-4 flex flex-col gap-3">
      <div class="flex justify-between items-center gap-2">
        <span class="eyebrow">Növbəti yemək · {{ nextMeal.time }}</span>
        <span class="num text-[13px] text-muted whitespace-nowrap">{{ nextMealMacros?.kcal }} kcal · {{ nextMealMacros?.protein }} q zülal</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex-1 flex flex-col gap-0.5 min-w-0">
          <span class="text-lg font-semibold leading-tight">{{ nextMeal.plan.recipe.name }}</span>
          <span class="text-[13px] text-muted leading-snug">{{ nextMealItems }}</span>
        </div>
        <button type="button" :disabled="busySlot" class="h-12 px-5 rounded-xl border-0 bg-primary text-white text-base font-semibold shrink-0 disabled:opacity-60" @click="eat(nextMeal.slot)">Yedim</button>
      </div>
    </section>
    <section v-else-if="app.todayPlan.length" class="card p-4 flex items-center gap-3">
      <span class="w-9 h-9 rounded-full bg-soft text-primary-strong flex items-center justify-center"><Check :size="20" /></span>
      <span class="text-base font-semibold">Bu günün 5 yeməyi qeyd olundu</span>
    </section>

    <!-- su -->
    <section class="card p-4 flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <span class="eyebrow">Su</span>
        <span class="num text-base font-semibold">{{ fmtL(app.waterMl) }} <span class="text-muted font-normal">/ {{ fmtL(app.waterGoal) }} L</span></span>
      </div>
      <div class="grid gap-1" :style="{ gridTemplateColumns: `repeat(${glassCount}, minmax(0, 1fr))` }">
        <button v-for="i in glassCount" :key="i" type="button" :aria-label="`${i}-ci stəkan`" :disabled="waterBusy"
          class="h-9 p-0 rounded-[4px_4px_8px_8px] border transition-colors"
          :class="i <= glassesOn ? 'bg-primary border-primary' : 'bg-panel border-line'" @click="pickGlass(i - 1)" />
      </div>
      <div class="flex justify-between items-center">
        <span class="text-[13px] text-muted">{{ app.isTrainingDay ? 'Məşq günü: hədəf +0,5 L' : '1 stəkan = 250 ml' }}</span>
        <button type="button" :disabled="waterBusy" class="h-11 px-3.5 rounded-xl border border-line bg-surface text-ink text-[15px] font-semibold flex items-center gap-1.5" @click="add250">
          <Plus :size="18" class="text-primary" />250 ml
        </button>
      </div>
    </section>

    <!-- məşq -->
    <section v-if="tpl" class="card p-4 flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <span class="eyebrow">{{ tpl.kind === 'istirahet' ? 'İstirahət günü' : 'Məşq · 19:00' }}</span>
        <span v-if="workoutDone" class="text-[13px] text-primary-strong font-semibold bg-soft px-2.5 py-1 rounded-full">Tamamlandı ✓</span>
        <span v-else-if="tpl.kind === 'guc'" class="text-[13px] text-muted">~60 dəq</span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-xl font-semibold">{{ tpl.name }}</span>
        <span class="text-sm text-muted leading-snug">{{ tpl.kind === 'istirahet' ? 'Tam istirahət, yuxu 7–8 saat.' : tplLine }}</span>
      </div>
      <RouterLink v-if="tpl.kind !== 'istirahet'" to="/zal" class="h-14 rounded-[14px] text-[17px] font-semibold flex items-center justify-center gap-2 no-underline"
        :class="workoutDone ? 'bg-soft text-primary-strong' : 'bg-primary text-white'">
        <Dumbbell v-if="tpl.kind === 'guc'" :size="22" /><Footprints v-else :size="22" />
        {{ workoutDone ? 'Bax və ya düzəlt' : tpl.kind === 'guc' ? 'Məşqə başla' : 'Başla' }}
      </RouterLink>
    </section>

    <!-- növbəti checkpoint -->
    <RouterLink v-if="cp" to="/mukafatlar" class="card p-4 flex flex-col gap-2.5 text-ink no-underline">
      <div class="flex justify-between items-center"><span class="eyebrow">Növbəti checkpoint</span><ChevronRight :size="20" class="text-muted" /></div>
      <div class="flex items-baseline gap-2 flex-wrap">
        <span class="num text-2xl font-bold">{{ fmt(cp.target_kg, 0) }} kq</span>
        <span class="text-[15px] text-muted">həftəlik ortalama ilə · {{ fmt(Math.max(0, avgForCp - cp.target_kg)) }} kq qalıb</span>
      </div>
      <Bar :value="progressTo(prof.start_weight_kg, avgForCp, cp.target_kg)" :max="100" />
      <span class="num text-[13px] text-muted">Bu həftə: {{ wkAvg.avg ? fmt(wkAvg.avg) + ' kq ortalama' : 'hələ çəki yoxdur' }} · {{ wkAvg.count }}/7 çəki · Mükafat: {{ cp.reward_text }}</span>
    </RouterLink>

    <!-- kiçik addım -->
    <section class="rounded-2xl bg-soft p-4 flex gap-3 items-start">
      <span class="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0"><Check :size="20" /></span>
      <span class="flex flex-col gap-1">
        <span class="text-[13px] font-bold text-primary-strong uppercase tracking-wide">Bu günün kiçik addımı</span>
        <span class="text-[15px] leading-snug text-on-soft">{{ smallStep }}</span>
      </span>
    </section>

    <RouterLink :to="'/gunu-bagla/' + app.today" class="card px-4 py-3.5 flex items-center justify-between text-ink no-underline" :class="isEvening && !todayClosed ? 'border-primary' : ''">
      <span class="flex flex-col gap-0.5">
        <span class="text-base font-semibold">{{ todayClosed ? 'Gün bağlandı ✓' : 'Günü bağla' }}</span>
        <span class="text-[13px] text-muted">{{ todayClosed ? 'Dəyişmək üçün aç' : '21:30 · 30 saniyəlik iş' }}</span>
      </span>
      <ChevronRight :size="22" class="text-muted" />
    </RouterLink>

    <NotificationsCard />

    <button type="button" class="self-center h-11 px-4 border-0 bg-transparent text-muted text-sm" @click="app.signOut().then(() => $router.replace('/giris'))">
      Çıxış ({{ app.email }})
    </button>
  </main>
</template>
