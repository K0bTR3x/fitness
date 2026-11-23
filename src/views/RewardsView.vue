<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, Footprints, CalendarCheck, Zap, Dumbbell, Droplet, Scale, Ruler, Flag } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import type { Checkpoint, DayClosure, WaterLog, WeightEntry } from '../lib/types'
import { diffDays, isoWeekday, shortDate } from '../lib/dates'
import { fmt, ordinal, signed } from '../lib/format'
import { computeBadges, strengthWeeks, weeklyAverages } from '../lib/progress'

const app = useApp()
const loading = ref(true)
const err = ref('')
const weights = ref<WeightEntry[]>([])
const closures = ref<DayClosure[]>([])
const sessions = ref<{ date: string; status: string }[]>([])
const water = ref<WaterLog[]>([])
const waist = ref<{ date: string; waist_cm: number }[]>([])
const prof = computed(() => app.profile!)

onMounted(async () => {
  try {
    const a = prof.value.start_date, b = app.today
    const [w, c, s, wa, ws] = await Promise.all([repo.getWeights(a, b), repo.getClosures(a, b), repo.getWorkouts(a, b), repo.getWaterRange(a, b), repo.getWaist(b)])
    weights.value = w; closures.value = c; sessions.value = s; water.value = wa; waist.value = ws
  } catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { loading.value = false }
})

const weekly = computed(() => weeklyAverages(weights.value))
const avg = computed(() => weekly.value.length ? weekly.value[weekly.value.length - 1].avg : null)
const cps = computed(() => [...app.checkpoints].sort((a, b) => a.sort - b.sort))
const weekNo = (iso: string | null) => iso ? Math.floor(diffDays(iso, prof.value.start_date) / 7) + 1 : null

type Row = { kind: 'start' | 'you' | 'cp'; cp?: Checkpoint; reached: boolean; next: boolean }
const rows = computed<Row[]>(() => {
  const reached = cps.value.filter((c) => c.status !== 'gozleyir')
  const rest = cps.value.filter((c) => c.status === 'gozleyir')
  return [
    { kind: 'start', reached: true, next: false },
    ...reached.map((cp) => ({ kind: 'cp' as const, cp, reached: true, next: false })),
    { kind: 'you', reached: true, next: false },
    ...rest.map((cp, i) => ({ kind: 'cp' as const, cp, reached: false, next: i === 0 })),
  ]
})
const youIdx = computed(() => rows.value.findIndex((r) => r.kind === 'you'))

// mükafatdan istifadə: səhifənin öz təsdiqi
const using = ref<Checkpoint['id'] | null>(null)
const note = ref('')
const busy = ref(false)
const useErr = ref('')
async function confirmUse(cp: Checkpoint) {
  busy.value = true; useErr.value = ''
  try {
    await repo.useReward(cp.id, note.value.trim() || 'Sərbəst yemək', app.today)
    await app.refresh(); using.value = null; note.value = ''
  } catch (e) { useErr.value = e instanceof Error ? e.message : String(e) } finally { busy.value = false }
}

