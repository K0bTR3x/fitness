<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Ruler, Trophy, ChevronRight } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import type { DayClosure, WeightEntry } from '../lib/types'
import { addDays, diffDays, isoWeekday, shortDate, weekStart, WD_SHORT } from '../lib/dates'
import { fmt, ordinal, signed } from '../lib/format'
import { forecastDate, pacePerWeek, paceTone, rolling7, weeklyAverages } from '../lib/progress'

const app = useApp()
const loading = ref(true)
const err = ref('')
const weights = ref<WeightEntry[]>([])
const closures = ref<DayClosure[]>([])
const sessions = ref<{ date: string; template_id: string; status: string }[]>([])
const waist = ref<{ date: string; waist_cm: number }[]>([])
const tab = ref(0)
const TABS = ['Çəki', 'Kalori', 'Zülal', 'Məşq']

const prof = computed(() => app.profile!)
const start = computed(() => prof.value.start_date)
const goals = computed(() => app.goals!)

onMounted(async () => {
  try {
    const a = start.value, b = app.today
    const [w, c, s, wa] = await Promise.all([repo.getWeights(a, b), repo.getClosures(a, b), repo.getWorkouts(a, b), repo.getWaist(b)])
    weights.value = w; closures.value = c; sessions.value = s; waist.value = wa
  } catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { loading.value = false }
})

const weekly = computed(() => weeklyAverages(weights.value))
const lastAvg = computed(() => weekly.value.length ? weekly.value[weekly.value.length - 1].avg : null)
const lost = computed(() => lastAvg.value === null ? null : prof.value.start_weight_kg - lastAvg.value)
const weeksIn = computed(() => Math.max(1, Math.floor(diffDays(app.today, start.value) / 7) + 1))
const pace = computed(() => pacePerWeek(weekly.value))
const tone = computed(() => pace.value !== null && lastAvg.value ? paceTone(pace.value, lastAvg.value) : null)
const toneTxt = { yavas: 'yavaşdır, kalorini yoxla', normal: 'normal', suretli: 'sürətlidir, kalorini azaltma' } as const
const target = computed(() => prof.value.target_12w_kg)
const left = computed(() => lastAvg.value === null ? null : Math.max(0, lastAvg.value - target.value))
const eta = computed(() => lastAvg.value === null ? null : forecastDate(lastAvg.value, target.value, pace.value, app.today))

// ---- qrafik ölçüləri (prototip: 358×214) ----
const X0 = 34, X1 = 350, YT = 14, YB = 190
const span = computed(() => Math.max(13, diffDays(app.today, start.value)))
const X = (iso: string) => X0 + (X1 - X0) * Math.max(0, diffDays(iso, start.value)) / span.value
const xTicks = computed(() => {
  const n = Math.ceil((span.value + 1) / 7)
  const step = Math.max(1, Math.ceil(n / 4))
  const out: { x: number; t: string; end?: boolean }[] = []
  for (let w = 0; w < n; w += step) out.push({ x: X(addDays(start.value, w * 7)), t: `Hft ${w + 1}` })
  return out
})

