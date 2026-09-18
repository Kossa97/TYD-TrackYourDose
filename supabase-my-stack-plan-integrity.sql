begin;

alter table public.cycles
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists closed_by_migration_resolution boolean not null default false;

create table if not exists public.cycle_plan_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  effective_kind text not null
    check (effective_kind in ('instant', 'local_date')),
  effective_at timestamptz,
  effective_local_date date,
  change_kind text not null
    check (change_kind in ('initial', 'dose', 'schedule', 'titration')),
  frequency text not null,
  x_days_interval integer,
  interval_unit text,
  cycle_on_days integer,
  cycle_off_days integer,
  schedule_days text[] not null default '{}',
  intake_time text not null,
  intake_time_custom text,
  slot_doses text,
  slot_days text,
  dose numeric(10,3),
  unit text,
  method text not null,
  created_at timestamptz not null default now(),
  check (
    (
      effective_kind = 'instant'
      and effective_at is not null
      and effective_local_date is null
    )
    or
    (
      effective_kind = 'local_date'
      and effective_at is null
      and effective_local_date is not null
    )
  )
);

create unique index if not exists cycle_plan_versions_instant_key
  on public.cycle_plan_versions(cycle_id, effective_at)
  where effective_kind = 'instant';

create unique index if not exists cycle_plan_versions_local_date_key
  on public.cycle_plan_versions(cycle_id, effective_local_date)
  where effective_kind = 'local_date';

create table if not exists public.cycle_pause_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  paused_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > paused_at)
);

create or replace function public.reject_overlapping_cycle_pause_periods()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1
  from public.cycles
  where id = new.cycle_id
  for update;

  if not found then
    raise foreign_key_violation using
      message = 'The cycle for this pause period does not exist.';
  end if;

  if exists (
    select 1
    from public.cycle_pause_periods existing
    where existing.cycle_id = new.cycle_id
      and existing.id <> new.id
      and tstzrange(existing.paused_at, existing.ends_at, '[)')
        && tstzrange(new.paused_at, new.ends_at, '[)')
  ) then
    raise exclusion_violation using
      message = 'Pause periods for one cycle must not overlap.';
  end if;

  return new;
end
$$;

drop trigger if exists reject_overlapping_cycle_pause_periods
  on public.cycle_pause_periods;

create trigger reject_overlapping_cycle_pause_periods
before insert or update of cycle_id, paused_at, ends_at
on public.cycle_pause_periods
for each row
execute function public.reject_overlapping_cycle_pause_periods();

revoke all on function public.reject_overlapping_cycle_pause_periods()
  from public, anon, authenticated;

create table if not exists public.plan_mutation_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  operation text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key, operation)
);

create table if not exists public.cycle_migration_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_item_id uuid not null references public.stack_items(id) on delete cascade,
  cycle_ids uuid[] not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, stack_item_id)
);

alter table public.dose_logs
  add column if not exists cycle_id uuid
    references public.cycles(id) on delete set null,
  add column if not exists plan_version_id uuid
    references public.cycle_plan_versions(id) on delete set null;

alter table public.cycle_plan_versions enable row level security;
alter table public.cycle_pause_periods enable row level security;
alter table public.plan_mutation_receipts enable row level security;
alter table public.cycle_migration_conflicts enable row level security;

drop policy if exists "Owner reads cycle plan versions"
  on public.cycle_plan_versions;
create policy "Owner reads cycle plan versions"
  on public.cycle_plan_versions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Owner reads cycle pause periods"
  on public.cycle_pause_periods;
create policy "Owner reads cycle pause periods"
  on public.cycle_pause_periods
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Owner reads plan mutation receipts"
  on public.plan_mutation_receipts;
create policy "Owner reads plan mutation receipts"
  on public.plan_mutation_receipts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Owner reads cycle migration conflicts"
  on public.cycle_migration_conflicts;
create policy "Owner reads cycle migration conflicts"
  on public.cycle_migration_conflicts
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.cycle_plan_versions from anon, authenticated;
revoke all on table public.cycle_pause_periods from anon, authenticated;
revoke all on table public.plan_mutation_receipts from anon, authenticated;
revoke all on table public.cycle_migration_conflicts from anon, authenticated;

grant select on table public.cycle_plan_versions to authenticated;
grant select on table public.cycle_pause_periods to authenticated;
grant select on table public.plan_mutation_receipts to authenticated;
grant select on table public.cycle_migration_conflicts to authenticated;

commit;
