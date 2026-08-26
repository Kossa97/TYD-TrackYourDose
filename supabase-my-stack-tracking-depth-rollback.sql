begin;

-- Data caveat: this rollback restores the pre-tracking-depth contracts. It
-- refuses to discard inventory, routine-slot metadata, nullable quantities, or
-- lower-depth ingredient shapes. Resolve or export those rows before retrying.
do $$
declare
  has_rows boolean;
begin
  if exists (
    select 1 from public.cycles where dose is null or unit is null
  ) then
    raise exception 'cannot restore cycles dose and unit constraints while null values exist';
  end if;

  if exists (
    select 1 from public.dose_logs where dose is null or unit is null
  ) then
    raise exception 'cannot restore dose_logs dose and unit constraints while null values exist';
  end if;

  if exists (
    select 1
    from public.stack_item_ingredients
    where basis_value is null
      or basis_unit is null
      or (catalog_substance_id is not null)
        = (nullif(btrim(custom_name), '') is not null)
  ) then
    raise exception 'cannot restore ingredient contracts while incompatible values exist';
  end if;

  if exists (
    select 1 from public.stack_items
    where tracking_level is distinct from 'complete'
  ) then
    raise exception 'cannot drop tracking_level after a tracking choice has been made';
  end if;

  if exists (
    select 1 from public.stack_items
    where pk_profile_method is not null
      and pk_profile_method is distinct from default_method
  ) then
    raise exception 'cannot drop pk_profile_method after it diverges from default_method';
  end if;

  if to_regclass('public.stack_item_inventory') is not null then
    execute 'select exists (select 1 from public.stack_item_inventory)' into has_rows;
    if has_rows then
      raise exception 'cannot drop inventory tables while inventory data exists';
    end if;
  end if;
  if to_regclass('public.stack_item_inventory_movements') is not null then
    execute 'select exists (select 1 from public.stack_item_inventory_movements)' into has_rows;
    if has_rows then
      raise exception 'cannot drop inventory tables while inventory data exists';
    end if;
  end if;
  if to_regclass('public.vial_stock_movements') is not null then
    execute 'select exists (select 1 from public.vial_stock_movements)' into has_rows;
    if has_rows then
      raise exception 'cannot drop inventory tables while inventory data exists';
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dose_logs'
      and column_name = 'routine_slot_key'
  ) then
    execute 'select exists (select 1 from public.dose_logs where routine_slot_key is not null)'
      into has_rows;
    if has_rows then
      raise exception 'cannot drop routine slot idempotency metadata while populated values exist';
    end if;
  end if;
end;
$$;

drop function if exists public.reverse_inventory_confirmation(uuid, text);
drop function if exists public.apply_inventory_confirmation(uuid);
drop function if exists public.confirm_intake_group(jsonb);
drop function if exists public.save_stack_item_with_plan(jsonb, jsonb, jsonb);
drop function if exists public.save_stack_item(jsonb, jsonb);

drop trigger if exists stack_item_ingredients_completeness_check on public.stack_item_ingredients;
drop trigger if exists stack_items_completeness_check on public.stack_items;
drop function if exists public.enforce_stack_item_completeness();

revoke all on table public.vial_stock_movements from authenticated;
drop policy if exists "own vial stock movements insert" on public.vial_stock_movements;
drop policy if exists "own vial stock movements select" on public.vial_stock_movements;
drop table if exists public.vial_stock_movements;

revoke all on table public.stack_item_inventory_movements from authenticated;
drop policy if exists "own stack item inventory movements update" on public.stack_item_inventory_movements;
drop policy if exists "own stack item inventory movements insert" on public.stack_item_inventory_movements;
drop policy if exists "own stack item inventory movements select" on public.stack_item_inventory_movements;
drop table if exists public.stack_item_inventory_movements;

revoke all on table public.stack_item_inventory from authenticated;
drop policy if exists "own stack item inventory delete" on public.stack_item_inventory;
drop policy if exists "own stack item inventory update" on public.stack_item_inventory;
drop policy if exists "own stack item inventory insert" on public.stack_item_inventory;
drop policy if exists "own stack item inventory select" on public.stack_item_inventory;
drop table if exists public.stack_item_inventory;

drop index if exists public.dose_logs_routine_slot_unique;
alter table public.dose_logs
  drop column if exists routine_slot_key;

