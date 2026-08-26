begin;

alter table public.stack_items
  add column if not exists tracking_level text not null default 'complete',
  add column if not exists pk_profile_method text;

alter table public.stack_items
  drop constraint if exists stack_items_tracking_level_check;

alter table public.stack_items
  add constraint stack_items_tracking_level_check
  check (tracking_level in ('intake_only', 'with_amount', 'complete'));

update public.stack_items
set tracking_level = 'complete'
where tracking_level is null;

update public.stack_items
set pk_profile_method = nullif(btrim(default_method), '')
where pk_profile_id is not null
  and pk_profile_method is null;

alter table public.cycles
  alter column dose drop not null,
  alter column unit drop not null;

alter table public.dose_logs
  alter column dose drop not null,
  alter column unit drop not null,
  add column if not exists routine_slot_key text;

create unique index if not exists dose_logs_routine_slot_unique
  on public.dose_logs (user_id, routine_slot_key)
  where routine_slot_key is not null;

alter table public.stack_item_ingredients
  alter column basis_value drop not null,
  alter column basis_unit drop not null;

alter table public.stack_item_ingredients
  drop constraint if exists stack_item_ingredients_basis_unit_check;

alter table public.stack_item_ingredients
  add constraint stack_item_ingredients_basis_unit_check
  check (basis_unit is null or nullif(btrim(basis_unit), '') is not null);

alter table public.stack_item_ingredients
  drop constraint if exists stack_item_ingredients_name_check;

alter table public.stack_item_ingredients
  add constraint stack_item_ingredients_name_check check (
    catalog_substance_id is not null
    or nullif(btrim(custom_name), '') is not null
  );

create table if not exists public.stack_item_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_item_id uuid not null unique references public.stack_items(id) on delete cascade,
  enabled boolean not null default false,
  package_quantity numeric,
  package_unit text,
  remaining_quantity numeric,
  batch_number text,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (
      package_quantity > 0
      and package_quantity <= '1000000000'::numeric
      and nullif(btrim(package_unit), '') is not null
      and remaining_quantity >= 0
      and remaining_quantity <= '1000000000'::numeric
    )
  )
);

create table if not exists public.stack_item_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_id uuid not null references public.stack_item_inventory(id) on delete cascade,
  dose_log_id uuid not null unique references public.dose_logs(id) on delete cascade,
  delta_quantity numeric not null check (
    delta_quantity > 0 and delta_quantity <= '1000000000'::numeric
  ),
  created_at timestamptz not null default now()
);

alter table public.stack_item_inventory_movements
  add column if not exists source_dose_log_id uuid,
  add column if not exists applied boolean not null default true,
  add column if not exists reversal_count integer not null default 0,
  add column if not exists last_reversed_at timestamptz,
  add column if not exists last_reversal_action text;

update public.stack_item_inventory_movements
set source_dose_log_id = dose_log_id
where source_dose_log_id is null;

alter table public.stack_item_inventory_movements
  alter column source_dose_log_id set not null,
  alter column dose_log_id drop not null,
  drop constraint if exists stack_item_inventory_movements_dose_log_id_fkey;

alter table public.stack_item_inventory_movements
  add constraint stack_item_inventory_movements_dose_log_id_fkey
  foreign key (dose_log_id) references public.dose_logs(id) on delete set null;

create unique index if not exists stack_item_inventory_movements_source_unique
  on public.stack_item_inventory_movements (user_id, source_dose_log_id);

create table if not exists public.vial_stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_item_id uuid not null references public.stack_items(id) on delete cascade,
  dose_log_id uuid unique references public.dose_logs(id) on delete set null,
  source_dose_log_id uuid not null,
  delta_vials numeric not null check (
    delta_vials >= 0 and delta_vials <= '1000000000'::numeric
  ),
  applied boolean not null default true,
  reversal_count integer not null default 0,
  last_reversed_at timestamptz,
  last_reversal_action text,
  created_at timestamptz not null default now()
);

alter table public.vial_stock_movements
  add column if not exists applied boolean not null default true,
  add column if not exists reversal_count integer not null default 0,
  add column if not exists last_reversed_at timestamptz,
  add column if not exists last_reversal_action text;

create unique index if not exists vial_stock_movements_source_unique
  on public.vial_stock_movements (user_id, source_dose_log_id);

alter table public.stack_item_inventory enable row level security;
alter table public.stack_item_inventory_movements enable row level security;
alter table public.vial_stock_movements enable row level security;

drop policy if exists "own stack item inventory select" on public.stack_item_inventory;
create policy "own stack item inventory select" on public.stack_item_inventory
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own stack item inventory insert" on public.stack_item_inventory;
create policy "own stack item inventory insert" on public.stack_item_inventory
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.stack_items owned_item
      where owned_item.id = stack_item_id
        and owned_item.user_id = auth.uid()
    )
  );
drop policy if exists "own stack item inventory update" on public.stack_item_inventory;
create policy "own stack item inventory update" on public.stack_item_inventory
  for update to authenticated using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.stack_items owned_item
      where owned_item.id = stack_item_id
        and owned_item.user_id = auth.uid()
    )
  );
