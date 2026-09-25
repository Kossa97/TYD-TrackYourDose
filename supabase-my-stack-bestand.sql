-- Bestand fuer alle Darreichungsformen
--
-- Vials fuehrten ihren Vorrat bisher in Altfeldern: angebrochenes Vial als
-- Bruchteil in stack_items.vials_in_stock, ungeoeffnete Vials in
-- inventory_items.vials_count. Alle anderen Formen nutzen stack_item_inventory.
-- Diese Migration zieht Vials in dasselbe Modell:
--
--   1. stack_item_inventory bekommt, was der Bestand fuer jede Form braucht:
--      Charge (Quelle, Analyse-Dokument) und den angebrochenen Behaelter
--      (angemischt/geoeffnet am, haltbar danach, zugefuegte Fluessigkeit).
--   2. Jedes Vial mit Altdaten bekommt eine Bestandszeile in der Einheit
--      'vial'. Bestehende Bestandszeilen werden nie ueberschrieben.
--   3. apply_/reverse_inventory_confirmation buchen Vials mit Bestandszeile
--      (und genau einem Wirkstoff pro Vial, vial_uses_inventory) ueber das
--      allgemeine Modell. Alte vial_stock_movements bleiben gueltig und buchen
--      beim Rueckgaengigmachen auf die neue Zeile.
--   4. Eintraege mit Chargendaten ohne Vial-Bestand bekommen eine
--      ausgeschaltete Zeile nur mit der Charge.
--   5. save_stack_item laesst den Bestand in Ruhe, wenn keiner mitkommt.
--   6. add_inventory_package und open_inventory_container fuer die
--      Bestand-Ansicht (atomar).
--
-- Nichts wird geloescht: die Altfelder bleiben stehen und werden nur nicht
-- mehr fortgeschrieben, sobald eine Bestandszeile existiert.
-- Zweimal ausfuehrbar; der zweite Lauf aendert nichts.

begin;

alter table public.stack_item_inventory
  add column if not exists batch_source text,
  add column if not exists batch_file_url text,
  add column if not exists opened_at date,
  add column if not exists use_within_days integer,
  add column if not exists reconstitution_ml numeric,
  add column if not exists legacy_migrated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stack_item_inventory'::regclass
      and conname = 'stack_item_inventory_use_within_days_check'
  ) then
    alter table public.stack_item_inventory
      add constraint stack_item_inventory_use_within_days_check
      check (use_within_days is null or use_within_days between 1 and 3650);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stack_item_inventory'::regclass
      and conname = 'stack_item_inventory_reconstitution_ml_check'
  ) then
    alter table public.stack_item_inventory
      add constraint stack_item_inventory_reconstitution_ml_check
      check (reconstitution_ml is null or (reconstitution_ml > 0 and reconstitution_ml <= 1000));
  end if;
end $$;

-- Vorrat eines Vials in Vials:
--   neues Modell (vials_initial <= 1): vials_in_stock ist der Rest des
--     angemischten Vials, inventory_items.vials_count die ungeoeffneten.
--   altes Modell (vials_initial > 1 oder vials_in_stock > 1): vials_in_stock
--     zaehlte schon alle Vials und wurde bei jeder Einnahme heruntergezaehlt;
--     vials_count ist dort das nie fortgeschriebene Formularfeld.
-- Nur Vials mit genau einem Wirkstoff pro Vial: ohne ihn koennte das
-- allgemeine Modell keine Dosis umrechnen, bei Mischungen waere die mg-Angabe
-- mehrdeutig. Fuer alle anderen bleibt der alte Weg zustaendig.
insert into public.stack_item_inventory (
  user_id,
  stack_item_id,
  enabled,
  package_quantity,
  package_unit,
  remaining_quantity,
  batch_number,
  batch_source,
  batch_file_url,
  opened_at,
  use_within_days,
  reconstitution_ml,
  legacy_migrated_at
)
select
  item.user_id,
  item.id,
  true,
  greatest(coalesce(item.vials_initial, 0), coalesce(stock.vials_initial, 0), ceil(vorrat.rest), 1),
  'vial',
  vorrat.rest,
  coalesce(nullif(btrim(item.batch_number), ''), nullif(btrim(stock.batch_number), '')),
  coalesce(nullif(btrim(item.batch_source), ''), nullif(btrim(stock.batch_source), '')),
  coalesce(nullif(btrim(item.batch_file_url), ''), nullif(btrim(stock.batch_file_url), '')),
  item.reconstitution_date,
  case when item.expiry_days between 1 and 3650 then item.expiry_days end,
  case when item.reconstitution_ml > 0 and item.reconstitution_ml <= 1000 then item.reconstitution_ml end,
  now()