alter table public.stack_item_ingredients
  drop constraint if exists stack_item_ingredients_basis_unit_check,
  drop constraint if exists stack_item_ingredients_name_check,
  alter column basis_value set not null,
  alter column basis_unit set not null;

alter table public.stack_item_ingredients
  add constraint stack_item_ingredients_basis_unit_check
    check (nullif(btrim(basis_unit), '') is not null),
  add constraint stack_item_ingredients_name_check check (
    (catalog_substance_id is not null)
    <> (nullif(btrim(custom_name), '') is not null)
  );

alter table public.cycles
  alter column dose set not null,
  alter column unit set not null;

alter table public.dose_logs
  alter column dose set not null,
  alter column unit set not null;

alter table public.stack_items
  drop constraint if exists stack_items_tracking_level_check,
  drop column if exists tracking_level,
  drop column if exists pk_profile_method;

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
        and item.configuration_status = 'complete'
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

create constraint trigger stack_items_completeness_check
after insert or update of configuration_status on public.stack_items
deferrable initially deferred
for each row execute function public.enforce_stack_item_completeness();

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
  existing_status text;
  ingredients_incomplete boolean;
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

  if p_ingredients is null
    or jsonb_typeof(p_ingredients) <> 'array'
    or jsonb_array_length(p_ingredients) = 0 then
    raise exception 'At least one ingredient is required';
  end if;

  if nullif(p_item ->> 'id', '') is not null then
    item_id := (p_item ->> 'id')::uuid;

    select configuration_status
    into existing_status
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
        (nullif(btrim(row_value ->> 'catalog_substance_id'), '') is null)
        = (nullif(btrim(row_value ->> 'custom_name'), '') is null)
      )
      or row_value ->> 'basis_value' is null
      or not (
        (row_value ->> 'basis_value')::numeric > 0
        and (row_value ->> 'basis_value')::numeric < 'Infinity'::numeric
      )
      or nullif(btrim(row_value ->> 'basis_unit'), '') is null
  ) then
    raise exception 'Invalid ingredient';
  end if;

  if (
    select count(*) <> count(distinct row_value ->> 'position')
    from jsonb_array_elements(p_ingredients) row_value
  ) then
    raise exception 'Ingredient positions must be unique';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(p_ingredients) row_value
    where row_value ->> 'amount_value' is null
      or not (
        (row_value ->> 'amount_value')::numeric > 0
        and (row_value ->> 'amount_value')::numeric < 'Infinity'::numeric
      )
      or nullif(btrim(row_value ->> 'amount_unit'), '') is null
  )
  into ingredients_incomplete;

  if (item_id is null or existing_status = 'complete') and ingredients_incomplete then
    raise exception 'Strength and unit are required';
  end if;

  if item_id is null then
    insert into public.stack_items (
      user_id,
      display_name,
      category,
      dosage_form,
      brand,
      color_hex,
      notes,
      configuration_status
    ) values (
      owner_id,
      btrim(p_item ->> 'display_name'),
      item_category,
      item_dosage_form,
      nullif(btrim(p_item ->> 'brand'), ''),
      nullif(btrim(p_item ->> 'color_hex'), ''),
      nullif(p_item ->> 'notes', ''),
      'complete'
    )
    returning * into saved_item;

    item_id := saved_item.id;
  else
    update public.stack_items
    set
      display_name = btrim(p_item ->> 'display_name'),
      category = item_category,
      dosage_form = item_dosage_form,
      brand = nullif(btrim(p_item ->> 'brand'), ''),
      color_hex = nullif(btrim(p_item ->> 'color_hex'), ''),
      notes = nullif(p_item ->> 'notes', ''),
      configuration_status = case
        when ingredients_incomplete then 'needs_review'
        else 'complete'
      end
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
      nullif(ingredient ->> 'amount_value', '')::numeric,
      nullif(btrim(ingredient ->> 'amount_unit'), ''),
      (ingredient ->> 'basis_value')::numeric,
      btrim(ingredient ->> 'basis_unit'),
      (ingredient ->> 'position')::integer
    );
  end loop;

  return saved_item;
end;
$$;

revoke execute on function public.save_stack_item(jsonb, jsonb) from public, anon;
grant execute on function public.save_stack_item(jsonb, jsonb) to authenticated;

commit;