drop policy if exists "own stack item inventory delete" on public.stack_item_inventory;
create policy "own stack item inventory delete" on public.stack_item_inventory
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "own stack item inventory movements select" on public.stack_item_inventory_movements;
create policy "own stack item inventory movements select" on public.stack_item_inventory_movements
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own stack item inventory movements insert" on public.stack_item_inventory_movements;
create policy "own stack item inventory movements insert" on public.stack_item_inventory_movements
  for insert to authenticated with check (
    auth.uid() = user_id
    and source_dose_log_id = dose_log_id
    and exists (
      select 1 from public.stack_item_inventory owned_inventory
      where owned_inventory.id = inventory_id
        and owned_inventory.user_id = auth.uid()
    )
    and exists (
      select 1 from public.dose_logs owned_log
      where owned_log.id = dose_log_id
        and owned_log.user_id = auth.uid()
    )
  );
drop policy if exists "own stack item inventory movements update" on public.stack_item_inventory_movements;
create policy "own stack item inventory movements update" on public.stack_item_inventory_movements
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own vial stock movements select" on public.vial_stock_movements;
create policy "own vial stock movements select" on public.vial_stock_movements
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own vial stock movements insert" on public.vial_stock_movements;
create policy "own vial stock movements insert" on public.vial_stock_movements
  for insert to authenticated with check (
    auth.uid() = user_id
    and source_dose_log_id = dose_log_id
    and exists (
      select 1 from public.stack_items owned_item
      where owned_item.id = stack_item_id
        and owned_item.user_id = auth.uid()
    )
    and exists (
      select 1 from public.dose_logs owned_log
      where owned_log.id = dose_log_id
        and owned_log.user_id = auth.uid()
    )
  );
drop policy if exists "own vial stock movements update" on public.vial_stock_movements;
create policy "own vial stock movements update" on public.vial_stock_movements
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.stack_item_inventory from public, anon;
revoke all on table public.stack_item_inventory_movements from public, anon;
revoke all on table public.vial_stock_movements from public, anon;
grant select, insert, update, delete on table public.stack_item_inventory to authenticated;
grant select, insert, update on table public.stack_item_inventory_movements to authenticated;
grant select, insert, update on table public.vial_stock_movements to authenticated;

create or replace function public.enforce_stack_item_completeness()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item_id_to_check uuid;
  item_ids_to_check uuid[];
begin
  if tg_table_name = 'stack_items' then
    item_ids_to_check := array[new.id];
  elsif tg_op = 'DELETE' then
    item_ids_to_check := array[old.stack_item_id];
  elsif tg_op = 'UPDATE' and old.stack_item_id is distinct from new.stack_item_id then
    item_ids_to_check := array[old.stack_item_id, new.stack_item_id];
  else
    item_ids_to_check := array[new.stack_item_id];
  end if;

  select array_agg(distinct affected_item_id order by affected_item_id)
  into item_ids_to_check
  from unnest(item_ids_to_check) affected_item_id
  where affected_item_id is not null;

  perform 1
  from public.stack_items item
  where item.id = any(item_ids_to_check)
  order by item.id
  for update;

  foreach item_id_to_check in array item_ids_to_check
  loop
    if exists (
      select 1
      from public.stack_items item
      where item.id = item_id_to_check
        and item.tracking_level = 'complete'
    ) then
      if not exists (
        select 1
        from public.stack_item_ingredients ingredient
        where ingredient.stack_item_id = item_id_to_check
      ) then
        raise exception 'Complete stack item requires at least one ingredient';
      end if;

      if exists (
        select 1
        from public.stack_item_ingredients ingredient
        where ingredient.stack_item_id = item_id_to_check
          and (
            ingredient.amount_value is null or not (
              ingredient.amount_value > 0
              and ingredient.amount_value < 'Infinity'::numeric
            )
            or nullif(btrim(ingredient.amount_unit), '') is null
            or ingredient.basis_value is null or not (
              ingredient.basis_value > 0
              and ingredient.basis_value < 'Infinity'::numeric
            )
            or nullif(btrim(ingredient.basis_unit), '') is null
          )
      ) then
        raise exception 'Complete stack item requires complete ingredients';
      end if;
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists stack_items_completeness_check on public.stack_items;

create constraint trigger stack_items_completeness_check
after insert or update of configuration_status, tracking_level on public.stack_items
deferrable initially deferred
for each row execute function public.enforce_stack_item_completeness();

drop trigger if exists stack_item_ingredients_completeness_check on public.stack_item_ingredients;

create constraint trigger stack_item_ingredients_completeness_check
after insert or update or delete on public.stack_item_ingredients
deferrable initially deferred
for each row execute function public.enforce_stack_item_completeness();