from public.stack_items item
left join public.inventory_items stock
  on stock.id = item.inventory_item_id
  and stock.user_id = item.user_id
cross join lateral (
  select least(round(
    case
      when coalesce(item.vials_initial, 0) > 1 or coalesce(item.vials_in_stock, 0) > 1
        then greatest(coalesce(item.vials_in_stock, 0), 0)
      else greatest(coalesce(stock.vials_count, 0), 0)
        + least(greatest(coalesce(item.vials_in_stock, 0), 0), 1)
    end, 4), '1000000000'::numeric) as rest
) vorrat
where item.dosage_form = 'vial'
  and item.vial_amount_mg > 0
  and (select count(*) from public.stack_item_ingredients ingredient where ingredient.stack_item_id = item.id) = 1
  and exists (
    select 1
    from public.stack_item_ingredients ingredient
    where ingredient.stack_item_id = item.id
      and ingredient.basis_unit = 'vial'
      and ingredient.amount_value > 0
      and ingredient.basis_value > 0
  )
on conflict (stack_item_id) do nothing;

-- Bucht dieses Vial ueber den Bestand? Nur mit Bestand in Vials und genau
-- einem Wirkstoff pro Vial — sonst waere eine mg-Dosis nicht eindeutig in
-- Vials umzurechnen, und der alte Weg (vial_amount_mg) bleibt zustaendig.
-- Abbuchen und Rueckbuchen fragen beide hier, damit sie nie auseinanderlaufen.
-- Charge, Quelle und Analyse-Dokument stehen jetzt am Bestand. Eintraege, die
-- oben keinen Vial-Bestand bekommen haben, aber Chargendaten in den
-- Altspalten tragen, bekommen eine ausgeschaltete Bestandszeile nur mit der
-- Charge — sonst waere sie nirgends mehr zu sehen.
insert into public.stack_item_inventory (
  user_id, stack_item_id, enabled, batch_number, batch_source, batch_file_url, legacy_migrated_at
)
select
  item.user_id,
  item.id,
  false,
  coalesce(nullif(btrim(item.batch_number), ''), nullif(btrim(stock.batch_number), '')),
  coalesce(nullif(btrim(item.batch_source), ''), nullif(btrim(stock.batch_source), '')),
  coalesce(nullif(btrim(item.batch_file_url), ''), nullif(btrim(stock.batch_file_url), '')),
  now()
from public.stack_items item
left join public.inventory_items stock
  on stock.id = item.inventory_item_id
  and stock.user_id = item.user_id
where coalesce(nullif(btrim(item.batch_number), ''), nullif(btrim(stock.batch_number), ''),
    nullif(btrim(item.batch_source), ''), nullif(btrim(stock.batch_source), ''),
    nullif(btrim(item.batch_file_url), ''), nullif(btrim(stock.batch_file_url), '')) is not null
on conflict (stack_item_id) do nothing;

create or replace function public.vial_uses_inventory(p_stack_item_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
      select 1
      from public.stack_items item
      join public.stack_item_inventory inventory on inventory.stack_item_id = item.id
      where item.id = p_stack_item_id
        and item.dosage_form = 'vial'
        and inventory.package_unit = 'vial'
    )
    and (select count(*) from public.stack_item_ingredients ingredient where ingredient.stack_item_id = p_stack_item_id) = 1
    and exists (
      select 1
      from public.stack_item_ingredients ingredient
      where ingredient.stack_item_id = p_stack_item_id
        and ingredient.basis_unit = 'vial'
        and ingredient.amount_value > 0
        and ingredient.basis_value > 0
    );
$$;

