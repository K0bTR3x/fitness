<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Home, Utensils, Dumbbell, TrendingUp, Trophy, Plus } from 'lucide-vue-next'
const route = useRoute()
const items = [
  { key: 'today', to: '/', label: 'Bu gün', icon: Home },
  { key: 'food', to: '/teqvim', label: 'Qida', icon: Utensils },
  { key: 'gym', to: '/zal', label: 'Məşq', icon: Dumbbell },
  { key: 'progress', to: '/inkisaf', label: 'İnkişaf', icon: TrendingUp },
  { key: 'rewards', to: '/mukafatlar', label: 'Mükafatlar', icon: Trophy },
]
</script>

<template>
  <RouterLink v-if="route.meta.nav === 'today' || route.meta.nav === 'food'" to="/qeyd" aria-label="Tez qeyd: çəki, su və ya yemək"
    class="fixed z-20 right-[max(20px,calc(50%-220px))] w-[60px] h-[60px] rounded-full bg-primary text-white flex items-center justify-center shadow-[0_8px_20px_rgba(21,128,61,0.35)]"
    style="bottom: calc(96px + env(safe-area-inset-bottom))">
    <Plus :size="30" :stroke-width="2.5" />
  </RouterLink>
  <nav aria-label="Əsas menyu" class="fixed z-10 bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-surface border-t border-line grid grid-cols-5 px-1 pt-1.5"
    style="padding-bottom: max(10px, env(safe-area-inset-bottom))">
    <RouterLink v-for="it in items" :key="it.key" :to="it.to" :aria-current="route.meta.nav === it.key ? 'page' : undefined"
      class="flex flex-col items-center justify-center gap-1 h-[58px] text-xs no-underline"
      :class="route.meta.nav === it.key ? 'text-primary-strong font-semibold' : 'text-muted font-medium'">
      <component :is="it.icon" :size="24" />
      {{ it.label }}
    </RouterLink>
  </nav>
</template>
