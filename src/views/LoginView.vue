<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Dumbbell, Info } from 'lucide-vue-next'
import { repo } from '../repo'
import { useApp } from '../stores/app'

const app = useApp()
const router = useRouter()
const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const err = ref('')
const busy = ref(false)
const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const emailOk = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim()))

function startCooldown() {
  cooldown.value = 60
  clearInterval(timer)
  timer = setInterval(() => { cooldown.value--; if (cooldown.value <= 0) clearInterval(timer) }, 1000)
}
onUnmounted(() => clearInterval(timer))

async function send() {
  err.value = ''
  if (!emailOk.value) { err.value = 'E-poçt ünvanını düzgün yaz (məs. ad@gmail.com).'; return }
  busy.value = true
  try {
    await repo.sendCode(email.value.trim())
    step.value = 'code'; code.value = ''
    startCooldown()
  } catch (e: any) {
    err.value = /rate|seconds/i.test(e.message) ? 'Bir az gözlə, sonra yenidən kod istə.' : 'Kod göndərilmədi: ' + e.message
  } finally { busy.value = false }
}
async function verify() {
  err.value = ''
  if (!/^\d{6}$/.test(code.value)) { err.value = '6 rəqəmli kodu yaz.'; return }
  busy.value = true
  try {
    await repo.verifyCode(email.value.trim(), code.value)
    await app.checkSession()
    router.replace('/')
  } catch {
    err.value = 'Kod səhvdir. Yenidən yoxla və ya yeni kod istə.'
  } finally { busy.value = false }
}
function onCode(e: Event) {
  code.value = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)
  err.value = ''
  if (code.value.length === 6) verify()
}
</script>

<template>
  <main class="min-h-dvh flex flex-col px-6 pb-8 gap-5" style="padding-top: max(96px, calc(env(safe-area-inset-top) + 64px))">
    <div class="w-[72px] h-[72px] rounded-[20px] bg-primary text-white flex items-center justify-center shadow-[0_10px_26px_rgba(22,163,74,0.35)]">
      <Dumbbell :size="36" />
    </div>

    <form v-if="step === 'email'" class="flex flex-col gap-4" @submit.prevent="send">
      <h1 class="m-0 text-[30px] font-extrabold tracking-tight">Daxil ol</h1>
      <p class="m-0 text-base leading-normal text-ink-2">{{ repo.mode === 'demo' ? 'Demo: istənilən e-poçtu yaz, kod göndərilməyəcək.' : 'Şifrə lazım deyil. E-poçtuna 6 rəqəmli kod göndərəcəyik.' }}</p>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold">E-poçt</span>
        <input v-model="email" type="email" inputmode="email" autocomplete="email" placeholder="ad@nümunə.az"
          class="h-14 rounded-[14px] px-3.5 text-[17px] bg-surface text-ink outline-none focus:border-primary"
          :class="err ? 'border-2 border-danger' : 'border border-line'" @input="err = ''" />
      </label>
      <span v-if="err" class="text-sm text-danger font-semibold" role="alert">{{ err }}</span>
      <button type="submit" :disabled="busy" class="h-[60px] rounded-2xl border-0 bg-primary text-white text-[17px] font-bold disabled:opacity-60">
        {{ busy ? 'Göndərilir…' : 'Kod göndər' }}
      </button>
    </form>

    <form v-else class="flex flex-col gap-4" @submit.prevent="verify">
      <h1 class="m-0 text-[30px] font-extrabold tracking-tight">Kodu yaz</h1>
      <p v-if="repo.mode === 'demo'" class="m-0 p-3 rounded-[14px] bg-soft text-base leading-normal text-ink font-semibold">Bu demo versiyadır, e-poçt göndərilmir. İstənilən 6 rəqəm yaz, məsələn 123456.</p>
      <p v-else class="m-0 text-base leading-normal text-ink-2">Kodu <b>{{ email }}</b> ünvanına göndərdik. Görmürsənsə, "Spam" qovluğuna bax.</p>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold">6 rəqəmli kod</span>
        <input :value="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"
          class="num h-16 rounded-[14px] px-3.5 text-[28px] tracking-[0.4em] text-center font-bold bg-surface text-ink outline-none"
          :class="err ? 'border-2 border-danger' : 'border border-line'" @input="onCode" />
      </label>
      <span v-if="err" class="text-sm text-danger font-semibold" role="alert">{{ err }}</span>
      <span class="text-[13px] text-muted">iPhone kodu klaviaturanın üstündə özü təklif edir.</span>
      <button type="submit" :disabled="busy" class="h-[60px] rounded-2xl border-0 bg-primary text-white text-[17px] font-bold disabled:opacity-60">
        {{ busy ? 'Yoxlanılır…' : 'Daxil ol' }}
      </button>
      <div class="flex justify-between items-center">
        <button type="button" class="h-11 p-0 border-0 bg-transparent text-muted text-[15px] font-semibold" @click="step = 'email'; err = ''">← E-poçtu dəyiş</button>
        <button type="button" :disabled="cooldown > 0 || busy" class="num h-11 p-0 border-0 bg-transparent text-primary-strong text-[15px] font-semibold disabled:text-muted" @click="send">
          {{ cooldown > 0 ? `Yeni kod · ${cooldown} san` : 'Yeni kod göndər' }}
        </button>
      </div>
    </form>

    <div class="flex-1" />
    <div class="flex gap-2.5 items-start px-3.5 py-3 rounded-[14px] bg-panel border border-line text-[13px] leading-snug text-ink-2">
      <Info :size="18" class="shrink-0 mt-px text-muted" />
      <span>Kod üsulu ana ekrandakı tətbiqdə də işləyir. E-poçt linki iPhone-da Safari-ni açardı, tətbiqi yox.</span>
    </div>
  </main>
</template>
