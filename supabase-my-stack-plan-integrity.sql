begin;

alter table public.cycles
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists start_local_date date,
  add column if not exists end_local_date date,
  add column if not exists lifecycle_timezone text,
  add column if not exists timezone_review_required boolean not null default false,
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

-- Keep the foundation guard, allowing only a recorded migration conflict.
create or replace function public.enforce_stack_item_review_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.configuration_status = 'needs_review' then
    raise exception 'New stack items cannot start as needs_review';
  end if;

  if tg_op = 'UPDATE'
    and old.configuration_status = 'complete'
    and new.configuration_status = 'needs_review'
    and not exists (
      select 1 from public.cycle_migration_conflicts conflict
      where conflict.stack_item_id = new.id
        and conflict.user_id = new.user_id
        and conflict.resolved_at is null
    ) then
    raise exception 'Complete stack items cannot return to needs_review';
  end if;

  return new;
end;
$$;

alter table public.dose_logs
  add column if not exists cycle_id uuid
    references public.cycles(id) on delete set null,
  add column if not exists plan_version_id uuid
    references public.cycle_plan_versions(id) on delete set null;

create or replace function public.reject_referenced_plan_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return new;
  end if;

  if exists (
    select 1
    from public.dose_logs
    where plan_version_id = old.id
  ) then
    raise exception 'Plan version has confirmed intake history';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists reject_referenced_plan_version_mutation
  on public.cycle_plan_versions;

create trigger reject_referenced_plan_version_mutation
before update or delete
on public.cycle_plan_versions
for each row
execute function public.reject_referenced_plan_version_mutation();

-- A concurrent confirmation can commit after the immediate check because its
-- FK key-share lock permits a non-key update. Recheck at transaction end.
drop trigger if exists reject_referenced_plan_version_mutation_at_commit
  on public.cycle_plan_versions;

create constraint trigger reject_referenced_plan_version_mutation_at_commit
after update or delete
on public.cycle_plan_versions
deferrable initially deferred
for each row
execute function public.reject_referenced_plan_version_mutation();

revoke all on function public.reject_referenced_plan_version_mutation()
  from public, anon, authenticated;

