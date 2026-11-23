<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Minus, Plus, ChevronRight, Trophy, Ruler, Download, Sun, Moon, SunMoon } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { repo } from '../repo'
import BackButton from '../components/BackButton.vue'
import NotificationsCard from '../components/NotificationsCard.vue'
import type { Goals } from '../lib/types'
import { themeMode, setThemeMode, type ThemeMode } from '../lib/theme'
import { longDate } from '../lib/dates'
import { fmtL } from '../lib/format'

const app = useApp()
const g = ref<Goals>({ ...app.goals! })
watch(() => app.goals, (v) => { if (v) g.value = { ...v } })

type K = 'kcal' | 'protein_g' | 'fat_g' | 'water_ml' | 'water_training_bonus_ml'
const T: { k: K; label: string; sub: string; step: number; min: number; max: number; show: (v: number) => string }[] = [
  { k: 'kcal', label: 'Kalori', sub: 'kcal / gün', step: 50, min: 1600, max: 3500, show: (v) => String(v) },
  { k: 'protein_g', label: 'Zülal', sub: '≈ 2 q × hədəf çəki', step: 5, min: 80, max: 250, show: (v) => `${v} q` },
  { k: 'fat_g', label: 'Yağ', sub: 'ən azı 50 q tövsiyə olunur', step: 5, min: 40, max: 120, show: (v) => `${v} q` },
  { k: 'water_ml', label: 'Su', sub: 'adi gün', step: 100, min: 1500, max: 5000, show: (v) => `${fmtL(v)} L` },
  { k: 'water_training_bonus_ml', label: 'Məşq günü əlavə su', sub: 'güc məşqi olan günlər', step: 100, min: 0, max: 1500, show: (v) => `+${fmtL(v)} L` },
]
function bump(k: K, d: number) {
  const t = T.find((x) => x.k === k)!
  g.value = { ...g.value, [k]: Math.min(t.max, Math.max(t.min, g.value[k] + d)) }
  saved.value = false
}
const carb = computed(() => Math.max(0, Math.round((g.value.kcal - g.value.protein_g * 4 - g.value.fat_g * 9) / 4)))
const dirty = computed(() => (['kcal', 'protein_g', 'fat_g', 'water_ml', 'water_training_bonus_ml'] as K[]).some((k) => g.value[k] !== app.goals![k]))
const warn = computed(() => {
  if (carb.value < 100) return 'Karbohidrat çox azalır. Zülal və ya yağı bir az azalt.'
  if (g.value.kcal < 1900) return 'Bu kalori səviyyəsi aclıq və yorğunluq yarada bilər. 2–3 həftəlik trendə baxmadan aşağı salma.'
  return ''
})
const busy = ref(false)
const saved = ref(false)
const err = ref('')
async function save() {
  busy.value = true; err.value = ''
  try { await app.saveGoals({ ...g.value, carb_g: carb.value }); saved.value = true }
  catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { busy.value = false }
}
function revert() { g.value = { ...app.goals! }; saved.value = false }

const THEMES: { m: ThemeMode; label: string; icon: any }[] = [
  { m: 'light', label: 'Açıq', icon: Sun }, { m: 'dark', label: 'Qaranlıq', icon: Moon }, { m: 'auto', label: 'Avtomatik', icon: SunMoon },
]

