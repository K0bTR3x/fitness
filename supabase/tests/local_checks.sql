create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

-- run: psql -f stub (this header), migrations/0001_init.sql, seed.sql, then the tests below
\set ON_ERROR_STOP 1
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select init_user(); select init_user();
select count(*) as cps from checkpoints;
-- 7 weights in the week of 2026-11-23, avg 96.9 -> CP1 opens
insert into weight_entries(date, weight_kg) select d::date, 96.9 from generate_series('2026-11-09'::date, '2026-11-15', '1 day') d;
select sort, status, reached_avg_kg from checkpoints order by sort limit 2;
-- 6 weights in next week at 93 -> nothing opens
insert into weight_entries(date, weight_kg) select d::date, 93 from generate_series('2026-11-16'::date, '2026-11-21', '1 day') d;
select sort, status from checkpoints where sort = 2;
select * from weekly_weight_avg order by week_start;
select use_reward((select id from checkpoints where sort=1), 'burger');
do $$ begin perform use_reward((select id from checkpoints where sort=1), 'pizza'); raise exception 'should fail'; exception when others then if sqlerrm = 'should fail' then raise; end if; raise notice 'double use blocked: %', sqlerrm; end $$;
do $$ begin update checkpoints set status='gozleyir' where sort=1; raise exception 'should fail'; exception when others then if sqlerrm = 'should fail' then raise; end if; raise notice 'backward blocked: %', sqlerrm; end $$;
insert into food_logs(date, slot, recipe_id, name, kcal) values ('2026-11-23','seher','yulaf_siyigi_kesmik_yumurta','x',700);
do $$ begin insert into food_logs(date, slot, name, kcal) values ('2026-11-23','seher','y',1); raise exception 'should fail'; exception when unique_violation then raise notice 'slot unique ok'; end $$;
insert into food_logs(date, slot, name, kcal) values ('2026-11-23','elave','alma',78),('2026-11-23','elave','alma',78);
select count(*) as foods_visible from foods;
-- other user sees nothing
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as other_sees_weights from weight_entries;
select count(*) as other_sees_cps from checkpoints;
do $$ begin insert into weight_entries(user_id, date, weight_kg) values ('11111111-1111-1111-1111-111111111111','2026-12-10',90); raise exception 'should fail'; exception when others then if sqlerrm = 'should fail' then raise; end if; raise notice 'cross-user insert blocked: %', sqlerrm; end $$;
-- fill the 7th day of week 2 -> should open CP2 (93 <= 94)
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into weight_entries(date, weight_kg) values ('2026-11-22', 93);
select sort, status, reached_week, reached_avg_kg from checkpoints order by sort limit 3;
insert into weight_entries(date, weight_kg) values ('2026-11-23', 101);
select sort, status from checkpoints where sort=3;