// çəki
const wDom = computed(() => {
  const vs = weights.value.map((w) => w.weight_kg).concat([prof.value.start_weight_kg, target.value])
  const hi = Math.ceil(Math.max(...vs) + 0.5), lo = Math.floor(Math.min(...vs) - 0.5)
  return { hi, lo }
})
const Yw = (v: number) => YT + (wDom.value.hi - v) / (wDom.value.hi - wDom.value.lo) * (YB - YT)
const wGrid = computed(() => {
  const { hi, lo } = wDom.value
  const step = Math.max(1, Math.ceil((hi - lo) / 5))
  const out: number[] = []
  for (let v = hi; v >= lo; v -= step) out.push(v)
  return out
})
const avgLine = computed(() => rolling7(weights.value).map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)} ${Yw(p.avg).toFixed(1)}`).join(''))
const weekNote = computed(() => {
  const w = weekly.value
  if (w.length < 2) return 'Gündəlik nöqtələr su ilə oynayır, qərarları yaşıl xətt (7 günlük ortalama) verir.'
  const a = w[w.length - 2].avg, b = w[w.length - 1].avg, d = b - a
  const head = d <= -0.2 ? 'Yaxşı həftədir' : d < 0.2 ? 'Sabit həftədir' : 'Bu həftə bir az yuxarıdır'
  return `${head}: ortalama ${signed(d)} kq (${fmt(a)} → ${fmt(b)}). Gündəlik nöqtələr su ilə oynayır, qərarları yaşıl xətt verir.`
})

// kalori / zülal sütunları
const bars = computed(() => [...closures.value].sort((a, b) => a.date.localeCompare(b.date)))
const barW = computed(() => Math.max(3, Math.min(14, (X1 - X0) / (span.value + 1) - 2)))
const kMax = computed(() => Math.max(goals.value.kcal + 400, ...bars.value.map((c) => c.kcal_total)))
const kMin = computed(() => Math.max(0, Math.min(goals.value.kcal - 800, ...bars.value.map((c) => c.kcal_total - 100))))
const Yk = (v: number) => YB - (Math.max(0, v - kMin.value) / (kMax.value - kMin.value)) * (YB - YT)
const kLo = computed(() => goals.value.kcal - goals.value.kcal_tolerance)
const kHi = computed(() => goals.value.kcal + goals.value.kcal_tolerance)
const kIn = computed(() => bars.value.filter((c) => c.kcal_total >= kLo.value && c.kcal_total <= kHi.value).length)
const kAvg = computed(() => bars.value.length ? Math.round(bars.value.reduce((s, c) => s + c.kcal_total, 0) / bars.value.length) : 0)
const pMax = computed(() => Math.max(goals.value.protein_g + 40, ...bars.value.map((c) => c.protein_total)))
const pMin = computed(() => Math.max(0, Math.min(Math.round(goals.value.protein_g * 0.5), ...bars.value.map((c) => c.protein_total - 20))))
const Yp = (v: number) => YB - (Math.max(0, v - pMin.value) / (pMax.value - pMin.value)) * (YB - YT)
const pOk = computed(() => bars.value.filter((c) => c.protein_total >= goals.value.protein_g * 0.9).length)
const pAvg = computed(() => bars.value.length ? Math.round(bars.value.reduce((s, c) => s + c.protein_total, 0) / bars.value.length) : 0)

// məşq istilik xəritəsi
type Cell = 'd' | 'p' | 'm' | 'r' | 'f'
const heat = computed(() => {
  const tpl = app.catalog?.workout_templates ?? []
  const rows: { n: number; cells: Cell[] }[] = []
  let done = 0, planned = 0
  const ws0 = weekStart(start.value)
  for (let w = 0; addDays(ws0, w * 7) <= app.today; w++) {
    const cells: Cell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(ws0, w * 7 + d)
      const t = tpl.find((x) => x.weekday === isoWeekday(date))
      const s = sessions.value.find((x) => x.date === date)
      let c: Cell
      if (date < start.value || date > app.today) c = 'f'
      else if (!t || t.kind === 'istirahet') c = 'r'
      else if (s?.status === 'tamamlandi') c = 'd'
      else if (s?.status === 'qismen') c = 'p'
      else c = date === app.today ? 'f' : 'm'
      if (t && t.kind !== 'istirahet' && date >= start.value && date < app.today) { planned++; if (c === 'd' || c === 'p') done++ }
      cells.push(c)
    }
    rows.push({ n: w + 1, cells })
  }
  return { rows, done, planned }
})
const cellCls: Record<Cell, string> = {
  d: 'bg-primary', p: 'bg-primary/45', m: 'bg-surface border-2 border-faint', r: 'bg-track', f: 'bg-panel',
}

// bel
const waistNow = computed(() => waist.value.length ? waist.value[waist.value.length - 1] : null)
const waistDiff = computed(() => waist.value.length > 1 ? waist.value[waist.value.length - 1].waist_cm - waist.value[0].waist_cm : null)
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pb-[140px]" style="padding-top: max(24px, calc(env(safe-area-inset-top) + 12px))">
    <div class="flex flex-col gap-1">
      <span class="text-[13px] text-muted num">{{ ordinal(weeksIn) }} həftə · başlanğıc {{ shortDate(start) }}</span>
      <h1 class="m-0 text-[28px] font-bold tracking-tight">İnkişaf</h1>
    </div>

    <p v-if="err" class="m-0 card p-4 text-danger font-semibold" role="alert">Yüklənmədi: {{ err }}</p>
    <div v-else-if="loading" class="grid grid-cols-2 gap-2.5" aria-busy="true">
      <div v-for="i in 4" :key="i" class="card h-[92px] animate-pulse" />
    </div>

    <template v-else>
      <section class="grid grid-cols-2 gap-2.5">
        <div class="card px-3.5 py-3 flex flex-col gap-0.5 min-w-0">
          <span class="text-[13px] text-muted">Həftəlik ortalama</span>
          <span class="num text-[28px] font-bold text-primary-strong tracking-tight">{{ lastAvg !== null ? fmt(lastAvg) + ' kq' : '—' }}</span>
          <span class="num text-[13px] text-ink-2">başlanğıc {{ fmt(prof.start_weight_kg) }}</span>
        </div>
        <div class="card px-3.5 py-3 flex flex-col gap-0.5 min-w-0">
          <span class="text-[13px] text-muted">Ümumi itki</span>
          <span class="num text-[28px] font-bold tracking-tight">{{ lost !== null ? signed(-lost) + ' kq' : '—' }}</span>
          <span class="num text-[13px] text-ink-2">{{ lost !== null ? fmt((lost / prof.start_weight_kg) * 100) + '% · ' : '' }}{{ weeksIn }} həftədə</span>
        </div>
        <div class="card px-3.5 py-3 flex flex-col gap-0.5 min-w-0">
          <span class="text-[13px] text-muted">Son 2 həftənin tempi</span>
          <span class="num text-[22px] font-bold">{{ pace !== null ? signed(pace) + ' kq/hft' : '—' }}</span>
          <span class="num text-[13px] text-ink-2"><template v-if="tone"><span class="whitespace-nowrap">çəkinin {{ fmt(tone.pct) }}%-i</span> · {{ toneTxt[tone.tone] }}</template><template v-else>2 həftədən sonra görünəcək</template></span>
        </div>
        <div class="card px-3.5 py-3 flex flex-col gap-0.5 min-w-0">
          <span class="text-[13px] text-muted num">12 həftəlik hədəf ({{ fmt(target, 0) }})</span>
          <span class="num text-[22px] font-bold">{{ left === null ? '—' : left === 0 ? 'Çatdın! 🎉' : fmt(left) + ' kq qalıb' }}</span>
          <span class="num text-[13px] text-ink-2">{{ eta ? 'bu tempdə ~' + shortDate(eta) : 'proqnoz üçün temp lazımdır' }}</span>
        </div>
      </section>

      <section class="card px-3 py-3.5 flex flex-col gap-3">
        <div role="tablist" aria-label="Qrafik" class="grid grid-cols-4 gap-1 bg-panel rounded-xl p-1">
          <button v-for="(t, i) in TABS" :key="t" type="button" role="tab" :aria-selected="tab === i"
            class="h-10 rounded-[9px] border-0 text-sm font-semibold"
            :class="tab === i ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'bg-transparent text-muted'" @click="tab = i">{{ t }}</button>
        </div>

        <!-- Çəki -->
        <div v-if="tab === 0" class="flex flex-col gap-2">
          <p v-if="!weights.length" class="m-0 px-1 text-[15px] text-ink-2">Hələ çəki yoxdur. Səhər <RouterLink to="/seher" class="text-primary-strong font-semibold">çəkini qeyd et</RouterLink>, qrafik buradan başlayacaq.</p>
          <template v-else>
            <svg width="100%" viewBox="0 0 358 214" role="img" :aria-label="`Çəki qrafiki: gündəlik nöqtələr və 7 günlük ortalama, son ortalama ${fmt(lastAvg ?? 0)} kq`">
              <path :d="wGrid.map((v) => `M${X0} ${Yw(v).toFixed(1)}H${X1}`).join('')" stroke="var(--track)" stroke-width="1" />
              <text v-for="v in wGrid" :key="v" x="2" :y="Yw(v) + 4" font-size="11" fill="var(--muted)">{{ v }}</text>
              <path :d="`M${X0} ${Yw(target).toFixed(1)}H${X1}`" stroke="var(--primary-strong)" stroke-width="1.5" stroke-dasharray="5 4" />
              <text :x="X1" :y="Yw(target) - 5" text-anchor="end" font-size="11" fill="var(--text-2)">Hədəf {{ fmt(target, 0) }}</text>
              <circle v-for="w in weights" :key="w.date" :cx="X(w.date)" :cy="Yw(w.weight_kg)" r="2.6" fill="var(--faint)" />
              <path :d="avgLine" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              <text v-for="t in xTicks" :key="t.t" :x="t.x" y="208" font-size="11" fill="var(--muted)" :text-anchor="t.x > X1 - 30 ? 'end' : 'start'">{{ t.t }}</text>
            </svg>
            <div class="flex gap-4 text-[13px] text-ink-2 px-1">
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-faint" />Gündəlik</span>
              <span class="flex items-center gap-1.5"><span class="w-4 h-[3px] rounded bg-primary" />7 günlük ortalama</span>
            </div>
            <p class="m-0 text-sm text-ink-2 leading-snug px-1 num">{{ weekNote }}</p>
          </template>
        </div>

        <!-- Kalori -->
        <div v-else-if="tab === 1" class="flex flex-col gap-2">
          <p v-if="!bars.length" class="m-0 px-1 text-[15px] text-ink-2">Qrafik bağlanmış günlərdən qurulur. Axşam <RouterLink :to="'/gunu-bagla/' + app.today" class="text-primary-strong font-semibold">Günü bağla</RouterLink>.</p>
          <template v-else>
            <svg width="100%" viewBox="0 0 358 214" role="img" :aria-label="`Gündəlik kalori, hədəf zolağı ${kLo}–${kHi}`">
              <rect :x="X0" :y="Yk(kHi)" :width="X1 - X0" :height="Yk(kLo) - Yk(kHi)" fill="var(--soft)" />
              <rect v-for="c in bars" :key="c.date" :x="X(c.date) - barW / 2" :y="Yk(c.kcal_total)" :width="barW" :height="YB - Yk(c.kcal_total)" rx="2"
                :fill="c.kcal_total >= kLo && c.kcal_total <= kHi ? 'var(--primary)' : 'var(--faint)'" />
              <text x="2" :y="Yk(kHi) + 4" font-size="11" fill="var(--muted)">{{ kHi }}</text>
              <text x="2" :y="Yk(kLo) + 4" font-size="11" fill="var(--muted)">{{ kLo }}</text>
              <text v-for="t in xTicks" :key="t.t" :x="t.x" y="208" font-size="11" fill="var(--muted)" :text-anchor="t.x > X1 - 30 ? 'end' : 'start'">{{ t.t }}</text>
            </svg>
            <p class="m-0 text-sm text-ink-2 leading-snug px-1 num">{{ bars.length }} bağlanmış gündən {{ kIn }}-i hədəf zolağında ({{ kLo }}–{{ kHi }}). Orta: {{ kAvg }} kcal.</p>
          </template>
        </div>

        <!-- Zülal -->
        <div v-else-if="tab === 2" class="flex flex-col gap-2">
          <p v-if="!bars.length" class="m-0 px-1 text-[15px] text-ink-2">Qrafik bağlanmış günlərdən qurulur. Axşam <RouterLink :to="'/gunu-bagla/' + app.today" class="text-primary-strong font-semibold">Günü bağla</RouterLink>.</p>
          <template v-else>
            <svg width="100%" viewBox="0 0 358 214" role="img" :aria-label="`Gündəlik zülal, ${goals.protein_g} q hədəf xətti`">
              <rect v-for="c in bars" :key="c.date" :x="X(c.date) - barW / 2" :y="Yp(c.protein_total)" :width="barW" :height="YB - Yp(c.protein_total)" rx="2"
                :fill="c.protein_total >= goals.protein_g * 0.9 ? 'var(--primary)' : 'var(--faint)'" />
              <path :d="`M${X0} ${Yp(goals.protein_g).toFixed(1)}H${X1}`" stroke="var(--text)" stroke-width="1.5" stroke-dasharray="5 4" />
              <text x="2" :y="Yp(goals.protein_g) - 5" font-size="11" fill="var(--text)">{{ goals.protein_g }} q</text>
              <text v-for="t in xTicks" :key="t.t" :x="t.x" y="208" font-size="11" fill="var(--muted)" :text-anchor="t.x > X1 - 30 ? 'end' : 'start'">{{ t.t }}</text>
            </svg>
            <p class="m-0 text-sm text-ink-2 leading-snug px-1 num">{{ bars.length }} gündən {{ pOk }}-də zülal hədəfə çatıb (≥90%). Orta: {{ pAvg }} q.</p>
          </template>
        </div>

        <!-- Məşq -->
        <div v-else class="flex flex-col gap-2.5 px-1">
          <div class="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1 text-[11px] text-muted text-center">
            <span /><span v-for="d in WD_SHORT" :key="d">{{ d }}</span>
          </div>
          <div v-for="w in heat.rows" :key="w.n" class="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1 items-center">
            <span class="num text-xs text-muted">Hft {{ w.n }}</span>
            <span v-for="(c, i) in w.cells" :key="i" class="h-[22px] rounded-[5px] box-border" :class="cellCls[c]" />
          </div>
          <div class="flex flex-wrap gap-3 text-xs text-ink-2">
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-[3px] bg-primary" />Tamamlandı</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-[3px] bg-primary/45" />Qismən</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-[3px] bg-surface border-2 border-faint box-border" />Buraxdı</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-[3px] bg-track" />İstirahət</span>
          </div>
          <p class="m-0 text-sm text-ink-2 leading-snug num">{{ heat.planned ? `Planlanan ${heat.planned} məşqdən ${heat.done}-i edilib.` : 'İlk məşq günü gələndə burada görünəcək.' }}</p>
        </div>
      </section>

      <section class="card px-4 py-3.5 flex flex-col gap-2.5">
        <span class="text-xl font-semibold">Bel çevrəsi</span>
        <div v-if="waistNow" class="flex items-baseline gap-2.5 flex-wrap">
          <span class="num text-[28px] font-bold">{{ fmt(waistNow.waist_cm, 0) }} sm</span>
          <span v-if="waistDiff !== null" class="num text-[15px] font-semibold" :class="waistDiff <= 0 ? 'text-primary-strong' : 'text-muted'">{{ signed(waistDiff, 0) }} sm ilk ölçüdən</span>
        </div>
        <RouterLink v-else to="/seher" class="flex items-center gap-2 text-primary-strong font-semibold text-[15px]"><Ruler :size="18" />İlk bel ölçüsünü yaz</RouterLink>
        <span class="text-[13px] text-muted">Hər bazar ertəsi səhər, göbək səviyyəsində, normal nəfəs verdikdən sonra.</span>
      </section>

      <nav aria-label="Daha çox" class="grid grid-cols-2 gap-2.5">
        <RouterLink to="/rekordlar" class="card px-3.5 py-3 flex items-center gap-2.5 text-ink no-underline"><Trophy :size="20" class="text-primary-strong shrink-0" /><span class="flex-1 text-[15px] font-semibold leading-tight">Güc rekordları</span><ChevronRight :size="18" class="text-muted shrink-0" /></RouterLink>
        <RouterLink to="/olculer" class="card px-3.5 py-3 flex items-center gap-2.5 text-ink no-underline"><Ruler :size="20" class="text-primary-strong shrink-0" /><span class="flex-1 text-[15px] font-semibold leading-tight">Bədən ölçüləri</span><ChevronRight :size="18" class="text-muted shrink-0" /></RouterLink>
      </nav>
    </template>
  </main>
</template>
