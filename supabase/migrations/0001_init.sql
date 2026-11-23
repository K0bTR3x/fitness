-- Fitness Dashboard · ilk sxem (v1)
-- Supabase SQL Editor-da bir dəfə işə sal, sonra seed.sql-i.
-- Qaydalar: hər şəxsi sətir user_id = auth.uid() ilə qorunur (RLS).
-- Kataloq cədvəlləri (ərzaq, resept, menyu, hərəkət, məşq şablonu) girişli istifadəçiyə yalnız oxunur.

set check_function_bodies = off;

-- =========================================================
-- Kataloq
-- =========================================================
create table if not exists foods (
  id text primary key,
  name text not null,
  state text not null check (state in ('çiy', 'quru', 'hazır', 'bişmiş')),
  kcal_100g numeric(6,1) not null check (kcal_100g >= 0),
  protein_100g numeric(5,1) not null default 0,
  fat_100g numeric(5,1) not null default 0,
  carb_100g numeric(5,1) not null default 0,
  unit_name text,
  unit_grams numeric(6,1),
  is_fruit boolean not null default false,
  excluded boolean not null default false,
  note text
);

create table if not exists recipes (
  id text primary key,
  name text not null,
  slot text not null check (slot in ('seher', 'ara_1', 'nahar', 'ara_2', 'axsam')),
  is_portable boolean not null default false,
  prep_min int, cook_min int, servings int not null default 1,
  steps jsonb, notes text
);

create table if not exists recipe_items (
  id bigint generated always as identity primary key,
  recipe_id text not null references recipes(id) on delete cascade,
  food_id text not null references foods(id),
  grams numeric(6,1) not null check (grams > 0),
  sort int not null default 0
);
create index if not exists recipe_items_recipe on recipe_items(recipe_id);

create table if not exists meal_plans (
  id text primary key,
  name text not null,
  is_active boolean not null default false,
  imported_from text
);

create table if not exists meal_plan_items (
  id bigint generated always as identity primary key,
  meal_plan_id text not null references meal_plans(id) on delete cascade,
  weekday int not null check (weekday between 1 and 7),
  slot text not null check (slot in ('seher', 'ara_1', 'nahar', 'ara_2', 'axsam')),
  recipe_id text not null references recipes(id),
  portion numeric(4,2) not null default 1,
  unique (meal_plan_id, weekday, slot)
);

create table if not exists exercises (
  id text primary key,
  name text not null,
  category text not null check (category in ('guc', 'qarin', 'kardio', 'mobilizasiya', 'gezinti')),
  measure text not null check (measure in ('set_tekrar', 'saniye', 'deqiqe')),
  rest_seconds int not null default 60,
  demo_frames jsonb not null default '[]',
  tips_az jsonb not null default '[]',
  video_url text
);

create table if not exists workout_templates (
  id text primary key,
  code text not null,
  weekday int not null check (weekday between 1 and 7),
  name text not null,
  kind text not null check (kind in ('guc', 'yungul', 'istirahet'))
);

create table if not exists workout_template_items (
  id bigint generated always as identity primary key,
  template_id text not null references workout_templates(id) on delete cascade,
  exercise_id text not null references exercises(id),
  sets int, reps_min int, reps_max int,
  sec_min int, sec_max int,
  minutes int, minutes_max int,
  rest_seconds int,
  note text,
  sort int not null default 0
);

-- =========================================================
-- Şəxsi məlumat
-- =========================================================
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  sex text,
  birth_year int,
  height_cm numeric(5,1),
  start_weight_kg numeric(5,2) not null,
  start_date date not null,
  target_12w_kg numeric(5,2),
  est_body_fat_pct numeric(4,1),
  body_fat_is_estimate boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists goal_settings (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  effective_from date not null,
  kcal int not null check (kcal between 1200 and 5000),
  kcal_tolerance int not null default 100,
  protein_g int not null,
  fat_g int not null,
  carb_g int not null,
  water_ml int not null default 2500,
  water_training_bonus_ml int not null default 500,
  steps int,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, effective_from)
);

create table if not exists weight_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null check (weight_kg between 40 and 250),
  fasted boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists body_measurements (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  waist_cm numeric(5,1) check (waist_cm between 50 and 200),
  chest_cm numeric(5,1), arm_cm numeric(5,1), hip_cm numeric(5,1), thigh_cm numeric(5,1),
  note text,
  unique (user_id, date)
);

