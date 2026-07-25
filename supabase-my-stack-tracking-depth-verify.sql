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
      )
  )
);