create or replace function public.normalize_plan_schedule(
  p_schedule jsonb,
  p_tracking_level text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_frequency text;
  plan_method text;
  plan_intake_time text;
  plan_intake_time_custom text;
  plan_interval integer;
  plan_interval_value numeric;
  plan_interval_unit text;
  plan_cycle_on integer;
  plan_cycle_off integer;
  plan_schedule_days text[] := '{}'::text[];
  plan_slot_doses text;
  plan_slot_days text;
  plan_dose numeric;
  plan_unit text;
  schedule_day_count integer;
  schedule_day_unique_count integer;
  schedule_days_valid boolean;
  slot_dose text;
begin
  if p_schedule is null or jsonb_typeof(p_schedule) <> 'object' then
    raise exception 'Invalid plan';
  end if;

  plan_frequency := nullif(btrim(p_schedule ->> 'frequency'), '');
  plan_method := nullif(btrim(p_schedule ->> 'method'), '');
  plan_intake_time := nullif(btrim(p_schedule ->> 'intake_time'), '');
  plan_intake_time_custom := nullif(btrim(p_schedule ->> 'intake_time_custom'), '');
  plan_interval_unit := nullif(btrim(p_schedule ->> 'interval_unit'), '');
  plan_cycle_on := nullif(p_schedule ->> 'cycle_on_days', '')::integer;
  plan_cycle_off := nullif(p_schedule ->> 'cycle_off_days', '')::integer;
  plan_slot_doses := nullif(btrim(p_schedule ->> 'slot_doses'), '');
  plan_slot_days := nullif(btrim(p_schedule ->> 'slot_days'), '');
  plan_dose := nullif(p_schedule ->> 'dose', '')::numeric;
  plan_unit := nullif(btrim(p_schedule ->> 'unit'), '');

  if plan_frequency is null then
    raise exception 'Plan frequency is required';
  end if;
  if plan_method is null then
    raise exception 'Plan method is required';
  end if;
  if plan_intake_time is null
    or exists (
      select 1
      from unnest(string_to_array(plan_intake_time, ',')) slot
      where btrim(slot) not in ('morgens', 'mittags', 'abends')
    )
    or coalesce(array_length(string_to_array(plan_intake_time, ','), 1), 0)
      not between 1 and 4 then
    raise exception 'Invalid plan intake time';
  end if;

  if plan_interval_unit is not null
    and plan_interval_unit not in ('day', 'week', 'month') then
    raise exception 'Invalid plan interval unit';
  end if;

  if plan_frequency = 'Im Wechsel' then
    if plan_cycle_on is null or plan_cycle_off is null
      or plan_cycle_on not between 1 and 90
      or plan_cycle_off not between 1 and 90 then
      raise exception 'Alternating frequency requires on and off days between 1 and 90';
    end if;
  else
    plan_cycle_on := null;
    plan_cycle_off := null;
  end if;

  if plan_slot_doses is not null then
    if array_length(string_to_array(plan_slot_doses, ','), 1)
      is distinct from array_length(string_to_array(plan_intake_time, ','), 1) then
      raise exception 'Slot doses must line up with intake times';
    end if;
    foreach slot_dose in array string_to_array(plan_slot_doses, ',') loop
      if nullif(btrim(slot_dose), '') is not null
        and not (
          btrim(slot_dose)::numeric > 0
          and btrim(slot_dose)::numeric <= '1000000000'::numeric
        ) then
        raise exception 'Slot doses must be positive quantities';
      end if;
    end loop;
  end if;

  if plan_slot_days is not null then
    if array_length(string_to_array(plan_slot_days, ','), 1)
      is distinct from array_length(string_to_array(plan_intake_time, ','), 1) then
      raise exception 'Slot days must line up with intake times';
    end if;
    if exists (
      select 1
      from unnest(string_to_array(plan_slot_days, ',')) entry,
           unnest(string_to_array(entry, '|')) weekday
      where btrim(weekday) <> ''
        and btrim(weekday) <> all (array['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
    ) then
      raise exception 'Slot days must be German weekday codes';
    end if;
  end if;

  if jsonb_typeof(p_schedule -> 'schedule_days') = 'array' then
    select coalesce(array_agg(value), '{}'::text[])
    into plan_schedule_days
    from jsonb_array_elements_text(p_schedule -> 'schedule_days') value;
  end if;

  if plan_frequency = 'Alle X Tage' then
    if coalesce(p_schedule ->> 'x_days_interval', '') !~ '^[0-9]+$' then
      raise exception 'Every-X-days frequency requires a whole-day interval';
    end if;
    plan_interval_value := (p_schedule ->> 'x_days_interval')::numeric;
    if not (
      plan_interval_value between 1 and case coalesce(plan_interval_unit, 'day')
        when 'month' then 12
        when 'week' then 52
        else 90
      end
    ) then
      raise exception 'Interval is outside the range of its unit';
    end if;
    plan_interval := plan_interval_value::integer;
  else
    plan_interval := null;
    plan_interval_unit := null;
  end if;

  if plan_frequency = 'Wochentage wählen' then
    select count(*), count(distinct weekday),
      coalesce(bool_and(
        weekday = any(array['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']::text[])
      ), false)
    into schedule_day_count, schedule_day_unique_count, schedule_days_valid
    from unnest(plan_schedule_days) weekday;

    if schedule_day_count = 0
      or schedule_day_count <> schedule_day_unique_count
      or not schedule_days_valid then
      raise exception 'Weekday frequency requires valid unique weekdays';
    end if;
  end if;

  if p_tracking_level = 'intake_only' then
    plan_dose := null;
    plan_unit := null;
  elsif p_tracking_level in ('with_amount', 'complete') then
    if plan_dose is null
      or not (plan_dose > 0 and plan_dose <= '1000000000'::numeric)
      or plan_unit is null then
      raise exception 'Tracked quantity requires a positive dose and unit';
    end if;
  else
    raise exception 'Invalid tracking level';
  end if;

  return jsonb_build_object(
    'frequency', plan_frequency,
    'x_days_interval', plan_interval,
    'interval_unit', plan_interval_unit,
    'cycle_on_days', plan_cycle_on,
    'cycle_off_days', plan_cycle_off,
    'schedule_days', to_jsonb(plan_schedule_days),
    'intake_time', plan_intake_time,
    'intake_time_custom', plan_intake_time_custom,
    'slot_doses', plan_slot_doses,
    'slot_days', plan_slot_days,
    'dose', plan_dose,
    'unit', plan_unit,
    'method', plan_method
  );
end
$$;

revoke all on function public.normalize_plan_schedule(jsonb, text)
  from public, anon, authenticated;

drop function if exists public.save_stack_item_with_plan(jsonb, jsonb, jsonb);

create or replace function public.save_stack_item_with_plan(
  p_item jsonb,
  p_ingredients jsonb,
  p_plan jsonb,
  p_idempotency_key text default null
)
returns public.stack_items
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  saved_item public.stack_items;
  cycle_row public.cycles;
  normalized jsonb;
  plan_id uuid;
  plan_name text := nullif(btrim(p_plan ->> 'name'), '');
  plan_effective_date date;
  plan_timezone text := nullif(p_plan ->> 'timezone', '');
  plan_end_date date := nullif(p_plan ->> 'end_date', '')::date;
  plan_reminder text := coalesce(nullif(btrim(p_plan ->> 'reminder'), ''), 'none');
  plan_schedule_days text[];
  schedule_changed boolean;
  next_history jsonb;
  previous_segment jsonb;
  next_segment jsonb;
  mutation_key text;
  operation_name constant text := 'save_stack_item_with_plan';
  receipt_result jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_idempotency_key is null then
    mutation_key := gen_random_uuid()::text;
  elsif nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  else
    mutation_key := p_idempotency_key;
  end if;
  if nullif(p_plan ->> 'id', '') is not null
    and to_regclass('public.cycles_one_open_per_stack_item') is not null then
    raise exception 'Legacy plan editing is disabled';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || mutation_key, 0)
  );
  select result into receipt_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = mutation_key
    and operation = operation_name;
  if found then
    select * into saved_item
    from jsonb_populate_record(null::public.stack_items, receipt_result);
    return saved_item;
  end if;

  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    raise exception 'Invalid plan';
  end if;
  if plan_name is null then
    raise exception 'Plan name is required';
  end if;
  if nullif(p_plan ->> 'start_date', '') is null then
    raise exception 'Plan start date is required';
  end if;

  plan_effective_date := (p_plan ->> 'start_date')::date;
  if plan_timezone is null or not exists (select from pg_timezone_names where name = plan_timezone) then
    raise exception 'Valid course timezone is required';
  end if;
  if plan_end_date is not null and plan_end_date < plan_effective_date then
    raise exception 'Plan end date is before its start date';
  end if;

  saved_item := public.save_stack_item(p_item, p_ingredients);
  normalized := public.normalize_plan_schedule(p_plan, saved_item.tracking_level);
  select coalesce(array_agg(value), '{}'::text[])
  into plan_schedule_days
  from jsonb_array_elements_text(normalized -> 'schedule_days') value;

  if nullif(p_plan ->> 'id', '') is null then
    if exists (select from public.cycles where stack_item_id = saved_item.id
      and coalesce(ended_at, 'infinity'::timestamptz) > plan_effective_date::timestamp at time zone plan_timezone) then
      raise exception 'Another open cycle exists';
    end if;
    insert into public.cycles (
      user_id, stack_item_id, name, dose, unit, method, frequency,
      x_days_interval, interval_unit, cycle_on_days, cycle_off_days,
      schedule_days, start_date, end_date, active, intake_time,
      intake_time_custom, slot_doses, slot_days, reminder, started_at, ended_at, start_local_date, end_local_date, lifecycle_timezone
    ) values (
      owner_id, saved_item.id, plan_name,
      (normalized ->> 'dose')::numeric, normalized ->> 'unit',
      normalized ->> 'method', normalized ->> 'frequency',
      (normalized ->> 'x_days_interval')::integer,
      normalized ->> 'interval_unit',
      (normalized ->> 'cycle_on_days')::integer,
      (normalized ->> 'cycle_off_days')::integer,
      plan_schedule_days, plan_effective_date, plan_end_date, true,
      normalized ->> 'intake_time', normalized ->> 'intake_time_custom',
      normalized ->> 'slot_doses', normalized ->> 'slot_days',
      plan_reminder,
      plan_effective_date::timestamp at time zone plan_timezone,
      (plan_end_date + 1)::timestamp at time zone plan_timezone,
      plan_effective_date, plan_end_date + 1, plan_timezone
    )
    returning * into cycle_row;

    insert into public.cycle_plan_versions (
      user_id, cycle_id, effective_kind, effective_at, effective_local_date,
      change_kind, frequency, x_days_interval, interval_unit, cycle_on_days,
      cycle_off_days, schedule_days, intake_time, intake_time_custom,
      slot_doses, slot_days, dose, unit, method
    ) values (
      owner_id, cycle_row.id, 'local_date', null, plan_effective_date, 'initial',
      normalized ->> 'frequency',
      (normalized ->> 'x_days_interval')::integer,
      normalized ->> 'interval_unit',
      (normalized ->> 'cycle_on_days')::integer,
      (normalized ->> 'cycle_off_days')::integer,
      plan_schedule_days,
      normalized ->> 'intake_time',
      normalized ->> 'intake_time_custom',
      normalized ->> 'slot_doses',
      normalized ->> 'slot_days',
      (normalized ->> 'dose')::numeric,
      normalized ->> 'unit',
      normalized ->> 'method'
    );
    insert into public.plan_mutation_receipts (
      user_id, idempotency_key, operation, result
    ) values (
      owner_id, mutation_key, operation_name, to_jsonb(saved_item)
    );
    return saved_item;
  end if;

  plan_id := (p_plan ->> 'id')::uuid;
  select * into cycle_row
  from public.cycles
  where id = plan_id
    and stack_item_id = saved_item.id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Plan not found';
  end if;
  if plan_effective_date < cycle_row.start_date then
    raise exception 'Plan effective date cannot precede cycle start';
  end if;

  schedule_changed := cycle_row.frequency is distinct from (normalized ->> 'frequency')
    or cycle_row.x_days_interval is distinct from (normalized ->> 'x_days_interval')::integer
    or cycle_row.interval_unit is distinct from (normalized ->> 'interval_unit')
    or cycle_row.cycle_on_days is distinct from (normalized ->> 'cycle_on_days')::integer
    or cycle_row.cycle_off_days is distinct from (normalized ->> 'cycle_off_days')::integer
    or coalesce(cycle_row.schedule_days, '{}'::text[]) is distinct from plan_schedule_days
    or cycle_row.intake_time is distinct from (normalized ->> 'intake_time')
    or cycle_row.intake_time_custom is distinct from (normalized ->> 'intake_time_custom')
    or cycle_row.slot_doses is distinct from (normalized ->> 'slot_doses')
    or cycle_row.slot_days is distinct from (normalized ->> 'slot_days')
    or cycle_row.dose is distinct from (normalized ->> 'dose')::numeric
    or cycle_row.unit is distinct from (normalized ->> 'unit');

  if schedule_changed then
    previous_segment := jsonb_build_object(
      'effective_from', cycle_row.start_date,
      'frequency', cycle_row.frequency,
      'x_days_interval', cycle_row.x_days_interval,
      'interval_unit', cycle_row.interval_unit,
      'cycle_on_days', cycle_row.cycle_on_days,
      'cycle_off_days', cycle_row.cycle_off_days,
      'schedule_days', cycle_row.schedule_days,
      'intake_time', cycle_row.intake_time,
      'intake_time_custom', cycle_row.intake_time_custom,
      'slot_doses', cycle_row.slot_doses,
      'slot_days', cycle_row.slot_days,
      'dose', cycle_row.dose,
      'unit', cycle_row.unit
    );
    next_segment := jsonb_build_object(
      'effective_from', plan_effective_date,
      'frequency', normalized ->> 'frequency',
      'x_days_interval', (normalized ->> 'x_days_interval')::integer,
      'interval_unit', normalized ->> 'interval_unit',
      'cycle_on_days', (normalized ->> 'cycle_on_days')::integer,
      'cycle_off_days', (normalized ->> 'cycle_off_days')::integer,
      'schedule_days', plan_schedule_days,
      'intake_time', normalized ->> 'intake_time',
      'intake_time_custom', normalized ->> 'intake_time_custom',
      'slot_doses', normalized ->> 'slot_doses',
      'slot_days', normalized ->> 'slot_days',
      'dose', (normalized ->> 'dose')::numeric,
      'unit', normalized ->> 'unit'
    );
    next_history := case
      when cycle_row.schedule_history is null
        or jsonb_typeof(cycle_row.schedule_history) <> 'array'
        or jsonb_array_length(cycle_row.schedule_history) = 0
        then jsonb_build_array(previous_segment)
      else cycle_row.schedule_history
    end;
    select coalesce(jsonb_agg(segment), '[]'::jsonb)
    into next_history
    from jsonb_array_elements(next_history) segment
    where segment ->> 'effective_from' is distinct from plan_effective_date::text;
    next_history := next_history || jsonb_build_array(next_segment);
  else
    next_history := cycle_row.schedule_history;
  end if;

  update public.cycles
  set
    name = plan_name,
    dose = (normalized ->> 'dose')::numeric,
    unit = normalized ->> 'unit',
    method = normalized ->> 'method',
    frequency = normalized ->> 'frequency',
    x_days_interval = (normalized ->> 'x_days_interval')::integer,
    interval_unit = normalized ->> 'interval_unit',
    cycle_on_days = (normalized ->> 'cycle_on_days')::integer,
    cycle_off_days = (normalized ->> 'cycle_off_days')::integer,
    schedule_days = plan_schedule_days,
    end_date = plan_end_date,
    intake_time = normalized ->> 'intake_time',
    intake_time_custom = normalized ->> 'intake_time_custom',
    slot_doses = normalized ->> 'slot_doses',
    slot_days = normalized ->> 'slot_days',
    reminder = plan_reminder,
    schedule_history = next_history
  where id = plan_id
    and stack_item_id = saved_item.id
    and user_id = owner_id;

  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, mutation_key, operation_name, to_jsonb(saved_item)
  );
  return saved_item;
