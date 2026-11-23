<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check, Minus, Plus } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import BackButton from '../components/BackButton.vue'
import type { BodyMeasurement } from '../lib/types'
import { addDays, longDate, shortDate } from '../lib/dates'
import { fmt, parseNum } from '../lib/format'

type Key = 'chest_cm' | 'waist_cm' | 'arm_cm' | 'hip_cm' | 'thigh_cm'
const M: { key: Key; name: string; how: string; min: number; max: number }[] = [
  { key: 'chest_cm', name: 'Sinə', how: 'Döş giləsi səviyyəsində, qollar aşağıda, normal nəfəs.', min: 60, max: 180 },
  { key: 'waist_cm', name: 'Bel', how: 'Göbək səviyyəsində, nəfəs verdikdən sonra. Qarnı içəri çəkmə.', min: 50, max: 200 },
  { key: 'arm_cm', name: 'Qol', how: 'Sağ qol, çiyinlə dirsəyin ortasında, qol rahat aşağıda.', min: 15, max: 70 },
  { key: 'hip_cm', name: 'Omba', how: 'Ən geniş yerdən, ayaqlar bir yerdə.', min: 60, max: 200 },
  { key: 'thigh_cm', name: 'Bud', how: 'Sağ bud, ən qalın yerdən (ombanın bir az aşağısı).', min: 30, max: 110 },
]

const app = useApp()
const all = ref<BodyMeasurement[]>([])
const val = ref<Record<Key, string>>({ chest_cm: '', waist_cm: '', arm_cm: '', hip_cm: '', thigh_cm: '' })
const focus = ref<Key>('waist_cm')
const loading = ref(true)
const busy = ref(false)
const err = ref('')
const saved = ref(false)

const past = computed(() => all.value.filter((m) => m.date < app.today))
const prevOf = (k: Key) => [...past.value].reverse().find((m) => m[k] != null)?.[k] ?? null
const firstOf = (k: Key) => all.value.find((m) => m[k] != null)?.[k] ?? null
const todayRow = computed(() => all.value.find((m) => m.date === app.today) ?? null)

onMounted(async () => {
  try {
    all.value = await repo.getMeasurements()
    for (const m of M) {
      const v = todayRow.value?.[m.key] ?? prevOf(m.key)
      val.value[m.key] = v == null ? '' : fmt(v, 1)
    }
  } catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { loading.value = false }
})

const num = (k: Key) => parseNum(val.value[k])
function bump(k: Key, d: number) {
  const cur = num(k) ?? prevOf(k) ?? (k === 'waist_cm' ? 100 : M.find((m) => m.key === k)!.min + 20)
  val.value[k] = fmt(Math.round((cur + d) * 10) / 10, 1); focus.value = k; saved.value = false
}
const rows = computed(() => M.map((m) => {
  const v = num(m.key), p = prevOf(m.key)
  const d = v != null && p != null ? Math.round((v - p) * 10) / 10 : null
  const bad = v != null && (v < m.min || v > m.max)
  return { ...m, prev: p, d, bad, sub: p == null ? 'ilk ölçü' : `əvvəl ${fmt(p, 1)} · ${d == null ? '—' : d === 0 ? 'dəyişməyib' : `${d < 0 ? '−' : '+'}${fmt(Math.abs(d), 1)} sm`}` }
}))
const tip = computed(() => M.find((m) => m.key === focus.value)!)
const totalSince = computed(() => {
  let t = 0, any = false
  for (const m of M) { const a = firstOf(m.key), b = num(m.key); if (a != null && b != null && all.value.length) { t += b - a; any = true } }
  return any ? Math.round(t * 10) / 10 : null
})
const startDate = computed(() => all.value[0]?.date ?? null)
const canSave = computed(() => !busy.value && rows.value.some((r) => num(r.key) != null) && !rows.value.some((r) => r.bad))

