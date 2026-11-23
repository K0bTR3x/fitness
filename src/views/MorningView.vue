<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, Info, Moon } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import BackButton from '../components/BackButton.vue'
import { fmt, parseNum, signed } from '../lib/format'
import { addDays, longDate, nowHM, shortDate, WD_SHORT, weekDays, weekStart } from '../lib/dates'

const app = useApp()
const route = useRoute()
const router = useRouter()
const field = ref<'w' | 'b'>(route.query.f === 'bel' ? 'b' : 'w')
const w = ref(app.todayWeight ? fmt(app.todayWeight.weight_kg) : '')
const b = ref('')
const prevWaist = ref<{ date: string; waist_cm: number } | null>(null)
const sleep = ref<number | null>(null)
const done = ref(false)
const busy = ref(false)
const err = ref('')

onMounted(async () => {
  const [ws, sl] = await Promise.all([repo.getWaist(app.today), repo.getSleep(app.today)])
  const todayW = ws.find((x) => x.date === app.today)
  if (todayW) b.value = fmt(todayW.waist_cm)
  prevWaist.value = [...ws].filter((x) => x.date < app.today).pop() ?? null
  sleep.value = sl.hours
})

const wv = computed(() => parseNum(w.value))
const bv = computed(() => parseNum(b.value))
const wOk = computed(() => wv.value !== null && wv.value >= 40 && wv.value <= 250)
const bOk = computed(() => b.value === '' || (bv.value !== null && bv.value >= 50 && bv.value <= 200))
const ref0 = computed(() => app.lastWeight?.weight_kg ?? null)
const diff = computed(() => (wOk.value && ref0.value !== null ? Math.round((wv.value! - ref0.value) * 10) / 10 : 0))
const big = computed(() => Math.abs(diff.value) >= 1.5)
const wDiff = computed(() => !wOk.value ? 'Rəqəmi yaz' : ref0.value === null ? 'ilk çəki' : diff.value === 0 ? 'son çəki ilə eyni' : `son ${fmt(ref0.value)} · ${signed(diff.value)}`)
const hint = computed(() => field.value === 'b'
  ? 'Lent göbək səviyyəsində, yerə paralel olsun. Normal nəfəs ver, qarnı içəri çəkmə. Həftədə 1 dəfə, bazar ertəsi səhər.'
  : big.value ? `Son çəki ilə fərq ${fmt(Math.abs(diff.value))} kq-dır. Rəqəmi yoxla: bu adətən su və duzdur, yağ deyil.`
  : 'Tualetdən sonra, yeməkdən və sudan əvvəl, eyni geyimdə çəkil.')

function press(ch: string) {
  const key = field.value
  let cur = key === 'w' ? w.value : b.value
  if (ch === 'del') cur = cur.slice(0, -1)
  else if (ch === ',') { if (!cur.includes(',') && cur.length) cur += ',' }
  else {
    const [i, d] = cur.split(',')
    if (d !== undefined && d.length >= 1) return
    if (d === undefined && i.length >= 3) return
    cur += ch
  }
  if (key === 'w') w.value = cur; else b.value = cur
}
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']

async function save() {
  if (!wOk.value || !bOk.value) return
  busy.value = true; err.value = ''
  try {
    await app.saveWeight(app.today, Math.round(wv.value! * 10) / 10)
    if (b.value !== '' && bv.value !== null) await repo.upsertWaist(app.today, Math.round(bv.value * 10) / 10)
    if (sleep.value !== null) await repo.upsertSleep(app.today, sleep.value, true)
    done.value = true
  } catch (e: any) { err.value = 'Yadda saxlanmadı: ' + e.message } finally { busy.value = false }
}
const week = computed(() => weekDays(app.today).map((d, i) => ({ d, wd: WD_SHORT[i], on: app.weights.some((x) => x.date === d) })))
const weekCount = computed(() => week.value.filter((x) => x.on).length)
const sleepTxt = (h: number) => `${Math.floor(h)} s${h % 1 ? ' 30 dəq' : ''}`
</script>

