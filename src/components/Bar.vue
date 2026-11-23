<script setup lang="ts">
defineProps<{ value: number; max: number; h?: number }>()
</script>
<template>
  <div class="rounded-full bg-track overflow-hidden" :style="{ height: (h ?? 10) + 'px' }">
    <div class="h-full rounded-full bg-primary transition-[width] duration-300" :style="{ width: Math.min(100, Math.round((value / Math.max(1, max)) * 100)) + '%' }" />
  </div>
</template>
