<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, X, Check, Dumbbell, Moon } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import { buildSteps, toSetLog, type GymStep } from '../lib/gym'
import type { SetLog } from '../lib/types'
import { fmt } from '../lib/format'
import { programWeek } from '../lib/dates'

const app = useApp()
const router = useRouter()
const tpl = computed(() => app.todayTemplate!)
const KEY = `fd-gym-${app.today}`
const steps = ref<GymStep[]>([])
const st = reactive({ ex: 0, set: 1, a: [] as number[], b: [] as number[], logged: [] as SetLog[], checks: [] as boolean[], done: false })
const resting = ref(false)
const endAt = ref(0)
const total = ref(90)
const now = ref(Date.now())
const flash = ref(false)
const undoUntil = ref(0)
const undoPrev = ref<{ ex: number; set: number } | null>(null)
const tips = ref(false)
const saving = ref(false)
const saved = ref(false)
const err = ref('')
const already = ref(false)
const confirmExit = ref(false)
const firstWeeks = computed(() => programWeek(app.profile!.start_date, app.today) <= 2)

onMounted(async () => {
  const items = tpl.value.items
  const ex = app.catalog!.exercises
  const last = await repo.lastSets(items.map((i) => i.exercise_id)).catch(() => ({}))
  steps.value = buildSteps(items, ex, last)
  st.a = steps.value.map((s) => s.a); st.b = steps.value.map((s) => s.b); st.checks = items.map(() => false)
  try { const raw = localStorage.getItem(KEY); if (raw) Object.assign(st, JSON.parse(raw)) } catch {}
  already.value = (await repo.getWorkouts(app.today, app.today).catch(() => [])).length > 0
  requestWake()
})
watch(st, () => { try { localStorage.setItem(KEY, JSON.stringify(st)) } catch {} }, { deep: true })

// ekran sönməsin (iPhone: iOS 16.4+ ana ekran tətbiqində)
let wake: any = null
async function requestWake() { try { wake = await (navigator as any).wakeLock?.request('screen') } catch {} }
const onVis = () => { if (document.visibilityState === 'visible') requestWake() }
document.addEventListener('visibilitychange', onVis)

// taymer bitmə vaxtına görə: ekran kilidlənsə də düz qalır
let audio: AudioContext | null = null
function beep() {
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator(), g = audio.createGain()
    o.frequency.value = 880; o.connect(g); g.connect(audio.destination)
    g.gain.setValueAtTime(0.25, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.5)
    o.start(); o.stop(audio.currentTime + 0.5)
  } catch {}
}
let lastBeep = 0
const timer = setInterval(() => {
  now.value = Date.now()
  if (resting.value) {
    const left = Math.ceil((endAt.value - now.value) / 1000)
    if (left <= 3 && left > 0 && left !== lastBeep) { lastBeep = left; beep() }
    if (now.value >= endAt.value) { resting.value = false; flash.value = true; beep(); setTimeout(() => (flash.value = false), 2600) }
  }
}, 250)
onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); try { wake?.release() } catch {} })

const cur = computed(() => steps.value[st.ex])
const last = computed(() => st.ex === steps.value.length - 1)
const left = computed(() => (resting.value ? Math.max(0, Math.ceil((endAt.value - now.value) / 1000)) : 0))
const C = 2 * Math.PI * 82
const restDash = computed(() => `${((resting.value ? Math.max(0, (endAt.value - now.value) / (total.value * 1000)) : 0) * C).toFixed(1)} ${C.toFixed(1)}`)
const aTxt = computed(() => fmt(st.a[st.ex] ?? 0, Number.isInteger(st.a[st.ex]) ? 0 : 1))
const setA = (d: number) => { st.a[st.ex] = Math.max(0, Math.round((st.a[st.ex] + d) * 10) / 10) }
const setB = (d: number) => { st.b[st.ex] = Math.max(0, st.b[st.ex] + d) }
const mainLabel = computed(() => cur.value?.exercise.category === 'kardio' ? 'Kardionu bitir' : cur.value?.exercise.measure === 'saniye' ? 'Plank bitdi' : 'Set bitdi')
const nextSetLine = computed(() => {
  const s = cur.value
  if (!s) return ''
  if (st.set <= s.sets) return `Set ${st.set} / ${s.sets} · ` + (s.exercise.measure === 'set_tekrar' ? `${st.b[st.ex]} × ${aTxt.value} kq` : `${aTxt.value} san`)
  return last.value ? 'son hərəkət' : steps.value[st.ex + 1].exercise.name
})

