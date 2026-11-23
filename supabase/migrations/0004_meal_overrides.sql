-- Yeməyi dəyiş: konkret gün üçün (date) və ya hər həftə həmin gün üçün (weekday).
create table if not exists meal_overrides (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date,
  weekday int check (weekday between 1 and 7),
  slot text not null check (slot in ('seher', 'ara_1', 'nahar', 'ara_2', 'axsam')),
  recipe_id text not null references recipes(id),
  created_at timestamptz not null default now(),
  check ((date is null) <> (weekday is null))
);
create unique index if not exists meal_overrides_date on meal_overrides(user_id, date, slot) where date is not null;
create unique index if not exists meal_overrides_weekday on meal_overrides(user_id, weekday, slot) where weekday is not null;
alter table meal_overrides enable row level security;
drop policy if exists own_rows on meal_overrides;
create policy own_rows on meal_overrides for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on meal_overrides to authenticated;
grant all on meal_overrides to service_role;