<template>
  <main class="min-h-dvh flex flex-col" style="padding-top: max(20px, calc(env(safe-area-inset-top) + 8px))">
    <div class="px-4 pb-2 flex items-center gap-3">
      <BackButton />
      <div class="flex flex-col gap-0.5 min-w-0">
        <h1 class="m-0 text-[22px] font-bold">Səhər ölçüsü</h1>
        <span class="text-[13px] text-muted">{{ longDate(app.today) }} · {{ nowHM() }}</span>
      </div>
    </div>

    <div v-if="!done" class="flex-1 flex flex-col px-4 pt-2 gap-3 safe-bottom">
      <div class="grid grid-cols-2 gap-2.5">
        <button type="button" aria-label="Çəki sahəsini seç" class="text-left p-3.5 rounded-2xl bg-surface text-ink border-2"
          :class="field === 'w' ? 'border-primary shadow-[0_0_0_4px_rgba(22,163,74,0.15)]' : 'border-line'" @click="field = 'w'">
          <span class="block eyebrow">Çəki</span>
          <span class="num block text-[38px] font-extrabold tracking-tight mt-1">{{ w || '—' }}<span class="text-base font-medium text-muted"> kq</span></span>
          <span class="num block text-[13px] mt-0.5" :class="big ? 'text-warn font-semibold' : 'text-muted'">{{ wDiff }}</span>
        </button>
        <button type="button" aria-label="Bel ölçüsü sahəsini seç" class="text-left p-3.5 rounded-2xl bg-surface text-ink border-2"
          :class="field === 'b' ? 'border-primary shadow-[0_0_0_4px_rgba(22,163,74,0.15)]' : 'border-line'" @click="field = 'b'">
          <span class="block eyebrow">Bel · həftəlik</span>
          <span class="num block text-[38px] font-extrabold tracking-tight mt-1">{{ b || '—' }}<span class="text-base font-medium text-muted"> sm</span></span>
          <span class="block text-[13px] text-muted mt-0.5">{{ b === '' ? 'istəyə görə' : prevWaist ? 'əvvəlki ' + fmt(prevWaist.waist_cm) + ' sm' : 'ilk ölçü' }}</span>
        </button>
      </div>

      <div class="flex gap-2 items-start px-3 py-2.5 rounded-[14px] text-sm leading-snug" :class="big && field === 'w' ? 'bg-warn-bg text-warn' : 'bg-panel text-ink-2'">
        <Info :size="18" class="shrink-0 mt-px" /><span>{{ hint }}</span>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button v-for="k in keys" :key="k" type="button" :aria-label="k === '⌫' ? 'Sil' : k === ',' ? 'Vergül' : k"
          class="num h-[52px] rounded-[14px] border border-line bg-surface text-ink text-2xl font-semibold active:bg-soft"
          @click="press(k === '⌫' ? 'del' : k)">{{ k }}</button>
      </div>

      <div class="shrink-0 card px-3 py-2.5 flex flex-col gap-2">
        <div class="flex items-center gap-2"><Moon :size="20" class="text-muted" /><span class="text-[15px] font-semibold">Yuxu: {{ sleep !== null ? sleepTxt(sleep) : 'seç' }}</span></div>
        <div class="grid grid-cols-5 gap-1.5">
          <button v-for="h in [6, 6.5, 7, 7.5, 8]" :key="h" type="button" class="num h-11 rounded-xl text-[15px] font-semibold"
            :class="sleep === h ? 'bg-primary text-white border border-primary' : 'bg-panel text-ink border border-line'" @click="sleep = sleep === h ? null : h">{{ fmt(h, h % 1 ? 1 : 0) }}</button>
        </div>
      </div>

      <span v-if="err" class="text-sm text-danger font-semibold">{{ err }}</span>
      <div class="flex-1" />
      <button type="button" :disabled="!wOk || !bOk || busy" class="h-16 rounded-2xl border-0 text-lg font-bold"
        :class="wOk && bOk ? 'bg-primary text-white' : 'bg-track text-muted'" @click="save">
        {{ busy ? 'Yazılır…' : wOk && bOk ? 'Yadda saxla' : 'Çəkini düzgün yaz' }}
      </button>
    </div>

    <div v-else class="scroll flex-1 overflow-y-auto px-4 pt-3 pb-8 flex flex-col gap-3.5">
      <div class="card !rounded-[20px] px-4 py-6 flex flex-col items-center gap-2.5 text-center">
        <div class="w-[72px] h-[72px] rounded-full bg-primary text-white flex items-center justify-center pop"><Check :size="36" :stroke-width="3" /></div>
        <span class="text-[22px] font-bold">Səhər ölçüsü yazıldı</span>
        <span class="num text-[44px] font-extrabold text-primary-strong tracking-tight">{{ w }} kq</span>
        <span class="num text-[15px] text-muted">{{ wDiff }}</span>
      </div>
      <div class="card p-4 flex flex-col gap-3">
        <div class="flex justify-between items-center"><span class="eyebrow">Bu həftənin çəkiləri</span><span class="num text-sm font-semibold text-primary-strong">{{ weekCount }} / 7</span></div>
        <div class="grid grid-cols-7 gap-1.5">
          <div v-for="d in week" :key="d.d" class="flex flex-col items-center gap-1">
            <span class="w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-bold box-border"
              :class="d.on ? 'bg-primary text-white' : 'bg-panel text-muted border border-dashed border-faint'">{{ d.on ? '✓' : '' }}</span>
            <span class="text-[11px] text-muted">{{ d.wd }}</span>
          </div>
        </div>
        <span class="text-sm leading-snug text-ink-2">Checkpoint üçün həftədə 7/7 çəki lazımdır. Həftəlik ortalama bazar günü bağlanır.</span>
      </div>
      <div class="grid grid-cols-2 gap-2.5">
        <div class="card p-3.5 flex flex-col gap-1">
          <span class="text-[13px] text-muted">Bel çevrəsi</span>
          <span class="num text-[22px] font-bold">{{ b ? b + ' sm' : '—' }}</span>
          <span class="text-xs text-muted">{{ b && prevWaist ? 'əvvəlki: ' + fmt(prevWaist.waist_cm) + ' sm' : 'növbəti: ' + shortDate(addDays(weekStart(app.today), 7)) }}</span>
        </div>
        <div class="card p-3.5 flex flex-col gap-1">
          <span class="text-[13px] text-muted">Yuxu</span>
          <span class="num text-[22px] font-bold">{{ sleep !== null ? sleepTxt(sleep) : '—' }}</span>
          <span class="text-xs text-muted">hədəf 7–8 saat</span>
        </div>
      </div>
      <button type="button" class="h-[60px] rounded-[14px] border-0 bg-primary text-white text-[17px] font-semibold" @click="router.replace('/')">Bu günə keç</button>
      <button type="button" class="h-12 rounded-[14px] border border-line bg-surface text-ink text-base font-semibold" @click="done = false">Düzəlt</button>
    </div>
  </main>
</template>