create or replace function public.save_stack_item(p_item jsonb, p_ingredients jsonb)
returns public.stack_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_item public.stack_items;
  ingredient jsonb;
  item_id uuid;
  owner_id uuid := auth.uid();
  item_category text := nullif(btrim(p_item ->> 'category'), '');
  item_dosage_form text := nullif(btrim(p_item ->> 'dosage_form'), '');
  item_tracking_level text := coalesce(
    nullif(btrim(p_item ->> 'tracking_level'), ''),
    'complete'
  );
  inventory_payload jsonb := coalesce(p_item -> 'inventory', '{}'::jsonb);
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(btrim(p_item ->> 'display_name'), '') is null then
    raise exception 'Display name is required';
  end if;

  if item_category is null or item_category not in (
    'peptide', 'medication', 'hormone', 'supplement', 'vitamin'
  ) then
    raise exception 'Invalid category';
  end if;

  if item_dosage_form is null or item_dosage_form not in (
    'vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops', 'liquid',
    'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube', 'other'
  ) then
    raise exception 'Invalid dosage form';
  end if;

  if item_tracking_level is null or item_tracking_level not in (
    'intake_only', 'with_amount', 'complete'
  ) then
    raise exception 'Invalid tracking level';
  end if;

  if p_ingredients is null
    or jsonb_typeof(p_ingredients) <> 'array'
    or jsonb_array_length(p_ingredients) = 0 then
    raise exception 'At least one ingredient is required';
  end if;

  if nullif(p_item ->> 'id', '') is not null then
    item_id := (p_item ->> 'id')::uuid;

    perform 1
    from public.stack_items
    where id = item_id
      and user_id = owner_id;

    if not found then
      raise exception 'Stack item not found';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_ingredients) row_value
    where row_value ->> 'position' is null
      or (row_value ->> 'position')::integer < 0
      or (
        nullif(btrim(row_value ->> 'catalog_substance_id'), '') is null
        and nullif(btrim(row_value ->> 'custom_name'), '') is null
      )
  ) then
    raise exception 'Invalid ingredient';
  end if;

  if (
    select count(*) <> count(distinct row_value ->> 'position')
    from jsonb_array_elements(p_ingredients) row_value
  ) then
    raise exception 'Ingredient positions must be unique';
  end if;

  if item_tracking_level = 'complete' and exists (
    select 1
    from jsonb_array_elements(p_ingredients) row_value
    where row_value ->> 'amount_value' is null
      or not (
        (row_value ->> 'amount_value')::numeric > 0
        and (row_value ->> 'amount_value')::numeric <= '1000000000'::numeric
      )
      or nullif(btrim(row_value ->> 'amount_unit'), '') is null
      or row_value ->> 'basis_value' is null
      or not (
        (row_value ->> 'basis_value')::numeric > 0
        and (row_value ->> 'basis_value')::numeric <= '1000000000'::numeric
      )
      or nullif(btrim(row_value ->> 'basis_unit'), '') is null
  ) then
    raise exception 'Complete tracking requires strength and basis';
  end if;

  if item_id is null then
    insert into public.stack_items (
      user_id,
      display_name,
      category,
      tracking_level,
      dosage_form,
      brand,
      color_hex,
      notes,
      pk_profile_method,
      configuration_status
    ) values (
      owner_id,
      btrim(p_item ->> 'display_name'),
      item_category,
      item_tracking_level,
      item_dosage_form,
      nullif(btrim(p_item ->> 'brand'), ''),
      nullif(btrim(p_item ->> 'color_hex'), ''),
      nullif(p_item ->> 'notes', ''),
      nullif(btrim(p_item ->> 'pk_profile_method'), ''),
      'complete'
    )
    returning * into saved_item;

    item_id := saved_item.id;
  else
    update public.stack_items
    set
      display_name = btrim(p_item ->> 'display_name'),
      category = item_category,
      tracking_level = item_tracking_level,
      dosage_form = item_dosage_form,
      brand = nullif(btrim(p_item ->> 'brand'), ''),
      color_hex = nullif(btrim(p_item ->> 'color_hex'), ''),
      notes = nullif(p_item ->> 'notes', ''),
      pk_profile_method = nullif(btrim(p_item ->> 'pk_profile_method'), ''),
      configuration_status = 'complete'
    where id = item_id
      and user_id = owner_id
    returning * into saved_item;

    delete from public.stack_item_ingredients
    where stack_item_id = item_id;
  end if;

  for ingredient in
    select value
    from jsonb_array_elements(p_ingredients)
  loop
    insert into public.stack_item_ingredients (
      stack_item_id,
      catalog_substance_id,
      custom_name,
      amount_value,
      amount_unit,
      basis_value,
      basis_unit,
      position
    ) values (
      item_id,
      nullif(btrim(ingredient ->> 'catalog_substance_id'), '')::uuid,
      nullif(btrim(ingredient ->> 'custom_name'), ''),
      case
        when item_tracking_level = 'complete'
          or (
            nullif(ingredient ->> 'amount_value', '')::numeric > 0
            and nullif(ingredient ->> 'amount_value', '')::numeric <= '1000000000'::numeric
            and nullif(btrim(ingredient ->> 'amount_unit'), '') is not null
          )
          then nullif(ingredient ->> 'amount_value', '')::numeric
      end,
      case
        when item_tracking_level = 'complete'
          or (
            nullif(ingredient ->> 'amount_value', '')::numeric > 0
            and nullif(ingredient ->> 'amount_value', '')::numeric <= '1000000000'::numeric
            and nullif(btrim(ingredient ->> 'amount_unit'), '') is not null
          )
          then nullif(btrim(ingredient ->> 'amount_unit'), '')
      end,
      case
        when item_tracking_level = 'complete'
          or (
            nullif(ingredient ->> 'basis_value', '')::numeric > 0
            and nullif(ingredient ->> 'basis_value', '')::numeric <= '1000000000'::numeric
            and nullif(btrim(ingredient ->> 'basis_unit'), '') is not null
          )
          then nullif(ingredient ->> 'basis_value', '')::numeric
      end,
      case
        when item_tracking_level = 'complete'
          or (
            nullif(ingredient ->> 'basis_value', '')::numeric > 0
            and nullif(ingredient ->> 'basis_value', '')::numeric <= '1000000000'::numeric
            and nullif(btrim(ingredient ->> 'basis_unit'), '') is not null
          )
          then nullif(btrim(ingredient ->> 'basis_unit'), '')
      end,
      (ingredient ->> 'position')::integer
    );
  end loop;

  if item_tracking_level = 'complete'
    and coalesce((inventory_payload ->> 'enabled')::boolean, false) then
    if nullif(inventory_payload ->> 'package_quantity', '')::numeric is null
      or nullif(inventory_payload ->> 'package_quantity', '')::numeric <= 0
      or nullif(inventory_payload ->> 'package_quantity', '')::numeric > '1000000000'::numeric
      or nullif(btrim(inventory_payload ->> 'package_unit'), '') is null
      or nullif(inventory_payload ->> 'remaining_quantity', '')::numeric is null
      or nullif(inventory_payload ->> 'remaining_quantity', '')::numeric < 0
      or nullif(inventory_payload ->> 'remaining_quantity', '')::numeric > '1000000000'::numeric then
      raise exception 'Enabled inventory requires package quantity, unit, and remaining quantity';
    end if;

    insert into public.stack_item_inventory (
      user_id,
      stack_item_id,
      enabled,
      package_quantity,
      package_unit,
      remaining_quantity,
      batch_number,
      expires_at,
      updated_at
    ) values (
      owner_id,
      item_id,
      true,
      (inventory_payload ->> 'package_quantity')::numeric,
      btrim(inventory_payload ->> 'package_unit'),
      (inventory_payload ->> 'remaining_quantity')::numeric,
      nullif(btrim(inventory_payload ->> 'batch_number'), ''),
      nullif(inventory_payload ->> 'expires_at', '')::date,
      now()
    )
    on conflict (stack_item_id) do update set
      enabled = excluded.enabled,
      package_quantity = excluded.package_quantity,
      package_unit = excluded.package_unit,
      remaining_quantity = excluded.remaining_quantity,
      batch_number = excluded.batch_number,
      expires_at = excluded.expires_at,
      updated_at = now()
    where public.stack_item_inventory.user_id = owner_id;
  else
    update public.stack_item_inventory
    set enabled = false,
      updated_at = now()
    where stack_item_id = item_id
      and user_id = owner_id;
  end if;

  return saved_item;
