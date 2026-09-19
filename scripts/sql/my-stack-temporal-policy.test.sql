\set ON_ERROR_STOP on
-- Run after the behavior suite, including enforcement. All test rows roll back.
begin;
insert into stack_items(id,user_id) values
 ('99700000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003');
insert into cycles(id,user_id,stack_item_id,start_date,started_at,ended_at,active) values
 ('99700000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','99700000-0000-0000-0000-000000000001','2020-01-01','2020-01-01Z','2020-01-02Z',false);
set role authenticated;
set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003';
do $$
declare
  schedule jsonb := '{"frequency":"Alle X Tage","x_days_interval":2,"interval_unit":"day","intake_time":"abends","dose":1,"unit":"mg","method":"Oral"}';
  zone text;
  result jsonb;
  retried jsonb;
  restarted cycles;
  rejected boolean;
  before_cycles jsonb;
  before_versions jsonb;
  before_receipts jsonb;
  item stack_items;
  source_id uuid;
begin
  select jsonb_agg(c order by id) into before_cycles from cycles c;
  select jsonb_agg(v order by id) into before_versions from cycle_plan_versions v;
  select jsonb_agg(r order by operation,idempotency_key) into before_receipts from plan_mutation_receipts r;
  foreach zone in array array[null, '', 'not/a-zone', '+03:00', 'localtime', 'Factory', 'posixrules', 'posix/UTC', 'right/UTC'] loop
    rejected := false;
    begin
      perform restart_cycle('99700000-0000-0000-0000-000000000002','2026-09-18T00:30Z',
        schedule || jsonb_build_object('_timezone',zone),'t15-invalid-'||coalesce(zone,'missing'));
    exception when others then
      if sqlerrm <> 'Valid restart timezone is required' then raise; end if;
      rejected := true;
    end;
    if not rejected then raise exception 'invalid/missing restart timezone accepted: %', zone; end if;
    if (select jsonb_agg(c order by id) from cycles c) is distinct from before_cycles
      or (select jsonb_agg(v order by id) from cycle_plan_versions v) is distinct from before_versions
      or (select jsonb_agg(r order by operation,idempotency_key) from plan_mutation_receipts r) is distinct from before_receipts then
      raise exception 'rejected restart timezone mutated rows: %', zone;
    end if;
  end loop;
  perform set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000004',true);
  foreach zone in array array['America/New_York', 'localtime', 'Factory'] loop
    begin
      perform restart_cycle('99700000-0000-0000-0000-000000000002','2026-09-18T00:30Z',
        schedule || jsonb_build_object('_timezone',zone),'t15-foreign-'||zone);
      raise exception 'foreign restart accepted';
    exception when others then if sqlerrm <> 'Cycle not found' then raise; end if; end;
  end loop;
  perform set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
  if (select jsonb_agg(c order by id) from cycles c) is distinct from before_cycles
    or (select jsonb_agg(v order by id) from cycle_plan_versions v) is distinct from before_versions
    or (select jsonb_agg(r order by operation,idempotency_key) from plan_mutation_receipts r) is distinct from before_receipts then
    raise exception 'foreign restart mutated rows';
  end if;
  result := restart_cycle('99700000-0000-0000-0000-000000000002','2026-09-18T00:30Z',
    schedule || '{"_timezone":"America/New_York"}'::jsonb,'t15-restart');
  retried := restart_cycle('99700000-0000-0000-0000-000000000002','2027-01-01T12:00Z',
    schedule || '{"_timezone":"Asia/Tokyo"}'::jsonb,'t15-restart');
  select * into restarted from cycles where id=(result->>'cycle_id')::uuid;
  if result is distinct from retried or restarted.start_local_date is distinct from '2026-09-17'::date
    or restarted.start_date <> '2026-09-17'::date
    or restarted.started_at <> '2026-09-18T00:30Z'::timestamptz
    or restarted.lifecycle_timezone is distinct from 'America/New_York'
    or not exists(select from cycle_plan_versions where id=(result->>'plan_version_id')::uuid
      and effective_kind='instant' and effective_at='2026-09-18T00:30Z' and effective_local_date is null) then
    raise exception 'restart lost exact activation, stable anchor, or original retry result';
  end if;
  -- Explicit zones and catalog aliases supported by Intl remain accepted.
  foreach zone in array array['UTC','Etc/UTC','Etc/GMT+5','GMT','Europe/Berlin','Asia/Tokyo'] loop
    item := save_stack_item_with_plan('{}','[]',schedule || jsonb_build_object(
      'name','Restart timezone fixture','timezone',zone,'start_date','2020-01-01','end_date','2020-01-02'), 't15-valid-source-'||zone);
    select id into source_id from cycles where stack_item_id=item.id;
    result := restart_cycle(source_id,'2026-09-18T00:30Z',schedule || jsonb_build_object('_timezone',zone),'t15-valid-'||zone);
    select * into restarted from cycles where id=(result->>'cycle_id')::uuid;
    if restarted.lifecycle_timezone is distinct from zone
      or restarted.start_local_date is distinct from (case when zone='Etc/GMT+5' then '2026-09-17'::date else '2026-09-18'::date end)
      or restarted.started_at <> '2026-09-18T00:30Z'::timestamptz then
      raise exception 'valid explicit restart timezone rejected or reinterpreted: %', zone;
    end if;
  end loop;
  raise notice 'Restart timezone contract: pseudo-zones rejected without writes; ownership checked first; explicit UTC/Etc/alias/region zones accepted';
