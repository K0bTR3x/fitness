import { ref } from 'vue'
const KEY = 'fd-theme'
function read(): 'light' | 'dark' | null { try { return localStorage.getItem(KEY) as any } catch { return null } }
const sys = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
export const isDark = ref(read() ? read() === 'dark' : sys())
export function applyTheme() {
  document.documentElement.classList.toggle('dark', isDark.value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark.value ? '#0B0F14' : '#F3F4F6')
}
export function toggleTheme() {
  isDark.value = !isDark.value
  try { localStorage.setItem(KEY, isDark.value ? 'dark' : 'light') } catch {}
  applyTheme()
}
