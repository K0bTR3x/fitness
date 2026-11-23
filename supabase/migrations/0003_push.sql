-- Bildirişlər: telefonun push abunəsi + göndəriş jurnalı (eyni xatırlatma gündə 1 dəfə).
create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists own_rows on push_subscriptions;
create policy own_rows on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on push_subscriptions to authenticated;

create table if not exists push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, day, key)
);
alter table push_log enable row level security;  -- yalnız server (service role) yazır
