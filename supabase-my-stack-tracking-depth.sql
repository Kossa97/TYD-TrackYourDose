begin;

alter table public.stack_items
  add column if not exists tracking_level text not null default 'complete',
  add column if not exists pk_profile_method text;

alter table public.stack_items
  drop constraint if exists stack_items_tracking_level_check;

alter table public.stack_items
  add constraint stack_items_tracking_level_check
  check (tracking_level in ('intake_only', 'with_amount', 'complete'));

update public.stack_items
set tracking_level = 'complete'
where tracking_level is null;

update public.stack_items
set pk_profile_method = nullif(btrim(default_method), '')
where pk_profile_id is not null
  and pk_profile_method is null;

alter table public.cycles
  alter column dose drop not null,
  alter column unit drop not null;

alter table public.dose_logs
  alter column dose drop not null,
  alter column unit drop not null;

commit;
