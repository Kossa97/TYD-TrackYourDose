begin;

create or replace function public.save_legacy_peptide(
  p_item jsonb,
  p_ingredients jsonb,
  p_tracking jsonb
)
returns public.stack_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_item public.stack_items;
  item_id uuid;
  owner_id uuid := auth.uid();
  ingredient jsonb;
  amount_value numeric;
  amount_unit text;
  next_configuration_status text;
  matched_catalog_substance_id uuid;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(btrim(p_item ->> 'display_name'), '') is null then
    raise exception 'Display name is required';
  end if;

  if p_ingredients is null
    or jsonb_typeof(p_ingredients) <> 'array'
    or jsonb_array_length(p_ingredients) <> 1 then
    raise exception 'Exactly one legacy peptide ingredient is required';
  end if;

  ingredient := p_ingredients -> 0;
  amount_value := nullif(ingredient ->> 'amount_value', '')::numeric;
  amount_unit := nullif(btrim(ingredient ->> 'amount_unit'), '');
  next_configuration_status := case
    when amount_value is null or amount_unit is null then 'needs_review'
    else 'complete'
  end;

  if amount_value is not null
    and not (amount_value > 0 and amount_value < 'Infinity'::numeric) then
    raise exception 'Invalid ingredient amount';
  end if;

  select candidate.id
  into matched_catalog_substance_id
  from public.substance_catalog candidate
  where lower(candidate.canonical_name) = lower(btrim(p_item ->> 'display_name'))
    or exists (
      select 1
      from unnest(candidate.aliases) candidate_alias
      where lower(candidate_alias) = lower(btrim(p_item ->> 'display_name'))
    )
  order by (
    lower(candidate.canonical_name) = lower(btrim(p_item ->> 'display_name'))
  ) desc, candidate.id
  limit 1;

  if nullif(p_item ->> 'id', '') is not null then
    item_id := (p_item ->> 'id')::uuid;

    perform 1
    from public.stack_items
    where id = item_id
      and user_id = owner_id
      and category = 'peptide';

    if not found then
      raise exception 'Peptide stack item not found';
    end if;
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
      configuration_status,
      default_unit,
      default_dose,
      default_method,
      vial_amount_mg,
      vial_amount_unit,
      reconstitution_ml,
      syringe_type,
      vials_in_stock,
      vials_initial,
      reconstitution_date,
      expiry_days,
      batch_number,
      batch_source,
      batch_file_url,
      inventory_item_id,
      pk_profile_id
    )
    values (
      owner_id,
      btrim(p_item ->> 'display_name'),
      'peptide',
      'vial',
      null,
      nullif(btrim(p_item ->> 'color_hex'), ''),
      nullif(p_tracking ->> 'notes', ''),
      next_configuration_status,
      nullif(btrim(p_tracking ->> 'default_unit'), ''),
      nullif(p_tracking ->> 'default_dose', '')::numeric,
      nullif(btrim(p_tracking ->> 'default_method'), ''),
      nullif(p_tracking ->> 'vial_amount_mg', '')::numeric,
      nullif(btrim(p_tracking ->> 'vial_amount_unit'), ''),
      nullif(p_tracking ->> 'reconstitution_ml', '')::numeric,
      nullif(btrim(p_tracking ->> 'syringe_type'), ''),
      nullif(p_tracking ->> 'vials_in_stock', '')::numeric,
      nullif(p_tracking ->> 'vials_initial', '')::numeric,
      nullif(p_tracking ->> 'reconstitution_date', '')::date,
      nullif(p_tracking ->> 'expiry_days', '')::integer,
      nullif(btrim(p_tracking ->> 'batch_number'), ''),
      nullif(btrim(p_tracking ->> 'batch_source'), ''),
      nullif(btrim(p_tracking ->> 'batch_file_url'), ''),
      nullif(p_tracking ->> 'inventory_item_id', '')::uuid,
      nullif(p_tracking ->> 'pk_profile_id', '')::uuid
    )
    returning * into saved_item;

    item_id := saved_item.id;
  else
    update public.stack_items
    set
      display_name = btrim(p_item ->> 'display_name'),
      category = 'peptide',
      dosage_form = 'vial',
      brand = null,
      color_hex = nullif(btrim(p_item ->> 'color_hex'), ''),
      notes = nullif(p_tracking ->> 'notes', ''),
      configuration_status = next_configuration_status,
      default_unit = nullif(btrim(p_tracking ->> 'default_unit'), ''),
      default_dose = nullif(p_tracking ->> 'default_dose', '')::numeric,
      default_method = nullif(btrim(p_tracking ->> 'default_method'), ''),
      vial_amount_mg = nullif(p_tracking ->> 'vial_amount_mg', '')::numeric,
      vial_amount_unit = nullif(btrim(p_tracking ->> 'vial_amount_unit'), ''),
      reconstitution_ml = nullif(p_tracking ->> 'reconstitution_ml', '')::numeric,
      syringe_type = nullif(btrim(p_tracking ->> 'syringe_type'), ''),
      vials_in_stock = nullif(p_tracking ->> 'vials_in_stock', '')::numeric,
      vials_initial = nullif(p_tracking ->> 'vials_initial', '')::numeric,
      reconstitution_date = nullif(p_tracking ->> 'reconstitution_date', '')::date,
      expiry_days = nullif(p_tracking ->> 'expiry_days', '')::integer,
      batch_number = nullif(btrim(p_tracking ->> 'batch_number'), ''),
      batch_source = nullif(btrim(p_tracking ->> 'batch_source'), ''),
      batch_file_url = nullif(btrim(p_tracking ->> 'batch_file_url'), ''),
      inventory_item_id = nullif(p_tracking ->> 'inventory_item_id', '')::uuid,
      pk_profile_id = nullif(p_tracking ->> 'pk_profile_id', '')::uuid,
      updated_at = now()
    where id = item_id
      and user_id = owner_id
    returning * into saved_item;

    delete from public.stack_item_ingredients
    where stack_item_id = item_id;
  end if;

  insert into public.stack_item_ingredients (
    stack_item_id,
    catalog_substance_id,
    custom_name,
    amount_value,
    amount_unit,
    basis_value,
    basis_unit,
    position
  )
  values (
    item_id,
    matched_catalog_substance_id,
    case
      when matched_catalog_substance_id is null
        then btrim(p_item ->> 'display_name')
    end,
    amount_value,
    amount_unit,
    1,
    'vial',
    0
  );

  return saved_item;
end;
$$;

revoke execute on function public.save_legacy_peptide(jsonb, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_legacy_peptide(jsonb, jsonb, jsonb)
  to authenticated;

commit;
