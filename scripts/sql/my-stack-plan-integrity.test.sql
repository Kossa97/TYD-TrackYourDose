\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
create extension if not exists dblink;
create schema auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

create table auth.users (
  id uuid primary key
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.stack_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracking_level text not null default 'complete',
  configuration_status text not null default 'complete'
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_item_id uuid not null references public.stack_items(id) on delete cascade,
  name text not null default 'Test cycle',
  dose numeric(10,3),
  unit text,
  method text not null default 'Oral',
  frequency text not null default 'Täglich',
  x_days_interval integer,
  interval_unit text,
  cycle_on_days integer,
  cycle_off_days integer,
  schedule_days text[] not null default '{}',
  start_date date not null default current_date,
  end_date date,
  notes text,
  active boolean not null default true,
  intake_time text not null default 'morgens',
  intake_time_custom text,
  slot_doses text,
  slot_days text,
  reminder text not null default 'none',
  schedule_history jsonb,
  created_at timestamptz not null default now()
);

create table public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_item_id uuid not null references public.stack_items(id) on delete cascade,
  dose numeric,
  unit text,
  method text not null default '',
  logged_at timestamptz not null,
  taken boolean,
  routine_slot_key text
);

create unique index dose_logs_routine_slot_unique
  on public.dose_logs (user_id, routine_slot_key)
  where routine_slot_key is not null;

grant select, insert, update on public.dose_logs to authenticated;

create table public.dose_escalations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  increase_amount numeric(10,3) not null,
  unit text not null,
  start_type text not null,
  start_date date,
  start_after_days integer,
  created_at timestamptz not null default now()
);

grant select on public.stack_items to authenticated;
grant select, update on public.cycles to authenticated;

create or replace function public.save_stack_item(p_item jsonb, p_ingredients jsonb)
returns public.stack_items
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_item public.stack_items;
  owner_id uuid := auth.uid();
begin
  if nullif(p_item ->> 'id', '') is null then
    insert into public.stack_items (user_id, tracking_level)
    values (owner_id, coalesce(nullif(p_item ->> 'tracking_level', ''), 'complete'))
    returning * into saved_item;
  else
    select * into saved_item
    from public.stack_items
    where id = (p_item ->> 'id')::uuid
      and user_id = owner_id;
  end if;
  return saved_item;
end
$$;

create or replace function public.reject_atomic_initial_version()
returns trigger
language plpgsql
as $$
begin
  if new.method = 'Reject' then
    raise exception 'forced initial version failure';
  end if;
  return new;
end
$$;

insert into auth.users (id)
values ('30000000-0000-0000-0000-000000000003');

insert into public.stack_items (id, user_id)
values
  ('33000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003'),
  ('34000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003');

insert into public.cycles (
  id, user_id, stack_item_id, name, dose, unit, method, frequency,
  schedule_days, start_date, end_date, active, intake_time,
  intake_time_custom, slot_doses, schedule_history
)
values
  (
    '33100000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    '33000000-0000-0000-0000-000000000003',
    'Conflicting A', 1, 'mg', 'Oral', 'Täglich', '{}',
    '2026-01-01', null, true, 'morgens', '08:00', null, null
  ),
  (
    '33200000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    '33000000-0000-0000-0000-000000000003',
    'Conflicting B', 2, 'mg', 'Oral', 'Täglich', '{}',
    '2026-02-01', null, true, 'morgens', '08:00', null, null
  ),
  (
    '34100000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    '34000000-0000-0000-0000-000000000004',
    'Legacy history', 200, 'mg', 'Oral', '2x täglich', '{}',
    '2026-01-01', '2026-02-28', false, 'morgens,abends', '08:00,20:00', '200,250',
    jsonb_build_array(
      jsonb_build_object(
        'effective_from', '2026-01-01', 'frequency', 'Täglich',
        'x_days_interval', null, 'schedule_days', jsonb_build_array(),
        'intake_time', 'morgens', 'intake_time_custom', '08:00',
        'slot_doses', null, 'slot_days', null, 'dose', 100, 'unit', 'mg'
      ),
      jsonb_build_object(
        'effective_from', '2026-02-01', 'frequency', '2x täglich',
        'x_days_interval', null, 'schedule_days', jsonb_build_array(),
        'intake_time', 'morgens,abends', 'intake_time_custom', '08:00,20:00',
        'slot_doses', '200,250', 'slot_days', null, 'dose', 200, 'unit', 'mg'
      )
    )
  );

insert into public.dose_escalations (
  id, user_id, cycle_id, increase_amount, unit,
  start_type, start_date, start_after_days
)
values
  (
    '34110000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    '34100000-0000-0000-0000-000000000001',
    25, 'mg', 'date', '2026-01-15', null
  ),
  (
    '34110000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    '34100000-0000-0000-0000-000000000001',
    -10, 'mg', 'after_days', null, 40
  ),
  (
    '34110000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    '34100000-0000-0000-0000-000000000001',
    500, 'mcg', 'date', '2026-01-20', null
  );

\ir ../../supabase-my-stack-plan-integrity.sql

drop policy "Owner reads cycle plan versions"
  on public.cycle_plan_versions;
create policy "Owner reads cycle plan versions"
  on public.cycle_plan_versions
  for select
  to authenticated
  using (true);

\ir ../../supabase-my-stack-plan-integrity.sql

create or replace function public.test_confirm_intake_error(p_entries jsonb)
returns text
language plpgsql
set search_path = public
as $$
begin
  perform public.confirm_intake_group(p_entries);
  return 'accepted';
exception
  when others then return sqlerrm;
end
$$;

begin;

do $$
declare
  required_table text;
  protected_tables constant text[] := array[
    'cycle_plan_versions',
    'cycle_pause_periods',
    'plan_mutation_receipts',
    'cycle_migration_conflicts'
  ];
