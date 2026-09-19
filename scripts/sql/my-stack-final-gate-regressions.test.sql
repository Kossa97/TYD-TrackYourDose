\set ON_ERROR_STOP on
-- Run after the behavior fixture and enforcement in a disposable PostgreSQL 16 database.

begin;
insert into public.stack_items(id,user_id,tracking_level) values
 ('99800000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','complete');
insert into public.cycles(id,user_id,stack_item_id,started_at,start_date) values
 ('99800000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99800000-0000-0000-0000-000000000001','2050-01-01T00:00Z','2050-01-01');
insert into public.cycle_plan_versions(id,user_id,cycle_id,effective_kind,effective_at,change_kind,frequency,intake_time,dose,unit,method) values
 ('99800000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','99800000-0000-0000-0000-000000000002','instant','2050-01-01T00:00Z','initial','Täglich','morgens',1,'mg','Oral');
set role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
do $$
declare
  resolved uuid;
begin
  begin
    perform public.replace_future_plan_version(
      '99800000-0000-0000-0000-000000000003','instant','2050-01-03T00:00Z',null,'initial',
      '{"frequency":"Täglich","intake_time":"morgens","dose":2,"unit":"mg","method":"Oral"}',
      'UTC','final-gap-replacement'
    );
    raise exception 'replacement created a lifecycle coverage gap';
  exception when others then
    if sqlerrm <> 'Initial plan coverage cannot be moved after cycle start' then raise; end if;
  end;
  resolved := public.resolve_plan_version_id(
    '99800000-0000-0000-0000-000000000002','2050-01-02T00:00Z','UTC'
  );
  if resolved <> '99800000-0000-0000-0000-000000000003'::uuid then
    raise exception 'failed replacement changed initial lifecycle coverage';
  end if;
end $$;
reset role;
rollback;

-- Committed fixtures allow independent sessions to reproduce aged transactions.
insert into public.stack_items(id,user_id,tracking_level) values
 ('99810000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','complete'),
 ('99820000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','complete'),
 ('99830000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','complete');
insert into public.cycles(id,user_id,stack_item_id,started_at,start_date) values
 ('99810000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99810000-0000-0000-0000-000000000001',clock_timestamp()-interval '1 day',current_date-1),
 ('99820000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99820000-0000-0000-0000-000000000001',clock_timestamp()-interval '1 day',current_date-1),
 ('99830000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99830000-0000-0000-0000-000000000001',clock_timestamp()-interval '1 day',current_date-1);
insert into public.cycle_plan_versions(id,user_id,cycle_id,effective_kind,effective_at,change_kind,frequency,intake_time,dose,unit,method) values
 ('99810000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','99810000-0000-0000-0000-000000000002','instant',clock_timestamp()-interval '1 day','initial','Täglich','morgens',1,'mg','Oral'),
 ('99820000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','99820000-0000-0000-0000-000000000002','instant',clock_timestamp()-interval '1 day','initial','Täglich','morgens',1,'mg','Oral'),
 ('99830000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','99830000-0000-0000-0000-000000000002','instant',clock_timestamp()-interval '1 day','initial','Täglich','morgens',1,'mg','Oral');

