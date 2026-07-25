begin;

create table public.substance_catalog (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  aliases text[] not null default '{}',
  default_category text not null
    check (default_category in ('peptide', 'medication', 'hormone', 'supplement', 'vitamin')),
  suggested_units text[] not null default '{}',
  suggested_dosage_forms text[] not null default '{}',
  pk_profile_id uuid references public.pk_profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index substance_catalog_canonical_name_idx
  on public.substance_catalog (lower(canonical_name));

alter table public.substance_catalog enable row level security;

create policy "Authenticated catalog read"
  on public.substance_catalog
  for select
  to authenticated
  using (true);

revoke all on table public.substance_catalog from anon, authenticated;
grant select on table public.substance_catalog to authenticated;

insert into public.substance_catalog (
  canonical_name,
  aliases,
  default_category
)
values
  ('Vitamin D3', array['Cholecalciferol'], 'vitamin'),
  ('Vitamin K2', array['Menachinon-7', 'MK-7'], 'vitamin'),
  ('Magnesium', '{}', 'supplement'),
  ('Omega-3', array['Omega 3'], 'supplement'),
  ('Creatin', array['Kreatin', 'Creatine'], 'supplement'),
  ('Testosteron', array['Testosterone'], 'hormone'),
  ('Testosteron Enantat', array['Testosterone Enanthate'], 'hormone'),
  ('Metformin', '{}', 'medication'),
  ('Melatonin', '{}', 'supplement')
on conflict do nothing;

insert into public.substance_catalog (
  canonical_name,
  aliases,
  default_category,
  pk_profile_id
)
select
  btrim(library.name),
  case
    when nullif(btrim(library.full_name), '') is null
      or lower(btrim(library.full_name)) = lower(btrim(library.name))
      then '{}'::text[]
    else array[btrim(library.full_name)]
  end,
  'peptide',
  (
    select profile.id
    from public.pk_profiles profile
    where lower(profile.name) = lower(library.name)
      or exists (
        select 1
        from unnest(profile.aliases) profile_alias
        where lower(profile_alias) = lower(library.name)
      )
    order by (lower(profile.name) = lower(library.name)) desc, profile.id
    limit 1
  )
from public.peptide_library library
where nullif(btrim(library.name), '') is not null
on conflict do nothing;

alter table public.peptides rename to stack_items;
alter table public.stack_items rename column name to display_name;

alter table public.stack_items
  add column category text not null default 'peptide'
    check (category in ('peptide', 'medication', 'hormone', 'supplement', 'vitamin')),
  add column dosage_form text not null default 'vial'
    check (dosage_form in (
      'vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops', 'liquid',
      'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube', 'other'
    )),
  add column brand text,
  add column color_hex text
    check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add column configuration_status text not null default 'complete'
    check (configuration_status in ('complete', 'needs_review')),
  add column tracking_level text not null default 'complete'
    check (tracking_level in ('intake_only', 'with_amount', 'complete')),
  add column pk_profile_method text,
  add column updated_at timestamptz not null default now();

update public.stack_items
set
  dosage_form = case
    when lower(btrim(default_method)) ~ '(nasal|intranasal)' then 'nasal_spray'
    when vial_amount_mg > 0
      and vial_amount_mg < 'Infinity'::numeric
      and (
        reconstitution_ml > 0
        or lower(btrim(default_method)) ~ '(subkutan|subcutaneous|intramusk|intraven|injek|inject|^sc$|^s\\.c\\.$|^im$|^iv$)'
      )
      then 'vial'
    else 'other'
  end,
  configuration_status = case
    when vial_amount_mg > 0
      and vial_amount_mg < 'Infinity'::numeric
      and nullif(btrim(vial_amount_unit), '') is not null
      and lower(btrim(default_method)) !~ '(nasal|intranasal)'
      and (
        reconstitution_ml > 0
        or lower(btrim(default_method)) ~ '(subkutan|subcutaneous|intramusk|intraven|injek|inject|^sc$|^s\\.c\\.$|^im$|^iv$)'
      )
      then 'complete'
    else 'needs_review'
  end;

update public.stack_items
set configuration_status = 'needs_review'
where vial_amount_mg is null;

update public.stack_items
set pk_profile_method = nullif(btrim(default_method), '')
where pk_profile_id is not null
  and pk_profile_method is null;

create table public.stack_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  stack_item_id uuid not null references public.stack_items(id) on delete cascade,
  catalog_substance_id uuid references public.substance_catalog(id) on delete set null,
  custom_name text,
  amount_value numeric,
  amount_unit text,
  basis_value numeric not null default 1
    check (basis_value > 0
      and basis_value < 'Infinity'::numeric),
  basis_unit text not null
    check (nullif(btrim(basis_unit), '') is not null),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stack_item_ingredients_name_check check (
    (catalog_substance_id is not null)
    <> (nullif(btrim(custom_name), '') is not null)
  ),
  constraint stack_item_ingredients_amount_check check (
    (amount_value is null and amount_unit is null)
    or (
      amount_value > 0
        and amount_value < 'Infinity'::numeric
        and nullif(btrim(amount_unit), '') is not null
    )
  ),
  constraint stack_item_ingredients_position_key unique (stack_item_id, position)
);

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
select
  item.id,
  catalog.id,
  case when catalog.id is null then item.display_name end,
  case
    when item.vial_amount_mg > 0
      and item.vial_amount_mg < 'Infinity'::numeric
      and nullif(btrim(item.vial_amount_unit), '') is not null
      then item.vial_amount_mg
  end,
  case
    when item.vial_amount_mg > 0
      and item.vial_amount_mg < 'Infinity'::numeric
      and nullif(btrim(item.vial_amount_unit), '') is not null
      then btrim(item.vial_amount_unit)
  end,
  1,
  case item.dosage_form
    when 'vial' then 'vial'
    when 'nasal_spray' then 'spray'
    else 'other'
  end,
  0