begin
  foreach required_table in array protected_tables loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'missing table public.%', required_table;
    end if;

    if not has_table_privilege('authenticated', 'public.' || required_table, 'select') then
      raise exception 'authenticated cannot select from public.%', required_table;
    end if;

    if has_table_privilege('authenticated', 'public.' || required_table, 'insert')
      or has_table_privilege('authenticated', 'public.' || required_table, 'update')
      or has_table_privilege('authenticated', 'public.' || required_table, 'delete')
    then
      raise exception 'authenticated can write directly to public.%', required_table;
    end if;
  end loop;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cycles'
      and column_name = 'started_at'
      and data_type = 'timestamp with time zone'
      and is_nullable = 'YES'
  ) then
    raise exception 'cycles.started_at is missing or has the wrong contract';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dose_logs'
      and column_name = 'plan_version_id'
      and data_type = 'uuid'
      and is_nullable = 'YES'
  ) then
    raise exception 'dose_logs.plan_version_id is missing or has the wrong contract';
  end if;

  if exists (
    select 1
    from pg_class
    where oid in (
      'public.cycle_plan_versions'::regclass,
      'public.cycle_pause_periods'::regclass,
      'public.plan_mutation_receipts'::regclass,
      'public.cycle_migration_conflicts'::regclass
    )
      and not relrowsecurity
  ) then
    raise exception 'RLS is not enabled on every plan-integrity table';
  end if;

  if (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = any(protected_tables)
      and cmd = 'SELECT'
      and roles @> array['authenticated']::name[]
      and qual like '%auth.uid()%user_id%'
  ) <> 4 then
    raise exception 'not every plan-integrity table has the owner-read policy';
  end if;
end
$$;

do $$
declare
  version_count integer;
  conflict_cycles uuid[];
begin
  if not exists (
    select 1
    from public.cycles
    where id = '34100000-0000-0000-0000-000000000001'
      and start_date = '2026-01-01'
      and end_date = '2026-02-28'
      and started_at = '2026-01-01T00:00:00Z'
      and ended_at = '2026-03-01T00:00:00Z'
  ) then
    raise exception 'legacy lifecycle dates were not backfilled without changing the source dates';
  end if;

  select count(*) into version_count
  from public.cycle_plan_versions
  where cycle_id = '34100000-0000-0000-0000-000000000001';
  if version_count <> 4 then
    raise exception 'legacy history/escalations produced % versions instead of 4', version_count;
  end if;

  if not exists (
    select 1
    from public.cycle_plan_versions
    where cycle_id = '34100000-0000-0000-0000-000000000001'
      and effective_kind = 'local_date'
      and effective_local_date = '2026-01-01'
      and change_kind = 'initial'
      and dose = 100
      and frequency = 'Täglich'
  ) or not exists (
    select 1
    from public.cycle_plan_versions
    where cycle_id = '34100000-0000-0000-0000-000000000001'
      and effective_local_date = '2026-01-15'
      and change_kind = 'titration'
      and dose = 125
  ) or not exists (
    select 1
    from public.cycle_plan_versions
    where cycle_id = '34100000-0000-0000-0000-000000000001'
      and effective_local_date = '2026-02-01'
      and change_kind = 'schedule'
      and dose = 225
      and slot_doses = '225,275'
      and intake_time = 'morgens,abends'
  ) or not exists (
    select 1
    from public.cycle_plan_versions
    where cycle_id = '34100000-0000-0000-0000-000000000001'
      and effective_local_date = '2026-02-10'
      and change_kind = 'titration'
      and dose = 215
      and slot_doses = '215,265'
  ) then
    raise exception 'legacy versions are not complete parity snapshots';
  end if;

  if exists (
    select 1
    from public.cycle_plan_versions
    where cycle_id = '34100000-0000-0000-0000-000000000001'
      and effective_local_date = '2026-01-20'
  ) then
    raise exception 'mixed-unit escalation was converted by inventing arithmetic';
  end if;
  if (
    select count(*)
    from public.dose_escalations
    where cycle_id = '34100000-0000-0000-0000-000000000001'
  ) <> 3 then
    raise exception 'legacy escalation rows were deleted during backfill';
  end if;

  select cycle_ids into conflict_cycles
  from public.cycle_migration_conflicts
  where user_id = '30000000-0000-0000-0000-000000000003'
    and stack_item_id = '33000000-0000-0000-0000-000000000003'
    and resolved_at is null;
  if conflict_cycles is null
    or cardinality(conflict_cycles) <> 2
    or not conflict_cycles @> array[
      '33100000-0000-0000-0000-000000000001'::uuid,
      '33200000-0000-0000-0000-000000000002'::uuid
    ] then
    raise exception 'multiple open cycles did not produce one deterministic conflict row';
  end if;
  if not exists (
    select 1
    from public.stack_items
    where id = '33000000-0000-0000-0000-000000000003'
      and configuration_status = 'needs_review'
  ) then
    raise exception 'conflicted stack item was not marked needs_review';
  end if;
end
$$;

insert into auth.users (id)
values
  ('10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002');