end
$$;

revoke execute on function public.save_stack_item_with_plan(jsonb, jsonb, jsonb, text)
  from public, anon;
grant execute on function public.save_stack_item_with_plan(jsonb, jsonb, jsonb, text)
  to authenticated;

create or replace function public.try_legacy_local_date(p_value text)
returns date
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  parsed date;
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  begin
    parsed := p_value::date;
  exception
    when others then return null;
  end;
  if to_char(parsed, 'YYYY-MM-DD') <> p_value then
    return null;
  end if;
  return parsed;
end
$$;

revoke all on function public.try_legacy_local_date(text)
  from public, anon, authenticated;

create or replace function public.legacy_schedule_snapshot(
  p_cycle_id uuid,
  p_day date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cycle_row public.cycles;
  segment jsonb;
begin
  select * into cycle_row
  from public.cycles
  where id = p_cycle_id;
  if not found then
    return null;
  end if;

  if jsonb_typeof(cycle_row.schedule_history) = 'array'
    and jsonb_array_length(cycle_row.schedule_history) > 0 then
    select candidate.value into segment
    from jsonb_array_elements(cycle_row.schedule_history) with ordinality candidate(value, position)
    where public.try_legacy_local_date(candidate.value ->> 'effective_from') <= p_day
    order by public.try_legacy_local_date(candidate.value ->> 'effective_from') desc,
      candidate.position desc
    limit 1;

    if segment is null then
      select candidate.value into segment
      from jsonb_array_elements(cycle_row.schedule_history) with ordinality candidate(value, position)
      where public.try_legacy_local_date(candidate.value ->> 'effective_from') is not null
      order by public.try_legacy_local_date(candidate.value ->> 'effective_from'),
        candidate.position
      limit 1;
    end if;
  end if;

  return jsonb_build_object(
    'frequency', case when segment ? 'frequency'
      then segment -> 'frequency' else to_jsonb(cycle_row.frequency) end,
    'x_days_interval', case when segment ? 'x_days_interval'
      then segment -> 'x_days_interval' else to_jsonb(cycle_row.x_days_interval) end,
    'interval_unit', case when segment ? 'interval_unit'
      then segment -> 'interval_unit' else to_jsonb(cycle_row.interval_unit) end,
    'cycle_on_days', case when segment ? 'cycle_on_days'
      then segment -> 'cycle_on_days' else to_jsonb(cycle_row.cycle_on_days) end,
    'cycle_off_days', case when segment ? 'cycle_off_days'
      then segment -> 'cycle_off_days' else to_jsonb(cycle_row.cycle_off_days) end,
    'schedule_days', case when segment ? 'schedule_days'
      then segment -> 'schedule_days' else to_jsonb(coalesce(cycle_row.schedule_days, '{}'::text[])) end,
    'intake_time', case when segment ? 'intake_time'
      then segment -> 'intake_time' else to_jsonb(cycle_row.intake_time) end,
    'intake_time_custom', case when segment ? 'intake_time_custom'
      then segment -> 'intake_time_custom' else to_jsonb(cycle_row.intake_time_custom) end,
    'slot_doses', case when segment ? 'slot_doses'
      then segment -> 'slot_doses' else to_jsonb(cycle_row.slot_doses) end,
    'slot_days', case when segment ? 'slot_days'
      then segment -> 'slot_days' else to_jsonb(cycle_row.slot_days) end,
    'dose', case when segment ? 'dose'
      then segment -> 'dose' else to_jsonb(cycle_row.dose) end,
    'unit', case when segment ? 'unit'
      then segment -> 'unit' else to_jsonb(cycle_row.unit) end,
    'method', to_jsonb(cycle_row.method)
  );
end
$$;

revoke all on function public.legacy_schedule_snapshot(uuid, date)
  from public, anon, authenticated;

create or replace function public.create_plan_version(
  p_cycle_id uuid,
  p_effective_kind text,
  p_effective_at timestamptz,
  p_effective_local_date date,
  p_change_kind text,
  p_schedule jsonb,
  p_idempotency_key text
)
returns public.cycle_plan_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  cycle_row public.cycles;
  normalized jsonb;
  item_tracking_level text;
  saved_version public.cycle_plan_versions;
  prior_result jsonb;
  operation_name constant text := 'create_plan_version';
  mutation_time timestamptz;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || p_idempotency_key, 0)
  );
  select result into prior_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = p_idempotency_key
    and operation = operation_name;
  if found then
    select * into saved_version
    from jsonb_populate_record(null::public.cycle_plan_versions, prior_result);
    return saved_version;
  end if;

  select * into cycle_row
  from public.cycles
  where id = p_cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  mutation_time := clock_timestamp();
  if cycle_row.ended_at is not null and cycle_row.ended_at <= mutation_time then
    raise exception 'Cycle is already ended';
  end if;
  if p_effective_kind not in ('instant', 'local_date')
    or (p_effective_kind = 'instant' and (p_effective_at is null or p_effective_local_date is not null))
    or (p_effective_kind = 'local_date' and (p_effective_at is not null or p_effective_local_date is null)) then
    raise exception 'Invalid plan boundary';
  end if;
  if p_change_kind not in ('initial', 'dose', 'schedule', 'titration') then
    raise exception 'Invalid plan change kind';
  end if;

  select tracking_level into item_tracking_level
  from public.stack_items
  where id = cycle_row.stack_item_id
    and user_id = owner_id;
  if not found then
    raise exception 'Stack item not found';
  end if;

  normalized := public.normalize_plan_schedule(p_schedule, item_tracking_level);

  if p_change_kind <> 'initial' or exists (
    select 1 from public.cycle_plan_versions where cycle_id = p_cycle_id
  ) then
    if p_effective_kind = 'instant' and coalesce((p_schedule ->> '_effective_now')::boolean, false) then
      p_effective_at := mutation_time;
    elsif (case p_effective_kind when 'instant' then p_effective_at
      else p_effective_local_date::timestamp at time zone coalesce(p_schedule ->> '_timezone', 'UTC') end) <= mutation_time then
      raise exception 'Plan changes require a future boundary or now';
    end if;
  end if;

  insert into public.cycle_plan_versions (
    user_id, cycle_id, effective_kind, effective_at, effective_local_date,
    change_kind, frequency, x_days_interval, interval_unit, cycle_on_days,
    cycle_off_days, schedule_days, intake_time, intake_time_custom,
    slot_doses, slot_days, dose, unit, method
  ) values (
    owner_id, p_cycle_id, p_effective_kind, p_effective_at, p_effective_local_date,
    p_change_kind, normalized ->> 'frequency',
    (normalized ->> 'x_days_interval')::integer,
    normalized ->> 'interval_unit',
    (normalized ->> 'cycle_on_days')::integer,
    (normalized ->> 'cycle_off_days')::integer,
    array(select jsonb_array_elements_text(normalized -> 'schedule_days')),
    normalized ->> 'intake_time',
    normalized ->> 'intake_time_custom',
    normalized ->> 'slot_doses',
    normalized ->> 'slot_days',
    (normalized ->> 'dose')::numeric,
    normalized ->> 'unit',
    normalized ->> 'method'
  )
  returning * into saved_version;

  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, p_idempotency_key, operation_name, to_jsonb(saved_version)
  );

  return saved_version;
end
$$;

