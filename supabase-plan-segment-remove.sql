-- Eine vorgemerkte Planstufe zuruecknehmen.
--
-- `save_stack_item_with_plan` kann eine Stufe ANLEGEN und eine mit demselben
-- Stichdatum ERSETZEN — aber es gibt keinen Weg, eine wieder wegzunehmen. Wer
-- sich beim Datum vertippt, haette die Stufe fuer immer im Plan.
--
-- Zurueckgenommen wird nur, was noch nicht angefangen hat. Eine laufende oder
-- vergangene Stufe ist eingetreten: der Kalender hat danach geplant, und
-- bestaetigte Einnahmen haengen daran. Sie zu loeschen wuerde die Vergangenheit
-- umschreiben.
--
-- Idempotent: ein zweiter Aufruf mit demselben Stichdatum findet nichts mehr
-- und meldet das, statt etwas anderes zu treffen.

create or replace function public.remove_plan_segment(
  p_cycle_id uuid,
  p_effective_from date
)
returns public.cycles
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  cycle_row public.cycles;
  rest jsonb;
  letzte jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_effective_from is null then
    raise exception 'Effective date is required';
  end if;

  select *
  into cycle_row
  from public.cycles
  where id = p_cycle_id
    and user_id = owner_id
  for update;

  if not found then
    raise exception 'Plan not found';
  end if;

  -- Was schon laeuft, bleibt. Der Vergleich gegen CURRENT_DATE ist derselbe,
  -- den `scheduleForDay` in der App fuehrt: gilt ab heute oder frueher.
  if p_effective_from <= current_date then
    raise exception 'Only future plan steps can be removed';
  end if;

  if cycle_row.schedule_history is null
    or jsonb_typeof(cycle_row.schedule_history) <> 'array'
    or jsonb_array_length(cycle_row.schedule_history) = 0 then
    raise exception 'Plan step not found';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(cycle_row.schedule_history) segment
    where segment ->> 'effective_from' = p_effective_from::text
  ) then
    raise exception 'Plan step not found';
  end if;

  select coalesce(jsonb_agg(segment order by segment ->> 'effective_from'), '[]'::jsonb)
  into rest
  from jsonb_array_elements(cycle_row.schedule_history) segment
  where segment ->> 'effective_from' is distinct from p_effective_from::text;

  -- Die flachen Spalten tragen immer den JUENGSTEN Plan — sie sind es, die der
  -- naechste Speichervorgang als „bisher" vergleicht. Faellt die letzte Stufe
  -- weg, muessen sie auf die dann letzte zurueck, sonst bliebe die
  -- zurueckgenommene Menge dort stehen.
  letzte := rest -> (jsonb_array_length(rest) - 1);

  if letzte is null then
    raise exception 'Plan step not found';
  end if;

  update public.cycles
  set
    schedule_history = case when jsonb_array_length(rest) <= 1 then null else rest end,
    frequency = coalesce(letzte ->> 'frequency', frequency),
    x_days_interval = nullif(letzte ->> 'x_days_interval', '')::integer,
    interval_unit = nullif(letzte ->> 'interval_unit', ''),
    cycle_on_days = nullif(letzte ->> 'cycle_on_days', '')::integer,
    cycle_off_days = nullif(letzte ->> 'cycle_off_days', '')::integer,
    schedule_days = case
      when jsonb_typeof(letzte -> 'schedule_days') = 'array'
        then array(select jsonb_array_elements_text(letzte -> 'schedule_days'))
      else schedule_days
    end,
    intake_time = coalesce(letzte ->> 'intake_time', intake_time),
    intake_time_custom = nullif(letzte ->> 'intake_time_custom', ''),
    slot_doses = nullif(letzte ->> 'slot_doses', ''),
    slot_days = nullif(letzte ->> 'slot_days', ''),
    dose = nullif(letzte ->> 'dose', '')::numeric,
    unit = nullif(letzte ->> 'unit', '')
  where id = p_cycle_id
    and user_id = owner_id
  returning * into cycle_row;

  return cycle_row;
end;
$$;

revoke execute on function public.remove_plan_segment(uuid, date) from public, anon;
grant execute on function public.remove_plan_segment(uuid, date) to authenticated;