function startRest(sec: number) { if (sec > 0) { resting.value = true; endAt.value = Date.now() + sec * 1000; total.value = sec; lastBeep = 0 } }
function setDone() {
  const s = cur.value
  undoPrev.value = { ex: st.ex, set: st.set }
  undoUntil.value = Date.now() + 5000
  st.logged.push(toSetLog(s, st.set, st.a[st.ex], st.b[st.ex]))
  tips.value = false
  if (st.set < s.sets) { st.set++; startRest(s.rest) }
  else if (!last.value) { st.ex++; st.set = 1; startRest(s.rest) }
  else st.done = true
}
function undo() {
  const p = undoPrev.value
  if (!p) return
  st.logged.pop(); st.ex = p.ex; st.set = p.set; st.done = false
  resting.value = false; undoUntil.value = 0; undoPrev.value = null
}
function jump(d: number) { const n = st.ex + d; if (n >= 0 && n < steps.value.length) { st.ex = n; st.set = 1; resting.value = false; tips.value = false } }
let tx = 0
const ts = (e: TouchEvent) => (tx = e.touches[0].clientX)
const te = (e: TouchEvent) => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 70) jump(dx < 0 ? 1 : -1) }

const totalSets = computed(() => steps.value.reduce((s, x) => s + x.sets, 0))
async function save(status: 'tamamlandi' | 'qismen') {
  saving.value = true; err.value = ''
  try {
    let sets = st.logged
    if (tpl.value.kind !== 'guc') sets = steps.value.filter((_, i) => st.checks[i]).map((s, i) => toSetLog(s, i + 1, s.a, s.b))
    await repo.saveWorkout({ date: app.today, template_id: tpl.value.id, status, sets })
    try { localStorage.removeItem(KEY) } catch {}
    saved.value = true
  } catch (e: any) { err.value = 'Yadda saxlanmadı, internet gələndə yenidən bas. (' + e.message + ')' } finally { saving.value = false }
}
function exit() {
  if (st.logged.length && !st.done && !saved.value) confirmExit.value = true
  else router.replace('/')
}
const doneLine = computed(() => `${new Set(st.logged.map((l) => l.exercise_id)).size} hərəkət · ${st.logged.length} set yazıldı. Əla iş! Axşam yeməyində zülalı unutma.`)
const lightItemLine = (s: GymStep) => s.item.sets ? `${s.item.sets} × ${s.item.reps_min}` : s.item.minutes ? `${s.item.minutes}${s.item.minutes_max ? '–' + s.item.minutes_max : ''} dəq` : (s.item.note ?? '')
</script>