insert into public.stack_items (id, user_id, tracking_level)
values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'complete'),
  ('13000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'complete'),
  ('14000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'intake_only'),
  ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'complete');

insert into public.cycles (id, user_id, stack_item_id, started_at)
values
  (
    '11100000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '2026-09-18T00:00:00Z'
  ),
  (
    '13100000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000003',
    '2026-09-18T00:00:00Z'
  ),
  (
    '14100000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000004',
    '2026-09-18T00:00:00Z'
  ),
  (
    '22200000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000002',
    '2026-09-18T00:00:00Z'
  );

insert into public.cycle_plan_versions (
  id,
  user_id,
  cycle_id,
  effective_kind,
  effective_at,
  effective_local_date,
  change_kind,
  frequency,
  intake_time,
  dose,
  unit,
  method
)
values
  (
    '11110000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '11100000-0000-0000-0000-000000000001',
    'local_date',
    null,
    '2026-09-18',
    'initial',
    'Täglich',
    'morgens',
    1,
    'mg',
    'Oral'
  ),
  (
    '11110000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '11100000-0000-0000-0000-000000000001',
    'instant',
    '2026-09-18T12:00:00Z',
    null,
    'dose',
    'Täglich',
    'morgens',
    1,
    'mg',
    'Oral'
  ),
  (
    '22220000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '22200000-0000-0000-0000-000000000002',
    'instant',
    '2026-09-18T08:00:00Z',
    null,
    'initial',
    'Täglich',
    'morgens',
    2,
    'mg',
    'Oral'
  );

do $$
begin
  begin
    insert into public.cycle_plan_versions (
      user_id, cycle_id, effective_kind, effective_at, effective_local_date,
      change_kind, frequency, intake_time, method
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '11100000-0000-0000-0000-000000000001',
      'instant',
      now(),
      current_date,
      'dose',
      'Täglich',
      'morgens',
      'Oral'
    );
    raise exception 'invalid plan boundary was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.cycle_plan_versions (
      user_id, cycle_id, effective_kind, effective_at,
      change_kind, frequency, intake_time, method
    ) values (
      '20000000-0000-0000-0000-000000000002',
      '22200000-0000-0000-0000-000000000002',
      'instant',
      '2026-09-18T08:00:00Z',
      'dose',
      'Täglich',
      'morgens',
      'Oral'
    );
    raise exception 'duplicate instant boundary was accepted';
  exception
    when unique_violation then null;
  end;
end
$$;

insert into public.cycle_pause_periods (
  id, user_id, cycle_id, paused_at, ends_at
)
values (
  '11111000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '11100000-0000-0000-0000-000000000001',
  '2026-09-19T08:00:00Z',
  '2026-09-20T08:00:00Z'
);

insert into public.cycle_pause_periods (
  user_id, cycle_id, paused_at, ends_at
)
values (
  '10000000-0000-0000-0000-000000000001',
  '11100000-0000-0000-0000-000000000001',
  '2026-09-20T08:00:00Z',
  '2026-09-21T08:00:00Z'
);

do $$
begin
  begin
    insert into public.cycle_pause_periods (
      user_id, cycle_id, paused_at, ends_at
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '11100000-0000-0000-0000-000000000001',
      '2026-09-19T12:00:00Z',
      '2026-09-19T18:00:00Z'
    );
    raise exception 'overlapping pause was accepted';
  exception
    when exclusion_violation then null;
  end;

  begin
    insert into public.cycle_pause_periods (
      user_id, cycle_id, paused_at, ends_at
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '11100000-0000-0000-0000-000000000001',
      '2026-09-22T08:00:00Z',
      '2026-09-22T08:00:00Z'
    );
    raise exception 'empty pause was accepted';
  exception
    when check_violation then null;
  end;
end
$$;

do $$
declare
  required_rpc regprocedure;
  required_rpcs constant regprocedure[] := array[
    'public.save_stack_item_with_plan(jsonb,jsonb,jsonb,text)'::regprocedure,
    'public.create_plan_version(uuid,text,timestamp with time zone,date,text,jsonb,text)'::regprocedure,
    'public.replace_future_plan_version(uuid,text,timestamp with time zone,date,text,jsonb,text,text)'::regprocedure,
    'public.remove_future_plan_version(uuid,text,text)'::regprocedure,
    'public.pause_cycle(uuid,timestamp with time zone,text)'::regprocedure,
    'public.set_pause_end(uuid,timestamp with time zone,text)'::regprocedure,
    'public.resume_cycle(uuid,text)'::regprocedure,
    'public.end_cycle(uuid,text)'::regprocedure,
    'public.restart_cycle(uuid,timestamp with time zone,jsonb,text)'::regprocedure,
    'public.resolve_plan_version_id(uuid,timestamp with time zone,text)'::regprocedure
  ];
begin
  foreach required_rpc in array required_rpcs loop
    if not has_function_privilege('authenticated', required_rpc, 'execute') then
      raise exception 'authenticated cannot execute %', required_rpc;
    end if;
    if has_function_privilege('anon', required_rpc, 'execute') then
      raise exception 'anon can execute %', required_rpc;
    end if;
    if exists (
      select 1
      from pg_proc function_row
      cross join lateral aclexplode(
        coalesce(
          function_row.proacl,
          acldefault('f', function_row.proowner)
        )
      ) privilege
      where function_row.oid = required_rpc
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ) then
      raise exception 'public can execute %', required_rpc;
    end if;
    if not exists (
      select 1
      from pg_proc
      where oid = required_rpc
        and prosecdef
        and proconfig @> array['search_path=public']
    ) then
      raise exception '% is not a security-definer function with a fixed search path', required_rpc;
    end if;
  end loop;
end
$$;

create or replace function public.test_plan_integrity_counts()
returns table (item_count bigint, cycle_count bigint, version_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.stack_items),
    (select count(*) from public.cycles),
    (select count(*) from public.cycle_plan_versions)
$$;
grant execute on function public.test_plan_integrity_counts() to authenticated;

do $$
declare
  concurrent_cycle_id constant uuid := '33100000-0000-0000-0000-000000000001';
  concurrent_item_id constant uuid := '33000000-0000-0000-0000-000000000003';
  initial_version_id uuid;
  confirmation_entries jsonb;
  confirmation_outcome text;
  persisted_count integer;