create or replace function public.resolve_plan_version_id(
  p_cycle_id uuid,
  p_target timestamptz,
  p_timezone text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  resolved_id uuid;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_target is null or nullif(btrim(p_timezone), '') is null then
    raise exception 'Target and timezone are required';
  end if;
  if not exists (
    select 1
    from public.cycles
    where id = p_cycle_id
      and user_id = owner_id
  ) then
    raise exception 'Cycle not found';
  end if;

  select version.id
  into resolved_id
  from public.cycle_plan_versions version
  where version.cycle_id = p_cycle_id
    and version.user_id = owner_id
    and case version.effective_kind
      when 'instant' then version.effective_at
      else version.effective_local_date::timestamp at time zone p_timezone
    end <= p_target
  order by
    case version.effective_kind
      when 'instant' then version.effective_at
      else version.effective_local_date::timestamp at time zone p_timezone
    end desc,
    version.created_at desc,
    version.id desc
  limit 1;

  return resolved_id;
end
$$;

create or replace function public.confirm_intake_group(p_entries jsonb)
returns setof public.dose_logs
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
  entry jsonb;
  saved_log public.dose_logs;
  entry_cycle_id uuid;
  entry_plan_version_id uuid;
  expected_plan_version_id uuid;
  entry_timezone text;
  entry_dose_log_id uuid;
  entry_slot_key text;
  entry_stack_item_id uuid;
  entry_dose numeric;
  entry_unit text;
  entry_method text;
  entry_logged_at timestamptz;
  entry_taken boolean;
  cycle_started_at timestamptz;
  cycle_ended_at timestamptz;
  item_tracking_level text;
  validated_entries jsonb := '[]'::jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_entries is null
    or jsonb_typeof(p_entries) <> 'array'
    or jsonb_array_length(p_entries) = 0 then
    raise exception 'At least one intake entry is required';
  end if;

  if exists (
    select 1
    from (
      select value ->> 'slot_key' as slot_key
      from jsonb_array_elements(p_entries)
      group by 1
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Duplicate routine slot key in intake group';
  end if;

  if exists (
    select 1
    from (
      select
        (value ->> 'cycle_id')::uuid as cycle_id,
        (value ->> 'logged_at')::timestamptz as logged_at
      from jsonb_array_elements(p_entries)
      group by 1, 2
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Duplicate cycle and logged_at in intake group';
  end if;

  for entry_cycle_id in
    select requested.cycle_id
    from (
      select distinct nullif(btrim(value ->> 'cycle_id'), '')::uuid as cycle_id
      from jsonb_array_elements(p_entries)
    ) requested
    where requested.cycle_id is not null
    order by requested.cycle_id
  loop
    perform 1
    from public.cycles
    where id = entry_cycle_id
      and user_id = owner_id
    for update;
  end loop;

  for entry in
    select value
    from jsonb_array_elements(p_entries)
  loop
    entry_cycle_id := nullif(btrim(entry ->> 'cycle_id'), '')::uuid;
    entry_plan_version_id := nullif(btrim(entry ->> 'plan_version_id'), '')::uuid;
    entry_timezone := nullif(btrim(entry ->> 'timezone'), '');
    entry_dose_log_id := nullif(btrim(entry ->> 'dose_log_id'), '')::uuid;
    entry_slot_key := nullif(btrim(entry ->> 'slot_key'), '');
    entry_stack_item_id := nullif(btrim(entry ->> 'stack_item_id'), '')::uuid;
    entry_unit := nullif(btrim(entry ->> 'unit'), '');
    entry_method := coalesce(entry ->> 'method', '');
    entry_logged_at := nullif(btrim(entry ->> 'logged_at'), '')::timestamptz;

    if not (entry ? 'taken') then
      entry_taken := true;
    elsif jsonb_typeof(entry -> 'taken') = 'boolean' then
      entry_taken := (entry ->> 'taken')::boolean;
    else
      raise exception 'Taken must be a boolean';
    end if;

    if entry -> 'dose' is null or entry -> 'dose' = 'null'::jsonb then
      entry_dose := null;
    elsif jsonb_typeof(entry -> 'dose') = 'number' then
      entry_dose := (entry ->> 'dose')::numeric;
    else
      raise exception 'Dose must be a number or null';
    end if;

    if entry_cycle_id is null
      or entry_timezone is null
      or entry_slot_key is null
      or entry_stack_item_id is null
      or entry_logged_at is null then
      raise exception 'Cycle, timezone, slot key, stack item, and logged_at are required';
    end if;
    if not exists (
      select 1
      from pg_timezone_names
      where name = entry_timezone
    ) then
      raise exception 'Invalid timezone';
    end if;
    if (entry_dose is null) <> (entry_unit is null) then
      raise exception 'Dose and unit must both be supplied or both be null';
    end if;
    if entry_dose is not null
      and not (entry_dose > 0 and entry_dose <= '1000000000'::numeric) then
      raise exception 'Dose must be positive';
    end if;

    select item.tracking_level, cycle.started_at, cycle.ended_at
    into item_tracking_level, cycle_started_at, cycle_ended_at
    from public.cycles cycle
    join public.stack_items item on item.id = cycle.stack_item_id
    where cycle.id = entry_cycle_id
      and cycle.stack_item_id = entry_stack_item_id
      and cycle.user_id = owner_id
      and item.user_id = owner_id;

    if not found then
      raise exception 'Intake cycle not found';
    end if;
    if cycle_started_at is null or entry_logged_at < cycle_started_at
      or entry_logged_at >= coalesce(cycle_ended_at, 'infinity'::timestamptz) then
      raise exception 'Intake falls outside cycle lifecycle';
    end if;
    if item_tracking_level = 'intake_only' then
      if entry_dose is not null then
        raise exception 'Intake-only entries cannot store a quantity';
      end if;
    elsif entry_dose is null then
      raise exception 'Tracked entries require dose and unit';
    end if;

    expected_plan_version_id := public.resolve_plan_version_id(
      entry_cycle_id,
      entry_logged_at,
      entry_timezone
    );
    if expected_plan_version_id is null then
      raise exception 'Plan version not found';
    end if;
    if entry_plan_version_id is not null
      and entry_plan_version_id <> expected_plan_version_id then
      raise exception 'Plan version does not match scheduled intake';
    end if;

    if exists (
      select 1
      from public.cycle_pause_periods pause
      where pause.cycle_id = entry_cycle_id
        and pause.user_id = owner_id
        and pause.paused_at <= entry_logged_at
        and (pause.ends_at is null or entry_logged_at < pause.ends_at)
    ) then
      raise exception 'Intake falls within a paused cycle';
    end if;

    select *
    into saved_log
    from public.dose_logs
    where routine_slot_key = entry_slot_key
      and user_id = owner_id;

    if found then
      if saved_log.stack_item_id <> entry_stack_item_id
        or (saved_log.taken is not null and saved_log.taken is distinct from entry_taken)
        or (saved_log.cycle_id is not null and saved_log.cycle_id <> entry_cycle_id)
        or (saved_log.taken is not null and (
          saved_log.logged_at <> entry_logged_at
          or saved_log.cycle_id is distinct from entry_cycle_id
          or saved_log.plan_version_id is distinct from expected_plan_version_id
        ))
        or (entry_dose_log_id is not null and saved_log.id <> entry_dose_log_id) then
        raise exception 'Routine slot key belongs to another intake';
      end if;
    elsif entry_dose_log_id is not null then
      perform 1
      from public.dose_logs
      where id = entry_dose_log_id
        and user_id = owner_id
        and stack_item_id = entry_stack_item_id
        and taken is null
        and (cycle_id is null or cycle_id = entry_cycle_id)
        and (routine_slot_key is null or routine_slot_key = entry_slot_key);

      if not found then
        raise exception 'Pending dose log not found';
      end if;
    end if;

    validated_entries := validated_entries || jsonb_build_array(
      entry || jsonb_build_object(
        '_resolved_plan_version_id', expected_plan_version_id,
        '_taken', entry_taken
      )
    );
  end loop;

  for entry in
    select value
    from jsonb_array_elements(validated_entries)
  loop
    entry_cycle_id := nullif(btrim(entry ->> 'cycle_id'), '')::uuid;
    entry_timezone := nullif(btrim(entry ->> 'timezone'), '');
    entry_dose_log_id := nullif(btrim(entry ->> 'dose_log_id'), '')::uuid;
    entry_slot_key := nullif(btrim(entry ->> 'slot_key'), '');
    entry_stack_item_id := nullif(btrim(entry ->> 'stack_item_id'), '')::uuid;
    entry_unit := nullif(btrim(entry ->> 'unit'), '');
    entry_method := coalesce(entry ->> 'method', '');
    entry_logged_at := nullif(btrim(entry ->> 'logged_at'), '')::timestamptz;
    entry_taken := (entry ->> '_taken')::boolean;
    if entry -> 'dose' is null or entry -> 'dose' = 'null'::jsonb then
      entry_dose := null;
    else
      entry_dose := (entry ->> 'dose')::numeric;
    end if;

    expected_plan_version_id := nullif(
      btrim(entry ->> '_resolved_plan_version_id'),
      ''
    )::uuid;
    if expected_plan_version_id is null then
      raise exception 'Plan version not found';
    end if;

    select *
    into saved_log
    from public.dose_logs
    where routine_slot_key = entry_slot_key
      and user_id = owner_id
    for update;

    if not found and entry_dose_log_id is not null then
      update public.dose_logs
      set
        cycle_id = entry_cycle_id,
        plan_version_id = expected_plan_version_id,
        dose = entry_dose,
        unit = entry_unit,
        method = entry_method,
        logged_at = entry_logged_at,
        routine_slot_key = entry_slot_key,
        taken = entry_taken
      where id = entry_dose_log_id
        and user_id = owner_id
        and stack_item_id = entry_stack_item_id
        and taken is null
        and (cycle_id is null or cycle_id = entry_cycle_id)
        and (routine_slot_key is null or routine_slot_key = entry_slot_key)
      returning * into saved_log;
    elsif not found then
      insert into public.dose_logs (
        user_id,
        stack_item_id,
        cycle_id,
        plan_version_id,
        dose,
        unit,
        method,
        logged_at,
        routine_slot_key,
        taken
      ) values (
        owner_id,
        entry_stack_item_id,
        entry_cycle_id,
        expected_plan_version_id,
        entry_dose,
        entry_unit,
        entry_method,
        entry_logged_at,
        entry_slot_key,
        entry_taken
      )
      on conflict (user_id, routine_slot_key)
        where routine_slot_key is not null
        do nothing
      returning * into saved_log;
    end if;

    if not found then
      select *
      into saved_log
      from public.dose_logs
      where routine_slot_key = entry_slot_key
        and user_id = owner_id
      for update;

      if not found then
        raise exception 'Routine intake could not be saved';
      end if;
    end if;

    if saved_log.stack_item_id <> entry_stack_item_id
      or (saved_log.taken is not null and saved_log.taken is distinct from entry_taken)
      or (saved_log.cycle_id is not null and saved_log.cycle_id <> entry_cycle_id)
      or (saved_log.taken is not null and (
        saved_log.logged_at <> entry_logged_at
        or saved_log.cycle_id is distinct from entry_cycle_id
        or saved_log.plan_version_id is distinct from expected_plan_version_id
      ))
      or (entry_dose_log_id is not null and saved_log.id <> entry_dose_log_id) then
      raise exception 'Routine slot key belongs to another intake';
    end if;

    if saved_log.taken is null then
      update public.dose_logs
      set
        cycle_id = entry_cycle_id,
        plan_version_id = expected_plan_version_id,
        dose = entry_dose,
        unit = entry_unit,
        method = entry_method,
        logged_at = entry_logged_at,
        routine_slot_key = entry_slot_key,
        taken = entry_taken
      where id = saved_log.id
        and user_id = owner_id
      returning * into saved_log;
    end if;

    return next saved_log;
  end loop;
end
$$;

revoke execute on function public.confirm_intake_group(jsonb) from public, anon;
grant execute on function public.confirm_intake_group(jsonb) to authenticated;

create or replace function public.replace_future_plan_version(
  p_version_id uuid,
  p_effective_kind text,
  p_effective_at timestamptz,
  p_effective_local_date date,
  p_change_kind text,
  p_schedule jsonb,
  p_timezone text,
  p_idempotency_key text
)
returns public.cycle_plan_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  cycle_row public.cycles;
  version_row public.cycle_plan_versions;
  discovered_cycle_id uuid;
  normalized jsonb;
  item_tracking_level text;
  prior_result jsonb;
  current_boundary timestamptz;
  replacement_boundary timestamptz;
  mutation_now timestamptz;
  operation_name constant text := 'replace_future_plan_version';
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || p_idempotency_key, 0)
  );
  select result into prior_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = p_idempotency_key
    and operation = operation_name;
  if found then
    select * into version_row
    from jsonb_populate_record(null::public.cycle_plan_versions, prior_result);
    return version_row;
  end if;

  select cycle_id into discovered_cycle_id
  from public.cycle_plan_versions
  where id = p_version_id
    and user_id = owner_id;
  if not found then
    raise exception 'Plan version not found';
  end if;

  select * into cycle_row
  from public.cycles
  where id = discovered_cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;

  select * into version_row
  from public.cycle_plan_versions
  where id = p_version_id
    and cycle_id = discovered_cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Plan version not found';
  end if;
  mutation_now := clock_timestamp();
  if cycle_row.ended_at is not null and cycle_row.ended_at <= mutation_now then
    raise exception 'Cycle is already ended';
  end if;
  if nullif(btrim(p_timezone), '') is null then
    raise exception 'Timezone is required';
  end if;

  current_boundary := case version_row.effective_kind
    when 'instant' then version_row.effective_at
    else version_row.effective_local_date::timestamp at time zone p_timezone
  end;
  if current_boundary <= mutation_now then
    raise exception 'Plan version is already effective';
  end if;

  if p_effective_kind not in ('instant', 'local_date')
    or (p_effective_kind = 'instant' and (p_effective_at is null or p_effective_local_date is not null))
    or (p_effective_kind = 'local_date' and (p_effective_at is not null or p_effective_local_date is null)) then
    raise exception 'Invalid plan boundary';
  end if;
  if p_change_kind not in ('initial', 'dose', 'schedule', 'titration') then
    raise exception 'Invalid plan change kind';
  end if;

  replacement_boundary := case p_effective_kind
    when 'instant' then p_effective_at
    else p_effective_local_date::timestamp at time zone p_timezone
  end;
  if replacement_boundary <= mutation_now then
    raise exception 'Plan version is already effective';
  end if;
  if cycle_row.started_at is not null
    and replacement_boundary > cycle_row.started_at
    and not exists (
      select 1
      from public.cycle_plan_versions covering
      where covering.cycle_id = version_row.cycle_id
        and covering.id <> version_row.id
        and case covering.effective_kind
          when 'instant' then covering.effective_at
          else covering.effective_local_date::timestamp at time zone p_timezone
        end <= cycle_row.started_at
    ) then
    raise exception 'Initial plan coverage cannot be moved after cycle start';
  end if;

  select tracking_level into item_tracking_level
  from public.stack_items
  where id = cycle_row.stack_item_id
    and user_id = owner_id;
  if not found then
    raise exception 'Stack item not found';
  end if;

  normalized := public.normalize_plan_schedule(p_schedule, item_tracking_level);

  update public.cycle_plan_versions
  set
    effective_kind = p_effective_kind,
    effective_at = p_effective_at,
    effective_local_date = p_effective_local_date,
    change_kind = p_change_kind,
    frequency = normalized ->> 'frequency',
    x_days_interval = (normalized ->> 'x_days_interval')::integer,
    interval_unit = normalized ->> 'interval_unit',
    cycle_on_days = (normalized ->> 'cycle_on_days')::integer,
    cycle_off_days = (normalized ->> 'cycle_off_days')::integer,
    schedule_days = array(select jsonb_array_elements_text(normalized -> 'schedule_days')),
    intake_time = normalized ->> 'intake_time',
    intake_time_custom = normalized ->> 'intake_time_custom',
    slot_doses = normalized ->> 'slot_doses',
    slot_days = normalized ->> 'slot_days',
    dose = (normalized ->> 'dose')::numeric,
    unit = normalized ->> 'unit',
    method = normalized ->> 'method'
  where id = p_version_id
  returning * into version_row;

  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, p_idempotency_key, operation_name, to_jsonb(version_row)
  );

  return version_row;
end
$$;

create or replace function public.remove_future_plan_version(
  p_version_id uuid,
  p_timezone text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  cycle_row public.cycles;
  version_row public.cycle_plan_versions;
  discovered_cycle_id uuid;
  prior_result jsonb;
  mutation_result jsonb;
  current_boundary timestamptz;
  mutation_now timestamptz;
  operation_name constant text := 'remove_future_plan_version';
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || p_idempotency_key, 0)
  );
  select result into prior_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = p_idempotency_key
    and operation = operation_name;
  if found then
    return prior_result;
  end if;

  select cycle_id into discovered_cycle_id
  from public.cycle_plan_versions
  where id = p_version_id
    and user_id = owner_id;
  if not found then
    raise exception 'Plan version not found';
  end if;

  select * into cycle_row
  from public.cycles
  where id = discovered_cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;

  select * into version_row
  from public.cycle_plan_versions
  where id = p_version_id
    and cycle_id = discovered_cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Plan version not found';
  end if;
  mutation_now := clock_timestamp();
  if cycle_row.ended_at is not null and cycle_row.ended_at <= mutation_now then
    raise exception 'Cycle is already ended';
  end if;
  if nullif(btrim(p_timezone), '') is null then
    raise exception 'Timezone is required';
  end if;

  current_boundary := case version_row.effective_kind
    when 'instant' then version_row.effective_at
    else version_row.effective_local_date::timestamp at time zone p_timezone
  end;
  if current_boundary <= mutation_now then
    raise exception 'Plan version is already effective';
  end if;

  if version_row.change_kind = 'initial' or not exists (
    select 1 from public.cycle_plan_versions earlier
    where earlier.cycle_id = version_row.cycle_id and earlier.id <> version_row.id
      and (case earlier.effective_kind when 'instant' then earlier.effective_at
        else earlier.effective_local_date::timestamp at time zone p_timezone end) < current_boundary
  ) then
    raise exception 'Initial plan coverage cannot be removed';
  end if;

  delete from public.cycle_plan_versions
  where id = p_version_id;

  mutation_result := jsonb_build_object(
    'cycle_id', version_row.cycle_id,
    'version_id', version_row.id
  );
  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, p_idempotency_key, operation_name, mutation_result
  );

  return mutation_result;