create or replace function public.apply_inventory_confirmation(p_dose_log_id uuid)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  log public.dose_logs;
  item public.stack_items;
  inventory_row public.stack_item_inventory;
  has_inventory boolean;
  uses_vial_inventory boolean;
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

  select *
  into inventory_row
  from public.stack_item_inventory
  where stack_item_id = item.id
    and user_id = owner_id
  for update;
  has_inventory := found;
  -- Ein Vial bucht ueber den Bestand, sobald es einen in Vials gefuehrten hat
  -- (und die Umrechnung eindeutig ist, siehe vial_uses_inventory). Wie der
  -- alte Weg unabhaengig von der Erfassungstiefe.
  uses_vial_inventory := has_inventory and public.vial_uses_inventory(item.id);

  -- Alle anderen Vials: der alte Weg, unveraendert.
  if item.dosage_form = 'vial' and not uses_vial_inventory then
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

  if item.tracking_level <> 'complete' and not uses_vial_inventory then
    return null;
  end if;

  if not has_inventory then
    return null;
  end if;
  if not inventory_row.enabled then
    return inventory_row.remaining_quantity;
  end if;

  -- Vor der Umstellung gebucht, danach rueckgaengig gemacht und jetzt erneut
  -- bestaetigt: die alte Buchung wird wiederverwendet, jetzt auf den Bestand.
  if uses_vial_inventory then
    select *
    into vial_movement
    from public.vial_stock_movements
    where source_dose_log_id = p_dose_log_id
      and user_id = owner_id
    for update;

    if found then
      if vial_movement.applied then
        return inventory_row.remaining_quantity;
      end if;

      actual_vial_delta := least(inventory_row.remaining_quantity, vial_movement.delta_vials);

      update public.stack_item_inventory
      set
        remaining_quantity = round(remaining_quantity - actual_vial_delta, 4),
        updated_at = now()
      where id = inventory_row.id
        and user_id = owner_id
      returning remaining_quantity into inventory_row.remaining_quantity;

      update public.vial_stock_movements
      set
        dose_log_id = p_dose_log_id,
        delta_vials = actual_vial_delta,
        applied = true
      where id = vial_movement.id
        and user_id = owner_id;

      return inventory_row.remaining_quantity;
    end if;
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
    if uses_vial_inventory then
      -- Wie beim ersten Buchen: ein leeres Vial lehnt nicht ab, es bucht
      -- hoechstens den Rest.
      actual_delta := least(inventory_row.remaining_quantity, movement.delta_quantity);
      if actual_delta <= 0 then
        return inventory_row.remaining_quantity;
      end if;
    else
      if inventory_row.remaining_quantity < movement.delta_quantity then
        raise exception 'Insufficient inventory for confirmation';
      end if;
      actual_delta := movement.delta_quantity;
    end if;

    update public.stack_item_inventory
    set
      remaining_quantity = remaining_quantity - actual_delta,
      updated_at = now()
    where id = inventory_row.id
      and user_id = owner_id
    returning remaining_quantity into inventory_row.remaining_quantity;

    update public.stack_item_inventory_movements
    set
      dose_log_id = p_dose_log_id,
      delta_quantity = actual_delta,
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
      -- Aufgezogene Milliliter aus einem angemischten Vial: ein Vial haelt
      -- genau die zugefuegte Fluessigkeit.
      when ingredient.basis_unit = inventory_row.package_unit
        and inventory_row.package_unit = 'vial'
        and lower(log.unit) = 'ml'
        and inventory_row.reconstitution_ml > 0
        then log.dose / inventory_row.reconstitution_ml
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

  if uses_vial_inventory then
    -- Vials rechnen wie bisher auf vier Stellen und lassen eine Einnahme
    -- aus leerem Bestand zu, statt sie abzulehnen.
    actual_delta := least(inventory_row.remaining_quantity, round(minimum_delta, 4));
    if actual_delta <= 0 then
      return inventory_row.remaining_quantity;
    end if;
  else
    actual_delta := least(inventory_row.remaining_quantity, minimum_delta);
    if actual_delta <= 0 then
      raise exception 'Insufficient inventory for confirmation';
    end if;
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

create or replace function public.reverse_inventory_confirmation(p_dose_log_id uuid, p_action text)
returns numeric
language plpgsql
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

    -- Fuehrt das Vial inzwischen einen Bestand in Vials, gehoert die Gutschrift
    -- dorthin: dessen Anfangsstand kam aus dem schon belasteten Altfeld, und
    -- apply bucht erneute Bestaetigungen ebenfalls dort.
    select *
    into inventory_row
    from public.stack_item_inventory
    where stack_item_id = vial_item.id
      and user_id = owner_id
      and public.vial_uses_inventory(vial_item.id)
    for update;

    if vial_movement.applied then
      if inventory_row.id is not null then
        update public.stack_item_inventory
        set
          remaining_quantity = round(least(remaining_quantity + vial_movement.delta_vials, '1000000000'::numeric), 4),
          updated_at = now()
        where id = inventory_row.id
          and user_id = owner_id
        returning remaining_quantity into remaining;
      else
        update public.stack_items
        set vials_in_stock = round(coalesce(vials_in_stock, 0) + vial_movement.delta_vials, 4)
        where id = vial_item.id
          and user_id = owner_id
        returning vials_in_stock into remaining;
      end if;

      update public.vial_stock_movements
      set
        applied = false,
        reversal_count = reversal_count + 1,
        last_reversed_at = now(),
        last_reversal_action = p_action
      where id = vial_movement.id
        and user_id = owner_id;
    else
      remaining := coalesce(inventory_row.remaining_quantity, vial_item.vials_in_stock);
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

