<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Trophy, Dumbbell } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import BackButton from '../components/BackButton.vue'
import type { SetRow } from '../lib/types'
import { advise, stepFor, strengthHistory } from '../lib/strength'
import { diffDays, shortDate } from '../lib/dates'
import { fmt } from '../lib/format'

const app = useApp()
const cat = computed(() => app.catalog!)
const rows = ref<SetRow[]>([])
const loading = ref(true)
const err = ref('')
onMounted(async () => {
  try { rows.value = await repo.getSetHistory() } catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { loading.value = false }
})

const exName = (id: string) => cat.value.exercises.find((e) => e.id === id)?.name ?? id
const order = computed(() => {
  const ids: string[] = []
  for (const t of cat.value.workout_templates) for (const it of [...t.items].sort((a, b) => a.sort - b.sort)) if (!ids.includes(it.exercise_id)) ids.push(it.exercise_id)
  return ids
})
const hist = computed(() => strengthHistory(rows.value).sort((a, b) => {
  const ia = order.value.indexOf(a.id), ib = order.value.indexOf(b.id)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
}))
const sel = ref(0)
const h = computed(() => hist.value[Math.min(sel.value, hist.value.length - 1)] ?? null)
const sessionsCount = computed(() => new Set(rows.value.map((r) => r.date)).size)
const weeks = computed(() => {
  const ds = [...new Set(rows.value.map((r) => r.date))].sort()
  return ds.length ? Math.floor(diffDays(ds[ds.length - 1], ds[0]) / 7) + 1 : 0
})
const repsMax = (id: string) => {
  for (const t of cat.value.workout_templates) { const it = t.items.find((i) => i.exercise_id === id); if (it?.reps_max) return it.reps_max }
  return null
}
const f1 = (n: number) => fmt(n, n % 1 ? 1 : 0)
/** [12,12,12] → "3×12", [12,10,9] → "12·10·9" */
const repsTxt = (r: number[]) => (r.length > 1 && r.every((x) => x === r[0]) ? `${r.length}×${r[0]}` : r.join('·'))

const tiles = computed(() => {
  if (!h.value) return []
  const s = h.value.sessions, last = s[s.length - 1], first = s[0]
  return [
    { label: 'İş çəkisi', value: `${f1(last.work)} kq`, sub: s.length > 1 ? `başlanğıc ${f1(first.work)}` : 'ilk məşq' },
    { label: 'Ən yaxşı', value: `${f1(h.value.best)} kq`, sub: `son: ${repsTxt(last.reps)}` },
    { label: 'Təxmini 1RM', value: `${fmt(h.value.bestE1rm, 0)} kq`, sub: 'Epley' },
  ]
})