end;
$$;

revoke execute on function public.save_stack_item(jsonb, jsonb) from public, anon;
grant execute on function public.save_stack_item(jsonb, jsonb) to authenticated;

create or replace function public.save_stack_item_with_plan(
  p_item jsonb,
  p_ingredients jsonb,
  p_plan jsonb
)
returns public.stack_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_item public.stack_items;
  cycle_row public.cycles;
  owner_id uuid := auth.uid();
  plan_id uuid;
  plan_name text := nullif(btrim(p_plan ->> 'name'), '');
  plan_dose numeric;
  plan_unit text;
  plan_method text := nullif(btrim(p_plan ->> 'method'), '');
  plan_frequency text := nullif(btrim(p_plan ->> 'frequency'), '');
  plan_interval integer;
  plan_interval_value numeric;
  plan_schedule_days text[];
  schedule_day_count integer;
  schedule_day_unique_count integer;
  schedule_days_valid boolean;
  plan_effective_date date;
  plan_end_date date := nullif(p_plan ->> 'end_date', '')::date;
  plan_intake_time text := nullif(btrim(p_plan ->> 'intake_time'), '');
  plan_intake_time_custom text := nullif(btrim(p_plan ->> 'intake_time_custom'), '');
  plan_reminder text := coalesce(nullif(btrim(p_plan ->> 'reminder'), ''), 'none');
  schedule_changed boolean;
  next_history jsonb;
  previous_segment jsonb;
  next_segment jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    raise exception 'Invalid plan';
  end if;

  saved_item := public.save_stack_item(p_item, p_ingredients);

  if plan_name is null then
    raise exception 'Plan name is required';
  end if;
  if plan_method is null then
    raise exception 'Plan method is required';
  end if;
  if plan_frequency is null then
    raise exception 'Plan frequency is required';
  end if;
  if nullif(p_plan ->> 'start_date', '') is null then
    raise exception 'Plan start date is required';
  end if;
  plan_effective_date := (p_plan ->> 'start_date')::date;
  if plan_intake_time is null or plan_intake_time not in ('morgens', 'mittags', 'abends') then
    raise exception 'Invalid plan intake time';
  end if;

  if jsonb_typeof(p_plan -> 'schedule_days') = 'array' then
    select coalesce(array_agg(value), '{}'::text[])
    into plan_schedule_days
    from jsonb_array_elements_text(p_plan -> 'schedule_days') value;
  else
    plan_schedule_days := '{}'::text[];
  end if;

  if plan_frequency = 'Alle X Tage' then
    if coalesce(p_plan ->> 'x_days_interval', '') !~ '^[0-9]+$' then
      raise exception 'Every-X-days frequency requires a whole-day interval';
    end if;
    plan_interval_value := (p_plan ->> 'x_days_interval')::numeric;
    if not (plan_interval_value between 2 and 30) then
      raise exception 'Every-X-days interval must be between 2 and 30';
    end if;
    plan_interval := plan_interval_value::integer;
  else
    plan_interval := null;
  end if;

  if plan_frequency = 'Wochentage wählen' then
    select count(*), count(distinct weekday),
      coalesce(bool_and(weekday = any(array['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']::text[])), false)
    into schedule_day_count, schedule_day_unique_count, schedule_days_valid
    from unnest(plan_schedule_days) weekday;
    if schedule_day_count = 0
      or schedule_day_count <> schedule_day_unique_count
      or not schedule_days_valid then
      raise exception 'Weekday frequency requires valid unique weekdays';
    end if;
  end if;

  if saved_item.tracking_level = 'intake_only' then
    plan_dose := null;
    plan_unit := null;
  elsif saved_item.tracking_level in ('with_amount', 'complete') then
    plan_dose := nullif(p_plan ->> 'dose', '')::numeric;
    plan_unit := nullif(btrim(p_plan ->> 'unit'), '');
    if plan_dose is null
      or not (plan_dose > 0 and plan_dose <= '1000000000'::numeric)
      or plan_unit is null then
      raise exception 'Tracked quantity requires a positive dose and unit';
    end if;
  end if;

  if nullif(p_plan ->> 'id', '') is null then
    insert into public.cycles (
      user_id,
      stack_item_id,
      name,
      dose,
      unit,
      method,
      frequency,
      x_days_interval,
      schedule_days,
      start_date,
      end_date,
      active,
      intake_time,
      intake_time_custom,
      reminder
    ) values (
      owner_id,
      saved_item.id,
      plan_name,
      plan_dose,
      plan_unit,
      plan_method,
      plan_frequency,
      plan_interval,
      plan_schedule_days,
      plan_effective_date,
      plan_end_date,
      true,
      plan_intake_time,
      plan_intake_time_custom,
      plan_reminder
    );
  else
    plan_id := (p_plan ->> 'id')::uuid;

    select *
    into cycle_row
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

    schedule_changed := cycle_row.frequency is distinct from plan_frequency
      or cycle_row.x_days_interval is distinct from plan_interval
      or coalesce(cycle_row.schedule_days, '{}'::text[]) is distinct from plan_schedule_days
      or cycle_row.intake_time is distinct from plan_intake_time
      or cycle_row.intake_time_custom is distinct from plan_intake_time_custom
      or cycle_row.dose is distinct from plan_dose
      or cycle_row.unit is distinct from plan_unit;

    if schedule_changed then
      previous_segment := jsonb_build_object(
        'effective_from', cycle_row.start_date,
        'frequency', cycle_row.frequency,
        'x_days_interval', cycle_row.x_days_interval,
        'schedule_days', cycle_row.schedule_days,
        'intake_time', cycle_row.intake_time,
        'intake_time_custom', cycle_row.intake_time_custom,
        'dose', cycle_row.dose,
        'unit', cycle_row.unit
      );
      next_segment := jsonb_build_object(
        'effective_from', plan_effective_date,
        'frequency', plan_frequency,
        'x_days_interval', plan_interval,
        'schedule_days', plan_schedule_days,
        'intake_time', plan_intake_time,
        'intake_time_custom', plan_intake_time_custom,
        'dose', plan_dose,
        'unit', plan_unit
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
      dose = plan_dose,
      unit = plan_unit,
      method = plan_method,
      frequency = plan_frequency,
      x_days_interval = plan_interval,
      schedule_days = plan_schedule_days,
      end_date = plan_end_date,
      intake_time = plan_intake_time,
      intake_time_custom = plan_intake_time_custom,
      reminder = plan_reminder,
      schedule_history = next_history
    where id = plan_id
      and stack_item_id = saved_item.id
      and user_id = owner_id;
  end if;

  return saved_item;
end;
$$;

revoke execute on function public.save_stack_item_with_plan(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_stack_item_with_plan(jsonb, jsonb, jsonb) to authenticated;

create or replace function public.confirm_intake_group(p_entries jsonb)
returns setof public.dose_logs
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  entry jsonb;
  saved_log public.dose_logs;
  entry_cycle_id uuid;
  entry_dose_log_id uuid;
  entry_slot_key text;
  entry_stack_item_id uuid;
  entry_dose numeric;
  entry_unit text;
  entry_method text;
  entry_logged_at timestamptz;
  item_tracking_level text;
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

  for entry in
    select value
    from jsonb_array_elements(p_entries)
  loop
    entry_cycle_id := nullif(btrim(entry ->> 'cycle_id'), '')::uuid;
    entry_dose_log_id := nullif(btrim(entry ->> 'dose_log_id'), '')::uuid;
    entry_slot_key := nullif(btrim(entry ->> 'slot_key'), '');
    entry_stack_item_id := nullif(btrim(entry ->> 'stack_item_id'), '')::uuid;
    entry_unit := nullif(btrim(entry ->> 'unit'), '');
    entry_method := coalesce(entry ->> 'method', '');
    entry_logged_at := nullif(btrim(entry ->> 'logged_at'), '')::timestamptz;

    if entry -> 'dose' is null or entry -> 'dose' = 'null'::jsonb then
      entry_dose := null;
    elsif jsonb_typeof(entry -> 'dose') = 'number' then
      entry_dose := (entry ->> 'dose')::numeric;
    else
      raise exception 'Dose must be a number or null';
    end if;

    if entry_cycle_id is null
      or entry_slot_key is null
      or entry_stack_item_id is null
      or entry_logged_at is null then
      raise exception 'Cycle, slot key, stack item, and logged_at are required';
    end if;
    if (entry_dose is null) <> (entry_unit is null) then
      raise exception 'Dose and unit must both be supplied or both be null';
    end if;
    if entry_dose is not null
      and not (entry_dose > 0 and entry_dose <= '1000000000'::numeric) then
      raise exception 'Dose must be positive';
    end if;

    select item.tracking_level
    into item_tracking_level
    from public.cycles cycle
    join public.stack_items item on item.id = cycle.stack_item_id
    where cycle.id = entry_cycle_id
      and cycle.stack_item_id = entry_stack_item_id
      and cycle.user_id = owner_id
      and item.user_id = owner_id;

    if not found then
      raise exception 'Intake cycle not found';
    end if;
    if item_tracking_level = 'intake_only' then
      if entry_dose is not null then
        raise exception 'Intake-only entries cannot store a quantity';
      end if;
    elsif entry_dose is null then
      raise exception 'Tracked entries require dose and unit';
    end if;

    select *
    into saved_log
    from public.dose_logs
    where routine_slot_key = entry_slot_key
      and user_id = owner_id;

    if found then
      if saved_log.stack_item_id <> entry_stack_item_id
        or saved_log.logged_at <> entry_logged_at
        or saved_log.taken is false
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
        and logged_at = entry_logged_at;

      if not found then
        raise exception 'Pending dose log not found';
      end if;
    end if;
  end loop;

  for entry in
    select value
    from jsonb_array_elements(p_entries)
  loop
    entry_cycle_id := nullif(btrim(entry ->> 'cycle_id'), '')::uuid;
    entry_dose_log_id := nullif(btrim(entry ->> 'dose_log_id'), '')::uuid;
    entry_slot_key := nullif(btrim(entry ->> 'slot_key'), '');
    entry_stack_item_id := nullif(btrim(entry ->> 'stack_item_id'), '')::uuid;
    entry_unit := nullif(btrim(entry ->> 'unit'), '');
    entry_method := coalesce(entry ->> 'method', '');
    entry_logged_at := nullif(btrim(entry ->> 'logged_at'), '')::timestamptz;
    if entry -> 'dose' is null or entry -> 'dose' = 'null'::jsonb then
      entry_dose := null;
    else
      entry_dose := (entry ->> 'dose')::numeric;
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
        dose = entry_dose,
        unit = entry_unit,
        method = entry_method,
        logged_at = entry_logged_at,
        routine_slot_key = entry_slot_key,
        taken = true
      where id = entry_dose_log_id
        and user_id = owner_id
        and stack_item_id = entry_stack_item_id
        and taken is null
        and logged_at = entry_logged_at
      returning * into saved_log;
    elsif not found then
      insert into public.dose_logs (
        user_id,
        stack_item_id,
        dose,
        unit,
        method,
        logged_at,
        routine_slot_key,
        taken
      ) values (
        owner_id,
        entry_stack_item_id,
        entry_dose,
        entry_unit,
        entry_method,
        entry_logged_at,
        entry_slot_key,
        true
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
      or saved_log.logged_at <> entry_logged_at
      or saved_log.taken is false
      or (entry_dose_log_id is not null and saved_log.id <> entry_dose_log_id) then
      raise exception 'Routine slot key belongs to another intake';
    end if;

    update public.dose_logs
    set
      dose = entry_dose,
      unit = entry_unit,
      method = entry_method,
      logged_at = entry_logged_at,
      routine_slot_key = entry_slot_key,
      taken = true
    where id = saved_log.id
      and user_id = owner_id
    returning * into saved_log;

    return next saved_log;
  end loop;
end;
$$;

revoke execute on function public.confirm_intake_group(jsonb) from public, anon;
grant execute on function public.confirm_intake_group(jsonb) to authenticated;

create or replace function public.apply_inventory_confirmation(p_dose_log_id uuid)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  log public.dose_logs;
  item public.stack_items;
  inventory_row public.stack_item_inventory;
  movement public.stack_item_inventory_movements;
  vial_movement public.vial_stock_movements;
  ingredient_count integer;
  convertible_count integer;
  minimum_delta numeric;
  maximum_delta numeric;
  actual_delta numeric;
  vial_delta numeric;
  actual_vial_delta numeric;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into log
  from public.dose_logs
  where id = p_dose_log_id
    and user_id = owner_id
    and taken is true
  for update;

  if not found then
    raise exception 'Confirmed dose log not found';
  end if;

  select *
  into item
  from public.stack_items
  where id = log.stack_item_id
    and user_id = owner_id
  for update;

  if not found then
    raise exception 'Stack item not found';
  end if;

  if item.dosage_form = 'vial' then
    select *
    into vial_movement
    from public.vial_stock_movements
    where source_dose_log_id = p_dose_log_id
      and user_id = owner_id
    for update;

    if found then
      if vial_movement.applied then
        return item.vials_in_stock;
      end if;

      actual_vial_delta := least(coalesce(item.vials_in_stock, 0), vial_movement.delta_vials);

      update public.stack_items
      set vials_in_stock = round(greatest(0, coalesce(vials_in_stock, 0) - actual_vial_delta), 4)
      where id = item.id
        and user_id = owner_id
      returning vials_in_stock into item.vials_in_stock;

      update public.vial_stock_movements
      set
        dose_log_id = p_dose_log_id,
        delta_vials = actual_vial_delta,
        applied = true
      where id = vial_movement.id
        and user_id = owner_id;

      return item.vials_in_stock;
    end if;

    if log.dose is null or log.unit is null or log.dose <= 0 then
      raise exception 'Vial stock conversion is ambiguous or unsupported';
    end if;

    if lower(log.unit) = 'ml' then
      if item.reconstitution_ml is null or item.reconstitution_ml <= 0 then
        raise exception 'Vial stock conversion is ambiguous or unsupported';
      end if;
      vial_delta := log.dose / item.reconstitution_ml;
    elsif lower(log.unit) in ('mg', 'mcg') then
      if item.vial_amount_mg is null or item.vial_amount_mg <= 0 then
        raise exception 'Vial stock conversion is ambiguous or unsupported';
      end if;
      vial_delta := case
        when lower(log.unit) = 'mcg' then log.dose / 1000
        else log.dose
      end / item.vial_amount_mg;
    else
      raise exception 'Vial stock conversion is ambiguous or unsupported';
    end if;

    if not (vial_delta > 0 and vial_delta <= '1000000000'::numeric) then
      raise exception 'Vial stock conversion is ambiguous or unsupported';
    end if;

    actual_vial_delta := least(coalesce(item.vials_in_stock, 0), vial_delta);

    insert into public.vial_stock_movements (
      user_id,
      stack_item_id,
      dose_log_id,
      source_dose_log_id,
      delta_vials,
      applied
    ) values (
      owner_id,
      item.id,
      p_dose_log_id,
      p_dose_log_id,
      actual_vial_delta,
      true
    );

    update public.stack_items
    set vials_in_stock = round(greatest(0, coalesce(vials_in_stock, 0) - actual_vial_delta), 4)
    where id = item.id
      and user_id = owner_id
    returning vials_in_stock into item.vials_in_stock;

    return item.vials_in_stock;
  end if;

  if item.tracking_level <> 'complete' then
    return null;
  end if;

  select *
  into inventory_row
  from public.stack_item_inventory
  where stack_item_id = item.id
    and user_id = owner_id
  for update;

  if not found then
    return null;
  end if;
  if not inventory_row.enabled then
    return inventory_row.remaining_quantity;
  end if;

  select *
  into movement
  from public.stack_item_inventory_movements
  where source_dose_log_id = p_dose_log_id
    and user_id = owner_id
  for update;

  if found then
    if movement.applied then
      return inventory_row.remaining_quantity;
    end if;
    if inventory_row.remaining_quantity < movement.delta_quantity then
      raise exception 'Insufficient inventory for confirmation';
    end if;

    update public.stack_item_inventory
    set
      remaining_quantity = remaining_quantity - movement.delta_quantity,
      updated_at = now()
    where id = inventory_row.id
      and user_id = owner_id
    returning remaining_quantity into inventory_row.remaining_quantity;

    update public.stack_item_inventory_movements
    set
      dose_log_id = p_dose_log_id,
      applied = true
    where id = movement.id
      and user_id = owner_id;

    return inventory_row.remaining_quantity;
  end if;

  if log.dose is null
    or log.unit is null
    or log.dose <= 0
    or log.dose > '1000000000'::numeric then
    raise exception 'Inventory conversion is ambiguous or unsupported';
  end if;

  with ingredient_deltas as (
    select case
      when ingredient.basis_unit = inventory_row.package_unit
        and log.unit = ingredient.basis_unit
        then log.dose
      when ingredient.basis_unit = inventory_row.package_unit
        and log.unit = ingredient.amount_unit
        then log.dose / ingredient.amount_value * ingredient.basis_value
      when ingredient.basis_unit = inventory_row.package_unit
        and log.unit = 'mg' and ingredient.amount_unit = 'mcg'
        then log.dose * 1000 / ingredient.amount_value * ingredient.basis_value
      when ingredient.basis_unit = inventory_row.package_unit
        and log.unit = 'mcg' and ingredient.amount_unit = 'mg'
        then log.dose / 1000 / ingredient.amount_value * ingredient.basis_value
    end as delta
    from public.stack_item_ingredients ingredient
    where ingredient.stack_item_id = item.id
  )
  select count(*), count(delta), min(delta), max(delta)
  into ingredient_count, convertible_count, minimum_delta, maximum_delta
  from ingredient_deltas;

  if ingredient_count = 0
    or convertible_count <> ingredient_count
    or minimum_delta is null
    or minimum_delta <= 0
    or maximum_delta > '1000000000'::numeric
    or minimum_delta is distinct from maximum_delta then
    raise exception 'Inventory conversion is ambiguous or unsupported';
  end if;

  actual_delta := least(inventory_row.remaining_quantity, minimum_delta);
  if actual_delta <= 0 then
    raise exception 'Insufficient inventory for confirmation';
  end if;

  insert into public.stack_item_inventory_movements (
    user_id,
    inventory_id,
    dose_log_id,
    source_dose_log_id,
    delta_quantity,
    applied
  ) values (
    owner_id,
    inventory_row.id,
    p_dose_log_id,
    p_dose_log_id,
    actual_delta,
    true
  );

  update public.stack_item_inventory
  set
    remaining_quantity = remaining_quantity - actual_delta,
    updated_at = now()
  where id = inventory_row.id
    and user_id = owner_id
  returning remaining_quantity into inventory_row.remaining_quantity;

  return inventory_row.remaining_quantity;
end;
$$;

revoke execute on function public.apply_inventory_confirmation(uuid) from public, anon;
grant execute on function public.apply_inventory_confirmation(uuid) to authenticated;

drop function if exists public.reverse_inventory_confirmation(uuid, boolean, boolean);

create or replace function public.reverse_inventory_confirmation(
  p_dose_log_id uuid,
  p_action text
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  log public.dose_logs;
  movement public.stack_item_inventory_movements;
  inventory_row public.stack_item_inventory;
  vial_movement public.vial_stock_movements;
  vial_item public.stack_items;
  remaining numeric;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_action is null or p_action not in ('undo', 'skip', 'delete') then
    raise exception 'Invalid inventory reversal action';
  end if;

  select *
  into log
  from public.dose_logs
  where id = p_dose_log_id
    and user_id = owner_id
  for update;

  select *
  into movement
  from public.stack_item_inventory_movements
  where source_dose_log_id = p_dose_log_id
    and user_id = owner_id
  for update;

  select *
  into vial_movement
  from public.vial_stock_movements
  where source_dose_log_id = p_dose_log_id
    and user_id = owner_id
  for update;

  if movement.id is not null and vial_movement.id is not null then
    raise exception 'Dose log has multiple inventory ledgers';
  end if;
  if log.id is null and movement.id is null and vial_movement.id is null then
    raise exception 'Dose log not found';
  end if;
  if log.id is null and p_action <> 'delete' then
    raise exception 'Dose log not found';
  end if;

  if vial_movement.id is not null then
    select *
    into vial_item
    from public.stack_items
    where id = vial_movement.stack_item_id
      and user_id = owner_id
    for update;

    if not found then
      raise exception 'Stack item not found';
    end if;

    if vial_movement.applied then
      update public.stack_items
      set vials_in_stock = round(coalesce(vials_in_stock, 0) + vial_movement.delta_vials, 4)
      where id = vial_item.id
        and user_id = owner_id
      returning vials_in_stock into remaining;

      update public.vial_stock_movements
      set
        applied = false,
        reversal_count = reversal_count + 1,
        last_reversed_at = now(),
        last_reversal_action = p_action
      where id = vial_movement.id
        and user_id = owner_id;
    else
      remaining := vial_item.vials_in_stock;
    end if;
  elsif movement.id is not null then
    select *
    into inventory_row
    from public.stack_item_inventory
    where id = movement.inventory_id
      and user_id = owner_id
    for update;

    if not found then
      raise exception 'Inventory not found';
    end if;

    if movement.applied then
      update public.stack_item_inventory
      set
        remaining_quantity = remaining_quantity + movement.delta_quantity,
        updated_at = now()
      where id = inventory_row.id
        and user_id = owner_id
      returning remaining_quantity into remaining;

      update public.stack_item_inventory_movements
      set
        applied = false,
        reversal_count = reversal_count + 1,
        last_reversed_at = now(),
        last_reversal_action = p_action
      where id = movement.id
        and user_id = owner_id;
    else
      remaining := inventory_row.remaining_quantity;
    end if;
  end if;

  if log.id is not null then
    if p_action = 'delete' then
      delete from public.dose_logs
      where id = p_dose_log_id
        and user_id = owner_id;
    else
      update public.dose_logs
      set taken = case p_action when 'skip' then false else null end
      where id = p_dose_log_id
        and user_id = owner_id;
    end if;
  end if;

  return remaining;
end;
$$;

revoke execute on function public.reverse_inventory_confirmation(uuid, text) from public, anon;
grant execute on function public.reverse_inventory_confirmation(uuid, text) to authenticated;

commit;