create or replace function public.final_gate_rpc_result(p_sql text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  result jsonb;
begin
  execute p_sql into result;
  return coalesce(result, '{}'::jsonb);
exception when others then
  return jsonb_build_object('error', sqlerrm);
end
$$;

do $$
declare
  remove_boundary timestamptz := clock_timestamp() + interval '2 seconds';
  replace_boundary timestamptz := clock_timestamp() + interval '2 seconds';
  remove_version uuid;
  replace_version uuid;
  remove_transaction_started_at timestamptz;
  replace_transaction_started_at timestamptz;
  result jsonb;
begin
  insert into public.cycle_plan_versions(user_id,cycle_id,effective_kind,effective_at,change_kind,frequency,intake_time,dose,unit,method)
  values ('30000000-0000-0000-0000-000000000003','99810000-0000-0000-0000-000000000002','instant',remove_boundary,'dose','Täglich','morgens',2,'mg','Oral')
  returning id into remove_version;
  insert into public.cycle_plan_versions(user_id,cycle_id,effective_kind,effective_at,change_kind,frequency,intake_time,dose,unit,method)
  values ('30000000-0000-0000-0000-000000000003','99820000-0000-0000-0000-000000000002','instant',clock_timestamp()+interval '1 hour','dose','Täglich','morgens',2,'mg','Oral')
  returning id into replace_version;

  perform dblink_connect('final_gate_lock','dbname='||current_database());
  perform dblink_connect('final_gate_remove','dbname='||current_database());
  perform dblink_connect('final_gate_replace','dbname='||current_database());
  perform dblink_exec('final_gate_remove',$q$set role authenticated; set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003'; begin$q$);
  perform dblink_exec('final_gate_replace',$q$set role authenticated; set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003'; begin$q$);
  select value into remove_transaction_started_at
  from dblink('final_gate_remove','select transaction_timestamp()') as started(value timestamptz);
  select value into replace_transaction_started_at
  from dblink('final_gate_replace','select transaction_timestamp()') as started(value timestamptz);
  if remove_transaction_started_at >= remove_boundary
    or replace_transaction_started_at >= replace_boundary then
    raise exception 'aged transaction did not begin before the tested future boundary';
  end if;
  perform dblink_exec('final_gate_lock','begin');
  perform id from dblink('final_gate_lock',$q$select id from cycles where id in (
    '99810000-0000-0000-0000-000000000002','99820000-0000-0000-0000-000000000002') order by id for update$q$) as locked(id uuid);
  perform dblink_send_query('final_gate_remove',format(
    'select final_gate_rpc_result(%L)',format(
      'select to_jsonb(remove_future_plan_version(%L,%L,%L))',remove_version,'UTC','final-aged-remove')));
  perform dblink_send_query('final_gate_replace',format(
    'select final_gate_rpc_result(%L)',format(
      'select to_jsonb(replace_future_plan_version(%L,%L,%L,null,%L,%L::jsonb,%L,%L))',
      replace_version,'instant',replace_boundary,'dose',
      '{"frequency":"Täglich","intake_time":"morgens","dose":3,"unit":"mg","method":"Oral"}',
      'UTC','final-aged-replace')));
  perform pg_sleep(2.25);
  if dblink_is_busy('final_gate_remove') <> 1 or dblink_is_busy('final_gate_replace') <> 1 then
    raise exception 'future mutation did not wait on the lifecycle lock';
  end if;
  perform dblink_exec('final_gate_lock','commit');
  select value into result from dblink_get_result('final_gate_remove') as done(value jsonb);
  if result->>'error' <> 'Plan version is already effective' then
    raise exception 'aged remove used transaction start instead of post-lock time: %',result;
  end if;
  select value into result from dblink_get_result('final_gate_replace') as done(value jsonb);
  if result->>'error' <> 'Plan version is already effective' then
    raise exception 'aged replace used transaction start instead of post-lock time: %',result;
  end if;
  perform dblink_exec('final_gate_remove','rollback');
  perform dblink_exec('final_gate_replace','rollback');
  perform dblink_disconnect('final_gate_lock');
  perform dblink_disconnect('final_gate_remove');
  perform dblink_disconnect('final_gate_replace');
  if not exists(select from cycle_plan_versions where id=remove_version)
    or not exists(select from cycle_plan_versions where id=replace_version and effective_at > clock_timestamp()) then
    raise exception 'rejected aged mutation changed a future plan version';
  end if;
end $$;

set role authenticated;
set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003';
do $$
declare
  payload jsonb := jsonb_build_object(
    'cycle_id','99830000-0000-0000-0000-000000000002',
    'plan_version_id','99830000-0000-0000-0000-000000000003',
    'stack_item_id','99830000-0000-0000-0000-000000000001',
    'timezone','UTC','slot_key','final-valid-skip','logged_at',clock_timestamp(),
    'dose',1,'unit','mg','method','Oral','taken',false
  );
  saved public.dose_logs;
  retried public.dose_logs;
begin
  select * into strict saved from public.confirm_intake_group(jsonb_build_array(payload));
  select * into strict retried from public.confirm_intake_group(jsonb_build_array(payload));
  if saved.taken is distinct from false or saved.id <> retried.id
    or saved.cycle_id <> '99830000-0000-0000-0000-000000000002'::uuid
    or saved.plan_version_id <> '99830000-0000-0000-0000-000000000003'::uuid then
    raise exception 'valid skip lost decision, provenance, or idempotency';
  end if;
end $$;
reset role;

do $$
declare
  result text;
begin
  perform dblink_connect('final_gate_pause','dbname='||current_database());
  perform dblink_connect('final_gate_skip','dbname='||current_database());
  perform dblink_exec('final_gate_pause',$q$set role authenticated; set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003'; begin$q$);
  perform value from dblink('final_gate_pause',$q$select pause_cycle('99830000-0000-0000-0000-000000000002',null,'final-stale-skip-pause')$q$) as paused(value jsonb);
  perform dblink_exec('final_gate_skip',$q$set role authenticated; set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003'; set statement_timeout='5s'$q$);
  perform dblink_send_query('final_gate_skip',$q$
    select test_confirm_intake_error(jsonb_build_array(jsonb_build_object(
      'cycle_id','99830000-0000-0000-0000-000000000002',
      'plan_version_id','99830000-0000-0000-0000-000000000003',
      'stack_item_id','99830000-0000-0000-0000-000000000001',
      'timezone','UTC','slot_key','final-stale-skip','logged_at',clock_timestamp(),
      'dose',1,'unit','mg','method','Oral','taken',false)))
  $q$);
  perform pg_sleep(0.1);
  if dblink_is_busy('final_gate_skip') <> 1 then raise exception 'stale skip did not wait for pause lock'; end if;
  perform dblink_exec('final_gate_pause','commit');
  select value into result from dblink_get_result('final_gate_skip') as done(value text);
  perform dblink_disconnect('final_gate_pause');
  perform dblink_disconnect('final_gate_skip');
  if result <> 'Intake falls within a paused cycle'
    or exists(select from dose_logs where routine_slot_key='final-stale-skip') then
    raise exception 'stale skip escaped the committed pause: %',result;
  end if;
end $$;
