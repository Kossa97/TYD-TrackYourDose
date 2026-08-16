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
    'stack_item_inventory',
      exists (
        select 1 from information_schema.tables
        where table_schema = 'public'
          and table_name = 'stack_item_inventory'
      ),
    'inventory_movement_dose_log_unique',
      exists (
        select 1
        from pg_constraint constraint_row
        join pg_class table_row on table_row.oid = constraint_row.conrelid
        join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
        where schema_row.nspname = 'public'
          and table_row.relname = 'stack_item_inventory_movements'
          and constraint_row.contype = 'u'
      ),
    'apply_inventory_confirmation',
      to_regprocedure('public.apply_inventory_confirmation(uuid)') is not null
  )
);
