<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Bell, BellOff } from 'lucide-vue-next'
import { repo } from '../repo'
import { pushState, subscribePush, unsubscribePush, type PushState } from '../lib/push'

const state = ref<PushState | null>(null)
const busy = ref(false)
const msg = ref('')
const err = ref('')

async function refresh() { state.value = await pushState().catch(() => 'unsupported' as PushState) }
onMounted(refresh)

async function enable() {
  busy.value = true; err.value = ''; msg.value = ''
  try {
    await repo.savePushSubscription(await subscribePush())
    msg.value = 'Bildirişlər açıldı. Sınaq göndərib yoxla.'
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    err.value = m === 'denied' ? '' : m
  } finally { busy.value = false; await refresh() }
}

async function disable() {
  busy.value = true; err.value = ''; msg.value = ''
  try {
    const endpoint = await unsubscribePush()
    if (endpoint) await repo.deletePushSubscription(endpoint)
    msg.value = 'Bildirişlər söndürüldü.'
  } catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { busy.value = false; await refresh() }
}

async function test() {
  busy.value = true; err.value = ''; msg.value = ''
  try {
    const n = await repo.sendTestPush()
    msg.value = n > 0 ? 'Göndərildi. Bir neçə saniyəyə gəlməlidir.' : 'Abunə tapılmadı. Söndürüb yenidən aç.'
  } catch (e) { err.value = e instanceof Error ? e.message : String(e) } finally { busy.value = false }
}
</script>

<template>
  <section v-if="state && state !== 'unsupported' && repo.mode !== 'demo'" class="card p-4 flex flex-col gap-3" aria-labelledby="notif-h">
    <div class="flex items-center gap-2.5">
      <span class="w-9 h-9 rounded-full flex items-center justify-center shrink-0" :class="state === 'on' ? 'bg-primary text-white' : 'bg-soft text-primary-strong'">
        <Bell v-if="state !== 'denied'" :size="19" /><BellOff v-else :size="19" />
      </span>
      <span class="flex flex-col">
        <span id="notif-h" class="text-base font-semibold">Bildirişlər</span>
        <span class="text-[13px] text-muted">
          {{ state === 'on' ? 'Açıqdır · yemək, su, hərəkət, 21:30' : 'Yemək saatları, su, hərəkət və Günü bağla' }}
        </span>
      </span>
    </div>

    <p v-if="state === 'needs-install'" class="m-0 text-[15px] leading-snug text-ink-2">
      iPhone-da bildiriş yalnız ana ekrandan açılan tətbiqdə işləyir. Safari-də <b>Paylaş</b> → <b>Ana ekrana əlavə et</b>, sonra tətbiqi ikondan aç.
    </p>
    <p v-else-if="state === 'denied'" class="m-0 text-[15px] leading-snug text-ink-2">
      İcazə bağlıdır. iPhone <b>Ayarlar</b> → <b>Bildirişlər</b> → <b>Fitness</b> → <b>Bildirişlərə icazə ver</b>, sonra bura qayıt.
    </p>
    <p v-else-if="state === 'not-configured'" class="m-0 text-[15px] leading-snug text-ink-2">
      Server tərəfi hələ qurulmayıb (VAPID açarı yoxdur).
    </p>

    <div v-if="state === 'off'" class="flex">
      <button type="button" :disabled="busy" class="h-12 px-5 rounded-[14px] border-0 bg-primary text-white text-base font-bold disabled:opacity-60" @click="enable">
        {{ busy ? 'Açılır…' : 'Bildirişləri aç' }}
      </button>
    </div>
    <div v-else-if="state === 'on'" class="flex gap-2 flex-wrap">
      <button type="button" :disabled="busy" class="h-11 px-4 rounded-[14px] border border-line bg-surface text-ink text-[15px] font-semibold disabled:opacity-60" @click="test">Sınaq göndər</button>
      <button type="button" :disabled="busy" class="h-11 px-4 rounded-[14px] border-0 bg-transparent text-muted text-[15px] font-semibold disabled:opacity-60" @click="disable">Söndür</button>
    </div>

    <span v-if="msg" class="text-sm text-primary-strong font-semibold" role="status">{{ msg }}</span>
    <span v-if="err" class="text-sm text-danger font-semibold" role="alert">{{ err }}</span>
  </section>
</template>