end
$$;

create or replace function public.pause_cycle(
  p_cycle_id uuid,
  p_ends_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  cycle_row public.cycles;
  pause_row public.cycle_pause_periods;
  prior_result jsonb;
  mutation_result jsonb;
  mutation_time timestamptz;
  operation_name constant text := 'pause_cycle';
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || p_idempotency_key, 0)
  );
  select result into prior_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = p_idempotency_key
    and operation = operation_name;
  if found then
    return prior_result;
  end if;

  select * into cycle_row
  from public.cycles
  where id = p_cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  if cycle_row.ended_at is not null and cycle_row.ended_at <= clock_timestamp() then
    raise exception 'Cycle is already ended';
  end if;

  mutation_time := clock_timestamp();
  if p_ends_at is not null and p_ends_at <= mutation_time then
    raise exception 'Pause end must be in the future';
  end if;
  if exists (
    select 1
    from public.cycle_pause_periods
    where cycle_id = p_cycle_id
      and user_id = owner_id
      and paused_at <= mutation_time
      and (ends_at is null or ends_at > mutation_time)
  ) then
    raise exception 'Cycle is already paused';
  end if;

  insert into public.cycle_pause_periods (
    user_id, cycle_id, paused_at, ends_at
  ) values (
    owner_id, p_cycle_id, mutation_time, p_ends_at
  )
  returning * into pause_row;

  mutation_result := jsonb_build_object(
    'cycle_id', p_cycle_id,
    'pause_id', pause_row.id,
    'paused_at', pause_row.paused_at,
    'ends_at', pause_row.ends_at
  );
  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, p_idempotency_key, operation_name, mutation_result
  );

  return mutation_result;
