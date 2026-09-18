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
  user_id uuid not null references auth.users(id) on delete cascade
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_item_id uuid not null references public.stack_items(id) on delete cascade
);

create table public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
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

insert into public.stack_items (id, user_id)
values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');

insert into public.cycles (id, user_id, stack_item_id, started_at)
values
  (
    '11100000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
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

reset role;

rollback;
