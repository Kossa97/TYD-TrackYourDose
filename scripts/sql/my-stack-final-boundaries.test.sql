\set ON_ERROR_STOP on
-- This file runs after the behavior suite has applied enforcement twice.
-- Run after the existing behavior fixture, including enforcement, in a disposable DB.
begin;
insert into public.stack_items(id,user_id,tracking_level) values
 ('99000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','complete');
insert into public.cycles(id,user_id,stack_item_id,started_at,ended_at,start_date) values
 ('99000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99000000-0000-0000-0000-000000000001','2030-01-01T12:00Z','2030-01-01T14:00Z','2030-01-01');
insert into public.cycle_plan_versions(id,user_id,cycle_id,effective_kind,effective_local_date,change_kind,frequency,intake_time,dose,unit,method) values
 ('99000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','99000000-0000-0000-0000-000000000002','local_date','2030-01-01','initial','Täglich','morgens',1,'mg','Oral');
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
do $$
declare
  entry jsonb := jsonb_build_object('cycle_id','99000000-0000-0000-0000-000000000002',
    'stack_item_id','99000000-0000-0000-0000-000000000001','timezone','UTC',
    'dose',1,'unit','mg','method','Oral');
  boundary text;
begin
  foreach boundary in array array['2030-01-01T11:59Z','2030-01-01T14:00Z'] loop
    begin
      perform public.confirm_intake_group(jsonb_build_array(entry || jsonb_build_object('slot_key',boundary,'logged_at',boundary)));
      raise exception 'accepted out-of-lifecycle intake';
    exception when others then
      if sqlerrm <> 'Intake falls outside cycle lifecycle' then raise; end if;
    end;
  end loop;
  -- Ordinary, grouped and injection-route inputs use the same authoritative boundary.
  perform public.confirm_intake_group(jsonb_build_array(entry || jsonb_build_object('slot_key','ordinary','logged_at','2030-01-01T12:01Z')));
  perform public.confirm_intake_group(jsonb_build_array(
    entry || jsonb_build_object('slot_key','group-1','logged_at','2030-01-01T12:02Z'),
    entry || jsonb_build_object('slot_key','injection','logged_at','2030-01-01T12:03Z','method','Subkutan')));
  if (select count(*) from public.dose_logs where cycle_id='99000000-0000-0000-0000-000000000002') <> 3 then
    raise exception 'post-enforcement confirmations missing';
  end if;
  begin
    update public.cycles set active=false where id='99000000-0000-0000-0000-000000000002';
    raise exception 'direct cycle mutation allowed';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000004',true);
  begin
    perform public.confirm_intake_group(jsonb_build_array(entry || jsonb_build_object('slot_key','foreign','logged_at','2030-01-01T12:04Z')));
    raise exception 'foreign confirmation allowed';
  exception when others then
    if sqlerrm <> 'Intake cycle not found' then raise; end if;
  end;
end $$;
reset role;
-- SQL uses the same absolute order as the TS/Node fallback-hour parity fixture.
insert into cycle_plan_versions(user_id,cycle_id,effective_kind,effective_at,change_kind,frequency,intake_time,dose,unit,method) values
('30000000-0000-0000-0000-000000000003','99000000-0000-0000-0000-000000000002','instant','2026-10-25T00:50Z','dose','Täglich','morgens',10,'mg','Oral'),
('30000000-0000-0000-0000-000000000003','99000000-0000-0000-0000-000000000002','instant','2026-10-25T01:10Z','dose','Täglich','morgens',20,'mg','Oral');
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
do $$ declare picked cycle_plan_versions; begin
  select * into picked from cycle_plan_versions where id = resolve_plan_version_id('99000000-0000-0000-0000-000000000002','2026-10-25T02:00Z','Europe/Berlin');
  if picked.dose <> 20 then raise exception 'SQL fallback-hour order differs'; end if;
end $$;
reset role;
rollback;

-- Committed synthetic rows allow two independent dblink transactions.
insert into public.stack_items(id,user_id,tracking_level) values
 ('99300000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','complete');
insert into public.cycles(id,user_id,stack_item_id,started_at,start_date) values
 ('99300000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99300000-0000-0000-0000-000000000001',now()-interval '2 days',current_date-2);
insert into cycle_plan_versions(user_id,cycle_id,effective_kind,effective_local_date,change_kind,frequency,intake_time,dose,unit,method) values
 ('30000000-0000-0000-0000-000000000003','99300000-0000-0000-0000-000000000002','local_date',current_date-2,'initial','Täglich','morgens',1,'mg','Oral');
create function final_stale_confirmation() returns text language plpgsql as $$ begin
  perform public.confirm_intake_group(jsonb_build_array(jsonb_build_object(
    'cycle_id','99300000-0000-0000-0000-000000000002','stack_item_id','99300000-0000-0000-0000-000000000001',
    'timezone','UTC','slot_key','stale-after-end','logged_at',clock_timestamp()+interval '1 second','dose',1,'unit','mg','method','Oral')));
  return 'unexpected success';
