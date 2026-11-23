// Bütün tarixlər Asia/Baku vaxtı ilə "YYYY-MM-DD" sətirləridir.
const TZ = 'Asia/Baku'

export const WD_SHORT = ['B.e.', 'Ç.a.', 'Çər.', 'C.a.', 'Cümə', 'Şən.', 'Baz.']
export const WD_FULL = ['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar']
export const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr']
export const MONTHS_CAP = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1))

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function nowHM(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
}
function toUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
export function addDays(iso: string, n: number): string {
  const d = toUTC(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86400000)
}
/** 1 = bazar ertəsi … 7 = bazar */
export function isoWeekday(iso: string): number {
  const d = toUTC(iso).getUTCDay()
  return d === 0 ? 7 : d
}
export function weekStart(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso))
}
export function weekDays(iso: string): string[] {
  const s = weekStart(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}
export function dayNum(iso: string): number {
  return Number(iso.slice(8, 10))
}
export function longDate(iso: string): string {
  return `${WD_FULL[isoWeekday(iso) - 1]}, ${dayNum(iso)} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
}
export function shortDate(iso: string): string {
  return `${dayNum(iso)} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`
}
export function monthTitle(iso: string): string {
  return `${MONTHS_CAP[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
}
/** Proqramın neçənci günü / həftəsi (1-dən başlayır) */
export function programDay(start: string, iso: string): number {
  return diffDays(iso, start) + 1
}
export function programWeek(start: string, iso: string): number {
  return Math.floor(diffDays(iso, start) / 7) + 1
}
