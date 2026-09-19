\set ON_ERROR_STOP on
-- Run after the behavior suite. These users have no saved device timezone.
insert into auth.users values ('99200000-0000-0000-0000-000000000001');
insert into stack_items(id,user_id) values
('99200000-0000-0000-0000-000000000002','99200000-0000-0000-0000-000000000001'),
('99200000-0000-0000-0000-000000000003','99200000-0000-0000-0000-000000000001');
insert into cycles(id,user_id,stack_item_id,start_date,end_date) values
('99200000-0000-0000-0000-000000000004','99200000-0000-0000-0000-000000000001','99200000-0000-0000-0000-000000000002','2050-09-18','2050-09-19'),
('99200000-0000-0000-0000-000000000005','99200000-0000-0000-0000-000000000001','99200000-0000-0000-0000-000000000003','2050-09-18','2050-09-19');
\ir ../../supabase-my-stack-plan-integrity.sql
do $$ begin
  if (select count(*) from cycles where timezone_review_required) <> 2
    or (select count(*) from cycle_migration_conflicts where resolved_at is null) <> 2
    or exists(select from cycles where timezone_review_required and started_at is not null)
    or (select count(*) from stack_items where user_id='99200000-0000-0000-0000-000000000001' and configuration_status='needs_review') <> 2 then
    raise exception 'missing timezone was silently guessed';
  end if;
end $$;
create temp table timezone_versions as select to_jsonb(v) snapshot from cycle_plan_versions v;
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
do $$ begin
  begin
    perform resolve_cycle_course_timezone('99200000-0000-0000-0000-000000000002','America/New_York','foreign-zone');
    raise exception 'foreign timezone changed';
  exception when others then if sqlerrm <> 'Stack item not found' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','99200000-0000-0000-0000-000000000001',false);
do $$ declare first_result jsonb; retry_result jsonb; begin
  begin
    perform resolve_cycle_course_timezone('99200000-0000-0000-0000-000000000002','not/a-zone','invalid-zone');
    raise exception 'invalid timezone accepted';
  exception when others then if sqlerrm <> 'Valid course timezone is required' then raise; end if; end;
  first_result := resolve_cycle_course_timezone('99200000-0000-0000-0000-000000000002','America/New_York','ny-zone');
  retry_result := resolve_cycle_course_timezone('99200000-0000-0000-0000-000000000002','America/New_York','ny-zone');
  if first_result <> retry_result then raise exception 'timezone retry not idempotent'; end if;
  perform resolve_cycle_course_timezone('99200000-0000-0000-0000-000000000003','Asia/Tokyo','tokyo-zone');
  if not exists(select from cycles where id='99200000-0000-0000-0000-000000000004' and started_at='2050-09-18T04:00Z' and ended_at='2050-09-20T04:00Z' and lifecycle_timezone='America/New_York')
    or not exists(select from cycles where id='99200000-0000-0000-0000-000000000005' and started_at='2050-09-17T15:00Z' and ended_at='2050-09-19T15:00Z' and lifecycle_timezone='Asia/Tokyo') then
    raise exception 'review did not materialize fixed local course boundaries';
  end if;
  -- A finite future end is not already ended: lifecycle operations remain legal.
  perform pause_cycle('99200000-0000-0000-0000-000000000004',null,'finite-pause');
end $$;
reset role;
do $$ begin
  if exists((select snapshot from timezone_versions) except (select to_jsonb(v) from cycle_plan_versions v))
    or exists(select from cycle_migration_conflicts where resolved_at is null)
    or exists(select from stack_items where user_id='99200000-0000-0000-0000-000000000001' and configuration_status<>'complete') then
    raise exception 'timezone review lost history or left unresolved state';
  end if;
end $$;
\ir ../../supabase-my-stack-plan-integrity-enforce.sql
\ir ../../supabase-my-stack-plan-integrity-enforce.sql