end
$$;

create or replace function public.set_pause_end(
  p_pause_id uuid,
  p_ends_at timestamptz,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  cycle_row public.cycles;
  pause_row public.cycle_pause_periods;
  prior_result jsonb;
  mutation_result jsonb;
  mutation_time timestamptz;
  operation_name constant text := 'set_pause_end';
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || p_idempotency_key, 0)
  );
  select result into prior_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = p_idempotency_key
    and operation = operation_name;
  if found then
    return prior_result;
  end if;

  select * into pause_row
  from public.cycle_pause_periods
  where id = p_pause_id
    and user_id = owner_id;
  if not found then
    raise exception 'Cycle is not paused';
  end if;

  select * into cycle_row
  from public.cycles
  where id = pause_row.cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  if cycle_row.ended_at is not null and cycle_row.ended_at <= clock_timestamp() then
    raise exception 'Cycle is already ended';
  end if;

  select * into pause_row
  from public.cycle_pause_periods
  where id = p_pause_id and cycle_id = cycle_row.id and user_id = owner_id
  for update;
  if not found then raise exception 'Cycle is not paused'; end if;

  mutation_time := clock_timestamp();
  if pause_row.paused_at > mutation_time
    or (pause_row.ends_at is not null and pause_row.ends_at <= mutation_time) then
    raise exception 'Cycle is not paused';
  end if;
  if p_ends_at is null or p_ends_at <= mutation_time then
    raise exception 'Pause end must be in the future';
  end if;

  update public.cycle_pause_periods
  set ends_at = p_ends_at
  where id = p_pause_id
  returning * into pause_row;

  mutation_result := jsonb_build_object(
    'cycle_id', pause_row.cycle_id,
    'pause_id', pause_row.id,
    'paused_at', pause_row.paused_at,
    'ends_at', pause_row.ends_at
  );
  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, p_idempotency_key, operation_name, mutation_result
  );

  return mutation_result;
end
$$;

create or replace function public.resume_cycle(
  p_cycle_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  cycle_row public.cycles;
  pause_row public.cycle_pause_periods;
  prior_result jsonb;
  mutation_result jsonb;
  mutation_time timestamptz;
  operation_name constant text := 'resume_cycle';
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || p_idempotency_key, 0)
  );
  select result into prior_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = p_idempotency_key
    and operation = operation_name;
  if found then
    return prior_result;
  end if;

  select * into cycle_row
  from public.cycles
  where id = p_cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  if cycle_row.ended_at is not null and cycle_row.ended_at <= clock_timestamp() then
    raise exception 'Cycle is already ended';
  end if;

  mutation_time := clock_timestamp();
  select * into pause_row
  from public.cycle_pause_periods
  where cycle_id = p_cycle_id
    and user_id = owner_id
    and paused_at <= mutation_time
    and (ends_at is null or ends_at > mutation_time)
  order by paused_at desc
  limit 1
  for update;
  if not found then
    raise exception 'Cycle is not paused';
  end if;

  update public.cycle_pause_periods
  set ends_at = mutation_time
  where id = pause_row.id
  returning * into pause_row;

  mutation_result := jsonb_build_object(
    'cycle_id', p_cycle_id,
    'pause_id', pause_row.id,
    'resumed_at', pause_row.ends_at
  );
  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, p_idempotency_key, operation_name, mutation_result
  );

  return mutation_result;
end
$$;

create or replace function public.end_cycle(
  p_cycle_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  cycle_row public.cycles;
  prior_result jsonb;
  mutation_result jsonb;
  mutation_time timestamptz;
  operation_name constant text := 'end_cycle';
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || p_idempotency_key, 0)
  );
  select result into prior_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = p_idempotency_key
    and operation = operation_name;
  if found then
    return prior_result;
  end if;

  select * into cycle_row
  from public.cycles
  where id = p_cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  if cycle_row.ended_at is not null and cycle_row.ended_at <= clock_timestamp() then
    raise exception 'Cycle is already ended';
  end if;

  mutation_time := clock_timestamp();
  update public.cycle_pause_periods
  set ends_at = mutation_time
  where cycle_id = p_cycle_id
    and user_id = owner_id
    and paused_at <= mutation_time
    and (ends_at is null or ends_at > mutation_time);

  update public.cycles
  set
    ended_at = mutation_time,
    end_local_date = null,
    end_date = mutation_time::date,
    active = false
  where id = p_cycle_id
  returning * into cycle_row;

  mutation_result := jsonb_build_object(
    'cycle_id', p_cycle_id,
    'ended_at', cycle_row.ended_at
  );
  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, p_idempotency_key, operation_name, mutation_result
  );

  return mutation_result;
end
$$;

create or replace function public.restart_cycle(
  p_source_cycle_id uuid,
  p_started_at timestamptz,
  p_initial_schedule jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  source_cycle public.cycles;
  new_cycle public.cycles;
  initial_version public.cycle_plan_versions;
  normalized jsonb;
  item_tracking_level text;
  prior_result jsonb;
  mutation_result jsonb;
  operation_name constant text := 'restart_cycle';
  restart_timezone text := p_initial_schedule ->> '_timezone';
  recurrence_date date;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || p_idempotency_key, 0)
  );
  select result into prior_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = p_idempotency_key
    and operation = operation_name;
  if found then
    return prior_result;
  end if;

  select * into source_cycle
  from public.cycles
  where id = p_source_cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  if source_cycle.ended_at is null or source_cycle.ended_at > clock_timestamp() then
    raise exception 'Cycle is not ended';
  end if;
  if p_started_at is null then
    raise exception 'Cycle start is required';
  end if;
  -- Catalog membership alone also admits server-local and placeholder zones
  -- that Intl cannot resolve. Keep explicit IANA zones and supported aliases.
  if restart_timezone is null
    or restart_timezone in ('localtime', 'Factory', 'posixrules')
    or restart_timezone ~ '^(posix|right)/'
    or not exists (select 1 from pg_timezone_names where name = restart_timezone) then
    raise exception 'Valid restart timezone is required';
  end if;
  recurrence_date := (p_started_at at time zone restart_timezone)::date;

  perform 1
  from public.stack_items
  where id = source_cycle.stack_item_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Stack item not found';
  end if;

  select tracking_level into item_tracking_level
  from public.stack_items
  where id = source_cycle.stack_item_id
    and user_id = owner_id;

  perform 1
  from public.cycles
  where user_id = owner_id
    and stack_item_id = source_cycle.stack_item_id
    and (ended_at is null or ended_at > p_started_at)
    and id <> source_cycle.id
  for update;
  if found then
    raise exception 'Another open cycle exists';
  end if;

  normalized := public.normalize_plan_schedule(p_initial_schedule, item_tracking_level);

  insert into public.cycles (
    user_id, stack_item_id, name, dose, unit, method, frequency,
    x_days_interval, interval_unit, cycle_on_days, cycle_off_days,
    schedule_days, start_date, end_date, notes, active, intake_time,
    intake_time_custom, slot_doses, slot_days, reminder, schedule_history,
    started_at, ended_at, closed_by_migration_resolution, start_local_date, lifecycle_timezone
  ) values (
    owner_id,
    source_cycle.stack_item_id,
    source_cycle.name,
    (normalized ->> 'dose')::numeric,
    normalized ->> 'unit',
    normalized ->> 'method',
    normalized ->> 'frequency',
    (normalized ->> 'x_days_interval')::integer,
    normalized ->> 'interval_unit',
    (normalized ->> 'cycle_on_days')::integer,
    (normalized ->> 'cycle_off_days')::integer,
    array(select jsonb_array_elements_text(normalized -> 'schedule_days')),
    recurrence_date,
    null,
    source_cycle.notes,
    true,
    normalized ->> 'intake_time',
    normalized ->> 'intake_time_custom',
    normalized ->> 'slot_doses',
    normalized ->> 'slot_days',
    source_cycle.reminder,
    null,
    p_started_at,
    null,
    false,
    recurrence_date,
    restart_timezone
  )
  returning * into new_cycle;

  insert into public.cycle_plan_versions (
    user_id, cycle_id, effective_kind, effective_at, effective_local_date,
    change_kind, frequency, x_days_interval, interval_unit, cycle_on_days,
    cycle_off_days, schedule_days, intake_time, intake_time_custom,
    slot_doses, slot_days, dose, unit, method
  ) values (
    owner_id,
    new_cycle.id,
    'instant',
    p_started_at,
    null,
    'initial',
    normalized ->> 'frequency',
    (normalized ->> 'x_days_interval')::integer,
    normalized ->> 'interval_unit',
    (normalized ->> 'cycle_on_days')::integer,
    (normalized ->> 'cycle_off_days')::integer,
    array(select jsonb_array_elements_text(normalized -> 'schedule_days')),
    normalized ->> 'intake_time',
    normalized ->> 'intake_time_custom',
    normalized ->> 'slot_doses',
    normalized ->> 'slot_days',
    (normalized ->> 'dose')::numeric,
    normalized ->> 'unit',
    normalized ->> 'method'
  )
  returning * into initial_version;

  mutation_result := jsonb_build_object(
    'source_cycle_id', source_cycle.id,
    'cycle_id', new_cycle.id,
    'plan_version_id', initial_version.id
  );
  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, p_idempotency_key, operation_name, mutation_result
  );

  return mutation_result;
