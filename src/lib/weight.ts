import type { Checkpoint, WeightEntry } from './types'
import { weekStart } from './dates'

export function round1(n: number) { return Math.round(n * 10) / 10 }

export function weekAverage(entries: WeightEntry[], anyDayOfWeek: string): { avg: number | null; count: number } {
  const ws = weekStart(anyDayOfWeek)
  const xs = entries.filter((e) => weekStart(e.date) === ws)
  if (!xs.length) return { avg: null, count: 0 }
  return { avg: round1(xs.reduce((s, e) => s + e.weight_kg, 0) / xs.length), count: xs.length }
}
export function nextCheckpoint(cps: Checkpoint[]): Checkpoint | null {
  return [...cps].sort((a, b) => a.sort - b.sort).find((c) => c.status === 'gozleyir') ?? null
}
/** Başlanğıcdan checkpoint-ə qədər irəliləyiş, 0–100 */
export function progressTo(start: number, current: number, target: number): number {
  if (start <= target) return 100
  return Math.max(0, Math.min(100, Math.round(((start - current) / (start - target)) * 100)))
}
