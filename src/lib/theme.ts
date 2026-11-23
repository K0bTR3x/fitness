import { ref } from 'vue'
export type ThemeMode = 'light' | 'dark' | 'auto'
const KEY = 'fd-theme'
function read(): ThemeMode {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto' } catch { return 'auto' }
}
const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
export const themeMode = ref<ThemeMode>(read())
export const isDark = ref(themeMode.value === 'auto' ? !!mq?.matches : themeMode.value === 'dark')
export function applyTheme() {
  document.documentElement.classList.toggle('dark', isDark.value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark.value ? '#0B0F14' : '#F3F4F6')
}
mq?.addEventListener?.('change', (e) => { if (themeMode.value === 'auto') { isDark.value = e.matches; applyTheme() } })
export function setThemeMode(m: ThemeMode) {
  themeMode.value = m
  isDark.value = m === 'auto' ? !!mq?.matches : m === 'dark'
  try { if (m === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, m) } catch {}
  applyTheme()
}
export function toggleTheme() { setThemeMode(isDark.value ? 'light' : 'dark') }