end $$;
reset role;
rollback;

begin;
set request.jwt.claim.sub='30000000-0000-0000-0000-000000000003';
do $$
declare
  fixture record;
  item stack_items;
  course cycles;
  plan jsonb := '{"name":"Temporal fixture","frequency":"Täglich","intake_time":"morgens","intake_time_custom":"00:00","dose":1,"unit":"mg","method":"Oral"}';
  before_id uuid;
  date_id uuid;
begin
  for fixture in select * from (values
    ('America/Havana','2026-11-01'::date,'2026-11-01T05:00Z'::timestamptz),
    ('America/Havana','2026-03-08'::date,'2026-03-08T05:00Z'::timestamptz),
    ('America/Santiago','2026-09-06'::date,'2026-09-06T04:00Z'::timestamptz)
  ) cases(zone,day,boundary) loop
    if fixture.day::timestamp at time zone fixture.zone <> fixture.boundary then
      raise exception 'PostgreSQL midnight policy changed: %',fixture;
    end if;
    item := save_stack_item_with_plan('{}','[]',plan || jsonb_build_object('timezone',fixture.zone,'start_date',fixture.day,'end_date',fixture.day), 't15-start-'||fixture.zone||fixture.day);
    select * into course from cycles where stack_item_id=item.id;
    if course.started_at <> fixture.boundary then raise exception 'creation midnight mismatch'; end if;
    select id into date_id from cycle_plan_versions where cycle_id=course.id;
    -- An instant in the first repeated midnight must win until the canonical
    -- local-date boundary, then the local-date version must supersede it.
    -- Past dates deliberately use direct fixture insertion instead of
    -- asking the guarded mutation RPC to backdate a plan change.
    insert into cycle_plan_versions(user_id,cycle_id,effective_kind,effective_at,change_kind,frequency,intake_time,dose,unit,method)
    values (auth.uid(),course.id,'instant',fixture.boundary-interval '15 minutes','dose','Täglich','morgens',2,'mg','Oral')
    returning id into before_id;
    if resolve_plan_version_id(course.id,fixture.boundary-interval '10 minutes',fixture.zone) <> before_id
      or resolve_plan_version_id(course.id,fixture.boundary,fixture.zone) <> date_id then
      raise exception 'SQL local-date/instant ordering mismatch';
    end if;
    update cycles set started_at=null,ended_at=null,lifecycle_timezone=null,timezone_review_required=true where id=course.id;
    perform resolve_cycle_course_timezone(item.id,fixture.zone,'t15-review-'||fixture.zone||fixture.day);
    if not exists(select from cycles where id=course.id and started_at=fixture.boundary
      and not timezone_review_required and lifecycle_timezone=fixture.zone) then
      raise exception 'timezone review midnight mismatch';
    end if;
    item := save_stack_item_with_plan('{}','[]',plan || jsonb_build_object('timezone',fixture.zone,'start_date',fixture.day-1,'end_date',fixture.day-1), 't15-end-'||fixture.zone||fixture.day);
    select * into course from cycles where stack_item_id=item.id;
    if course.ended_at <> fixture.boundary or course.end_local_date <> fixture.day then
      raise exception 'exclusive course end midnight mismatch';
    end if;
    raise notice 'SQL policy verified: % % = %',fixture.zone,fixture.day,fixture.boundary;
  end loop;
end $$;
reset role;
rollback;