// ixrac: Excel-də açılan CSV (nöqtəli vergül, UTF-8 BOM)
const exportMsg = ref('')
async function exportCsv() {
  exportMsg.value = ''
  try {
    const start = app.profile!.start_date
    const [w, m, c] = await Promise.all([repo.getWeights(start, app.today), repo.getMeasurements(), repo.getClosures(start, app.today)])
    const dates = [...new Set([...w.map((x) => x.date), ...m.map((x) => x.date), ...c.map((x) => x.date)])].sort()
    const n = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','))
    const lines = [['Tarix', 'Çəki kq', 'Kalori', 'Zülal q', 'Plana uyğun', 'Bel sm', 'Sinə sm', 'Qol sm', 'Omba sm', 'Bud sm'].join(';')]
    for (const d of dates) {
      const ww = w.find((x) => x.date === d), mm = m.find((x) => x.date === d), cc = c.find((x) => x.date === d)
      lines.push([d, n(ww?.weight_kg), n(cc?.kcal_total), n(cc?.protein_total), cc ? (cc.adherent ? 'bəli' : 'xeyr') : '', n(mm?.waist_cm), n(mm?.chest_cm), n(mm?.arm_cm), n(mm?.hip_cm), n(mm?.thigh_cm)].join(';'))
    }
    const name = `fitness-${app.today}.csv`
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' })
    const file = new File([blob], name, { type: 'text/csv' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); exportMsg.value = `${dates.length} gün göndərildi.`; return }
      catch (e) { if ((e as Error)?.name === 'AbortError') return }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    exportMsg.value = `${dates.length} günlük fayl yükləndi.`
  } catch (e) { exportMsg.value = 'İxrac alınmadı: ' + (e instanceof Error ? e.message : String(e)) }
}
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pb-[140px]" style="padding-top: max(16px, calc(env(safe-area-inset-top) + 8px))">
    <div class="flex items-center gap-3">
      <BackButton to="/" />
      <h1 class="m-0 text-[26px] font-bold tracking-tight">Parametrlər</h1>
    </div>

    <section class="flex flex-col gap-1.5">
      <span class="eyebrow px-1">Gündəlik hədəflər</span>
      <div class="card overflow-hidden">
        <div v-for="(t, i) in T" :key="t.k" class="flex items-center gap-2 px-3.5 py-2.5" :class="i ? 'border-t border-line' : ''">
          <span class="flex-1 min-w-0 flex flex-col">
            <span class="text-base font-semibold">{{ t.label }}</span>
            <span class="text-[13px] text-muted leading-snug">{{ t.sub }}</span>
          </span>
          <button type="button" :aria-label="`${t.label} azalt`" :disabled="g[t.k] <= t.min" class="w-11 h-11 rounded-xl border border-line bg-panel text-ink flex items-center justify-center shrink-0 disabled:opacity-40" @click="bump(t.k, -t.step)"><Minus :size="18" /></button>
          <span class="num w-[76px] text-center text-base font-bold" aria-live="polite">{{ t.show(g[t.k]) }}</span>
          <button type="button" :aria-label="`${t.label} artır`" :disabled="g[t.k] >= t.max" class="w-11 h-11 rounded-xl border border-line bg-panel text-ink flex items-center justify-center shrink-0 disabled:opacity-40" @click="bump(t.k, t.step)"><Plus :size="18" /></button>
        </div>
        <div class="flex items-center gap-2 px-3.5 py-3 border-t border-line bg-panel">
          <span class="flex-1 min-w-0 flex flex-col">
            <span class="text-base font-semibold">Karbohidrat</span>
            <span class="text-[13px] text-muted">avtomatik: qalan kalori ÷ 4</span>
          </span>
          <span class="num text-base font-bold pr-2">{{ carb }} q</span>
        </div>
      </div>
      <span v-if="warn" class="text-sm text-warn font-semibold px-1" role="status">{{ warn }}</span>
      <span class="text-[13px] text-muted px-1 leading-snug">Hədəfləri 2–3 həftədə bir, çəki trendinə baxaraq dəyiş. Yeni hədəf bu gündən qüvvədədir.</span>
      <div v-if="dirty" class="flex gap-2">
        <button type="button" :disabled="busy" class="flex-1 h-12 rounded-xl border-0 bg-primary text-white text-base font-bold disabled:opacity-60" @click="save">Yadda saxla</button>
        <button type="button" :disabled="busy" class="h-12 px-4 rounded-xl border border-line bg-surface text-ink text-[15px] font-semibold" @click="revert">Ləğv et</button>
      </div>
      <span v-else-if="saved" class="text-sm text-primary-strong font-semibold px-1" role="status">Yeni hədəflər yazıldı.</span>
      <span v-if="err" class="text-sm text-danger font-semibold px-1" role="alert">{{ err }}</span>
    </section>

    <section class="flex flex-col gap-1.5">
      <span class="eyebrow px-1">Bildirişlər</span>
      <NotificationsCard />
      <span class="text-[13px] text-muted px-1 leading-snug">Vaxtlar: 07:15 çəki, yeməklər öz saatında, iş günləri su və hərəkət xatırlatması, 21:30 "Günü bağla". Edilən iş üçün bildiriş gəlmir.</span>
    </section>

    <section class="flex flex-col gap-1.5">
      <span class="eyebrow px-1">Görünüş</span>
      <div role="radiogroup" aria-label="Görünüş" class="grid grid-cols-3 gap-1 bg-panel border border-line rounded-xl p-1">
        <button v-for="t in THEMES" :key="t.m" type="button" role="radio" :aria-checked="themeMode === t.m"
          class="h-11 rounded-[9px] border-0 text-sm font-semibold flex items-center justify-center gap-1.5"
          :class="themeMode === t.m ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'bg-transparent text-muted'" @click="setThemeMode(t.m)">
          <component :is="t.icon" :size="16" />{{ t.label }}
        </button>
      </div>
      <span v-if="themeMode === 'auto'" class="text-[13px] text-muted px-1">iPhone-un öz rejiminə uyğun dəyişir.</span>
    </section>

    <section class="flex flex-col gap-1.5">
      <span class="eyebrow px-1">Məlumat</span>
      <div class="card overflow-hidden">
        <RouterLink to="/rekordlar" class="px-4 min-h-[56px] flex items-center gap-3 text-ink no-underline"><Trophy :size="20" class="text-primary-strong" /><span class="flex-1 text-[15px] font-medium">Güc rekordları</span><ChevronRight :size="18" class="text-muted" /></RouterLink>
        <RouterLink to="/olculer" class="px-4 min-h-[56px] flex items-center gap-3 text-ink no-underline border-t border-line"><Ruler :size="20" class="text-primary-strong" /><span class="flex-1 text-[15px] font-medium">Bədən ölçüləri</span><ChevronRight :size="18" class="text-muted" /></RouterLink>
        <button type="button" class="w-full px-4 min-h-[56px] flex items-center gap-3 text-ink border-0 border-t border-solid border-line bg-transparent text-left" @click="exportCsv"><Download :size="20" class="text-primary-strong" /><span class="flex-1 text-[15px] font-medium">Excel-ə ixrac et (CSV)</span></button>
      </div>
      <span v-if="exportMsg" class="text-sm text-ink-2 px-1" role="status">{{ exportMsg }}</span>
    </section>

    <section class="flex flex-col gap-1.5">
      <span class="eyebrow px-1">Hesab</span>
      <div class="card p-4 flex flex-col gap-1">
        <span class="text-[15px]">{{ app.email }}</span>
        <span class="text-[13px] text-muted">Proqramın başlanğıcı: {{ longDate(app.profile!.start_date) }}</span>
      </div>
      <button type="button" class="self-center h-11 px-4 border-0 bg-transparent text-danger text-[15px] font-semibold" @click="app.signOut().then(() => $router.replace('/giris'))">Çıxış</button>
    </section>
  </main>
</template>
