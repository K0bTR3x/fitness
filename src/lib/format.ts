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
