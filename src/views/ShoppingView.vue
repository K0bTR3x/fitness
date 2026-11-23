<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Share2 } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import BackButton from '../components/BackButton.vue'
import Bar from '../components/Bar.vue'
import { addDays, shortDate, weekDays, weekStart } from '../lib/dates'
import { ordinal } from '../lib/format'
import { shoppingList, shoppingText } from '../lib/shopping'

const app = useApp()
const which = ref<0 | 1>(0) // 0 = bu həftə, 1 = gələn həftə
const onlyLeft = ref(false)
const ws = computed(() => addDays(weekStart(app.today), which.value * 7))
const days = computed(() => weekDays(ws.value))
const weekNo = computed(() => Math.floor((Date.parse(ws.value) - Date.parse(weekStart(app.profile!.start_date))) / 6048e5) + 1)
const range = computed(() => `${shortDate(days.value[0])} – ${shortDate(days.value[6])}`)
const groups = computed(() => shoppingList(app.catalog!, days.value.map((d) => app.planOn(d))))

// alınanlar: yalnız bu telefonda (həftəyə görə)
const key = computed(() => `fd-shop-${ws.value}`)
const got = ref<Record<string, boolean>>({})
watch(key, (k) => { try { got.value = JSON.parse(localStorage.getItem(k) ?? '{}') } catch { got.value = {} } }, { immediate: true })
function toggle(id: string) {
  got.value = { ...got.value, [id]: !got.value[id] }
  try { localStorage.setItem(key.value, JSON.stringify(got.value)) } catch { /* yaddaş yoxdursa, sessiya üçün */ }
  shared.value = ''
}
const total = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0))
const done = computed(() => groups.value.reduce((n, g) => n + g.items.filter((i) => got.value[i.food_id]).length, 0))
const shown = computed(() => groups.value.map((g) => ({ ...g, items: g.items.filter((i) => !onlyLeft.value || !got.value[i.food_id]) })).filter((g) => g.items.length))

const shared = ref('')
async function share() {
  const text = shoppingText(groups.value, `Alış-veriş (${range.value})`, got.value)
  try {
    if (navigator.share) { await navigator.share({ text }); shared.value = 'Göndərildi.'; return }
  } catch (e) { if ((e as Error)?.name === 'AbortError') return }
  try { await navigator.clipboard.writeText(text); shared.value = 'Siyahı kopyalandı. WhatsApp-da yapışdır.' }
  catch { shared.value = 'Kopyalamaq alınmadı.' }
}
</script>

<template>
  <main class="flex flex-col gap-4 px-4 pb-[140px]" style="padding-top: max(16px, calc(env(safe-area-inset-top) + 8px))">
    <div class="flex items-center gap-3">
      <BackButton to="/" />
      <div class="flex flex-col min-w-0">
        <h1 class="m-0 text-[26px] font-bold tracking-tight">Alış-veriş siyahısı</h1>
        <span class="num text-[13px] text-muted">{{ weekNo > 0 ? ordinal(weekNo) + ' həftə · ' : '' }}{{ range }} menyusundan</span>
      </div>
    </div>

    <div role="group" aria-label="Həftə" class="grid grid-cols-2 gap-1 bg-panel border border-line rounded-xl p-1">
      <button v-for="(t, i) in ['Bu həftə', 'Gələn həftə']" :key="t" type="button" :aria-pressed="which === i"
        class="h-10 rounded-[9px] border-0 text-sm font-semibold"
        :class="which === i ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'bg-transparent text-muted'" @click="which = i as 0 | 1">{{ t }}</button>
    </div>

    <section class="card p-4 flex flex-col gap-2.5">
      <div class="flex justify-between items-baseline">
        <span class="num text-base font-semibold">{{ done }} / {{ total }} alındı</span>
        <span class="num text-[13px] text-muted">{{ total - done }} qalıb</span>
      </div>
      <Bar :value="done" :max="total" />
      <div class="flex items-center gap-2">
        <button type="button" :aria-pressed="onlyLeft" class="h-10 px-3.5 rounded-full text-sm font-semibold border"
          :class="onlyLeft ? 'bg-ink text-surface border-ink' : 'bg-surface text-ink border-line'" @click="onlyLeft = !onlyLeft">Yalnız qalanlar</button>
        <span class="flex-1" />
        <button type="button" class="h-10 px-4 rounded-full border-0 bg-primary text-white text-sm font-semibold flex items-center gap-1.5" @click="share"><Share2 :size="17" />Göndər</button>
      </div>
      <span v-if="shared" class="text-sm text-primary-strong font-semibold" role="status">{{ shared }}</span>
    </section>

    <section v-for="g in shown" :key="g.id" class="flex flex-col gap-1.5">
      <div class="flex justify-between items-baseline px-1">
        <span class="text-base font-semibold">{{ g.icon }} {{ g.name }}</span>
        <span class="num text-[13px] text-muted">{{ g.items.length }}</span>
      </div>
      <div class="card overflow-hidden">
        <button v-for="(it, i) in g.items" :key="it.food_id" type="button" role="checkbox" :aria-checked="!!got[it.food_id]"
          class="w-full min-h-[60px] px-3.5 py-2 border-0 bg-transparent text-ink flex items-center gap-3 text-left" :class="i ? 'border-t border-line border-solid' : ''" @click="toggle(it.food_id)">
          <span class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 box-border" :class="got[it.food_id] ? 'bg-primary text-white' : 'border-2 border-faint'">
            <Check v-if="got[it.food_id]" :size="16" :stroke-width="3" />
          </span>
          <span class="flex-1 min-w-0 flex flex-col">
            <span class="text-base font-medium" :class="got[it.food_id] ? 'line-through text-muted' : ''">{{ it.name }}</span>
            <span class="num text-xs text-muted">{{ it.note }}</span>
          </span>
          <span class="num text-base font-semibold whitespace-nowrap" :class="got[it.food_id] ? 'text-muted' : ''">{{ it.qty }}</span>
        </button>
      </div>
    </section>
    <p v-if="!shown.length" class="m-0 card p-4 text-[15px] text-ink-2">Hamısı alınıb 🎉</p>

    <p class="m-0 text-[13px] text-muted leading-normal">Miqdarlar menyudakı çəkilərin cəmidir. Meyvə və tərəvəzə qabıq və tullantı üçün 15% əlavə olunub. Yeməyi dəyişəndə siyahı da yenilənir.</p>
  </main>
</template>