-- Speichern eines Eintrags ohne Bestandsangabe laesst den Bestand in Ruhe.
-- Bisher schaltete jedes Speichern ohne "enabled" den Bestand ab — seit der
-- Bestand eine eigene Ansicht hat, schickt der Assistent beim Bearbeiten
-- keinen mehr mit. Sonst unveraendert gegenueber
-- supabase-my-stack-tracking-depth.sql (einzige Aenderung: "elsif p_item ?
-- 'inventory'" statt "else" im letzten Zweig).
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
    'peptide', 'medication', 'hormone', 'supplement', 'vitamin', 'other'
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
  elsif p_item ? 'inventory' then
    update public.stack_item_inventory
    set enabled = false,
      updated_at = now()
    where stack_item_id = item_id
      and user_id = owner_id;
  end if;

  return saved_item;
end;
$$;

-- Neue Packung: in einem Schritt zum aktuellen Stand addiert, damit eine
-- gleichzeitige Abbuchung nicht verloren geht.
create or replace function public.add_inventory_package(p_inventory_id uuid, p_quantity numeric)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  remaining numeric;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > '1000000000'::numeric then
    raise exception 'Invalid package quantity';
  end if;

  update public.stack_item_inventory
  set
    remaining_quantity = least(coalesce(remaining_quantity, 0) + p_quantity, '1000000000'::numeric),
    updated_at = now()
  where id = p_inventory_id
    and user_id = owner_id
    and enabled
  returning remaining_quantity into remaining;

  if not found then
    raise exception 'Inventory not found';
  end if;
  return remaining;
end;
$$;

-- Neues Vial anmischen / neue Flasche oeffnen. Auf Wunsch wird der Rest im
-- alten Behaelter verworfen: beim Vial der Nachkommateil, sonst der Rest
-- ueber vollen Behaeltern der Packungsgroesse.
create or replace function public.open_inventory_container(
  p_inventory_id uuid,
  p_opened_at date,
  p_discard_rest boolean,
  p_reconstitution_ml numeric default null
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  remaining numeric;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_opened_at is null then
    raise exception 'Opening date required';
  end if;
  if p_reconstitution_ml is not null and not (p_reconstitution_ml > 0 and p_reconstitution_ml <= 1000) then
    raise exception 'Invalid reconstitution volume';
  end if;

  update public.stack_item_inventory
  set
    opened_at = p_opened_at,
    reconstitution_ml = coalesce(p_reconstitution_ml, reconstitution_ml),
    remaining_quantity = case
      when not coalesce(p_discard_rest, false) then remaining_quantity
      when package_unit = 'vial' then trunc(remaining_quantity)
      when package_quantity > 0 then remaining_quantity - mod(remaining_quantity, package_quantity)
      else remaining_quantity
    end,
    updated_at = now()
  where id = p_inventory_id
    and user_id = owner_id
    and enabled
  returning remaining_quantity into remaining;

  if not found then
    raise exception 'Inventory not found';
  end if;
  return remaining;
end;
$$;

revoke execute on function public.vial_uses_inventory(uuid) from public, anon;
grant execute on function public.vial_uses_inventory(uuid) to authenticated;
revoke execute on function public.save_stack_item(jsonb, jsonb) from public, anon;
grant execute on function public.save_stack_item(jsonb, jsonb) to authenticated;
revoke execute on function public.add_inventory_package(uuid, numeric) from public, anon;
grant execute on function public.add_inventory_package(uuid, numeric) to authenticated;
revoke execute on function public.open_inventory_container(uuid, date, boolean, numeric) from public, anon;
grant execute on function public.open_inventory_container(uuid, date, boolean, numeric) to authenticated;

commit;

-- Nachzaehlen (nach dem Lauf, liest nur):
-- select
--   count(*) filter (where legacy_migrated_at is not null) as uebernommene_vials,
--   count(*) filter (where package_unit = 'vial') as vial_bestaende,
--   count(*) as bestaende
-- from public.stack_item_inventory;