begin
  select id into strict initial_version_id
  from public.cycle_plan_versions
  where cycle_id = concurrent_cycle_id
  order by effective_local_date nulls last, effective_at nulls last, created_at, id
  limit 1;

  perform dblink_connect('task9_lifecycle', 'dbname=' || current_database());
  perform dblink_connect('task9_confirmation', 'dbname=' || current_database());
  perform dblink_exec(
    'task9_lifecycle',
    'set request.jwt.claim.sub = ''30000000-0000-0000-0000-000000000003'''
  );
  perform dblink_exec(
    'task9_confirmation',
    'set request.jwt.claim.sub = ''30000000-0000-0000-0000-000000000003'''
  );
  perform dblink_exec('task9_lifecycle', 'begin');

  perform created_version_id
  from dblink(
    'task9_lifecycle',
    $query$
      select (public.create_plan_version(
        '33100000-0000-0000-0000-000000000001',
        'instant',
        '2026-09-18T07:00:00Z',
        null,
        'dose',
        jsonb_build_object(
          'frequency', 'Täglich',
          'schedule_days', jsonb_build_array(),
          'intake_time', 'morgens',
          'dose', 9,
          'unit', 'mg',
          'method', 'Oral'
        ),
        'task9-concurrent-version'
      )).id
    $query$
  ) as lifecycle_result(created_version_id uuid);

  confirmation_entries := jsonb_build_array(jsonb_build_object(
    'cycle_id', concurrent_cycle_id,
    'plan_version_id', initial_version_id,
    'timezone', 'Europe/Berlin',
    'dose_log_id', null,
    'slot_key', 'routine:concurrent-version',
    'stack_item_id', concurrent_item_id,
    'dose', 1,
    'unit', 'mg',
    'method', 'Oral',
    'logged_at', '2026-09-18T08:00:00Z'
  ));

  if dblink_send_query(
    'task9_confirmation',
    format(
      'select public.test_confirm_intake_error(%L::jsonb)',
      confirmation_entries::text
    )
  ) <> 1 then
    raise exception 'concurrent confirmation query was not dispatched';
  end if;

  perform pg_sleep(0.2);
  if dblink_is_busy('task9_confirmation') <> 1 then
    raise exception 'confirmation did not serialize on the lifecycle cycle lock';
  end if;

  perform dblink_exec('task9_lifecycle', 'commit');

  select outcome into strict confirmation_outcome
  from dblink_get_result('task9_confirmation') as confirmation_result(outcome text);

  if confirmation_outcome is distinct from 'Plan version does not match scheduled intake' then
    raise exception 'concurrent confirmation returned %, expected the exact mismatch error', confirmation_outcome;
  end if;

  select count(*) into persisted_count
  from public.dose_logs
  where routine_slot_key = 'routine:concurrent-version';
  if persisted_count <> 0 then
    raise exception 'concurrent plan mutation allowed % confirmation writes', persisted_count;
  end if;

  perform dblink_disconnect('task9_lifecycle');
  perform dblink_disconnect('task9_confirmation');
end
$$;

create trigger reject_atomic_initial_version
before insert on public.cycle_plan_versions
for each row execute function public.reject_atomic_initial_version();

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

do $$
declare
  correct_log public.dose_logs;
  retry_log public.dose_logs;
  prn_log public.dose_logs;
  pending_log_id uuid := '11112000-0000-0000-0000-000000000001';
  completed_pending public.dose_logs;
  persisted_log public.dose_logs;
  row_count integer;
