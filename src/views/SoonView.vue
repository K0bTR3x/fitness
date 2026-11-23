<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { TrendingUp, Trophy } from 'lucide-vue-next'
import { useApp } from '../stores/app'
import { fmt } from '../lib/format'
import { weekAverage } from '../lib/weight'
const route = useRoute()
const app = useApp()
const isRewards = computed(() => route.meta.nav === 'rewards')
const statusTxt = { gozleyir: 'Gözləyir', hedefe_catildi: 'Hədəfə çatıldı', mukafat_istifade_edildi: 'Mükafat istifadə edildi' } as const
const wk = computed(() => weekAverage(app.weights, app.today))
</script>
<template>
  <main class="flex flex-col gap-4 px-4 pb-[140px]" style="padding-top: max(24px, calc(env(safe-area-inset-top) + 12px))">
    <h1 class="m-0 text-[28px] font-bold">{{ route.meta.title }}</h1>
    <div class="rounded-2xl bg-soft p-4 flex gap-3 items-start">
      <component :is="isRewards ? Trophy : TrendingUp" :size="24" class="text-primary-strong shrink-0" />
      <span class="text-[15px] leading-snug text-on-soft">Bu ekranın tam dizaynı növbəti versiyada gəlir. Məlumat artıq toplanır, heç nə itmir.</span>
    </div>
    <section v-if="isRewards" class="card overflow-hidden">
      <div v-for="(c, i) in app.checkpoints" :key="c.id" class="flex items-center justify-between px-4 py-3" :class="i ? 'border-t border-line' : ''">
        <span class="flex flex-col"><span class="text-base font-semibold">{{ c.label }}</span><span class="text-[13px] text-muted">{{ c.reward_text }}</span></span>
        <span class="flex flex-col items-end"><span class="num text-lg font-bold">≤ {{ fmt(c.target_kg) }} kq</span>
          <span class="text-xs font-semibold" :class="c.status === 'gozleyir' ? 'text-muted' : 'text-primary-strong'">{{ statusTxt[c.status] }}</span></span>
      </div>
    </section>
    <section v-else class="card p-4 flex flex-col gap-2">
      <span class="eyebrow">Bu həftə</span>
      <span class="num text-2xl font-bold">{{ wk.avg ? fmt(wk.avg) + ' kq ortalama' : 'Hələ çəki yoxdur' }}</span>
      <span class="text-[13px] text-muted">{{ wk.count }}/7 çəki · başlanğıc {{ fmt(app.profile!.start_weight_kg) }} kq</span>
      <div v-for="w in [...app.weights].reverse().slice(0, 14)" :key="w.date" class="flex justify-between text-sm border-t border-line pt-1.5"><span>{{ w.date }}</span><span class="num font-semibold">{{ fmt(w.weight_kg) }} kq</span></div>
    </section>
  </main>
</template>
