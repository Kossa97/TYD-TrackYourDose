select json_build_object(
  'stack_items', (select count(*) from public.stack_items),
  'ingredients', (select count(*) from public.stack_item_ingredients),
  'catalog_entries', (select count(*) from public.substance_catalog),
  'vials', (select count(*) from public.vials),
  'dose_logs', (select count(*) from public.dose_logs),
  'cycles', (select count(*) from public.cycles),
  'effects', (select count(*) from public.effects),
  'reviews', (select count(*) from public.reviews),
  'injection_logs', (select count(*) from public.injection_logs),
  'items_without_ingredients', (
    select count(*)
    from public.stack_items item
    where not exists (
      select 1
      from public.stack_item_ingredients ingredient
      where ingredient.stack_item_id = item.id
    )
  ),
  'complete_items_with_missing_strength', (
    select count(distinct item.id)
    from public.stack_items item
    join public.stack_item_ingredients ingredient on ingredient.stack_item_id = item.id
    where item.configuration_status = 'complete'
      and (
        ingredient.amount_value is null
        or ingredient.amount_value <= 0
        or ingredient.amount_value >= 'Infinity'::numeric
        or nullif(btrim(ingredient.amount_unit), '') is null
        or ingredient.basis_value is null
        or ingredient.basis_value <= 0
        or ingredient.basis_value >= 'Infinity'::numeric
        or nullif(btrim(ingredient.basis_unit), '') is null
      )
  )
) as migration_counts;

select relation_name, orphan_count
from (
  select 'vials' as relation_name, count(*) as orphan_count
  from public.vials child
  left join public.stack_items parent on parent.id = child.stack_item_id
  where child.stack_item_id is not null and parent.id is null
  union all
  select 'dose_logs', count(*)
  from public.dose_logs child
  left join public.stack_items parent on parent.id = child.stack_item_id
  where child.stack_item_id is not null and parent.id is null
  union all
  select 'cycles', count(*)
  from public.cycles child
  left join public.stack_items parent on parent.id = child.stack_item_id
  where child.stack_item_id is not null and parent.id is null
  union all
  select 'effects', count(*)
  from public.effects child
  left join public.stack_items parent on parent.id = child.stack_item_id
  where child.stack_item_id is not null and parent.id is null
  union all
  select 'reviews', count(*)
  from public.reviews child
  left join public.stack_items parent on parent.id = child.stack_item_id
  where child.stack_item_id is not null and parent.id is null
  union all
  select 'injection_logs', count(*)
  from public.injection_logs child
  left join public.stack_items parent on parent.id = child.stack_item_id
  where child.stack_item_id is not null and parent.id is null
  union all
  select 'stack_item_ingredients', count(*)
  from public.stack_item_ingredients child
  left join public.stack_items parent on parent.id = child.stack_item_id
  where parent.id is null
) orphan_checks
order by relation_name;

select
  class.relname as relation_name,
  class.relrowsecurity as rls_enabled,
  policy.policyname,
  policy.roles,
  policy.cmd,
  policy.qual,
  policy.with_check
from pg_class class
join pg_namespace namespace on namespace.oid = class.relnamespace
left join pg_policies policy
  on policy.schemaname = namespace.nspname
  and policy.tablename = class.relname
where namespace.nspname = 'public'
  and class.relname in ('stack_items', 'stack_item_ingredients', 'substance_catalog')
order by class.relname, policy.policyname;

select
  grantee,
  table_name,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('stack_items', 'stack_item_ingredients', 'substance_catalog')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select
  has_function_privilege(
    'authenticated',
    'public.save_stack_item(jsonb,jsonb)',
    'EXECUTE'
  ) as authenticated_can_execute,
  has_function_privilege(
    'anon',
    'public.save_stack_item(jsonb,jsonb)',
    'EXECUTE'
  ) as anon_can_execute;

select json_build_object(
  'stack_items', (
    select count(*) from public.stack_items
    where display_name = '__my_stack_verifier_rollback__'
  ),
  'ingredients', (
    select count(*) from public.stack_item_ingredients
    where custom_name = '__my_stack_verifier_rollback__'
  )
) as qa_records_before;

begin;

select set_config(
  'request.jwt.claim.sub',
  (
    select user_row.id::text
    from auth.users user_row
    order by user_row.id
    limit 1
  ),
  true
) as qa_user_context_set;

set local role authenticated;

select (public.save_stack_item(
  jsonb_build_object(
    'display_name', '__my_stack_verifier_rollback__',
    'category', 'supplement',
    'dosage_form', 'capsule',
    'brand', 'Verifier rollback',
    'color_hex', '#123456',
    'notes', 'Rolled back by supabase-my-stack-verify.sql'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'catalog_substance_id', null,
      'custom_name', '__my_stack_verifier_rollback__',
      'amount_value', 1,
      'amount_unit', 'mg',
      'basis_value', 1,
      'basis_unit', 'capsule',
      'position', 0
    )
  )
)).id as qa_stack_item_id;

set constraints all immediate;
reset role;

select json_build_object(
  'stack_items', (
    select count(*) from public.stack_items
    where display_name = '__my_stack_verifier_rollback__'
  ),
  'ingredients', (
    select count(*) from public.stack_item_ingredients
    where custom_name = '__my_stack_verifier_rollback__'
  )
) as qa_records_inside_transaction;

rollback;

select json_build_object(
  'stack_items', (
    select count(*) from public.stack_items
    where display_name = '__my_stack_verifier_rollback__'
  ),
  'ingredients', (
    select count(*) from public.stack_item_ingredients
    where custom_name = '__my_stack_verifier_rollback__'
  )
) as qa_records_after_rollback;
