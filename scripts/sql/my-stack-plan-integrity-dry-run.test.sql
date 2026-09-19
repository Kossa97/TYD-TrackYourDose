\set ON_ERROR_STOP on
-- Disposable PostgreSQL 16 only. Synthetic data; real checked-in schema/guards.
create extension if not exists pgcrypto;
create schema auth;
create table auth.users (id uuid primary key);
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
-- Supabase storage API stand-ins, unused by the tested migrations.
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (bucket_id text, name text);
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
\ir ../../supabase-schema.sql
\ir ../../supabase-schema-update.sql
\ir ../../supabase-cycles-update.sql
\ir ../../supabase-intake-reminder.sql
\ir ../../supabase-intake-rhythm.sql
\ir ../../supabase-cycle-schedule-history.sql
\ir ../../supabase-inventory.sql
\ir ../../supabase-escalation.sql
\ir ../../supabase-archive.sql
\ir ../../supabase-injection.sql
\ir ../../supabase-injection-pro.sql
\ir ../../supabase-pk-profiles.sql
\ir ../../supabase-peptide-library.sql
\ir ../../supabase-rls-hardening.sql
-- Current legacy columns/index referenced by the foundation schema.
alter table peptides add column pk_profile_id uuid references pk_profiles(id) on delete set null;
create index peptides_pk_profile_idx on peptides(pk_profile_id);
alter table cycles add column schedule_days text[] default '{}';
\ir ../../supabase-my-stack-foundation.sql
\ir ../../supabase-my-stack-tracking-depth.sql
grant select, insert, update, delete on stack_items, cycles, dose_logs to authenticated;

begin;
insert into auth.users values ('14000000-0000-0000-0000-000000000001'), ('14000000-0000-0000-0000-000000000002');
insert into stack_items(id, user_id, display_name, dosage_form, default_method)
select ('14000000-0000-0000-0001-' || lpad(n::text,12,'0'))::uuid,
  '14000000-0000-0000-0000-000000000001', 'Synthetic item ' || n, 'tablet', 'Oral'
from generate_series(1,4) n;
insert into stack_item_ingredients(stack_item_id, custom_name, amount_value, amount_unit, basis_value, basis_unit, position)
select id, 'Synthetic ingredient', 1, 'mg', 1, 'tablet', 0 from stack_items;
insert into cycles(id,user_id,stack_item_id,name,dose,unit,method,frequency,start_date,end_date,active,intake_time,intake_time_custom)
values
('14000000-0000-0000-0002-000000000001','14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000001','Conflict A',1,'mg','Oral','Täglich','2026-01-01',null,true,'morgens','08:00'),
('14000000-0000-0000-0002-000000000002','14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000001','Conflict B',2,'mg','Oral','Täglich','2026-02-01',null,true,'morgens','08:00'),
('14000000-0000-0000-0002-000000000003','14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000002','Historical',20,'mg','Oral','Täglich','2026-01-01','2026-02-28',false,'morgens','08:00'),
('14000000-0000-0000-0002-000000000004','14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000002','Restarted',30,'mg','Oral','Täglich','2026-03-01',null,true,'morgens','08:00'),
('14000000-0000-0000-0002-000000000005','14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000003','PRN',5,'mg','Oral','Bei Bedarf','2026-01-01',null,true,'morgens','08:00'),
('14000000-0000-0000-0002-000000000006','14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000004','Pause spanning',2,'mg','Oral','Täglich','2026-01-01',null,true,'morgens','08:00');
update cycles set schedule_history = '[{"effective_from":"2026-01-01","frequency":"Täglich","intake_time":"morgens","intake_time_custom":"08:00","dose":10,"unit":"mg","schedule_days":[]},{"effective_from":"2026-02-01","frequency":"Täglich","intake_time":"morgens","intake_time_custom":"08:00","dose":20,"unit":"mg","schedule_days":[]}]'
where id = '14000000-0000-0000-0002-000000000003';
insert into dose_escalations(user_id,cycle_id,increase_amount,unit,start_type,start_date,start_after_days)
values
('14000000-0000-0000-0000-000000000001','14000000-0000-0000-0002-000000000003',1,'mg','date','2026-01-08',null),
('14000000-0000-0000-0000-000000000001','14000000-0000-0000-0002-000000000003',2,'mg','after_days',null,14),
('14000000-0000-0000-0000-000000000001','14000000-0000-0000-0002-000000000003',3,'mg','after_weeks',null,21);
insert into dose_logs(user_id,stack_item_id,dose,unit,method,logged_at,taken,notes,routine_slot_key)
values
('14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000002',11,'mg','Oral','2026-01-09 08:00Z',true,'Confirmed synthetic snapshot','synthetic-confirmed'),
('14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000002',13,'mg','Oral','2026-01-16 08:00Z',false,'Skipped synthetic snapshot','synthetic-skipped'),
('14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000003',5,'mg','Oral','2026-01-20 16:00Z',true,'PRN synthetic snapshot',null);
commit;

-- Partial additive-install scenario: preserve an already-recorded pause on rerun.
create table cycle_pause_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references cycles(id) on delete cascade,
  paused_at timestamptz not null, ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > paused_at)
);
insert into cycle_pause_periods(user_id,cycle_id,paused_at,ends_at)
values ('14000000-0000-0000-0000-000000000001','14000000-0000-0000-0002-000000000006','2026-01-10 12:00Z','2026-01-13 12:00Z');