exception when others then return sqlerrm;
end $$;
do $$ declare outcome text; begin
  perform dblink_connect('final_end','dbname='||current_database());
  perform dblink_connect('final_confirm','dbname='||current_database());
  perform dblink_exec('final_end',$q$set role authenticated; set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003'; begin$q$);
  perform result from dblink('final_end',$q$select end_cycle('99300000-0000-0000-0000-000000000002','race-end')$q$) as ended(result jsonb);
  perform dblink_exec('final_confirm',$q$set role authenticated; set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003'; set statement_timeout='5s'$q$);
  perform dblink_send_query('final_confirm','select final_stale_confirmation()');
  perform pg_sleep(0.1);
  if dblink_is_busy('final_confirm') <> 1 then raise exception 'confirmation did not wait for lifecycle lock'; end if;
  perform dblink_exec('final_end','commit');
  select result into outcome from dblink_get_result('final_confirm') as done(result text);
  perform dblink_disconnect('final_end');
  perform dblink_disconnect('final_confirm');
  if outcome <> 'Intake falls outside cycle lifecycle' or exists(select from dose_logs where routine_slot_key='stale-after-end') then
    raise exception 'stale confirmation escaped the committed end: %', outcome;
  end if;
end $$;

insert into public.stack_items(id,user_id,tracking_level) values
 ('99100000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','complete');
insert into public.cycles(id,user_id,stack_item_id,started_at,start_date) values
 ('99100000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99100000-0000-0000-0000-000000000001',now()-interval '2 days',current_date-2);
insert into public.cycle_pause_periods(id,user_id,cycle_id,paused_at) values
 ('99100000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','99100000-0000-0000-0000-000000000002',now()-interval '1 hour');
do $$
declare wrong_order boolean := false;
begin
  perform dblink_connect('final_cycle_lock','dbname='||current_database());
  perform dblink_connect('final_pause_edit','dbname='||current_database());
  perform dblink_exec('final_cycle_lock','begin');
  perform id from dblink('final_cycle_lock',$q$select id from public.cycles where id='99100000-0000-0000-0000-000000000002' for update$q$) as locked(id uuid);
  perform dblink_exec('final_pause_edit',$q$set role authenticated; set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003'; set statement_timeout='5s'$q$);
  perform dblink_send_query('final_pause_edit',$q$select public.set_pause_end('99100000-0000-0000-0000-000000000003',clock_timestamp()+interval '2 hours','final-lock-order')$q$);
  perform pg_sleep(0.2);
  begin
    perform id from dblink('final_cycle_lock',$q$select id from public.cycle_pause_periods where id='99100000-0000-0000-0000-000000000003' for update nowait$q$) as locked(id uuid);
  exception when lock_not_available then wrong_order := true;
  end;
  perform dblink_exec('final_cycle_lock','rollback');
  perform result from dblink_get_result('final_pause_edit') as finished(result jsonb);
  perform dblink_disconnect('final_cycle_lock');
  perform dblink_disconnect('final_pause_edit');
  if wrong_order then raise exception 'set_pause_end locked pause before cycle'; end if;
end $$;

begin;
insert into public.stack_items(id,user_id,tracking_level) values
 ('99000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000003','complete');
insert into public.cycles(id,user_id,stack_item_id,started_at,start_date) values
 ('99000000-0000-0000-0000-000000000012','30000000-0000-0000-0000-000000000003','99000000-0000-0000-0000-000000000011','2050-01-01T00:00Z','2050-01-01');
insert into public.cycle_plan_versions(id,user_id,cycle_id,effective_kind,effective_local_date,change_kind,frequency,intake_time,dose,unit,method) values
 ('99000000-0000-0000-0000-000000000013','30000000-0000-0000-0000-000000000003','99000000-0000-0000-0000-000000000012','local_date','2050-01-01','initial','Täglich','morgens',1,'mg','Oral');
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
do $$ declare immediate cycle_plan_versions; zone text; before_immediate timestamptz; begin
  begin
    perform public.remove_future_plan_version('99000000-0000-0000-0000-000000000013','UTC','sole-removal');
    raise exception 'sole initial version removed';
  exception when others then
    if sqlerrm <> 'Initial plan coverage cannot be removed' then raise; end if;
  end;
  begin
    perform public.create_plan_version('99000000-0000-0000-0000-000000000012','local_date',null,'2000-01-01','dose',
      jsonb_build_object('frequency','Täglich','intake_time','morgens','dose',1,'unit','mg','method','Oral'),'backdated-change');
    raise exception 'backdated change accepted';
  exception when others then
    if sqlerrm <> 'Plan changes require a future boundary or now' then raise; end if;
  end;
  foreach zone in array array['America/New_York','Asia/Tokyo'] loop
    begin
      perform public.create_plan_version('99000000-0000-0000-0000-000000000012','local_date',null,
        (transaction_timestamp() at time zone zone)::date,'dose',
        jsonb_build_object('frequency','Täglich','intake_time','morgens','dose',1,'unit','mg','method','Oral','_timezone',zone),'today-'||zone);
      raise exception 'already-started local day accepted';
    exception when others then if sqlerrm <> 'Plan changes require a future boundary or now' then raise; end if; end;
  end loop;
  before_immediate := clock_timestamp();
  immediate := public.create_plan_version('99000000-0000-0000-0000-000000000012','instant','2000-01-01',null,'dose',
    jsonb_build_object('frequency','Täglich','intake_time','morgens','dose',1,'unit','mg','method','Oral','_timezone','Asia/Tokyo','_effective_now',true),'server-now');
  if immediate.effective_at < before_immediate or immediate.effective_at > clock_timestamp() then
    raise exception 'immediate trusted client or transaction-start clock';
  end if;
end $$;
reset role;
rollback;
