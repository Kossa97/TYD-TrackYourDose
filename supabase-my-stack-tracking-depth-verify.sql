with
required_movement_indexes(index_name, table_name, column_names) as (
  values
    (
      'stack_item_inventory_movements_source_unique',
      'stack_item_inventory_movements',
      array['user_id', 'source_dose_log_id']::text[]
    ),
    (
      'vial_stock_movements_source_unique',
      'vial_stock_movements',
      array['user_id', 'source_dose_log_id']::text[]
    )
),
required_inventory_tables(table_name) as (
  values
    ('stack_item_inventory'),
    ('stack_item_inventory_movements'),
    ('vial_stock_movements')
),
required_inventory_policies(
  table_name,
  policy_name,
  command,
  permissive,
  using_expression,
  check_expression
) as (
  values
    ('stack_item_inventory', 'own stack item inventory select', 'r', true,
      'auth.uid=user_id', null::text),
    ('stack_item_inventory', 'own stack item inventory insert', 'a', true,
      null::text,
      'auth.uid=user_idandexistsselect1fromstack_itemsowned_itemwhereowned_item.id=stack_item_idandowned_item.user_id=auth.uid'),
    ('stack_item_inventory', 'own stack item inventory update', 'w', true,
      'auth.uid=user_id',
      'auth.uid=user_idandexistsselect1fromstack_itemsowned_itemwhereowned_item.id=stack_item_idandowned_item.user_id=auth.uid'),
    ('stack_item_inventory', 'own stack item inventory delete', 'd', true,
      'auth.uid=user_id', null::text),
    ('stack_item_inventory_movements', 'own stack item inventory movements select', 'r', true,
      'auth.uid=user_id', null::text),
    ('stack_item_inventory_movements', 'own stack item inventory movements insert', 'a', true,
      null::text,
      'auth.uid=user_idandsource_dose_log_id=dose_log_idandexistsselect1fromstack_item_inventoryowned_inventorywhereowned_inventory.id=inventory_idandowned_inventory.user_id=auth.uidandexistsselect1fromdose_logsowned_logwhereowned_log.id=dose_log_idandowned_log.user_id=auth.uid'),
    ('stack_item_inventory_movements', 'own stack item inventory movements update', 'w', true,
      'auth.uid=user_id', 'auth.uid=user_id'),
    ('vial_stock_movements', 'own vial stock movements select', 'r', true,
      'auth.uid=user_id', null::text),
    ('vial_stock_movements', 'own vial stock movements insert', 'a', true,
      null::text,
      'auth.uid=user_idandsource_dose_log_id=dose_log_idandexistsselect1fromstack_itemsowned_itemwhereowned_item.id=stack_item_idandowned_item.user_id=auth.uidandexistsselect1fromdose_logsowned_logwhereowned_log.id=dose_log_idandowned_log.user_id=auth.uid'),
    ('vial_stock_movements', 'own vial stock movements update', 'w', true,
      'auth.uid=user_id', 'auth.uid=user_id')
),
required_inventory_grants(table_name, privilege_type) as (
  values
    ('stack_item_inventory', 'DELETE'),
    ('stack_item_inventory', 'INSERT'),
    ('stack_item_inventory', 'SELECT'),
    ('stack_item_inventory', 'UPDATE'),
    ('stack_item_inventory_movements', 'INSERT'),
    ('stack_item_inventory_movements', 'SELECT'),
    ('stack_item_inventory_movements', 'UPDATE'),
    ('vial_stock_movements', 'INSERT'),
    ('vial_stock_movements', 'SELECT'),
    ('vial_stock_movements', 'UPDATE')
),
required_rpc_grants(signature) as (
  values
    ('public.save_stack_item(jsonb,jsonb)'),
    ('public.save_stack_item_with_plan(jsonb,jsonb,jsonb)'),
    ('public.confirm_intake_group(jsonb)'),
    ('public.apply_inventory_confirmation(uuid)'),
    ('public.reverse_inventory_confirmation(uuid,text)')
),
unexpected_inventory_policy as (
  select 1
  from pg_policy policy
  join pg_class table_row on table_row.oid = policy.polrelid
  join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
  join required_inventory_tables required_table on required_table.table_name = table_row.relname
  where schema_row.nspname = 'public'
    and not exists (
      select 1
      from required_inventory_policies required
      where required.table_name = table_row.relname
        and required.policy_name = policy.polname
    )
)
select jsonb_build_object(
  'tracking_depth_contract', jsonb_build_object(
    'stack_items_tracking_level',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'stack_items'
          and column_name = 'tracking_level'
          and is_nullable = 'NO'
      ),
    'cycles_dose_nullable',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'cycles'
          and column_name = 'dose'
          and is_nullable = 'YES'
      ),
    'dose_logs_dose_nullable',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'dose_logs'
          and column_name = 'dose'
          and is_nullable = 'YES'
      ),
    'routine_slot_identity',
      exists (
        select 1
        from pg_class index_row
        join pg_namespace index_schema on index_schema.oid = index_row.relnamespace
        join pg_index index_meta on index_meta.indexrelid = index_row.oid
        join pg_class table_row on table_row.oid = index_meta.indrelid
        join pg_namespace table_schema on table_schema.oid = table_row.relnamespace
        where index_schema.nspname = 'public'
          and index_row.relname = 'dose_logs_routine_slot_unique'
          and table_schema.nspname = 'public'
          and table_row.relname = 'dose_logs'
          and index_meta.indisunique
          and index_meta.indisvalid
          and index_meta.indisready
          and index_meta.indnkeyatts = 2
          and index_meta.indnatts = index_meta.indnkeyatts
          and index_meta.indexprs is null
          and (
            select array_agg(attribute.attname::text order by key.ordinality)
            from unnest(
              regexp_split_to_array(btrim(index_meta.indkey::text), '\s+')::smallint[]
            ) with ordinality as key(attribute_number, ordinality)
            join pg_attribute attribute
              on attribute.attrelid = index_meta.indrelid
             and attribute.attnum = key.attribute_number
            where key.ordinality <= index_meta.indnkeyatts
          ) = array['user_id', 'routine_slot_key']::text[]
          and index_meta.indpred is not null
          and replace(
            replace(
              regexp_replace(
                lower(pg_get_expr(index_meta.indpred, index_meta.indrelid, false)),
                '[[:space:]()"]',
                '',
                'g'
              ),
              'public.',
              ''
            ),
            table_row.relname || '.',
            ''
          ) = 'routine_slot_keyisnotnull'
      ),
    'stack_item_inventory',
      to_regclass('public.stack_item_inventory') is not null,
    'stack_item_inventory_movements',
      to_regclass('public.stack_item_inventory_movements') is not null,
    'vial_stock_movements',
      to_regclass('public.vial_stock_movements') is not null,
    'movement_source_indexes_exact',
      not exists (
        select 1
        from required_movement_indexes required
        where not exists (
          select 1
          from pg_class index_row
          join pg_namespace index_schema on index_schema.oid = index_row.relnamespace
          join pg_index index_meta on index_meta.indexrelid = index_row.oid
          join pg_class table_row on table_row.oid = index_meta.indrelid
          join pg_namespace table_schema on table_schema.oid = table_row.relnamespace
          where index_schema.nspname = 'public'
            and index_row.relname = required.index_name
            and table_schema.nspname = 'public'
            and table_row.relname = required.table_name
            and index_meta.indisunique
            and index_meta.indisvalid
            and index_meta.indisready
            and index_meta.indnkeyatts = cardinality(required.column_names)
            and index_meta.indnatts = index_meta.indnkeyatts
            and index_meta.indpred is null
            and index_meta.indexprs is null
            and (
              select array_agg(attribute.attname::text order by key.ordinality)
              from unnest(
                regexp_split_to_array(btrim(index_meta.indkey::text), '\s+')::smallint[]
              ) with ordinality as key(attribute_number, ordinality)
              join pg_attribute attribute
                on attribute.attrelid = index_meta.indrelid
               and attribute.attnum = key.attribute_number
              where key.ordinality <= index_meta.indnkeyatts
            ) = required.column_names
        )
      ),
    'inventory_rls',
      not exists (
        select 1
        from required_inventory_tables required
        where not exists (
          select 1
          from pg_class table_row
          join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
          where schema_row.nspname = 'public'
            and table_row.relname = required.table_name
            and table_row.relrowsecurity
        )
      ),
    'inventory_owner_policies_exact',
      not exists (
        select 1
        from required_inventory_policies required
        where not exists (
          select 1
          from pg_policy policy
          join pg_class table_row on table_row.oid = policy.polrelid
          join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
          where schema_row.nspname = 'public'
            and table_row.relname = required.table_name
            and policy.polname = required.policy_name
            and policy.polcmd::text = required.command
            and policy.polpermissive = required.permissive
            and policy.polroles = array[(select oid from pg_roles where rolname = 'authenticated')]::oid[]
            and replace(
              replace(
                regexp_replace(
                  lower(pg_get_expr(policy.polqual, policy.polrelid, false)),
                  '[[:space:]()"]',
                  '',
                  'g'
                ),
                'public.',
                ''
              ),
              required.table_name || '.',
              ''
            ) is not distinct from required.using_expression
            and replace(
              replace(
                regexp_replace(
                  lower(pg_get_expr(policy.polwithcheck, policy.polrelid, false)),
                  '[[:space:]()"]',
                  '',
                  'g'
                ),
                'public.',
                ''
              ),
              required.table_name || '.',
              ''
            ) is not distinct from required.check_expression
        )
      ),
    'no_unexpected_inventory_policy',
      not exists (select 1 from unexpected_inventory_policy),
    'inventory_authenticated_grants_exact',
      not exists (
        select 1
        from required_inventory_grants required
        where not exists (
          select 1
          from pg_class table_row
          join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
          cross join lateral aclexplode(
            coalesce(table_row.relacl, acldefault('r'::"char", table_row.relowner))
          ) acl
          where schema_row.nspname = 'public'
            and table_row.relname = required.table_name
            and acl.grantee = (select oid from pg_roles where rolname = 'authenticated')
            and acl.privilege_type = required.privilege_type
            and not acl.is_grantable
        )
      )
      and not exists (
        select 1
        from required_inventory_tables required_table
        join pg_class table_row on table_row.relname = required_table.table_name
        join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
        cross join lateral aclexplode(
          coalesce(table_row.relacl, acldefault('r'::"char", table_row.relowner))
        ) acl
        where schema_row.nspname = 'public'
          and acl.grantee = (select oid from pg_roles where rolname = 'authenticated')
          and (
            acl.is_grantable
            or not exists (
              select 1
              from required_inventory_grants required
              where required.table_name = required_table.table_name
                and required.privilege_type = acl.privilege_type
            )
          )
      ),
    'no_public_or_anon_inventory_grants',
      not exists (
        select 1
        from required_inventory_tables required
        join pg_class table_row on table_row.relname = required.table_name
        join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
        cross join lateral aclexplode(
          coalesce(table_row.relacl, acldefault('r'::"char", table_row.relowner))
        ) acl
        where schema_row.nspname = 'public'
          and (
            acl.grantee = 0
            or acl.grantee = (select oid from pg_roles where rolname = 'anon')
          )
      ),
    'no_inventory_column_grants',
      not exists (
        select 1
        from required_inventory_tables required
        join pg_class table_row on table_row.relname = required.table_name
        join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
        join pg_attribute attribute on attribute.attrelid = table_row.oid
        cross join lateral aclexplode(attribute.attacl) acl
        where schema_row.nspname = 'public'
          and attribute.attnum > 0
          and not attribute.attisdropped
          and attribute.attacl is not null
          and (
            acl.grantee = 0
            or acl.grantee = (select oid from pg_roles where rolname = 'anon')
            or acl.grantee = (select oid from pg_roles where rolname = 'authenticated')
          )
      ),
    'required_rpc_grants_exact',
      not exists (
        select 1
        from required_rpc_grants required
        where to_regprocedure(required.signature) is null
          or not exists (
            select 1
            from pg_proc routine
            cross join lateral aclexplode(
              coalesce(routine.proacl, acldefault('f'::"char", routine.proowner))
            ) acl
            where routine.oid = to_regprocedure(required.signature)
              and acl.grantee = (select oid from pg_roles where rolname = 'authenticated')
              and acl.privilege_type = 'EXECUTE'
              and not acl.is_grantable
          )
      )
      and not exists (
        select 1
        from required_rpc_grants required
        join pg_proc routine on routine.oid = to_regprocedure(required.signature)
        cross join lateral aclexplode(
          coalesce(routine.proacl, acldefault('f'::"char", routine.proowner))
        ) acl
        where (
          acl.grantee = (select oid from pg_roles where rolname = 'authenticated')
          and (acl.privilege_type <> 'EXECUTE' or acl.is_grantable)
        )
          or acl.grantee = 0
          or acl.grantee = (select oid from pg_roles where rolname = 'anon')
      ),
    'save_stack_item_with_plan',
      to_regprocedure('public.save_stack_item_with_plan(jsonb,jsonb,jsonb)') is not null,
    'confirm_intake_group',
      to_regprocedure('public.confirm_intake_group(jsonb)') is not null,
    'apply_inventory_confirmation',
      to_regprocedure('public.apply_inventory_confirmation(uuid)') is not null,
    'reverse_inventory_confirmation',
      to_regprocedure('public.reverse_inventory_confirmation(uuid,text)') is not null
  )
);