create function test_review_rejected() returns void language plpgsql as $$
begin
  begin
    update stack_items set configuration_status = 'needs_review'
    where id = '14000000-0000-0000-0001-000000000004';
    raise exception 'arbitrary review downgrade accepted';
  exception when others then
    if sqlerrm <> 'Complete stack items cannot return to needs_review' then raise; end if;
  end;
  begin
    insert into stack_items(user_id,display_name,configuration_status)
    values ('14000000-0000-0000-0000-000000000001','Rejected synthetic insert','needs_review');
    raise exception 'review insert accepted';
  exception when others then
    if sqlerrm <> 'New stack items cannot start as needs_review' then raise; end if;
  end;
end $$;
select test_review_rejected();
create temp table original_logs as select id, to_jsonb(l)::text as snapshot from dose_logs l;
create temp table original_pauses as select to_jsonb(p)::text as snapshot from cycle_pause_periods p;
\echo BEFORE: stack_items cycles versions pauses escalations logs
select (select count(*) from stack_items), (select count(*) from cycles), 0 as versions_absent,
 (select count(*) from cycle_pause_periods), (select count(*) from dose_escalations), (select count(*) from dose_logs);
\ir ../../supabase-my-stack-plan-integrity.sql

create function test_counts() returns jsonb language sql as $$
select jsonb_build_object('stack_items',(select count(*) from stack_items),'cycles',(select count(*) from cycles),
 'cycle_plan_versions',(select count(*) from cycle_plan_versions),'cycle_pause_periods',(select count(*) from cycle_pause_periods),
 'dose_escalations',(select count(*) from dose_escalations),'dose_logs',(select count(*) from dose_logs),
 'receipts',(select count(*) from plan_mutation_receipts),'conflicts',(select count(*) from cycle_migration_conflicts))
$$;
\echo AFTER FIRST RUN
select test_counts();
create temp table first_counts as select test_counts() as counts;
create temp table first_versions as select to_jsonb(v)::text as snapshot from cycle_plan_versions v;
\ir ../../supabase-my-stack-plan-integrity.sql
\echo AFTER SECOND RUN
select test_counts();
do $$ begin
  if test_counts() <> (select counts from first_counts) then raise exception 'second-run counts differ'; end if;
  if exists ((select snapshot from first_versions) except (select to_jsonb(v)::text from cycle_plan_versions v)) then raise exception 'versions changed on rerun'; end if;
  if exists ((select snapshot from original_pauses) except (select to_jsonb(p)::text from cycle_pause_periods p)) then raise exception 'pauses changed'; end if;
  if exists (select from dose_logs l join original_logs o using(id) where (to_jsonb(l) - 'cycle_id' - 'plan_version_id')::text <> o.snapshot)
    or (select count(*) from dose_logs) <> (select count(*) from original_logs) then raise exception 'legacy log bytes changed'; end if;
  if exists (select from dose_logs where cycle_id is not null or plan_version_id is not null) then raise exception 'legacy provenance invented'; end if;
  if (select count(*) from cycle_migration_conflicts) <> 1 or not exists (
    select from cycle_migration_conflicts where stack_item_id = '14000000-0000-0000-0001-000000000001'
      and cycle_ids = array['14000000-0000-0000-0002-000000000001'::uuid,'14000000-0000-0000-0002-000000000002'::uuid]
      and resolved_at is null
  ) then raise exception 'conflicts not surfaced exactly'; end if;
  if exists (select from cycles c where not exists (select from cycle_plan_versions v where v.cycle_id = c.id and v.change_kind='initial' and v.effective_local_date=c.start_date)) then raise exception 'missing initial version'; end if;
  if (select array_agg(dose order by effective_local_date) from cycle_plan_versions where cycle_id='14000000-0000-0000-0002-000000000003') <> array[10,11,13,16,26]::numeric[] then raise exception 'escalation/history parity mismatch'; end if;
end $$;
select test_review_rejected();
-- Wrong-owner and resolved rows must not grant the downgrade exception.
begin;
insert into cycle_migration_conflicts(user_id,stack_item_id,cycle_ids) values
('14000000-0000-0000-0000-000000000002','14000000-0000-0000-0001-000000000004','{}');
select test_review_rejected();
update cycle_migration_conflicts set user_id='14000000-0000-0000-0000-000000000001',resolved_at=now()
where stack_item_id='14000000-0000-0000-0001-000000000004';
select test_review_rejected();
rollback;

select set_config('request.jwt.claim.sub','14000000-0000-0000-0000-000000000001',false);
set role authenticated;
select resolve_cycle_migration_conflict('14000000-0000-0000-0001-000000000001','14000000-0000-0000-0002-000000000002','task14-resolve');
reset role;
\ir ../../supabase-my-stack-plan-integrity-enforce.sql
\ir ../../supabase-my-stack-plan-integrity-enforce.sql
do $$ begin
  begin
    insert into cycles(user_id,stack_item_id,name,dose,unit,method,frequency,start_date,started_at)
    values ('14000000-0000-0000-0000-000000000001','14000000-0000-0000-0001-000000000001','Rejected second open',1,'mg','Oral','Täglich','2026-04-01','2026-04-01Z');
    raise exception 'second open cycle accepted';
  exception when unique_violation then
    if sqlerrm not like '%cycles_one_open_per_stack_item%' then raise; end if;
  end;
  if (select count(*) from cycle_migration_conflicts where resolved_at is null) <> 0 then raise exception 'unresolved conflict remains'; end if;
end $$;
select test_review_rejected();
\echo FINAL ENFORCED COUNTS
select test_counts();
select 'PASS: idempotency, exact conflicts, initial versions, logs, pauses, escalation parity, review guards, enforcement' as result;