end
$$;

-- A subscription stores the device's IANA zone. Multiple different zones are
-- ambiguous: the owner must explicitly review them, just like a missing zone.
do $$ begin
  if to_regclass('public.push_subscriptions') is not null then
    execute $migration$
      update public.cycles c set lifecycle_timezone = zones.timezone
      from (
        select s.user_id, min(s.timezone) as timezone
        from public.push_subscriptions s join pg_timezone_names z on z.name = s.timezone
        group by s.user_id having count(distinct s.timezone) = 1
      ) zones
      where c.user_id = zones.user_id and c.started_at is null and c.lifecycle_timezone is null
    $migration$;
  end if;
end $$;
update public.cycles set
  start_local_date = coalesce(start_local_date, start_date),
  end_local_date = coalesce(end_local_date, end_date + 1),
  timezone_review_required = lifecycle_timezone is null,
  started_at = start_date::timestamp at time zone lifecycle_timezone,
  ended_at = case
    when end_date is not null then (end_date + 1)::timestamp at time zone lifecycle_timezone
    when not active then transaction_timestamp()
    else null end
where started_at is null;

do $$
declare
  cycle_row public.cycles;
  escalation_row public.dose_escalations;
  snapshot jsonb;
  activation_snapshot jsonb;
  boundary date;
  escalation_date date;
  boundary_dates date[];
  history_dates date[];
  base_dose numeric;
  adjustment numeric;
  adjusted_slot_doses text;
  version_change_kind text;
begin
  for cycle_row in
    select *
    from public.cycles
    order by id
  loop
    history_dates := '{}'::date[];
    if jsonb_typeof(cycle_row.schedule_history) = 'array'
      and jsonb_array_length(cycle_row.schedule_history) > 0 then
      select coalesce(array_agg(distinct history_date order by history_date), '{}'::date[])
      into history_dates
      from (
        select public.try_legacy_local_date(entry.value ->> 'effective_from') history_date
        from jsonb_array_elements(cycle_row.schedule_history) entry(value)
      ) dates
      where history_date is not null;

      boundary_dates := case
        when cardinality(history_dates) > 0
          then array_append(history_dates, cycle_row.start_date)
        else '{}'::date[]
      end;
    else
      boundary_dates := array[cycle_row.start_date];
    end if;

    for escalation_row in
      select *
      from public.dose_escalations
      where cycle_id = cycle_row.id
      order by created_at, id
    loop
      escalation_date := case escalation_row.start_type
        when 'date' then escalation_row.start_date
        when 'after_days' then case
          when escalation_row.start_after_days is not null
            and escalation_row.start_after_days >= 0
            then cycle_row.start_date + escalation_row.start_after_days
        end
        when 'after_weeks' then case
          when escalation_row.start_after_days is not null
            and escalation_row.start_after_days >= 0
            then cycle_row.start_date + escalation_row.start_after_days
        end
      end;

      if escalation_date is not null
        and escalation_row.increase_amount <> 'NaN'::numeric then
        activation_snapshot := public.legacy_schedule_snapshot(
          cycle_row.id,
          escalation_date
        );
        if nullif(btrim(activation_snapshot ->> 'unit'), '') = btrim(escalation_row.unit) then
          boundary_dates := array_append(boundary_dates, escalation_date);
        end if;
      end if;
    end loop;

    for boundary in
      select distinct candidate
      from unnest(boundary_dates) candidate
      order by candidate
    loop
      snapshot := public.legacy_schedule_snapshot(cycle_row.id, boundary);
      if snapshot is null then
        continue;
      end if;

      base_dose := case
        when coalesce(snapshot ->> 'dose', '')
          ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
          then (snapshot ->> 'dose')::numeric
        else null
      end;

      select coalesce(sum(escalation.increase_amount), 0)
      into adjustment
      from public.dose_escalations escalation
      cross join lateral (
        select case escalation.start_type
          when 'date' then escalation.start_date
          when 'after_days' then case
            when escalation.start_after_days is not null
              and escalation.start_after_days >= 0
              then cycle_row.start_date + escalation.start_after_days
          end
          when 'after_weeks' then case
            when escalation.start_after_days is not null
              and escalation.start_after_days >= 0
              then cycle_row.start_date + escalation.start_after_days
          end
        end activation_date
      ) activation
      where escalation.cycle_id = cycle_row.id
        and activation.activation_date is not null
        and activation.activation_date <= boundary
        and escalation.increase_amount <> 'NaN'::numeric
        and btrim(escalation.unit) = nullif(btrim(snapshot ->> 'unit'), '')
        and btrim(escalation.unit) = nullif(btrim(
          public.legacy_schedule_snapshot(
            cycle_row.id,
            activation.activation_date
          ) ->> 'unit'
        ), '');

      adjusted_slot_doses := nullif(btrim(snapshot ->> 'slot_doses'), '');
      if adjusted_slot_doses is not null and adjustment <> 0 then
        select string_agg(
          case
            when btrim(slot.value) = '' then ''
            when btrim(slot.value) ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
              then trim_scale(btrim(slot.value)::numeric + adjustment)::text
            else slot.value
          end,
          ',' order by slot.position
        )
        into adjusted_slot_doses
        from unnest(string_to_array(adjusted_slot_doses, ','))
          with ordinality slot(value, position);
      end if;

      version_change_kind := case
        when boundary = (
          select min(candidate) from unnest(boundary_dates) candidate
        ) then 'initial'
        when boundary = any(history_dates) then 'schedule'
        else 'titration'
      end;

      insert into public.cycle_plan_versions (
        user_id, cycle_id, effective_kind, effective_at,
        effective_local_date, change_kind, frequency, x_days_interval,
        interval_unit, cycle_on_days, cycle_off_days, schedule_days,
        intake_time, intake_time_custom, slot_doses, slot_days,
        dose, unit, method
      ) values (
        cycle_row.user_id,
        cycle_row.id,
        'local_date',
        null,
        boundary,
        version_change_kind,
        coalesce(nullif(btrim(snapshot ->> 'frequency'), ''), cycle_row.frequency),
        case when coalesce(snapshot ->> 'x_days_interval', '') ~ '^[0-9]+$'
          then (snapshot ->> 'x_days_interval')::integer else null end,
        nullif(btrim(snapshot ->> 'interval_unit'), ''),
        case when coalesce(snapshot ->> 'cycle_on_days', '') ~ '^[0-9]+$'
          then (snapshot ->> 'cycle_on_days')::integer else null end,
        case when coalesce(snapshot ->> 'cycle_off_days', '') ~ '^[0-9]+$'
          then (snapshot ->> 'cycle_off_days')::integer else null end,
        case when jsonb_typeof(snapshot -> 'schedule_days') = 'array'
          then array(select jsonb_array_elements_text(snapshot -> 'schedule_days'))
          else '{}'::text[] end,
        coalesce(nullif(btrim(snapshot ->> 'intake_time'), ''), 'morgens'),
        nullif(btrim(snapshot ->> 'intake_time_custom'), ''),
        adjusted_slot_doses,
        nullif(btrim(snapshot ->> 'slot_days'), ''),
        case
          when base_dose is null then null
          when base_dose + adjustment > 0 then base_dose + adjustment
          else null
        end,
        nullif(btrim(snapshot ->> 'unit'), ''),
        coalesce(nullif(btrim(snapshot ->> 'method'), ''), cycle_row.method)
      )
      on conflict (cycle_id, effective_local_date)
        where effective_kind = 'local_date'
      do nothing;
    end loop;
  end loop;