// qrafik
const W = 358, H = 170, X0 = 30, X1 = 350, Y0 = 14, Y1 = 140
const chart = computed(() => {
  if (!h.value || h.value.sessions.length < 2) return null
  const s = h.value.sessions, ws = s.map((x) => x.work)
  const step = stepFor(h.value.id)
  const lo = Math.floor((Math.min(...ws) - step) / 5) * 5, hi = Math.ceil((Math.max(...ws) + step) / 5) * 5
  const X = (i: number) => X0 + i * ((X1 - X0) / (s.length - 1))
  const Y = (v: number) => Y1 - ((v - lo) / (hi - lo || 1)) * (Y1 - Y0)
  const grid = [lo, Math.round((lo + hi) / 2), hi]
  return {
    grid: grid.map((v) => ({ v, y: Y(v) })),
    line: s.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x.work).toFixed(1)}`).join(''),
    dots: s.map((x, i) => ({ x: X(i), y: Y(x.work), pr: x.pr, key: x.date })),
    ticks: [{ x: X0, t: shortDate(s[0].date), a: 'start' }, { x: X1, t: shortDate(s[s.length - 1].date), a: 'end' }],
  }
})
const advice = computed(() => (h.value ? advise(h.value, repsMax(h.value.id), stepFor(h.value.id), f1) : null))
const recent = computed(() => (h.value ? [...h.value.sessions].reverse().slice(0, 5) : []))
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pb-[140px]" style="padding-top: max(16px, calc(env(safe-area-inset-top) + 8px))">
    <div class="flex items-center gap-3">
      <BackButton to="/inkisaf" />
      <div class="flex flex-col min-w-0">
        <h1 class="m-0 text-[26px] font-bold tracking-tight">Güc rekordları</h1>
        <span class="num text-[13px] text-muted">{{ sessionsCount ? `${weeks} həftə · ${sessionsCount} güc məşqi` : 'Zal məşqlərindən' }}</span>
      </div>
    </div>

    <p v-if="loading" class="m-0 text-[15px] text-muted px-1">Yüklənir…</p>
    <p v-else-if="err" class="m-0 card p-4 text-[15px] text-danger" role="alert">Oxumaq alınmadı: {{ err }}</p>

    <section v-else-if="!h" class="card p-5 flex flex-col items-center gap-3 text-center">
      <span class="w-14 h-14 rounded-full bg-soft text-primary-strong flex items-center justify-center"><Dumbbell :size="28" /></span>
      <span class="text-lg font-semibold">Hələ rekord yoxdur</span>
      <span class="text-[15px] text-ink-2 leading-snug">Zal rejimində setlərin çəkisini və təkrarını yaz. Hər hərəkətin inkişafı burada görünəcək.</span>
      <RouterLink to="/zal" class="h-12 px-5 rounded-xl bg-primary text-white text-base font-semibold flex items-center no-underline">Zala keç</RouterLink>
    </section>

    <template v-else>
      <div class="scroll -mx-4 px-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Hərəkət">
        <button v-for="(x, i) in hist" :key="x.id" type="button" role="tab" :aria-selected="h.id === x.id"
          class="h-10 px-3.5 rounded-full border text-sm font-semibold whitespace-nowrap shrink-0"
          :class="h.id === x.id ? 'bg-ink text-surface border-ink' : 'bg-surface text-ink border-line'" @click="sel = i">{{ exName(x.id) }}</button>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div v-for="t in tiles" :key="t.label" class="card px-3 py-2.5 flex flex-col min-w-0">
          <span class="text-xs text-muted">{{ t.label }}</span>
          <span class="num text-lg font-bold">{{ t.value }}</span>
          <span class="num text-xs text-muted truncate">{{ t.sub }}</span>
        </div>
      </div>

      <section class="card p-4 flex flex-col gap-2">
        <div class="flex justify-between items-baseline">
          <span class="text-base font-semibold">İş çəkisi, kq</span>
          <span class="num text-[13px] text-muted">{{ h.sessions.length }} məşq</span>
        </div>
        <svg v-if="chart" width="100%" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`${exName(h.id)}: iş çəkisi ${f1(h.sessions[0].work)} kq-dan ${f1(h.sessions[h.sessions.length - 1].work)} kq-a`">
          <path :d="chart.grid.map((g) => `M${X0} ${g.y.toFixed(1)}H${X1}`).join('')" stroke="var(--track)" stroke-width="1" />
          <text v-for="g in chart.grid" :key="g.v" x="0" :y="g.y + 4" font-size="11" fill="var(--muted)">{{ g.v }}</text>
          <path :d="chart.line" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <circle v-for="d in chart.dots" :key="d.key" :cx="d.x" :cy="d.y" :r="d.pr ? 5 : 3" :fill="d.pr ? 'var(--gold)' : 'var(--primary)'" stroke="var(--surface)" stroke-width="1.5" />
          <text v-for="t in chart.ticks" :key="t.a" :x="t.x" :y="H - 6" font-size="11" fill="var(--muted)" :text-anchor="t.a">{{ t.t }}</text>
        </svg>
        <p v-else class="m-0 text-[15px] text-ink-2">Qrafik üçün ən azı 2 məşq lazımdır.</p>
        <span v-if="chart" class="flex items-center gap-1.5 text-[13px] text-ink-2"><span class="w-2.5 h-2.5 rounded-full bg-gold" />Yeni rekord (təxmini 1RM artıb)</span>
      </section>

      <section v-if="advice" class="rounded-2xl bg-soft border border-soft-line p-4 flex flex-col gap-1">
        <span class="text-sm font-semibold text-on-soft">[💪 Məşqçi] Növbəti məşq</span>
        <span class="text-[15px] text-ink leading-snug">{{ advice.text }}</span>
      </section>

      <section class="flex flex-col gap-1.5">
        <span class="text-base font-semibold px-1">Son məşqlər</span>
        <div class="card overflow-hidden">
          <div v-for="(s, i) in recent" :key="s.date" class="px-4 py-3 flex items-center gap-3" :class="i ? 'border-t border-line' : ''">
            <span class="num text-sm text-muted w-[84px] shrink-0 whitespace-nowrap">{{ shortDate(s.date) }}</span>
            <span class="num text-[15px] flex-1 min-w-0"><b>{{ f1(s.work) }} kq</b> · {{ repsTxt(s.reps) }} təkrar</span>
            <span v-if="s.pr" class="text-xs font-semibold rounded-md px-1.5 py-0.5 bg-warn-bg text-warn flex items-center gap-1"><Trophy :size="12" />Rekord</span>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-1.5">
        <span class="text-base font-semibold px-1">Bütün hərəkətlər · başlanğıc → indi</span>
        <div class="card overflow-hidden">
          <button v-for="(x, i) in hist" :key="x.id" type="button" class="w-full px-4 py-3 border-0 bg-transparent text-ink flex items-center gap-3 text-left" :class="i ? 'border-t border-line border-solid' : ''" @click="sel = i">
            <span class="text-[15px] flex-1 min-w-0">{{ exName(x.id) }}</span>
            <span class="num text-sm text-muted">{{ f1(x.sessions[0].work) }}</span>
            <span class="text-muted">→</span>
            <span class="num text-[15px] font-semibold" :class="x.sessions[x.sessions.length - 1].work > x.sessions[0].work ? 'text-primary-strong' : ''">{{ f1(x.sessions[x.sessions.length - 1].work) }} kq</span>
          </button>
        </div>
      </section>

      <p class="m-0 text-[13px] text-muted leading-normal px-1">Təxmini maksimum (1RM) Epley düsturu ilə hesablanır: çəki × (1 + təkrar ÷ 30). Bu test deyil, 1 təkrarlıq maksimum yoxlamağa ehtiyac yoxdur.</p>
    </template>
  </main>
</template>
