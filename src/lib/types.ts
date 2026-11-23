export type Slot = 'seher' | 'ara_1' | 'nahar' | 'ara_2' | 'axsam'
export type LogSlot = Slot | 'elave'
export const SLOTS: { slot: Slot; time: string; label: string }[] = [
  { slot: 'seher', time: '07:30', label: 'Səhər yeməyi' },
  { slot: 'ara_1', time: '10:30', label: 'Meyvə' },
  { slot: 'nahar', time: '13:00', label: 'Nahar' },
  { slot: 'ara_2', time: '16:30', label: 'Meyvə' },
  { slot: 'axsam', time: '20:15', label: 'Axşam yeməyi' },
]

export interface Food {
  id: string; name: string; state: 'çiy' | 'quru' | 'hazır' | 'bişmiş'
  kcal_100g: number; protein_100g: number; fat_100g: number; carb_100g: number
  unit_name: string | null; unit_grams: number | null; is_fruit: boolean; note?: string | null
}
export interface RecipeItem { food_id: string; grams: number }
export interface Recipe { id: string; name: string; slot: Slot; is_portable: boolean; items: RecipeItem[] }
export interface PlanItem { weekday: number; slot: Slot; recipe_id: string }
export interface Exercise {
  id: string; name: string; category: 'guc' | 'qarin' | 'kardio' | 'mobilizasiya' | 'gezinti'
  measure: 'set_tekrar' | 'saniye' | 'deqiqe'; rest_seconds: number; demo_frames: string[]; tips_az: string[]
}
export interface TemplateItem {
  exercise_id: string; sets: number | null; reps_min: number | null; reps_max: number | null
  sec_min: number | null; sec_max: number | null; minutes: number | null; minutes_max: number | null
  note: string | null; sort: number
}
export interface WorkoutTemplate { id: string; code: string; weekday: number; name: string; kind: 'guc' | 'yungul' | 'istirahet'; items: TemplateItem[] }

export interface Catalog {
  foods: Food[]; recipes: Recipe[]; meal_plan: PlanItem[]; exercises: Exercise[]; workout_templates: WorkoutTemplate[]
}

export interface Profile { start_date: string; start_weight_kg: number; target_12w_kg: number; height_cm: number; est_body_fat_pct: number | null }
export interface Goals { kcal: number; kcal_tolerance: number; protein_g: number; fat_g: number; carb_g: number; water_ml: number; water_training_bonus_ml: number; steps: number | null }
export interface Checkpoint { id: number | string; sort: number; label: string; target_kg: number; reward_text: string; status: 'gozleyir' | 'hedefe_catildi' | 'mukafat_istifade_edildi'; reached_week: string | null; reached_avg_kg: number | null; reward_used_at?: string | null; reward_note?: string | null }

export interface Macros { kcal: number; protein: number; fat: number; carb: number }
export interface FoodLog extends Macros {
  id?: number | string; date: string; slot: LogSlot; recipe_id: string | null; food_id: string | null
  portion: number | null; grams: number | null; name: string
  source: 'plan' | 'diger' | 'kenarda' | 'elave' | 'mukafat'; kcal_is_estimate: boolean
}
export interface WeightEntry { date: string; weight_kg: number }
export interface WaterLog { id: number | string; date: string; ml: number; logged_at: string }
export interface DayClosure { date: string; kcal_total: number; protein_total: number; adherent: boolean }
export interface SetLog { exercise_id: string; set_no: number; reps: number | null; weight_kg: number | null; seconds: number | null; minutes: number | null; incline_pct: number | null; speed_kmh: number | null }
export interface WorkoutSession { date: string; template_id: string; status: 'tamamlandi' | 'qismen' | 'buraxildi'; sets: SetLog[] }