create table if not exists daily_checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 16),
  sleep_source text check (sleep_source in ('shortcut', 'manual')),
  sleep_confirmed boolean not null default false,
  hunger int check (hunger between 1 and 5),
  energy int check (energy between 1 and 5),
  note text,
  unique (user_id, date)
);

create table if not exists water_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  ml int not null check (ml between -3000 and 3000 and ml <> 0),
  logged_at timestamptz not null default now()
);
create index if not exists water_logs_user_date on water_logs(user_id, date);

-- Qida qeydi kalorini özündə saxlayır: ərzaq kataloqu sonra dəyişsə də, tarixçə dəyişmir.
create table if not exists food_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('seher', 'ara_1', 'nahar', 'ara_2', 'axsam', 'elave')),
  recipe_id text references recipes(id),
  food_id text references foods(id),
  portion numeric(4,2),
  grams numeric(6,1),
  name text not null,
  kcal numeric(6,1) not null check (kcal >= 0),
  protein_g numeric(5,1) not null default 0,
  fat_g numeric(5,1) not null default 0,
  carb_g numeric(5,1) not null default 0,
  source text not null default 'plan' check (source in ('plan', 'diger', 'kenarda', 'elave', 'mukafat')),
  kcal_is_estimate boolean not null default false,
  is_reward_meal boolean not null default false,
  logged_at timestamptz not null default now()
);
create index if not exists food_logs_user_date on food_logs(user_id, date);
-- Plan slotunda gündə bir qeyd (əlavələr limitsizdir)
create unique index if not exists food_logs_one_per_slot on food_logs(user_id, date, slot) where slot <> 'elave';

create table if not exists day_closures (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  closed_at timestamptz not null default now(),
  kcal_total numeric(6,1) not null,
  protein_total numeric(5,1) not null,
  adherent boolean not null,
  is_reward_day boolean not null default false,
  primary key (user_id, date)
);

create table if not exists workout_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  template_id text references workout_templates(id),
  status text not null default 'tamamlandi' check (status in ('planlanib', 'tamamlandi', 'qismen', 'buraxildi')),
  started_at timestamptz,
  finished_at timestamptz,
  rpe int check (rpe between 1 and 10),
  note text,
  unique (user_id, date)
);

create table if not exists workout_sets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id bigint not null references workout_sessions(id) on delete cascade,
  exercise_id text not null references exercises(id),
  set_no int not null,
  reps int,
  weight_kg numeric(5,1),
  seconds int,
  minutes numeric(5,1),
  incline_pct numeric(3,1),
  speed_kmh numeric(3,1),
  done_at timestamptz not null default now()
);
create index if not exists workout_sets_user_ex on workout_sets(user_id, exercise_id, done_at desc);

create table if not exists checkpoints (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sort int not null,
  label text not null,
  target_kg numeric(5,2) not null,
  reward_text text not null default '1 sərbəst yemək',
  status text not null default 'gozleyir' check (status in ('gozleyir', 'hedefe_catildi', 'mukafat_istifade_edildi')),
  reached_week date,
  reached_avg_kg numeric(5,2),
  reward_used_at date,
  reward_note text,
  unique (user_id, sort)
);

