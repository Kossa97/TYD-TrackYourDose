\set ON_ERROR_STOP on

create extension if not exists pgcrypto;
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
  tracking_level text not null default 'complete'
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
  user_id uuid not null references auth.users(id) on delete cascade
);

grant select on public.cycles to authenticated;

\ir ../../supabase-my-stack-plan-integrity.sql

drop policy "Owner reads cycle plan versions"
  on public.cycle_plan_versions;
create policy "Owner reads cycle plan versions"
  on public.cycle_plan_versions
  for select
  to authenticated
  using (true);

\ir ../../supabase-my-stack-plan-integrity.sql

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

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.cycle_plan_versions;
  if visible_count <> 1 then
    raise exception 'owner RLS exposed % plan versions instead of 1', visible_count;
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