begin
  select * into correct_log
  from public.confirm_intake_group(jsonb_build_array(jsonb_build_object(
    'cycle_id', '11100000-0000-0000-0000-000000000001',
    'plan_version_id', '11110000-0000-0000-0000-000000000001',
    'timezone', 'Europe/Berlin',
    'dose_log_id', null,
    'slot_key', 'routine:correct-version',
    'stack_item_id', '11000000-0000-0000-0000-000000000001',
    'dose', 1,
    'unit', 'mg',
    'method', 'Oral',
    'logged_at', '2026-09-18T08:00:00Z'
  )));

  if correct_log.id is null
    or correct_log.cycle_id is null
    or correct_log.plan_version_id is null
    or correct_log.cycle_id is distinct from '11100000-0000-0000-0000-000000000001'
    or correct_log.plan_version_id is distinct from '11110000-0000-0000-0000-000000000001' then
    raise exception 'correct confirmation did not persist exact provenance';
  end if;
  select * into persisted_log
  from public.dose_logs
  where id = correct_log.id;
  if not found
    or persisted_log.cycle_id is null
    or persisted_log.plan_version_id is null
    or persisted_log.cycle_id is distinct from correct_log.cycle_id
    or persisted_log.plan_version_id is distinct from correct_log.plan_version_id then
    raise exception 'correct confirmation return did not match a persisted provenance row';
  end if;

  select * into retry_log
  from public.confirm_intake_group(jsonb_build_array(jsonb_build_object(
    'cycle_id', '11100000-0000-0000-0000-000000000001',
    'plan_version_id', '11110000-0000-0000-0000-000000000001',
    'timezone', 'Europe/Berlin',
    'dose_log_id', null,
    'slot_key', 'routine:correct-version',
    'stack_item_id', '11000000-0000-0000-0000-000000000001',
    'dose', 1,
    'unit', 'mg',
    'method', 'Oral',
    'logged_at', '2026-09-18T08:00:00Z'
  )));

  if retry_log.id is null
    or retry_log.cycle_id is null
    or retry_log.plan_version_id is null
    or retry_log.id is distinct from correct_log.id
    or retry_log.cycle_id is distinct from correct_log.cycle_id
    or retry_log.plan_version_id is distinct from correct_log.plan_version_id then
    raise exception 'idempotent retry changed log identity or provenance';
  end if;
  select * into persisted_log
  from public.dose_logs
  where id = retry_log.id;
  if not found
    or persisted_log.id is distinct from correct_log.id
    or persisted_log.cycle_id is null
    or persisted_log.plan_version_id is null
    or persisted_log.cycle_id is distinct from correct_log.cycle_id
    or persisted_log.plan_version_id is distinct from correct_log.plan_version_id then
    raise exception 'idempotent retry did not reuse the persisted provenance row';
  end if;

  begin
    perform public.confirm_intake_group(jsonb_build_array(
      jsonb_build_object(
        'cycle_id', '11100000-0000-0000-0000-000000000001',
        'plan_version_id', '11110000-0000-0000-0000-000000000001',
        'timezone', 'Europe/Berlin',
        'dose_log_id', null,
        'slot_key', 'routine:mismatch-atomic-first',
        'stack_item_id', '11000000-0000-0000-0000-000000000001',
        'dose', 1,
        'unit', 'mg',
        'method', 'Oral',
        'logged_at', '2026-09-18T09:00:00Z'
      ),
      jsonb_build_object(
        'cycle_id', '11100000-0000-0000-0000-000000000001',
        'plan_version_id', '22220000-0000-0000-0000-000000000002',
        'timezone', 'Europe/Berlin',
        'dose_log_id', null,
        'slot_key', 'routine:mismatch-atomic-second',
        'stack_item_id', '11000000-0000-0000-0000-000000000001',
        'dose', 1,
        'unit', 'mg',
        'method', 'Oral',
        'logged_at', '2026-09-18T10:00:00Z'
      )
    ));
    raise exception 'a mismatched plan-version claim was accepted';
  exception
    when others then
      if sqlerrm <> 'Plan version does not match scheduled intake' then
        raise;
      end if;
  end;

  select count(*) into row_count
  from public.dose_logs
  where routine_slot_key in (
    'routine:mismatch-atomic-first',
    'routine:mismatch-atomic-second'
  );
  if row_count <> 0 then
    raise exception 'mismatched plan-version group wrote % logs', row_count;
  end if;

  begin
    perform public.confirm_intake_group(jsonb_build_array(
      jsonb_build_object(
        'cycle_id', '11100000-0000-0000-0000-000000000001',
        'plan_version_id', '11110000-0000-0000-0000-000000000001',
        'timezone', 'Europe/Berlin',
        'dose_log_id', null,
        'slot_key', 'routine:pause-atomic-first',
        'stack_item_id', '11000000-0000-0000-0000-000000000001',
        'dose', 1,
        'unit', 'mg',
        'method', 'Oral',
        'logged_at', '2026-09-18T11:00:00Z'
      ),
      jsonb_build_object(
        'cycle_id', '11100000-0000-0000-0000-000000000001',
        'plan_version_id', '11110000-0000-0000-0000-000000000002',
        'timezone', 'Europe/Berlin',
        'dose_log_id', null,
        'slot_key', 'routine:pause-atomic-second',
        'stack_item_id', '11000000-0000-0000-0000-000000000001',
        'dose', 1,
        'unit', 'mg',
        'method', 'Oral',
        'logged_at', '2026-09-19T12:00:00Z'
      )
    ));
    raise exception 'an intake inside a pause was accepted';
  exception
    when others then
      if sqlerrm <> 'Intake falls within a paused cycle' then
        raise;
      end if;
  end;

  select count(*) into row_count
  from public.dose_logs
  where routine_slot_key in (
    'routine:pause-atomic-first',
    'routine:pause-atomic-second'
  );
  if row_count <> 0 then
    raise exception 'paused intake group wrote % logs', row_count;
  end if;

  select * into prn_log
  from public.confirm_intake_group(jsonb_build_array(jsonb_build_object(
    'cycle_id', '11100000-0000-0000-0000-000000000001',
    'plan_version_id', null,
    'timezone', 'Europe/Berlin',
    'dose_log_id', null,
    'slot_key', 'manual-prn:unpaused',
    'stack_item_id', '11000000-0000-0000-0000-000000000001',
    'dose', 1,
    'unit', 'mg',
    'method', 'Oral',
    'logged_at', '2026-09-18T15:00:00Z'
  )));

  if prn_log.id is null
    or prn_log.cycle_id is null
    or prn_log.plan_version_id is null
    or prn_log.plan_version_id is distinct from '11110000-0000-0000-0000-000000000002'
    or prn_log.cycle_id is distinct from '11100000-0000-0000-0000-000000000001' then
    raise exception 'manual PRN confirmation did not store resolved provenance';
  end if;
  select * into persisted_log
  from public.dose_logs
  where id = prn_log.id;
  if not found
    or persisted_log.cycle_id is null
    or persisted_log.plan_version_id is null
    or persisted_log.cycle_id is distinct from prn_log.cycle_id
    or persisted_log.plan_version_id is distinct from prn_log.plan_version_id then
    raise exception 'manual PRN return did not match a persisted provenance row';
  end if;

  insert into public.dose_logs (
    id, user_id, stack_item_id, dose, unit, method, logged_at, taken
  ) values (
    pending_log_id,
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    1,
    'mg',
    'Oral',
    '2026-09-18T16:00:00Z',
    null
  );

  select * into completed_pending
  from public.confirm_intake_group(jsonb_build_array(jsonb_build_object(
    'cycle_id', '11100000-0000-0000-0000-000000000001',
    'plan_version_id', null,
    'timezone', 'Europe/Berlin',
    'dose_log_id', pending_log_id,
    'slot_key', 'routine:pending-completion',
    'stack_item_id', '11000000-0000-0000-0000-000000000001',
    'dose', 1,
    'unit', 'mg',
    'method', 'Oral',
    'logged_at', '2026-09-18T16:00:00Z'
  )));

  if completed_pending.id is null
    or completed_pending.cycle_id is null
    or completed_pending.plan_version_id is null
    or completed_pending.id is distinct from pending_log_id
    or completed_pending.cycle_id is distinct from '11100000-0000-0000-0000-000000000001'
    or completed_pending.plan_version_id is distinct from '11110000-0000-0000-0000-000000000002' then
    raise exception 'pending-log completion did not preserve identity and set provenance';
  end if;
  select * into persisted_log
  from public.dose_logs
  where id = completed_pending.id;
  if not found
    or persisted_log.id is distinct from pending_log_id
    or persisted_log.cycle_id is null
    or persisted_log.plan_version_id is null
    or persisted_log.cycle_id is distinct from completed_pending.cycle_id
    or persisted_log.plan_version_id is distinct from completed_pending.plan_version_id then
    raise exception 'pending-log completion return did not match its persisted provenance row';
  end if;
end
$$;

do $$
declare
  saved_item public.stack_items;
  retried_item public.stack_items;
  created_cycle public.cycles;
  row_count integer;
  item_count_before bigint;
  cycle_count_before bigint;
  version_count_before bigint;
  rollback_item_count bigint;
  rollback_cycle_count bigint;
  rollback_version_count bigint;