end
$$;

insert into public.cycle_migration_conflicts (
  user_id, stack_item_id, cycle_ids
)
select
  user_id,
  stack_item_id,
  array_agg(id order by started_at, id)
from public.cycles
where ended_at is null or ended_at > transaction_timestamp() or timezone_review_required
group by user_id, stack_item_id
having count(*) > 1 or bool_or(timezone_review_required)
on conflict (user_id, stack_item_id) do update set
  cycle_ids = excluded.cycle_ids,
  resolved_at = null;

update public.stack_items item
set configuration_status = 'needs_review'
where exists (
  select 1
  from public.cycle_migration_conflicts conflict
  where conflict.user_id = item.user_id
    and conflict.stack_item_id = item.id
    and conflict.resolved_at is null
);

create or replace function public.resolve_cycle_course_timezone(
  p_stack_item_id uuid, p_timezone text, p_idempotency_key text
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  owner_id uuid := auth.uid();
  prior_result jsonb;
  result jsonb;
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'Idempotency key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text || ':resolve_cycle_course_timezone:' || p_idempotency_key, 0));
  select receipt.result into prior_result from public.plan_mutation_receipts receipt
  where user_id = owner_id and idempotency_key = p_idempotency_key and operation = 'resolve_cycle_course_timezone';
  if found then return prior_result; end if;
  perform 1 from public.stack_items where id = p_stack_item_id and user_id = owner_id for update;
  if not found then raise exception 'Stack item not found'; end if;
  if p_timezone is null or not exists(select from pg_timezone_names where name = p_timezone) then
    raise exception 'Valid course timezone is required';
  end if;
  perform id from public.cycles where stack_item_id = p_stack_item_id and user_id = owner_id order by id for update;
  if not exists(select from public.cycles where stack_item_id = p_stack_item_id and user_id = owner_id and timezone_review_required) then
    raise exception 'Course timezone review is not required';
  end if;
  update public.cycles set lifecycle_timezone = p_timezone, timezone_review_required = false,
    started_at = start_local_date::timestamp at time zone p_timezone,
    ended_at = case when end_local_date is not null then end_local_date::timestamp at time zone p_timezone
      when not active then coalesce(ended_at, transaction_timestamp()) else null end
  where stack_item_id = p_stack_item_id and user_id = owner_id and timezone_review_required;
  -- A timezone confirmation cannot implicitly choose among contradictory cycles.
  if (select count(*) from public.cycles where stack_item_id = p_stack_item_id and user_id = owner_id
    and (ended_at is null or ended_at > transaction_timestamp())) <= 1 then
    delete from public.cycle_migration_conflicts where stack_item_id = p_stack_item_id and user_id = owner_id;
    update public.stack_items set configuration_status = 'complete' where id = p_stack_item_id and user_id = owner_id;
  end if;
  result := jsonb_build_object('stack_item_id', p_stack_item_id, 'timezone', p_timezone);
  insert into public.plan_mutation_receipts(user_id,idempotency_key,operation,result)
  values(owner_id,p_idempotency_key,'resolve_cycle_course_timezone',result);
  return result;
end $$;
revoke all on function public.resolve_cycle_course_timezone(uuid,text,text) from public, anon;
grant execute on function public.resolve_cycle_course_timezone(uuid,text,text) to authenticated;

create or replace function public.resolve_cycle_migration_conflict(
  p_stack_item_id uuid,
  p_keep_cycle_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  conflict_row public.cycle_migration_conflicts;
  kept_cycle public.cycles;
  prior_result jsonb;
  mutation_result jsonb;
  mutation_time timestamptz;
  open_cycle_ids uuid[];
  operation_name constant text := 'resolve_cycle_migration_conflict';
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(owner_id::text || ':' || operation_name || ':' || p_idempotency_key, 0)
  );
  select result into prior_result
  from public.plan_mutation_receipts
  where user_id = owner_id
    and idempotency_key = p_idempotency_key
    and operation = operation_name;
  if found then
    return prior_result;
  end if;

  perform 1
  from public.stack_items
  where id = p_stack_item_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Stack item not found';
  end if;

  select * into conflict_row
  from public.cycle_migration_conflicts
  where user_id = owner_id
    and stack_item_id = p_stack_item_id
    and resolved_at is null
  for update;
  if not found then
    raise exception 'Migration conflict not found';
  end if;

  perform id
  from public.cycles
  where user_id = owner_id
    and stack_item_id = p_stack_item_id
  order by id
  for update;

  if exists (select from public.cycles where stack_item_id = p_stack_item_id
    and user_id = owner_id and timezone_review_required) then
    raise exception 'Course timezone review is required';
  end if;

  select * into kept_cycle
  from public.cycles
  where id = p_keep_cycle_id
    and user_id = owner_id
    and stack_item_id = p_stack_item_id
    and (ended_at is null or ended_at > transaction_timestamp())
    and id = any(conflict_row.cycle_ids);
  if not found then
    raise exception 'Selected cycle is not an open conflicted cycle';
  end if;

  select coalesce(array_agg(id order by id), '{}'::uuid[])
  into open_cycle_ids
  from public.cycles
  where user_id = owner_id
    and stack_item_id = p_stack_item_id
    and (ended_at is null or ended_at > transaction_timestamp());
  if not open_cycle_ids <@ conflict_row.cycle_ids then
    raise exception 'Open cycle set changed since migration conflict';
  end if;

  mutation_time := transaction_timestamp();
  update public.cycles
  set
    ended_at = mutation_time,
    end_local_date = null,
    end_date = mutation_time::date,
    active = false,
    closed_by_migration_resolution = true
  where user_id = owner_id
    and stack_item_id = p_stack_item_id
    and id = any(conflict_row.cycle_ids)
    and id <> p_keep_cycle_id
    and (ended_at is null or ended_at > transaction_timestamp());

  delete from public.cycle_migration_conflicts
  where id = conflict_row.id;

  update public.stack_items item
  set configuration_status = 'complete'
  where item.id = p_stack_item_id
    and item.user_id = owner_id
    and not exists (
      select 1
      from public.cycle_migration_conflicts remaining
      where remaining.user_id = owner_id
        and remaining.stack_item_id = p_stack_item_id
        and remaining.resolved_at is null
    );

  mutation_result := jsonb_build_object(
    'cycle_id', kept_cycle.id,
    'stack_item_id', kept_cycle.stack_item_id,
    'resolved_at', mutation_time
  );
  insert into public.plan_mutation_receipts (
    user_id, idempotency_key, operation, result
  ) values (
    owner_id, p_idempotency_key, operation_name, mutation_result
  );

  return mutation_result;
end
$$;

revoke all on function public.create_plan_version(
  uuid, text, timestamptz, date, text, jsonb, text
) from public, anon;
revoke all on function public.replace_future_plan_version(
  uuid, text, timestamptz, date, text, jsonb, text, text
) from public, anon;
revoke all on function public.remove_future_plan_version(uuid, text, text)
  from public, anon;
revoke all on function public.pause_cycle(uuid, timestamptz, text)
  from public, anon;
revoke all on function public.set_pause_end(uuid, timestamptz, text)
  from public, anon;
revoke all on function public.resume_cycle(uuid, text)
  from public, anon;
revoke all on function public.end_cycle(uuid, text)
  from public, anon;
revoke all on function public.restart_cycle(uuid, timestamptz, jsonb, text)
  from public, anon;
revoke all on function public.resolve_plan_version_id(uuid, timestamptz, text)
  from public, anon;
revoke all on function public.resolve_cycle_migration_conflict(uuid, uuid, text)
  from public, anon;

grant execute on function public.create_plan_version(
  uuid, text, timestamptz, date, text, jsonb, text
) to authenticated;
grant execute on function public.replace_future_plan_version(
  uuid, text, timestamptz, date, text, jsonb, text, text
) to authenticated;
grant execute on function public.remove_future_plan_version(uuid, text, text)
  to authenticated;
grant execute on function public.pause_cycle(uuid, timestamptz, text)
  to authenticated;
grant execute on function public.set_pause_end(uuid, timestamptz, text)
  to authenticated;
grant execute on function public.resume_cycle(uuid, text)
  to authenticated;
grant execute on function public.end_cycle(uuid, text)
  to authenticated;
grant execute on function public.restart_cycle(uuid, timestamptz, jsonb, text)
  to authenticated;
grant execute on function public.resolve_plan_version_id(uuid, timestamptz, text)
  to authenticated;
grant execute on function public.resolve_cycle_migration_conflict(uuid, uuid, text)
  to authenticated;

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
