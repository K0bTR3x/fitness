import type { Catalog, Checkpoint, DayClosure, FoodLog, Goals, LogSlot, Profile, SetLog, WaterLog, WeightEntry, WorkoutSession } from '../lib/types'

export interface Repo {
  readonly mode: 'supabase' | 'demo'
  // giriş
  currentEmail(): Promise<string | null>
  sendCode(email: string): Promise<void>
  verifyCode(email: string, code: string): Promise<void>
  signOut(): Promise<void>
  // ilk açılış: profil, hədəf və checkpoint-lər (bir dəfə)
  ensureUser(): Promise<void>
  loadCatalog(): Promise<Catalog>
  getProfile(): Promise<Profile>
  getGoals(date: string): Promise<Goals>
  getCheckpoints(): Promise<Checkpoint[]>
  useReward(checkpointId: Checkpoint['id'], note: string, date: string): Promise<void>
  // çəki, bel, yuxu
  getWeights(from: string, to: string): Promise<WeightEntry[]>
  upsertWeight(date: string, kg: number): Promise<void>
  getWaist(upTo: string): Promise<{ date: string; waist_cm: number }[]>
  upsertWaist(date: string, cm: number): Promise<void>
  getSleep(date: string): Promise<{ hours: number | null; confirmed: boolean }>
  upsertSleep(date: string, hours: number | null, confirmed: boolean): Promise<void>
  // su
  getWater(date: string): Promise<WaterLog[]>
  getWaterRange(from: string, to: string): Promise<WaterLog[]>
  addWater(date: string, ml: number): Promise<WaterLog>
  deleteWater(id: WaterLog['id']): Promise<void>
  // qida
  getFoodLogs(from: string, to: string): Promise<FoodLog[]>
  setSlotLog(date: string, slot: Exclude<LogSlot, 'elave'>, log: FoodLog | null): Promise<void>
  addExtraLog(log: FoodLog): Promise<FoodLog>
  deleteLog(id: NonNullable<FoodLog['id']>): Promise<void>
  /** Günü bağla: həmin günün bütün qeydlərini əvəz edir və nəticəni yazır */
  closeDay(date: string, logs: FoodLog[], closure: DayClosure): Promise<void>
  reopenDay(date: string): Promise<void>
  getClosures(from: string, to: string): Promise<DayClosure[]>
  // məşq
  getWorkouts(from: string, to: string): Promise<{ date: string; template_id: string; status: string }[]>
  saveWorkout(s: WorkoutSession): Promise<void>
  lastSets(exerciseIds: string[]): Promise<Record<string, SetLog>>
  // ilk dəfə çağırılanda keçən həftə checkpoint-lərini yoxlayır
  evaluateLastWeek(): Promise<number>
  // bildirişlər
  savePushSubscription(sub: PushSubscriptionJSON): Promise<void>
  deletePushSubscription(endpoint: string): Promise<void>
  sendTestPush(): Promise<{ sent: number; subscriptions: number }>
}