begin
  select item_count, cycle_count, version_count
  into item_count_before, cycle_count_before, version_count_before
  from public.test_plan_integrity_counts();

  select * into saved_item
  from public.save_stack_item_with_plan(
    jsonb_build_object('tracking_level', 'complete'),
    jsonb_build_array(jsonb_build_object('position', 0)),
    jsonb_build_object(
      'name', 'Atomic initial setup',
      'dose', 1.5,
      'unit', 'mg',
      'method', 'Oral',
      'frequency', 'Täglich',
      'schedule_days', jsonb_build_array(),
      'start_date', '2026-09-19',
      'end_date', null,
      'intake_time', 'morgens',
      'intake_time_custom', '08:00',
      'slot_doses', null,
      'slot_days', null,
      'reminder', 'on_time'
    ),
    'initial-setup-key'
  );

  select * into retried_item
  from public.save_stack_item_with_plan(
    jsonb_build_object('tracking_level', 'complete'),
    jsonb_build_array(jsonb_build_object('position', 0)),
    jsonb_build_object(
      'name', 'Atomic initial setup',
      'dose', 1.5,
      'unit', 'mg',
      'method', 'Oral',
      'frequency', 'Täglich',
      'schedule_days', jsonb_build_array(),
      'start_date', '2026-09-19',
      'end_date', null,
      'intake_time', 'morgens',
      'intake_time_custom', '08:00',
      'slot_doses', null,
      'slot_days', null,
      'reminder', 'on_time'
    ),
    'initial-setup-key'
  );

  if to_jsonb(retried_item) <> to_jsonb(saved_item) then
    raise exception 'initial setup retry returned a different canonical item';
  end if;
  select item_count, cycle_count, version_count
  into rollback_item_count, rollback_cycle_count, rollback_version_count
  from public.test_plan_integrity_counts();
  if rollback_item_count <> item_count_before + 1 then
    raise exception 'initial setup retry did not leave exactly one new item';
  end if;
  if rollback_cycle_count <> cycle_count_before + 1 then
    raise exception 'initial setup retry did not leave exactly one new cycle';
  end if;
  if rollback_version_count <> version_count_before + 1 then
    raise exception 'initial setup retry did not leave exactly one new version';
  end if;
  select count(*) into row_count
  from public.plan_mutation_receipts
  where idempotency_key = 'initial-setup-key'
    and operation = 'save_stack_item_with_plan';
  if row_count <> 1 then
    raise exception 'initial setup retry wrote % receipts instead of 1', row_count;
  end if;

  select * into strict created_cycle
  from public.cycles
  where stack_item_id = saved_item.id;

  select count(*) into row_count
  from public.cycle_plan_versions
  where cycle_id = created_cycle.id
    and effective_kind = 'local_date'
    and effective_local_date = '2026-09-19'
    and change_kind = 'initial'
    and dose = 1.5
    and unit = 'mg'
    and method = 'Oral';
  if row_count <> 1 then
    raise exception 'initial setup wrote % canonical versions instead of 1', row_count;
  end if;
  if created_cycle.dose <> 1.5
    or created_cycle.unit <> 'mg'
    or created_cycle.method <> 'Oral'
    or created_cycle.frequency <> 'Täglich' then
    raise exception 'initial setup did not retain legacy cycle fields';
  end if;

  select item_count, cycle_count, version_count
  into rollback_item_count, rollback_cycle_count, rollback_version_count
  from public.test_plan_integrity_counts();

  begin
    perform public.save_stack_item_with_plan(
      jsonb_build_object('tracking_level', 'complete'),
      jsonb_build_array(jsonb_build_object('position', 0)),
      jsonb_build_object(
        'name', 'Atomic rollback setup',
        'dose', 2,
        'unit', 'mg',
        'method', 'Reject',
        'frequency', 'Täglich',
        'schedule_days', jsonb_build_array(),
        'start_date', '2026-09-19',
        'intake_time', 'morgens',
        'reminder', 'none'
      ),
      'atomic-rollback-key'
    );
    raise exception 'forced initial version failure was not raised';
  exception
    when others then
      if sqlerrm <> 'forced initial version failure' then
        raise;
      end if;
  end;

  select item_count, cycle_count, version_count
  into item_count_before, cycle_count_before, version_count_before
  from public.test_plan_integrity_counts();
  if item_count_before <> rollback_item_count then
    raise exception 'failed initial version left a stack item behind';
  end if;
  if cycle_count_before <> rollback_cycle_count then
    raise exception 'failed initial version left a cycle behind';
  end if;
  if version_count_before <> rollback_version_count then
    raise exception 'failed initial version left a plan version behind';
  end if;
end
$$;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.cycle_plan_versions;
  if visible_count <> 3 then
    raise exception 'owner RLS exposed % plan versions instead of 3', visible_count;
  end if;

  begin
    insert into public.cycle_plan_versions (
      user_id, cycle_id, effective_kind, effective_at,
      change_kind, frequency, intake_time, method
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '11100000-0000-0000-0000-000000000001',
      'instant',
      now(),
      'dose',
      'Täglich',
      'morgens',
      'Oral'
    );
    raise exception 'authenticated direct insert was accepted';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

do $$
declare
  lifecycle_cycle_id constant uuid := '13100000-0000-0000-0000-000000000003';
  other_user_cycle_id constant uuid := '22200000-0000-0000-0000-000000000002';
  daily_schedule constant jsonb := jsonb_build_object(
    'frequency', 'Täglich',
    'schedule_days', jsonb_build_array(),
    'intake_time', 'morgens',
    'dose', 1.25,
    'unit', 'mg',
    'method', 'Oral'
  );
  initial_version public.cycle_plan_versions;
  initial_retry public.cycle_plan_versions;
  intake_only_version public.cycle_plan_versions;
  local_version public.cycle_plan_versions;
  future_version public.cycle_plan_versions;
  replaced_version public.cycle_plan_versions;
  replaced_retry public.cycle_plan_versions;
  removed_result jsonb;
  removed_retry jsonb;
  pause_result jsonb;
  pause_retry jsonb;
  pause_id uuid;
  changed_pause jsonb;
  changed_pause_retry jsonb;
  resumed_result jsonb;
  resumed_retry jsonb;
  ended_result jsonb;
  ended_retry jsonb;
  restart_result jsonb;
  restart_retry jsonb;
  restarted_cycle_id uuid;
  restarted_version_id uuid;
  future_local_date date := current_date + 5;
  future_local_midnight timestamptz;
  future_instant timestamptz;
  test_started_at timestamptz;
  resolved_id uuid;
  row_count integer;
