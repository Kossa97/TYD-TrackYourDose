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
  if cycle_row.ended_at is not null then
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
  normalized jsonb;
  item_tracking_level text;
  prior_result jsonb;
  current_boundary timestamptz;
  replacement_boundary timestamptz;
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

  select * into version_row
  from public.cycle_plan_versions
  where id = p_version_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Plan version not found';
  end if;

  select * into cycle_row
  from public.cycles
  where id = version_row.cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  if cycle_row.ended_at is not null then
    raise exception 'Cycle is already ended';
  end if;
  if nullif(btrim(p_timezone), '') is null then
    raise exception 'Timezone is required';
  end if;

  current_boundary := case version_row.effective_kind
    when 'instant' then version_row.effective_at
    else version_row.effective_local_date::timestamp at time zone p_timezone
  end;
  if current_boundary <= transaction_timestamp() then
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
  if replacement_boundary <= transaction_timestamp() then
    raise exception 'Plan version is already effective';
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
  prior_result jsonb;
  mutation_result jsonb;
  current_boundary timestamptz;
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

  select * into version_row
  from public.cycle_plan_versions
  where id = p_version_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Plan version not found';
  end if;

  select * into cycle_row
  from public.cycles
  where id = version_row.cycle_id
    and user_id = owner_id
  for update;
  if not found then
    raise exception 'Cycle not found';
  end if;
  if cycle_row.ended_at is not null then
    raise exception 'Cycle is already ended';
  end if;
  if nullif(btrim(p_timezone), '') is null then
    raise exception 'Timezone is required';
  end if;

  current_boundary := case version_row.effective_kind
    when 'instant' then version_row.effective_at
    else version_row.effective_local_date::timestamp at time zone p_timezone
  end;
  if current_boundary <= transaction_timestamp() then
    raise exception 'Plan version is already effective';
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
  if cycle_row.ended_at is not null then
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
    and user_id = owner_id
  for update;
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
  if cycle_row.ended_at is not null then
    raise exception 'Cycle is already ended';
  end if;

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
  if cycle_row.ended_at is not null then
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
  if cycle_row.ended_at is not null then
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
  if source_cycle.ended_at is null then
    raise exception 'Cycle is not ended';
  end if;
  if p_started_at is null then
    raise exception 'Cycle start is required';
  end if;

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
    and ended_at is null
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
    started_at, ended_at, closed_by_migration_resolution
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
    p_started_at::date,
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
    false
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