// nişanlar
const badges = computed(() => {
  const tpl = app.catalog?.workout_templates ?? []
  const strengthDays = tpl.filter((t) => t.kind === 'guc').map((t) => t.weekday)
  const byDay = new Map<string, number>()
  for (const w of water.value) byDay.set(w.date, (byDay.get(w.date) ?? 0) + w.ml)
  const g = app.goals!
  const waterDays = [...byDay.entries()].filter(([d, ml]) => ml >= g.water_ml + (strengthDays.includes(isoWeekday(d)) ? g.water_training_bonus_ml : 0)).length
  const wd = waist.value.length > 1 ? waist.value[0].waist_cm - waist.value[waist.value.length - 1].waist_cm : 0
  return computeBadges({
    weights: weights.value, closures: closures.value, proteinGoal: g.protein_g,
    strengthWeeksDone: strengthWeeks(sessions.value, strengthDays, prof.value.start_date, app.today),
    waterDays, startWeight: prof.value.start_weight_kg, waistDrop: wd,
    programWeeks: Math.max(0, Math.floor(diffDays(app.today, prof.value.start_date) / 7)),
  }, (n) => fmt(n))
})
const ICONS = { ilk: Footprints, tam_hefte: CalendarCheck, zulal: Zap, zal: Dumbbell, su: Droplet, ilk5: Scale, bel: Ruler, '12': Flag } as const
const earned = computed(() => badges.value.filter((b) => b.tier > 0).length)
const C = 2 * Math.PI * 34
const ringCls = (t: number) => ['fill-surface stroke-track', 'fill-soft stroke-soft', 'fill-primary stroke-primary', 'fill-primary-strong stroke-gold'][t]
const inkCls = (t: number) => ['text-faint', 'text-primary-strong', 'text-white', 'text-white'][t]
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pb-[140px]" style="padding-top: max(24px, calc(env(safe-area-inset-top) + 12px))">
    <div class="flex flex-col gap-1">
      <span class="text-[13px] text-muted num">Hər checkpoint = 1 sərbəst yemək</span>
      <h1 class="m-0 text-[28px] font-bold tracking-tight">Mükafatlar</h1>
    </div>

    <section class="card p-4 flex flex-col gap-3">
      <div class="flex justify-between items-baseline">
        <span class="text-xl font-semibold">Checkpoint yolu</span>
        <span class="num text-[13px] text-muted">{{ fmt(prof.start_weight_kg, 0) }} → {{ cps.length ? fmt(cps[cps.length - 1].target_kg, 0) : '' }} kq</span>
      </div>
      <div class="flex items-center gap-2.5 bg-panel rounded-xl px-3 py-2.5">
        <span class="w-3.5 h-3.5 rounded-full bg-ink shrink-0 shadow-[0_0_0_4px_var(--surface),0_0_0_5px_var(--text)]" />
        <span class="num text-[15px]">Həftəlik ortalaman: <b>{{ avg !== null ? fmt(avg) + ' kq' : 'hələ yoxdur' }}</b><template v-if="avg !== null"> · başlanğıcdan {{ signed(avg - prof.start_weight_kg) }} kq</template></span>
      </div>

      <ol class="m-0 p-0 list-none flex flex-col">
        <li v-for="(r, i) in rows" :key="r.kind + (r.cp?.id ?? '')" class="grid grid-cols-[40px_minmax(0,1fr)] gap-x-2.5">
          <div class="relative flex items-center justify-center">
            <span v-if="i > 0" class="absolute left-[18px] w-1 top-0 bottom-1/2" :class="i <= youIdx ? 'bg-primary' : 'bg-track'" />
            <span v-if="i < rows.length - 1" class="absolute left-[18px] w-1 top-1/2 bottom-0" :class="i < youIdx ? 'bg-primary' : 'bg-track'" />
            <span v-if="r.kind === 'start'" class="relative z-[1] w-[18px] h-[18px] rounded-full bg-primary" />
            <span v-else-if="r.kind === 'you'" class="relative z-[1] w-[22px] h-[22px] rounded-full bg-ink border-4 border-surface shadow-[0_0_0_1px_var(--text)] box-border" />
            <span v-else class="relative z-[1] w-7 h-7 rounded-full flex items-center justify-center box-border"
              :class="r.reached ? 'bg-primary' : r.next ? 'bg-surface border-[3px] border-primary' : 'bg-surface border-[3px] border-track'">
              <Check v-if="r.reached" :size="16" :stroke-width="3" class="text-white" />
            </span>
          </div>

          <div class="py-1.5 min-w-0">
            <span v-if="r.kind === 'start'" class="block py-1.5 text-sm text-ink-2 num">Başlanğıc · {{ fmt(prof.start_weight_kg) }} kq · {{ shortDate(prof.start_date) }}</span>
            <span v-else-if="r.kind === 'you'" class="inline-block num text-sm font-bold text-surface bg-ink rounded-full px-3 py-1.5">Sən buradasan · {{ avg !== null ? fmt(avg) + ' kq' : '—' }}</span>
            <div v-else-if="r.cp" class="rounded-[14px] px-3 py-2.5 flex flex-col gap-1"
              :class="r.reached ? 'bg-soft border border-soft-line' : r.next ? 'bg-surface border-2 border-primary' : 'bg-surface border border-line'">
              <div class="flex justify-between items-center gap-x-2 gap-y-1 flex-wrap">
                <span class="num text-[17px] font-bold whitespace-nowrap">{{ r.cp.label }} · {{ fmt(r.cp.target_kg, 0) }} kq</span>
                <span class="text-xs font-bold rounded-full px-2.5 py-1 whitespace-nowrap"
                  :class="r.reached ? 'text-primary-strong bg-surface' : r.next ? 'text-white bg-primary' : 'text-ink-2 bg-panel font-semibold'">
                  {{ r.cp.status === 'mukafat_istifade_edildi' ? 'İstifadə edildi' : r.reached ? 'Hədəfə çatıldı' : r.next ? 'Növbəti' : 'Gözləyir' }}
                </span>
              </div>
              <span class="num text-[13px] text-ink-2">
                <template v-if="r.cp.status === 'mukafat_istifade_edildi'">{{ ordinal(weekNo(r.cp.reached_week) ?? 0) }} həftədə çatıldı · {{ r.cp.reward_used_at ? shortDate(r.cp.reward_used_at) : '' }}{{ r.cp.reward_note ? ' · ' + r.cp.reward_note : '' }}</template>
                <template v-else-if="r.reached">{{ ordinal(weekNo(r.cp.reached_week) ?? 0) }} həftədə çatıldı ({{ fmt(r.cp.reached_avg_kg ?? 0) }} kq) · {{ r.cp.reward_text }}</template>
                <template v-else-if="r.next && avg !== null">{{ fmt(Math.max(0, avg - r.cp.target_kg)) }} kq qalıb · {{ r.cp.reward_text }}</template>
                <template v-else>{{ r.cp.reward_text }}</template>
              </span>

              <template v-if="r.cp.status === 'hedefe_catildi'">
                <button v-if="using !== r.cp.id" type="button" class="mt-1 h-12 rounded-xl border-0 bg-primary text-white text-base font-bold" @click="using = r.cp.id; useErr = ''">Mükafatı istifadə et</button>
                <div v-else class="mt-1 flex flex-col gap-2">
                  <label class="flex flex-col gap-1.5">
                    <span class="text-sm font-semibold">Nə yeyirsən? (istəyə bağlı)</span>
                    <input v-model="note" type="text" maxlength="80" placeholder="məs. pizza, 2 dilim" class="h-12 rounded-xl px-3 text-base bg-surface text-ink border border-line outline-none focus:border-primary" />
                  </label>
                  <span class="text-[13px] text-ink-2">Bu, bir sərbəst yeməkdir, bütün gün deyil. Geri qaytarmaq olmur.</span>
                  <div class="flex gap-2">
                    <button type="button" :disabled="busy" class="flex-1 h-12 rounded-xl border-0 bg-primary text-white text-base font-bold disabled:opacity-60" @click="confirmUse(r.cp)">{{ busy ? 'Yazılır…' : 'Təsdiqlə' }}</button>
                    <button type="button" :disabled="busy" class="h-12 px-4 rounded-xl border border-line bg-surface text-ink text-base font-semibold" @click="using = null">Ləğv et</button>
                  </div>
                  <span v-if="useErr" class="text-sm text-danger font-semibold" role="alert">{{ useErr }}</span>
                </div>
              </template>
            </div>
          </div>
        </li>
      </ol>
      <span class="text-[13px] text-muted leading-normal">Checkpoint yalnız tam həftənin (7/7 çəki) ortalaması ilə açılır. İstifadə olunmamış mükafat heç vaxt yanmır. Mükafat bir sərbəst yeməkdir, bütün gün deyil.</span>
    </section>

    <div class="flex justify-between items-baseline">
      <span class="text-xl font-semibold">Nişanlar</span>
      <span class="num text-[13px] text-muted">{{ loading ? '…' : `${earned} / ${badges.length} qazanıldı` }}</span>
    </div>
    <p v-if="err" class="m-0 card p-4 text-danger font-semibold" role="alert">Yüklənmədi: {{ err }}</p>
    <div v-else class="grid grid-cols-3 gap-2.5" :aria-busy="loading">
      <div v-for="b in badges" :key="b.id" class="card px-1.5 py-3 flex flex-col items-center gap-1.5 text-center" :class="loading ? 'opacity-50' : ''">
        <div class="relative w-[76px] h-[76px]">
          <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true" class="absolute inset-0">
            <circle cx="38" cy="38" r="34" :class="ringCls(b.tier)" :stroke-width="b.tier === 3 ? 3 : b.tier === 0 ? 2 : 0" />
            <circle v-if="b.tier === 0 && b.progress > 0" cx="38" cy="38" r="34" fill="none" class="stroke-primary" stroke-width="4" stroke-linecap="round"
              :stroke-dasharray="`${(b.progress * C).toFixed(1)} ${C.toFixed(1)}`" transform="rotate(-90 38 38)" />
          </svg>
          <component :is="ICONS[b.id as keyof typeof ICONS]" :size="30" class="absolute left-[23px] top-[23px]" :class="inkCls(b.tier)" aria-hidden="true" />
        </div>
        <span class="text-[13px] font-semibold leading-tight">{{ b.name }}</span>
        <span class="num text-xs text-ink-2">{{ b.sub }}</span>
      </div>
    </div>
  </main>
</template>