-- =========================================================
-- RLS
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['foods','recipes','recipe_items','meal_plans','meal_plan_items','exercises','workout_templates','workout_template_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists catalog_read on %I', t);
    execute format('create policy catalog_read on %I for select to authenticated using (true)', t);
  end loop;
  foreach t in array array['goal_settings','weight_entries','body_measurements','daily_checkins','water_logs','food_logs','day_closures','workout_sessions','workout_sets','checkpoints','profiles'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format('create policy own_rows on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Checkpoint statusu yalnız irəli gedir və bazada qorunur.
create or replace function checkpoint_forward_only() returns trigger language plpgsql as $$
declare rank_old int; rank_new int;
begin
  rank_old := array_position(array['gozleyir','hedefe_catildi','mukafat_istifade_edildi'], old.status);
  rank_new := array_position(array['gozleyir','hedefe_catildi','mukafat_istifade_edildi'], new.status);
  if rank_new < rank_old then
    raise exception 'Checkpoint statusu geri qayıda bilməz';
  end if;
  if new.target_kg <> old.target_kg and old.status <> 'gozleyir' then
    raise exception 'Açılmış checkpoint-in hədəfi dəyişmir';
  end if;
  return new;
end $$;
drop trigger if exists checkpoint_forward_only on checkpoints;
create trigger checkpoint_forward_only before update on checkpoints for each row execute function checkpoint_forward_only();

-- =========================================================
-- Həftəlik ortalama (həftə = B.e.–Baz., Asia/Baku)
-- =========================================================
create or replace view weekly_weight_avg with (security_invoker = true) as
select user_id,
       date_trunc('week', date)::date as week_start,
       round(avg(weight_kg), 1) as avg_kg,
       count(*)::int as entries
from weight_entries
group by user_id, date_trunc('week', date);

-- =========================================================
-- İlk girişdə profil, hədəf və checkpoint-ləri yaradır (bir dəfə).
-- =========================================================
create or replace function init_user(p_start_date date default '2026-11-23', p_start_weight numeric default 101)
returns void language plpgsql security invoker as $$
begin
  if auth.uid() is null then raise exception 'Giriş lazımdır'; end if;
  if exists (select 1 from profiles where user_id = auth.uid()) then return; end if;

  insert into profiles (user_id, sex, birth_year, height_cm, start_weight_kg, start_date, target_12w_kg, est_body_fat_pct)
  values (auth.uid(), 'kisi', 2000, 181, p_start_weight, p_start_date, 93, 30);

  insert into goal_settings (user_id, effective_from, kcal, kcal_tolerance, protein_g, fat_g, carb_g, water_ml, water_training_bonus_ml, steps, reason)
  values (auth.uid(), p_start_date, 2300, 100, 170, 70, 247, 2500, 500, 8000, 'Başlanğıc hədəfi');

  insert into checkpoints (user_id, sort, label, target_kg) values
    (auth.uid(), 1, 'Checkpoint 1', 97), (auth.uid(), 2, 'Checkpoint 2', 94),
    (auth.uid(), 3, 'Checkpoint 3', 91), (auth.uid(), 4, 'Checkpoint 4', 88),
    (auth.uid(), 5, 'Checkpoint 5', 85), (auth.uid(), 6, 'Final', 82);
end $$;

-- =========================================================
-- Həftəni bağlamaq: 7/7 çəki qeydi varsa, ortalama ≤ hədəf olan checkpoint-lər açılır.
-- Çəki yazılanda və ya düzəldiləndə trigger keçmiş həftəni yenidən yoxlayır.
-- =========================================================
create or replace function evaluate_week(p_user uuid, p_week_start date)
returns int language plpgsql security definer set search_path = public as $$
declare v_avg numeric; v_cnt int; v_opened int := 0;
begin
  -- yalnız bitmiş həftə
  if p_week_start + 7 > (now() at time zone 'Asia/Baku')::date then return 0; end if;
  select round(avg(weight_kg), 1), count(*) into v_avg, v_cnt
  from weight_entries where user_id = p_user and date >= p_week_start and date < p_week_start + 7;
  if v_cnt < 7 then return 0; end if;
  update checkpoints set status = 'hedefe_catildi', reached_week = p_week_start, reached_avg_kg = v_avg
  where user_id = p_user and status = 'gozleyir' and target_kg >= v_avg;
  get diagnostics v_opened = row_count;
  return v_opened;
end $$;
revoke all on function evaluate_week(uuid, date) from public, anon, authenticated;

create or replace function weight_entry_evaluate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform evaluate_week(new.user_id, date_trunc('week', new.date)::date);
  return new;
end $$;
drop trigger if exists weight_entry_evaluate on weight_entries;
create trigger weight_entry_evaluate after insert or update on weight_entries for each row execute function weight_entry_evaluate();

-- İstifadəçi öz keçən həftəsini yoxlatdıra bilər (Bu gün açılanda çağırılır; pg_cron sonra əlavə olunur).
create or replace function evaluate_last_week() returns int language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Giriş lazımdır'; end if;
  return evaluate_week(auth.uid(), (date_trunc('week', (now() at time zone 'Asia/Baku')::date) - interval '7 days')::date);
end $$;
grant execute on function evaluate_last_week() to authenticated;
grant execute on function init_user(date, numeric) to authenticated;

-- Mükafatın istifadəsi: bir checkpoint üçün yalnız bir dəfə.
create or replace function use_reward(p_checkpoint_id bigint, p_note text, p_date date default null)
returns void language plpgsql security invoker as $$
begin
  update checkpoints set status = 'mukafat_istifade_edildi', reward_used_at = coalesce(p_date, (now() at time zone 'Asia/Baku')::date), reward_note = p_note
  where id = p_checkpoint_id and user_id = auth.uid() and status = 'hedefe_catildi';
  if not found then raise exception 'Bu mükafat hələ açılmayıb və ya artıq istifadə olunub'; end if;
end $$;
grant execute on function use_reward(bigint, text, date) to authenticated;