begin
  future_local_midnight := future_local_date::timestamp at time zone 'Europe/Berlin';
  future_instant := future_local_midnight + interval '12 hours';

  begin
    perform public.create_plan_version(
      lifecycle_cycle_id,
      'instant',
      future_instant + interval '1 day',
      null,
      'dose',
      daily_schedule - 'dose' - 'unit',
      'missing-tracked-quantity'
    );
    raise exception 'a complete plan snapshot without dose and unit was accepted';
  exception
    when others then
      if sqlerrm <> 'Tracked quantity requires a positive dose and unit' then
        raise;
      end if;
  end;

  select * into intake_only_version
  from public.create_plan_version(
    '14100000-0000-0000-0000-000000000004',
    'local_date',
    null,
    current_date - 1,
    'initial',
    daily_schedule,
    'create-intake-only'
  );
  if intake_only_version.dose is not null or intake_only_version.unit is not null then
    raise exception 'intake-only plan snapshot retained a tracked quantity';
  end if;

  select * into initial_version
  from public.create_plan_version(
    lifecycle_cycle_id,
    'local_date',
    null,
    current_date - 1,
    'initial',
    daily_schedule,
    'create-initial'
  );
  select * into initial_retry
  from public.create_plan_version(
    lifecycle_cycle_id,
    'local_date',
    null,
    current_date - 1,
    'initial',
    daily_schedule,
    'create-initial'
  );

  if initial_retry.id <> initial_version.id then
    raise exception 'create_plan_version did not return the original idempotent result';
  end if;
  if initial_version.frequency <> 'Täglich'
    or initial_version.intake_time <> 'morgens'
    or initial_version.dose <> 1.25
    or initial_version.unit <> 'mg'
    or initial_version.method <> 'Oral'
    or initial_version.schedule_days <> '{}'::text[] then
    raise exception 'create_plan_version did not persist a complete normalized snapshot';
  end if;

  select count(*) into row_count
  from public.plan_mutation_receipts
  where operation = 'create_plan_version'
    and idempotency_key = 'create-initial';
  if row_count <> 1 then
    raise exception 'idempotent create wrote % receipts instead of 1', row_count;
  end if;

  begin
    perform public.create_plan_version(
      lifecycle_cycle_id,
      'instant',
      future_instant + interval '2 days',
      null,
      'schedule',
      daily_schedule || jsonb_build_object('intake_time', 'nachts'),
      'invalid-schedule'
    );
    raise exception 'an invalid schedule was accepted';
  exception
    when others then
      if sqlerrm <> 'Invalid plan intake time' then
        raise;
      end if;
  end;

  begin
    perform public.create_plan_version(
      other_user_cycle_id,
      'instant',
      future_instant + interval '3 days',
      null,
      'schedule',
      daily_schedule,
      'cross-owner-create'
    );
    raise exception 'a different user could mutate the cycle';
  exception
    when others then
      if sqlerrm <> 'Cycle not found' then
        raise;
      end if;
  end;

  select * into local_version
  from public.create_plan_version(
    lifecycle_cycle_id,
    'local_date',
    null,
    future_local_date,
    'dose',
    daily_schedule || jsonb_build_object('dose', 1.5),
    'create-future-local'
  );
  select * into future_version
  from public.create_plan_version(
    lifecycle_cycle_id,
    'instant',
    future_instant,
    null,
    'titration',
    daily_schedule || jsonb_build_object('dose', 2),
    'create-future-instant'
  );

  resolved_id := public.resolve_plan_version_id(
    lifecycle_cycle_id,
    future_local_midnight + interval '1 hour',
    'Europe/Berlin'
  );
  if resolved_id <> local_version.id then
    raise exception 'local-date plan boundary resolved to %, expected %', resolved_id, local_version.id;
  end if;
  resolved_id := public.resolve_plan_version_id(
    lifecycle_cycle_id,
    future_instant + interval '1 hour',
    'Europe/Berlin'
  );
  if resolved_id <> future_version.id then
    raise exception 'instant plan boundary resolved to %, expected %', resolved_id, future_version.id;
  end if;

  begin
    perform public.replace_future_plan_version(
      future_version.id,
      'instant',
      clock_timestamp() - interval '1 hour',
      null,
      'titration',
      daily_schedule || jsonb_build_object('dose', 2.5),
      'Europe/Berlin',
      'replace-into-past'
    );
    raise exception 'a future version was replaced with an effective boundary';
  exception
    when others then
      if sqlerrm <> 'Plan version is already effective' then
        raise;
      end if;
  end;

  select * into replaced_version
  from public.replace_future_plan_version(
    future_version.id,
    'instant',
    future_instant + interval '2 hours',
    null,
    'titration',
    daily_schedule || jsonb_build_object('dose', 2.5),
    'Europe/Berlin',
    'replace-future'
  );
  select * into replaced_retry
  from public.replace_future_plan_version(
    future_version.id,
    'instant',
    future_instant + interval '2 hours',
    null,
    'titration',
    daily_schedule || jsonb_build_object('dose', 2.5),
    'Europe/Berlin',
    'replace-future'
  );
  if replaced_version.id <> future_version.id
    or replaced_retry is distinct from replaced_version
    or replaced_version.dose <> 2.5
    or replaced_version.effective_at <> future_instant + interval '2 hours' then
    raise exception 'replace_future_plan_version did not replace the requested snapshot';
  end if;

  removed_result := public.remove_future_plan_version(
    future_version.id,
    'Europe/Berlin',
    'remove-future'
  );
  removed_retry := public.remove_future_plan_version(
    future_version.id,
    'Europe/Berlin',
    'remove-future'
  );
  if removed_result is distinct from removed_retry
    or removed_result ->> 'version_id' <> future_version.id::text then
    raise exception 'remove_future_plan_version is not idempotent';
  end if;
  if exists (select 1 from public.cycle_plan_versions where id = future_version.id) then
    raise exception 'remove_future_plan_version left the version in place';
  end if;

  begin
    perform public.remove_future_plan_version(
      initial_version.id,
      'Europe/Berlin',
      'remove-effective'
    );
    raise exception 'an effective plan version was removed';
  exception
    when others then
      if sqlerrm <> 'Plan version is already effective' then
        raise;
      end if;
  end;

  test_started_at := clock_timestamp();
  pause_result := public.pause_cycle(
    lifecycle_cycle_id,
    clock_timestamp() + interval '2 days',
    'pause-cycle'
  );
  pause_retry := public.pause_cycle(
    lifecycle_cycle_id,
    clock_timestamp() + interval '2 days',
    'pause-cycle'
  );
  if pause_result is distinct from pause_retry then
    raise exception 'pause_cycle is not idempotent';
  end if;
  pause_id := (pause_result ->> 'pause_id')::uuid;
  if not exists (
    select 1
    from public.cycle_pause_periods
    where id = pause_id
      and paused_at >= test_started_at
      and ends_at > paused_at
  ) then
    raise exception 'pause_cycle did not create the expected pause period';
  end if;

  changed_pause := public.set_pause_end(
    pause_id,
    clock_timestamp() + interval '3 days',
    'set-pause-end'
  );
  changed_pause_retry := public.set_pause_end(
    pause_id,
    clock_timestamp() + interval '3 days',
    'set-pause-end'
  );
  if (changed_pause ->> 'pause_id')::uuid <> pause_id
    or changed_pause_retry is distinct from changed_pause then
    raise exception 'set_pause_end returned a different or non-idempotent result';
  end if;

  perform pg_sleep(0.01);
  resumed_result := public.resume_cycle(lifecycle_cycle_id, 'resume-cycle');
  resumed_retry := public.resume_cycle(lifecycle_cycle_id, 'resume-cycle');
  if (resumed_result ->> 'pause_id')::uuid <> pause_id
    or resumed_retry is distinct from resumed_result then
    raise exception 'resume_cycle returned a different or non-idempotent result';
  end if;

  begin
    perform public.resume_cycle(lifecycle_cycle_id, 'resume-not-paused');
    raise exception 'resume_cycle accepted a cycle that is not paused';
  exception
    when others then
      if sqlerrm <> 'Cycle is not paused' then
        raise;
      end if;
  end;

  perform public.pause_cycle(
    lifecycle_cycle_id,
    null,
    'pause-before-end'
  );
  perform pg_sleep(0.01);
  ended_result := public.end_cycle(lifecycle_cycle_id, 'end-cycle');
  ended_retry := public.end_cycle(lifecycle_cycle_id, 'end-cycle');
  if ended_result ->> 'cycle_id' <> lifecycle_cycle_id::text
    or ended_retry is distinct from ended_result then
    raise exception 'end_cycle returned a wrong or non-idempotent result';
  end if;
  if not exists (
    select 1
    from public.cycles
    where id = lifecycle_cycle_id
      and ended_at is not null
      and end_date is not null
      and not active
  ) or exists (
    select 1
    from public.cycle_pause_periods
    where cycle_id = lifecycle_cycle_id
      and ends_at is null
  ) then
    raise exception 'end_cycle did not close the cycle and its open pause';
  end if;

  begin
    perform public.end_cycle(lifecycle_cycle_id, 'end-cycle-again');
    raise exception 'end_cycle accepted an ended cycle';
  exception
    when others then
      if sqlerrm <> 'Cycle is already ended' then
        raise;
      end if;
  end;

  begin
    perform public.pause_cycle(
      lifecycle_cycle_id,
      null,
      'pause-ended-cycle'
    );
    raise exception 'pause_cycle accepted an ended cycle';
  exception
    when others then
      if sqlerrm <> 'Cycle is already ended' then
        raise;
      end if;
  end;

  begin
    perform public.create_plan_version(
      lifecycle_cycle_id,
      'instant',
      clock_timestamp() + interval '10 days',
      null,
      'schedule',
      daily_schedule,
      'create-on-ended-cycle'
    );
    raise exception 'create_plan_version accepted an ended cycle';
  exception
    when others then
      if sqlerrm <> 'Cycle is already ended' then
        raise;
      end if;
  end;

  restart_result := public.restart_cycle(
    lifecycle_cycle_id,
    clock_timestamp(),
    daily_schedule || jsonb_build_object('dose', 3),
    'restart-cycle'
  );
  restart_retry := public.restart_cycle(
    lifecycle_cycle_id,
    clock_timestamp(),
    daily_schedule || jsonb_build_object('dose', 3),
    'restart-cycle'
  );
  if restart_result is distinct from restart_retry then
    raise exception 'restart_cycle is not idempotent';
  end if;
  restarted_cycle_id := (restart_result ->> 'cycle_id')::uuid;
  restarted_version_id := (restart_result ->> 'plan_version_id')::uuid;
  if not exists (
    select 1
    from public.cycles
    where id = restarted_cycle_id
      and stack_item_id = '13000000-0000-0000-0000-000000000003'
      and ended_at is null
      and active
  ) or not exists (
    select 1
    from public.cycle_plan_versions
    where id = restarted_version_id
      and cycle_id = restarted_cycle_id
      and change_kind = 'initial'
      and dose = 3
  ) then
    raise exception 'restart_cycle did not create a new cycle with an initial snapshot';
  end if;

  begin
    perform public.restart_cycle(
      lifecycle_cycle_id,
      clock_timestamp(),
      daily_schedule,
      'restart-conflict'
    );
    raise exception 'restart_cycle accepted a second open cycle';
  exception
    when others then
      if sqlerrm <> 'Another open cycle exists' then
        raise;
      end if;
  end;
end
$$;

reset role;

rollback;