async function save() {
  busy.value = true; err.value = ''
  try {
    const m: BodyMeasurement = { date: app.today, chest_cm: num('chest_cm'), waist_cm: num('waist_cm'), arm_cm: num('arm_cm'), hip_cm: num('hip_cm'), thigh_cm: num('thigh_cm') }
    await repo.upsertMeasurement(m)
    all.value = all.value.filter((x) => x.date !== m.date).concat(m).sort((a, b) => a.date.localeCompare(b.date))
    saved.value = true
  } catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { busy.value = false }
}
const history = computed(() => [...all.value].reverse().slice(0, 6))
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pb-[140px]" style="padding-top: max(16px, calc(env(safe-area-inset-top) + 8px))">
    <div class="flex items-center gap-3">
      <BackButton to="/inkisaf" />
      <div class="flex flex-col min-w-0">
        <h1 class="m-0 text-[26px] font-bold tracking-tight">Bədən ölçüləri</h1>
        <span class="num text-[13px] text-muted">Ayda 1 dəfə · {{ longDate(app.today) }}</span>
      </div>
    </div>

    <p v-if="loading" class="m-0 text-[15px] text-muted px-1">Yüklənir…</p>
    <template v-else>
      <div class="rounded-2xl bg-soft border border-soft-line p-3.5 flex flex-col gap-0.5" aria-live="polite">
        <span class="text-sm font-semibold text-on-soft">{{ tip.name }}: necə ölçməli</span>
        <span class="text-[15px] text-ink leading-snug">{{ tip.how }}</span>
      </div>

      <section class="card overflow-hidden">
        <div v-for="(r, i) in rows" :key="r.key" class="flex items-center gap-2 px-3.5 py-2.5"
          :class="[i ? 'border-t border-line' : '', focus === r.key ? 'bg-soft shadow-[inset_4px_0_0_var(--primary)]' : '']">
          <span class="flex-1 min-w-0 flex flex-col">
            <span class="text-base font-semibold">{{ r.name }}</span>
            <span class="num text-[13px]" :class="r.d != null && r.d < 0 ? 'text-primary-strong font-semibold' : 'text-muted'">{{ r.bad ? `${r.min}–${r.max} sm arası olmalıdır` : r.sub }}</span>
          </span>
          <button type="button" :aria-label="`${r.name} 0,5 sm azalt`" class="w-11 h-11 rounded-xl border border-line bg-panel text-ink flex items-center justify-center shrink-0" @click="bump(r.key, -0.5)"><Minus :size="18" /></button>
          <label class="flex items-baseline gap-0.5">
            <span class="sr-only">{{ r.name }}, sm</span>
            <input v-model="val[r.key]" inputmode="decimal" placeholder="—" class="num w-16 h-11 rounded-xl border bg-surface text-ink text-center text-lg font-bold"
              :class="r.bad ? 'border-danger' : 'border-line'" @focus="focus = r.key; saved = false" @input="saved = false" />
          </label>
          <button type="button" :aria-label="`${r.name} 0,5 sm artır`" class="w-11 h-11 rounded-xl border border-line bg-panel text-ink flex items-center justify-center shrink-0" @click="bump(r.key, 0.5)"><Plus :size="18" /></button>
        </div>
      </section>

      <section v-if="totalSince !== null && startDate && startDate < app.today" class="card p-4 flex flex-col gap-1">
        <span class="text-sm text-muted">Başlanğıcdan bəri ({{ shortDate(startDate) }})</span>
        <span class="num text-2xl font-bold" :class="totalSince < 0 ? 'text-primary-strong' : ''">{{ totalSince > 0 ? '+' : totalSince < 0 ? '−' : '' }}{{ fmt(Math.abs(totalSince), 1) }} sm cəmi</span>
        <span class="text-sm text-ink-2 leading-snug">Çəki bəzən dayanır, amma santimetrlər azalmağa davam edir. Ona görə ölçülər də vacibdir.</span>
      </section>

      <button v-if="!saved" type="button" :disabled="!canSave" class="h-14 rounded-xl border-0 bg-primary text-white text-base font-bold disabled:opacity-50" @click="save">Ölçüləri yadda saxla</button>
      <div v-else class="card p-4 flex items-center gap-3" role="status">
        <span class="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0"><Check :size="20" :stroke-width="3" /></span>
        <span class="text-[15px] leading-snug">Yazıldı. Növbəti ölçü: <b class="num">{{ longDate(addDays(app.today, 30)) }}</b>.</span>
      </div>
      <span v-if="err" class="text-sm text-danger font-semibold" role="alert">{{ err }}</span>
      <RouterLink v-if="saved" to="/inkisaf" class="self-center h-11 px-4 flex items-center text-primary-strong text-[15px] font-semibold no-underline">İnkişafa qayıt</RouterLink>

      <section v-if="history.length" class="flex flex-col gap-1.5">
        <span class="text-base font-semibold px-1">Əvvəlki ölçülər</span>
        <div class="card overflow-x-auto">
          <table class="w-full text-sm num border-collapse">
            <thead><tr class="text-muted text-xs">
              <th class="text-left font-semibold px-3 py-2">Tarix</th>
              <th v-for="m in M" :key="m.key" class="text-right font-semibold px-2 py-2">{{ m.name }}</th>
            </tr></thead>
            <tbody><tr v-for="h in history" :key="h.date" class="border-t border-line">
              <td class="px-3 py-2 whitespace-nowrap">{{ shortDate(h.date) }}</td>
              <td v-for="m in M" :key="m.key" class="text-right px-2 py-2">{{ h[m.key] == null ? '—' : fmt(h[m.key]!, 1) }}</td>
            </tr></tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>
