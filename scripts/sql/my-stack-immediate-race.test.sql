\set ON_ERROR_STOP on
-- Run after the behavior fixture / enforcement, in a disposable PostgreSQL 16 DB.
insert into stack_items(id,user_id) values
 ('99600000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003');
insert into cycles(id,user_id,stack_item_id,start_date,started_at) values
 ('99600000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99600000-0000-0000-0000-000000000001','2020-01-01','2020-01-01Z');
insert into cycle_plan_versions(id,user_id,cycle_id,effective_kind,effective_local_date,change_kind,frequency,intake_time,dose,unit,method) values
 ('99600000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003','99600000-0000-0000-0000-000000000002','local_date','2020-01-01','initial','Täglich','morgens',1,'mg','Oral');

do $$
declare
  changer_pid integer;
  waited boolean := false;
  old_log jsonb;
  new_log jsonb;
  changed jsonb;
  retried jsonb;
  boundary timestamptz;
  resolved uuid;
  attempt integer;
begin
  perform dblink_connect('t15_confirm','dbname='||current_database());
  perform dblink_connect('t15_change','dbname='||current_database());
  perform dblink_exec('t15_confirm','begin');
  -- Lock as a confirmation transaction, but timestamp its log only after the
  -- plan-change transaction has started and is proven blocked on this lock.
  perform id from dblink('t15_confirm',$q$select id from cycles where id='99600000-0000-0000-0000-000000000002' for update$q$) as locked(id uuid);
  perform dblink_exec('t15_confirm',$q$set role authenticated; set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003'$q$);
  perform dblink_exec('t15_change',$q$set role authenticated; set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003'; set statement_timeout='10s'$q$);
  select pid into changer_pid from dblink('t15_change','select pg_backend_pid()') as backend(pid integer);
  perform dblink_send_query('t15_change',$q$select to_jsonb(create_plan_version(
    '99600000-0000-0000-0000-000000000002','instant','2000-01-01Z',null,'dose',
    '{"frequency":"Täglich","intake_time":"morgens","dose":2,"unit":"mg","method":"Oral","_timezone":"UTC","_effective_now":true}',
    't15-immediate-race'))$q$);
  for attempt in 1..100 loop
    select wait_event_type='Lock' into waited from pg_stat_activity where pid=changer_pid;
    exit when waited;
    perform pg_sleep(0.01);
    perform pg_stat_clear_snapshot();
  end loop;
  if not coalesce(waited,false) then raise exception 'plan change never waited on cycle lock'; end if;
  select result into old_log from dblink('t15_confirm',$q$select to_jsonb(log) from confirm_intake_group(jsonb_build_array(jsonb_build_object(
    'cycle_id','99600000-0000-0000-0000-000000000002','stack_item_id','99600000-0000-0000-0000-000000000001',
    'timezone','UTC','slot_key','t15-before-change','logged_at',clock_timestamp(),'dose',1,'unit','mg','method','Oral'))) log$q$) as confirmed(result jsonb);
  perform dblink_exec('t15_confirm','commit');
  select result into changed from dblink_get_result('t15_change') as done(result jsonb);
  perform result from dblink_get_result('t15_change') as drained(result jsonb);
  boundary := (changed->>'effective_at')::timestamptz;
  perform set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
  resolved := resolve_plan_version_id('99600000-0000-0000-0000-000000000002',(old_log->>'logged_at')::timestamptz,'UTC');
  raise notice 'log=%, immediate=%, stored=%, resolved=%',old_log->>'logged_at',boundary,old_log->>'plan_version_id',resolved;
  if boundary <= (old_log->>'logged_at')::timestamptz
    or resolved <> (old_log->>'plan_version_id')::uuid
    or resolved <> '99600000-0000-0000-0000-000000000003'::uuid then
    raise exception 'Immediate boundary predates confirmation committed before lock acquisition';
  end if;
  select result into retried from dblink('t15_change',$q$select to_jsonb(create_plan_version(
    '99600000-0000-0000-0000-000000000002','instant',clock_timestamp(),null,'dose',
    '{"frequency":"Täglich","intake_time":"morgens","dose":2,"unit":"mg","method":"Oral","_timezone":"UTC","_effective_now":true}',
    't15-immediate-race'))$q$) as retry(result jsonb);
  if retried is distinct from changed then raise exception 'immediate retry changed committed boundary'; end if;
  select result into new_log from dblink('t15_confirm',$q$select to_jsonb(log) from confirm_intake_group(jsonb_build_array(jsonb_build_object(
    'cycle_id','99600000-0000-0000-0000-000000000002','stack_item_id','99600000-0000-0000-0000-000000000001',
    'timezone','UTC','slot_key','t15-after-change','logged_at',clock_timestamp(),'dose',2,'unit','mg','method','Oral'))) log$q$) as confirmed(result jsonb);
  if (new_log->>'logged_at')::timestamptz <= boundary
    or new_log->>'plan_version_id' <> changed->>'id'
    or resolve_plan_version_id('99600000-0000-0000-0000-000000000002',(new_log->>'logged_at')::timestamptz,'UTC') <> (changed->>'id')::uuid then
    raise exception 'post-boundary confirmation did not select the new version';
  end if;
  perform dblink_disconnect('t15_confirm');
  perform dblink_disconnect('t15_change');
end $$;
