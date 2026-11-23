/** az-AZ rəqəm formatı: 101,0 */
export function fmt(n: number, digits = 1): string {
  return n.toFixed(digits).replace('.', ',')
}
/** 1,25 → "1,25"; 2,5 → "2,5"; 3 → "3,0" (litr üçün) */
export function fmtL(ml: number): string {
  const s = (ml / 1000).toFixed(2).replace(/0$/, '')
  return s.replace('.', ',')
}
export function parseNum(text: string): number | null {
  const v = parseFloat(String(text).trim().replace(',', '.'))
  return Number.isFinite(v) ? v : null
}
export function signed(n: number, digits = 1): string {
  if (Math.abs(n) < 0.05) return '0,0'
  return (n > 0 ? '+' : '−') + fmt(Math.abs(n), digits)
}
/** Sıra şəkilçisi: 1-ci, 3-cü, 6-cı, 9-cu, 40-cı */
export function ordinal(n: number): string {
  const last = n % 10, tens = Math.floor(n / 10) % 10
  const d = last || tens * 10
  const map: Record<number, string> = { 1: 'ci', 2: 'ci', 3: 'cü', 4: 'cü', 5: 'ci', 6: 'cı', 7: 'ci', 8: 'ci', 9: 'cu', 10: 'cu', 20: 'ci', 30: 'cu', 40: 'cı', 50: 'ci', 60: 'cı', 70: 'ci', 80: 'ci', 90: 'cı' }
  return `${n}-${map[d] ?? 'cü'}`
}
