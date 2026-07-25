begin;

do $$
begin
  if exists (
    select 1
    from public.cycles
    where dose is null or unit is null
  ) then
    raise exception 'cannot restore cycles dose and unit constraints while null values exist';
  end if;

  if exists (
    select 1
    from public.dose_logs
    where dose is null or unit is null
  ) then
    raise exception 'cannot restore dose_logs dose and unit constraints while null values exist';
  end if;

  if exists (
    select 1
    from public.stack_items
    where tracking_level is distinct from 'complete'
  ) then
    raise exception 'cannot drop tracking_level after a tracking choice has been made';
  end if;

  if exists (
    select 1
    from public.stack_items
    where pk_profile_method is not null
      and pk_profile_method is distinct from default_method
  ) then
    raise exception 'cannot drop pk_profile_method after it diverges from default_method';
  end if;
end;
$$;

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

commit;
