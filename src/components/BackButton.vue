<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
const props = defineProps<{ to?: string; label?: string }>()
const router = useRouter()
function back() { if (window.history.state?.back) router.back(); else router.replace(props.to ?? '/') }
</script>
<template>
  <button type="button" :aria-label="label ?? 'Geri'" class="w-11 h-11 rounded-full bg-panel border border-line text-ink flex items-center justify-center shrink-0" @click="back">
    <ArrowLeft :size="22" />
  </button>
</template>
