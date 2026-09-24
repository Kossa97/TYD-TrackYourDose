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
--      ueber das allgemeine Modell. Alte vial_stock_movements bleiben gueltig
--      und buchen beim Rueckgaengigmachen auf die neue Zeile.
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
--   altes Modell (vials_initial > 1): vials_in_stock zaehlte schon alle Vials
--     und wurde bei jeder Einnahme heruntergezaehlt; vials_count ist dort das
--     nie fortgeschriebene Formularfeld.
-- Nur Vials mit Zusammensetzung pro Vial: ohne sie koennte das allgemeine
-- Modell keine Dosis umrechnen, dann bleibt der alte Weg zustaendig.
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
  greatest(coalesce(stock.vials_initial, 0), ceil(vorrat.rest), 1),
  'vial',
  vorrat.rest,
  nullif(btrim(coalesce(item.batch_number, stock.batch_number)), ''),
  nullif(btrim(coalesce(item.batch_source, stock.batch_source)), ''),
  nullif(btrim(coalesce(item.batch_file_url, stock.batch_file_url)), ''),
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
      when coalesce(item.vials_initial, 0) > 1
        then greatest(coalesce(item.vials_in_stock, 0), 0)
      else greatest(coalesce(stock.vials_count, 0), 0)
        + least(greatest(coalesce(item.vials_in_stock, 0), 0), 1)
    end, 4), '1000000000'::numeric) as rest
) vorrat
where item.dosage_form = 'vial'
  and item.vial_amount_mg > 0
  and exists (
    select 1
    from public.stack_item_ingredients ingredient
    where ingredient.stack_item_id = item.id
      and ingredient.basis_unit = 'vial'
  )
on conflict (stack_item_id) do nothing;

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

  -- Vials ohne Bestandszeile: der alte Weg, unveraendert.
  if item.dosage_form = 'vial' and not has_inventory then
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

  if not has_inventory then
    return null;
  end if;
  if not inventory_row.enabled then
    return inventory_row.remaining_quantity;
  end if;

  -- Vor der Umstellung gebucht, danach rueckgaengig gemacht und jetzt erneut
  -- bestaetigt: die alte Buchung wird wiederverwendet, jetzt auf den Bestand.
  if item.dosage_form = 'vial' then
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
      if inventory_row.package_unit <> 'vial' then
        raise exception 'Inventory conversion is ambiguous or unsupported';
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

    -- Hat das Vial inzwischen eine Bestandszeile, gehoert die Gutschrift dorthin:
    -- deren Anfangsstand wurde aus dem schon belasteten Altfeld uebernommen.
    select *
    into inventory_row
    from public.stack_item_inventory
    where stack_item_id = vial_item.id
      and user_id = owner_id
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

commit;

-- Nachzaehlen (nach dem Lauf, liest nur):
-- select
--   count(*) filter (where legacy_migrated_at is not null) as uebernommene_vials,
--   count(*) filter (where package_unit = 'vial') as vial_bestaende,
--   count(*) as bestaende
-- from public.stack_item_inventory;
