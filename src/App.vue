<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from './stores/app'
import { repo } from './repo'
import BottomNav from './components/BottomNav.vue'

const app = useApp()
const route = useRoute()
const loading = ref(false)
const offline = ref(typeof navigator !== 'undefined' && !navigator.onLine)
const needsBoot = computed(() => !route.meta.public && app.email && !app.booted)

async function boot() {
  loading.value = true
  try { await app.boot() } catch (e: any) { app.error = e?.message ?? String(e) } finally { loading.value = false }
}
watch(needsBoot, (v) => { if (v) boot() }, { immediate: true })

// Tətbiqə qayıdanda (yeni gün ola bilər) məlumatı yenilə
function onVisible() { if (document.visibilityState === 'visible' && app.booted) app.refresh().catch(() => {}) }
const setOnline = () => (offline.value = !navigator.onLine)
onMounted(() => { document.addEventListener('visibilitychange', onVisible); addEventListener('online', setOnline); addEventListener('offline', setOnline) })
onUnmounted(() => { document.removeEventListener('visibilitychange', onVisible); removeEventListener('online', setOnline); removeEventListener('offline', setOnline) })
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-[480px] bg-bg text-ink relative">
    <div v-if="repo.mode === 'demo' && !route.meta.public" class="bg-warn-bg text-warn text-[13px] font-semibold px-4 py-1.5 text-center safe-top !pb-1.5">
      Demo rejimi: məlumat yalnız bu brauzerdə saxlanılır
    </div>
    <div v-if="offline" class="bg-ink text-bg text-[13px] font-semibold px-4 py-1.5 text-center">İnternet yoxdur. Qeydlər göndərilməyə bilər.</div>

    <template v-if="route.meta.public">
      <RouterView />
    </template>
    <div v-else-if="app.error" class="p-6 pt-24 flex flex-col gap-4">
      <h1 class="text-2xl font-bold m-0">Məlumat yüklənmədi</h1>
      <p class="text-ink-2 m-0 leading-relaxed">İnterneti yoxla və yenidən cəhd et. Qeydlərin itməyib, onlar bazada saxlanılır.</p>
      <p class="text-[13px] text-muted m-0 break-words">Texniki səbəb: {{ app.error }}</p>
      <button class="h-14 rounded-2xl border-0 bg-primary text-white text-[17px] font-bold" @click="boot">Yenidən cəhd et</button>
    </div>
    <div v-else-if="!app.booted" class="flex flex-col gap-4 p-4 pt-16" aria-busy="true" aria-label="Yüklənir">
      <div v-for="i in 4" :key="i" class="card h-32 animate-pulse" />
    </div>
    <template v-else>
      <RouterView />
      <BottomNav v-if="route.meta.nav" />
    </template>
  </div>
</template>
