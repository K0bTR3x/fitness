-- New Supabase projects don't auto-grant table privileges to API roles.
-- RLS policies still decide which rows each user sees.
grant usage on schema public to anon, authenticated;
grant select on foods, recipes, recipe_items, meal_plans, meal_plan_items,
  exercises, workout_templates, workout_template_items to authenticated;
grant select, insert, update, delete on profiles, goal_settings, weight_entries,
  body_measurements, daily_checkins, water_logs, food_logs, day_closures,
  workout_sessions, workout_sets, checkpoints to authenticated;
grant select on weekly_weight_avg to authenticated;
grant usage, select on all sequences in schema public to authenticated;