from public.stack_items item
left join lateral (
  select candidate.id
  from public.substance_catalog candidate
  where lower(candidate.canonical_name) = lower(item.display_name)
    or exists (
      select 1
      from unnest(candidate.aliases) candidate_alias
      where lower(candidate_alias) = lower(item.display_name)
    )
  order by (lower(candidate.canonical_name) = lower(item.display_name)) desc, candidate.id
  limit 1
) catalog on true;

update public.stack_items item
set configuration_status = 'needs_review'
where exists (
  select 1
  from public.stack_item_ingredients ingredient
  where ingredient.stack_item_id = item.id
    and (ingredient.amount_value is null or ingredient.amount_unit is null)
);

alter table public.vials rename column peptide_id to stack_item_id;
alter table public.vials
  rename constraint vials_peptide_id_fkey to vials_stack_item_id_fkey;

alter table public.dose_logs rename column peptide_id to stack_item_id;
alter table public.dose_logs
  rename constraint dose_logs_peptide_id_fkey to dose_logs_stack_item_id_fkey;

alter table public.cycles rename column peptide_id to stack_item_id;
alter table public.cycles
  rename constraint cycles_peptide_id_fkey to cycles_stack_item_id_fkey;

alter table public.cycles
  alter column dose drop not null,
  alter column unit drop not null;

alter table public.dose_logs
  alter column dose drop not null,
  alter column unit drop not null;

alter table public.effects rename column peptide_id to stack_item_id;
alter table public.effects
  rename constraint effects_peptide_id_fkey to effects_stack_item_id_fkey;

alter table public.reviews rename column peptide_id to stack_item_id;
alter table public.reviews
  rename constraint reviews_peptide_id_fkey to reviews_stack_item_id_fkey;

alter table public.injection_logs rename column peptide_id to stack_item_id;
alter table public.injection_logs
  rename constraint injection_logs_peptide_id_fkey to injection_logs_stack_item_id_fkey;

alter table public.stack_items
  rename constraint peptides_pkey to stack_items_pkey;
alter index public.peptides_pk_profile_idx rename to stack_items_pk_profile_idx;
alter index public.peptides_user_archived_idx rename to stack_items_user_archived_idx;
alter policy "Own peptides" on public.stack_items rename to "Own stack items";
alter policy "Own stack items" on public.stack_items
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


alter table public.stack_item_ingredients enable row level security;

create policy "Own stack item ingredients"
  on public.stack_item_ingredients
  for all
  using (
    exists (
      select 1
      from public.stack_items item
      where item.id = stack_item_id
        and item.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.stack_items item
      where item.id = stack_item_id
        and item.user_id = auth.uid()
    )
  );

revoke all on table public.stack_item_ingredients from public, anon;
grant select, insert, update, delete on table public.stack_item_ingredients to authenticated;

create or replace function public.set_stack_item_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stack_items_set_updated_at
before update on public.stack_items
for each row execute function public.set_stack_item_updated_at();

create trigger stack_item_ingredients_set_updated_at
before update on public.stack_item_ingredients
for each row execute function public.set_stack_item_updated_at();


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
    and new.configuration_status = 'needs_review' then
    raise exception 'Complete stack items cannot return to needs_review';
  end if;

  return new;
end;
$$;

create trigger stack_items_review_status_check
before insert or update of configuration_status on public.stack_items
for each row execute function public.enforce_stack_item_review_status();

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
    )
    values (
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
    )
    values (
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