<template>
  <main class="min-h-dvh flex flex-col px-4 gap-3.5 bg-surface" :class="flash ? 'flash' : ''" style="padding-top: max(20px, calc(env(safe-area-inset-top) + 8px)); padding-bottom: max(20px, env(safe-area-inset-bottom))">
    <div class="flex items-center justify-between h-11">
      <button type="button" class="h-11 px-3.5 rounded-full bg-panel border-0 text-ink text-[15px] font-semibold flex items-center gap-1.5" @click="exit"><X :size="18" />Bitir</button>
      <span class="num text-[15px] font-semibold text-muted">{{ tpl.name.replace(' + qarın', '') }}<template v-if="tpl.kind === 'guc' && steps.length"> · {{ st.ex + 1 }} / {{ steps.length }}</template></span>
      <button v-if="tpl.kind === 'guc'" type="button" aria-label="Texnika ipucları" class="w-11 h-11 rounded-full border-0 bg-panel text-ink text-lg font-bold" @click="tips = !tips">?</button>
      <span v-else class="w-11" />
    </div>

    <!-- yadda saxlandı -->
    <div v-if="saved" class="flex-1 flex flex-col items-center justify-center gap-4 text-center">
      <div class="w-24 h-24 rounded-full bg-soft text-primary flex items-center justify-center pop"><Check :size="48" :stroke-width="2.5" /></div>
      <h1 class="m-0 text-[28px] font-bold">Yadda saxlandı</h1>
      <p class="m-0 text-[17px] text-ink-2">Bu günün məşqi qeyd olundu.</p>
      <button type="button" class="mt-2 w-full h-16 rounded-2xl border-0 bg-primary text-white text-lg font-bold" @click="router.replace('/')">Bu günə qayıt</button>
    </div>

    <!-- istirahət günü -->
    <div v-else-if="tpl.kind === 'istirahet'" class="flex-1 flex flex-col items-center justify-center gap-4 text-center">
      <div class="w-24 h-24 rounded-full bg-soft text-primary flex items-center justify-center"><Moon :size="44" /></div>
      <h1 class="m-0 text-[28px] font-bold">Bu gün istirahət günüdür</h1>
      <p class="m-0 text-[17px] text-ink-2 leading-normal">Əzələ istirahətdə böyüyür. 7–8 saat yat, sabah Full Body A var.</p>
      <button type="button" class="mt-2 w-full h-14 rounded-2xl border border-line bg-surface text-ink text-base font-semibold" @click="router.push('/teqvim')">Həftənin planına bax</button>
    </div>

    <!-- yüngül gün: siyahı -->
    <template v-else-if="tpl.kind === 'yungul'">
      <h1 class="m-0 text-[28px] font-bold">{{ tpl.name }}</h1>
      <p class="m-0 text-[15px] text-muted">Etdiyin hər bəndə toxun. Hamısını etmək məcburi deyil.</p>
      <div class="flex flex-col gap-2.5">
        <button v-for="(s, i) in steps" :key="i" type="button" class="min-h-[72px] rounded-2xl border px-4 py-3 flex items-center gap-3 text-left"
          :class="st.checks[i] ? 'border-primary bg-soft text-ink' : 'border-line bg-surface text-ink'" @click="st.checks[i] = !st.checks[i]">
          <span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 box-border" :class="st.checks[i] ? 'bg-primary text-white' : 'border-2 border-line'"><Check v-if="st.checks[i]" :size="20" :stroke-width="3" /></span>
          <span class="flex-1 flex flex-col gap-0.5"><span class="text-[17px] font-semibold">{{ s.exercise.name }}</span><span class="text-sm text-muted">{{ lightItemLine(s) }}</span></span>
        </button>
      </div>
      <div class="flex-1" />
      <span v-if="err" class="text-sm text-danger font-semibold">{{ err }}</span>
      <span v-if="already" class="text-[13px] text-muted text-center">Bu gün artıq qeyd olunub, yenidən saxlasan əvəz olunacaq.</span>
      <button type="button" :disabled="saving || !st.checks.some(Boolean)" class="h-16 rounded-2xl border-0 text-xl font-bold disabled:bg-track disabled:text-muted bg-primary text-white"
        @click="save(st.checks.every(Boolean) ? 'tamamlandi' : 'qismen')">{{ saving ? 'Yazılır…' : 'Tamamlandı' }}</button>
    </template>

    <!-- güc məşqi tamamlandı -->
    <div v-else-if="st.done" class="flex-1 flex flex-col items-center justify-center gap-4 text-center">
      <div class="w-24 h-24 rounded-full bg-soft text-primary flex items-center justify-center pop"><Check :size="48" :stroke-width="2.5" /></div>
      <h1 class="m-0 text-[28px] font-bold">Məşq tamamlandı</h1>
      <p class="num m-0 text-[17px] text-ink-2 leading-normal">{{ doneLine }}</p>
      <span v-if="err" class="text-sm text-danger font-semibold">{{ err }}</span>
      <button type="button" :disabled="saving" class="mt-2 w-full h-16 rounded-2xl border-0 bg-primary text-white text-lg font-bold disabled:opacity-60" @click="save(st.logged.length >= totalSets ? 'tamamlandi' : 'qismen')">{{ saving ? 'Yazılır…' : 'Yadda saxla' }}</button>
      <button type="button" class="h-12 border-0 bg-transparent text-muted text-[15px]" @click="undo">Son seti geri al</button>
    </div>

    <!-- güc məşqi -->
    <div v-else-if="cur" class="flex-1 flex flex-col gap-3.5 min-h-0" @touchstart.passive="ts" @touchend.passive="te">
      <button type="button" aria-label="Animasiyanı böyüt və ipucları göstər" class="relative h-[clamp(150px,25dvh,212px)] rounded-[20px] border border-line bg-white p-0 overflow-hidden shrink-0" @click="tips = !tips">
        <template v-if="cur.exercise.demo_frames.length">
          <img :src="cur.exercise.demo_frames[0]" :alt="cur.exercise.name + ': başlanğıc vəziyyət'" class="absolute inset-0 w-full h-full object-contain pose-a" />
          <img :src="cur.exercise.demo_frames[1]" :alt="cur.exercise.name + ': son vəziyyət'" class="absolute inset-0 w-full h-full object-contain pose-b" />
        </template>
        <div v-else class="absolute inset-0 flex items-center justify-center text-faint"><Dumbbell :size="64" /></div>
        <span class="absolute left-3 bottom-2.5 text-xs text-[#6B7280] bg-white border border-[#E5E7EB] rounded-full px-2 py-0.5">Toxun: ipucları</span>
      </button>
      <div v-if="tips" class="bg-[#111827] text-white rounded-2xl px-4 py-3.5 flex flex-col gap-2">
        <div v-for="(t, i) in cur.exercise.tips_az" :key="i" class="flex gap-2.5 text-base leading-snug"><span class="text-[#4ADE80] font-bold">{{ i + 1 }}.</span><span>{{ t }}</span></div>
        <span v-if="cur.item.note" class="text-sm text-[#D1D5DB]">{{ cur.item.note }}</span>
      </div>
      <div class="flex items-end justify-between gap-3">
        <h1 class="m-0 text-[28px] font-bold tracking-tight leading-tight">{{ cur.exercise.name }}</h1>
        <span class="num text-[30px] font-extrabold text-primary whitespace-nowrap">Set {{ Math.min(st.set, cur.sets) }} / {{ cur.sets }}</span>
      </div>

      <div v-if="resting" class="flex-1 flex flex-col items-center justify-center gap-3.5">
        <div class="relative w-[184px] h-[184px]">
          <svg width="184" height="184" viewBox="0 0 184 184" aria-hidden="true">
            <circle cx="92" cy="92" r="82" fill="none" stroke="var(--track)" stroke-width="12" />
            <circle cx="92" cy="92" r="82" fill="none" stroke="var(--primary)" stroke-width="12" stroke-linecap="round" :stroke-dasharray="restDash" transform="rotate(-90 92 92)" />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="num text-[64px] font-bold tracking-tight leading-none" role="timer">{{ Math.floor(left / 60) }}:{{ String(left % 60).padStart(2, '0') }}</span>
            <span class="text-sm text-muted mt-1">istirahət</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2.5 w-full">
          <button type="button" class="h-14 rounded-[14px] border border-line bg-surface text-ink text-lg font-semibold" @click="endAt = Math.max(Date.now() + 1000, endAt - 15000)">−15 san</button>
          <button type="button" class="h-14 rounded-[14px] border border-line bg-surface text-ink text-lg font-semibold" @click="endAt += 15000; total += 15">+15 san</button>
        </div>
        <span class="num text-base text-ink-2">Növbəti: {{ nextSetLine }}</span>
      </div>

      <div v-else class="flex flex-col gap-3">
        <div class="grid gap-2.5" :class="cur.hasB ? 'grid-cols-2' : 'grid-cols-1'">
          <div class="border border-line rounded-2xl p-2.5 flex flex-col items-center gap-1">
            <span class="text-[13px] text-muted font-semibold">{{ cur.aLabel }}</span>
            <div class="flex items-center justify-between w-full">
              <button type="button" aria-label="Azalt" class="w-14 h-14 rounded-[14px] border-0 bg-panel text-ink text-[28px] font-semibold" @click="setA(-cur.aStep)">−</button>
              <span class="num text-[40px] font-bold tracking-tight">{{ aTxt }}</span>
              <button type="button" aria-label="Artır" class="w-14 h-14 rounded-[14px] border-0 bg-panel text-ink text-[28px] font-semibold" @click="setA(cur.aStep)">+</button>
            </div>
          </div>
          <div v-if="cur.hasB" class="border border-line rounded-2xl p-2.5 flex flex-col items-center gap-1">
            <span class="text-[13px] text-muted font-semibold">{{ cur.bLabel }}</span>
            <div class="flex items-center justify-between w-full">
              <button type="button" aria-label="Azalt" class="w-14 h-14 rounded-[14px] border-0 bg-panel text-ink text-[28px] font-semibold" @click="setB(-cur.bStep)">−</button>
              <span class="num text-[40px] font-bold tracking-tight">{{ st.b[st.ex] }}</span>
              <button type="button" aria-label="Artır" class="w-14 h-14 rounded-[14px] border-0 bg-panel text-ink text-[28px] font-semibold" @click="setB(cur.bStep)">+</button>
            </div>
          </div>
        </div>
        <div v-if="cur.exercise.category === 'kardio' && firstWeeks && st.b[st.ex] > 3" class="bg-warn-bg text-warn rounded-xl px-3 py-2.5 text-sm font-medium">İlk 2 həftə meyil 3%-dən yuxarı olmasın.</div>
        <div class="flex gap-2 items-center">
          <span v-for="i in cur.sets" :key="i" class="w-[18px] h-[18px] rounded-full box-border" :class="i < st.set ? 'bg-primary' : i === st.set ? 'bg-surface border-[3px] border-primary' : 'bg-track'" />
          <span class="num text-sm text-muted ml-1">Hədəf: {{ cur.target }}<template v-if="cur.rest"> · istirahət {{ cur.rest }} san</template></span>
        </div>
      </div>

      <div class="flex-1" />
      <div v-if="undoUntil > now" class="bg-[#111827] text-white rounded-[14px] pl-4 pr-2 h-[52px] flex items-center justify-between">
        <span class="num text-[15px]">Set yazıldı · {{ Math.max(0, Math.ceil((undoUntil - now) / 1000)) }} san</span>
        <button type="button" class="h-11 px-3.5 rounded-[10px] border-0 bg-transparent text-[#4ADE80] text-base font-bold" @click="undo">Geri al</button>
      </div>
      <button v-if="!resting" type="button" class="h-16 rounded-2xl border-0 bg-primary text-white text-xl font-bold shrink-0" @click="setDone">{{ mainLabel }}</button>
      <button v-else type="button" class="h-16 rounded-2xl border-2 border-primary bg-surface text-primary-strong text-xl font-bold shrink-0" @click="resting = false">İstirahəti keç</button>
      <div class="flex items-center justify-between gap-2 shrink-0">
        <button type="button" aria-label="Əvvəlki hərəkət" class="w-12 h-12 rounded-full border border-line bg-surface text-ink flex items-center justify-center disabled:opacity-40" :disabled="st.ex === 0" @click="jump(-1)"><ChevronLeft :size="22" /></button>
        <span class="text-base text-ink-2 text-center">{{ last ? 'Son hərəkət' : 'Növbəti: ' + steps[st.ex + 1].exercise.name }}</span>
        <button type="button" aria-label="Növbəti hərəkət" class="w-12 h-12 rounded-full border border-line bg-surface text-ink flex items-center justify-center disabled:opacity-40" :disabled="last" @click="jump(1)"><ChevronRight :size="22" /></button>
      </div>
    </div>

    <!-- çıxış təsdiqi -->
    <div v-if="confirmExit" class="fixed inset-0 z-30 bg-black/40 flex items-end justify-center" @click.self="confirmExit = false">
      <div class="w-full max-w-[480px] bg-surface rounded-t-[28px] p-4 flex flex-col gap-2.5 safe-bottom">
        <h2 class="m-0 text-xl font-bold">Məşqi bitirək?</h2>
        <p class="m-0 text-[15px] text-ink-2">{{ st.logged.length }} set yazılıb. Yarımçıq məşq "qismən" kimi saxlanılır.</p>
        <button type="button" class="h-14 rounded-2xl border-0 bg-primary text-white text-[17px] font-bold" @click="confirmExit = false; save('qismen')">Saxla və bitir</button>
        <button type="button" class="h-12 rounded-2xl border border-line bg-surface text-ink text-base font-semibold" @click="confirmExit = false">Davam et</button>
        <button type="button" class="h-11 border-0 bg-transparent text-muted text-sm" @click="router.replace('/')">Saxlamadan çıx (telefonda qalır)</button>
      </div>
    </div>
  </main>
</template>
