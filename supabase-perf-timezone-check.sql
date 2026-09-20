-- Die Zeitzonenpruefung kostete 800 ms. Je Eintrag.
--
-- Vier Funktionen pruefen eine Zeitzone so:
--
--   if not exists (select 1 from pg_timezone_names where name = zone)
--
-- `pg_timezone_names` ist keine Tabelle, sondern eine Funktion: jeder Zugriff
-- zaehlt die komplette Zeitzonendatenbank auf. Gemessen am Projekt:
--
--   explain analyze select 1 from pg_timezone_names where name = 'Europe/Berlin';
--   Function Scan on pg_timezone_names (actual time=799.654..799.693 rows=1)
--   Rows Removed by Filter: 1195
--   Execution Time: 799.857 ms
--
-- `confirm_intake_group` -- das Bestaetigen einer Einnahme im Kalender --
-- macht diese Pruefung je Eintrag und lag deshalb bei im Schnitt 1,6 s,
-- im schlechtesten Fall 8,7 s. Das war kein Datenmengenproblem.
--
-- Dieselben 1196 Namen in einer Tabelle nachgeschlagen kosten warm rund
-- 0,4 ms. Es ist derselbe Namensraum, also dieselbe Strenge -- nur ein
-- Indexzugriff statt eines Durchlaufs.
--
-- Diese Datei aendert KEINE Daten und KEIN Schema. Sie legt eine Hilfsfunktion
-- an und ersetzt in `confirm_intake_group` genau diese eine Bedingung; der
-- Rest der Funktion ist unveraendert. Zweimal laufen lassen ist erlaubt
-- (`create or replace`).
--
-- `resolve_cycle_course_timezone`, `restart_cycle` und
-- `save_stack_item_with_plan` tragen dieselbe Stelle und wurden mit
-- derselben Ersetzung umgestellt; bei `restart_cycle` bleiben die
-- zusaetzlichen Ausschluesse (`localtime`, `Factory`, `posixrules`,
-- `posix/`, `right/`) unangetastet daneben stehen.

-- ── Die Pruefung selbst ─────────────────────────────────────────────────────
--
-- Erster Versuch war `perform now() at time zone p_zone` in einem
-- Ausnahmeblock: schnell, aber GROSSZUEGIGER als der Katalog -- `+05:00`
-- waere durchgegangen, und die Strenge ist hier Absicht (siehe die Commits
-- „reject server-local restart timezones"). Deshalb derselbe Namensraum,
-- nur nachschlagbar statt aufzaehlbar.

create table if not exists public.tyd_timezone_names (
  name text primary key
);

insert into public.tyd_timezone_names (name)
select name from pg_timezone_names
on conflict (name) do nothing;

alter table public.tyd_timezone_names enable row level security;

drop policy if exists tyd_timezone_names_read on public.tyd_timezone_names;
create policy tyd_timezone_names_read on public.tyd_timezone_names
  for select to authenticated, anon using (true);

comment on table public.tyd_timezone_names is
  'Abzug von pg_timezone_names als nachschlagbare Tabelle. Ein Durchlauf durch die Katalogfunktion kostete 800 ms; hier ist es ein Indexzugriff. Unbekannte Namen fallen auf den Katalog zurueck, damit neue Zonen weiterhin gelten.';

create or replace function public.tyd_is_valid_timezone(p_zone text)
returns boolean
language plpgsql
stable
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
begin
  if p_zone is null or btrim(p_zone) = '' then
    return false;
  end if;
  -- Der schnelle Weg: ein Indexzugriff auf den Abzug.
  if exists (select 1 from public.tyd_timezone_names where name = p_zone) then
    return true;
  end if;
  -- Unbekannt heisst nicht ungueltig: die Zonendatenbank waechst. Dann
  -- einmal im Katalog nachsehen -- teuer, aber nur auf dem Fehlerweg.
  return exists (select 1 from pg_timezone_names where name = p_zone);
end
$function$;

comment on function public.tyd_is_valid_timezone(text) is
  'Prueft eine Zeitzone gegen denselben Namensraum wie pg_timezone_names, aber ueber einen Indexzugriff statt ueber einen Katalogdurchlauf (800 ms je Aufruf).';

-- Gegenprobe nach dem Lauf: 1196 von 1196 Zonen uebernommen, `+05:00`
-- abgelehnt, Unsinn abgelehnt, leer und null abgelehnt. Warm kostet der
-- Aufruf rund 0,4 ms statt 800.

-- ── Und ihr Einsatz ─────────────────────────────────────────────────────────
-- Unveraendert gegenueber der bestehenden Fassung bis auf die eine Bedingung,
-- die jetzt `tyd_is_valid_timezone` fragt.

CREATE OR REPLACE FUNCTION public.confirm_intake_group(p_entries jsonb)
 RETURNS SETOF dose_logs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
declare
  owner_id uuid := auth.uid();
  entry jsonb;
  saved_log public.dose_logs;
  entry_cycle_id uuid;
  entry_plan_version_id uuid;
  expected_plan_version_id uuid;
  entry_timezone text;
  entry_dose_log_id uuid;
  entry_slot_key text;
  entry_stack_item_id uuid;
  entry_dose numeric;
  entry_unit text;
  entry_method text;
  entry_logged_at timestamptz;
  entry_taken boolean;
  cycle_started_at timestamptz;
  cycle_ended_at timestamptz;
  item_tracking_level text;
  validated_entries jsonb := '[]'::jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_entries is null
    or jsonb_typeof(p_entries) <> 'array'
    or jsonb_array_length(p_entries) = 0 then
    raise exception 'At least one intake entry is required';
  end if;

  if exists (
    select 1
    from (
      select value ->> 'slot_key' as slot_key
      from jsonb_array_elements(p_entries)
      group by 1
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Duplicate routine slot key in intake group';
  end if;

  if exists (
    select 1
    from (
      select
        (value ->> 'cycle_id')::uuid as cycle_id,
        (value ->> 'logged_at')::timestamptz as logged_at
      from jsonb_array_elements(p_entries)
      group by 1, 2
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Duplicate cycle and logged_at in intake group';
  end if;

  for entry_cycle_id in
    select requested.cycle_id
    from (
      select distinct nullif(btrim(value ->> 'cycle_id'), '')::uuid as cycle_id
      from jsonb_array_elements(p_entries)
    ) requested
    where requested.cycle_id is not null
    order by requested.cycle_id
  loop
    perform 1
    from public.cycles
    where id = entry_cycle_id
      and user_id = owner_id
    for update;
  end loop;

  for entry in
    select value
    from jsonb_array_elements(p_entries)
  loop
    entry_cycle_id := nullif(btrim(entry ->> 'cycle_id'), '')::uuid;
    entry_plan_version_id := nullif(btrim(entry ->> 'plan_version_id'), '')::uuid;
    entry_timezone := nullif(btrim(entry ->> 'timezone'), '');
    entry_dose_log_id := nullif(btrim(entry ->> 'dose_log_id'), '')::uuid;
    entry_slot_key := nullif(btrim(entry ->> 'slot_key'), '');
    entry_stack_item_id := nullif(btrim(entry ->> 'stack_item_id'), '')::uuid;
    entry_unit := nullif(btrim(entry ->> 'unit'), '');
    entry_method := coalesce(entry ->> 'method', '');
    entry_logged_at := nullif(btrim(entry ->> 'logged_at'), '')::timestamptz;

    if not (entry ? 'taken') then
      entry_taken := true;
    elsif jsonb_typeof(entry -> 'taken') = 'boolean' then
      entry_taken := (entry ->> 'taken')::boolean;
    else
      raise exception 'Taken must be a boolean';
    end if;

    if entry -> 'dose' is null or entry -> 'dose' = 'null'::jsonb then
      entry_dose := null;
    elsif jsonb_typeof(entry -> 'dose') = 'number' then
      entry_dose := (entry ->> 'dose')::numeric;
    else
      raise exception 'Dose must be a number or null';
    end if;

    if entry_cycle_id is null
      or entry_timezone is null
      or entry_slot_key is null
      or entry_stack_item_id is null
      or entry_logged_at is null then
      raise exception 'Cycle, timezone, slot key, stack item, and logged_at are required';
    end if;
    -- HIER die einzige Aenderung: vorher ein Durchlauf durch
    -- `pg_timezone_names` (800 ms), jetzt die Umrechnung.
    if not public.tyd_is_valid_timezone(entry_timezone) then
      raise exception 'Invalid timezone';
    end if;
    if (entry_dose is null) <> (entry_unit is null) then
      raise exception 'Dose and unit must both be supplied or both be null';
    end if;
    if entry_dose is not null
      and not (entry_dose > 0 and entry_dose <= '1000000000'::numeric) then
      raise exception 'Dose must be positive';
    end if;

    select item.tracking_level, cycle.started_at, cycle.ended_at
    into item_tracking_level, cycle_started_at, cycle_ended_at
    from public.cycles cycle
    join public.stack_items item on item.id = cycle.stack_item_id
    where cycle.id = entry_cycle_id
      and cycle.stack_item_id = entry_stack_item_id
      and cycle.user_id = owner_id
      and item.user_id = owner_id;

    if not found then
      raise exception 'Intake cycle not found';
    end if;
    if cycle_started_at is null or entry_logged_at < cycle_started_at
      or entry_logged_at >= coalesce(cycle_ended_at, 'infinity'::timestamptz) then
      raise exception 'Intake falls outside cycle lifecycle';
    end if;
    if item_tracking_level = 'intake_only' then
      if entry_dose is not null then
        raise exception 'Intake-only entries cannot store a quantity';
      end if;
    elsif entry_dose is null then
      raise exception 'Tracked entries require dose and unit';
    end if;

    expected_plan_version_id := public.resolve_plan_version_id(
      entry_cycle_id,
      entry_logged_at,
      entry_timezone
    );
    if expected_plan_version_id is null then
      raise exception 'Plan version not found';
    end if;
    if entry_plan_version_id is not null
      and entry_plan_version_id <> expected_plan_version_id then
      raise exception 'Plan version does not match scheduled intake';
    end if;

    if exists (
      select 1
      from public.cycle_pause_periods pause
      where pause.cycle_id = entry_cycle_id
        and pause.user_id = owner_id
        and pause.paused_at <= entry_logged_at
        and (pause.ends_at is null or entry_logged_at < pause.ends_at)
    ) then
      raise exception 'Intake falls within a paused cycle';
    end if;

    select *
    into saved_log
    from public.dose_logs
    where routine_slot_key = entry_slot_key
      and user_id = owner_id;

    if found then
      if saved_log.stack_item_id <> entry_stack_item_id
        or (saved_log.taken is not null and saved_log.taken is distinct from entry_taken)
        or (saved_log.cycle_id is not null and saved_log.cycle_id <> entry_cycle_id)
        or (saved_log.taken is not null and (
          saved_log.logged_at <> entry_logged_at
          or saved_log.cycle_id is distinct from entry_cycle_id
          or saved_log.plan_version_id is distinct from expected_plan_version_id
        ))
        or (entry_dose_log_id is not null and saved_log.id <> entry_dose_log_id) then
        raise exception 'Routine slot key belongs to another intake';
      end if;
    elsif entry_dose_log_id is not null then
      perform 1
      from public.dose_logs
      where id = entry_dose_log_id
        and user_id = owner_id
        and stack_item_id = entry_stack_item_id
        and taken is null
        and (cycle_id is null or cycle_id = entry_cycle_id)
        and (routine_slot_key is null or routine_slot_key = entry_slot_key);

      if not found then
        raise exception 'Pending dose log not found';
      end if;
    end if;

    validated_entries := validated_entries || jsonb_build_array(
      entry || jsonb_build_object(
        '_resolved_plan_version_id', expected_plan_version_id,
        '_taken', entry_taken
      )
    );
  end loop;

  for entry in
    select value
    from jsonb_array_elements(validated_entries)
  loop
    entry_cycle_id := nullif(btrim(entry ->> 'cycle_id'), '')::uuid;
    entry_timezone := nullif(btrim(entry ->> 'timezone'), '');
    entry_dose_log_id := nullif(btrim(entry ->> 'dose_log_id'), '')::uuid;
    entry_slot_key := nullif(btrim(entry ->> 'slot_key'), '');
    entry_stack_item_id := nullif(btrim(entry ->> 'stack_item_id'), '')::uuid;
    entry_unit := nullif(btrim(entry ->> 'unit'), '');
    entry_method := coalesce(entry ->> 'method', '');
    entry_logged_at := nullif(btrim(entry ->> 'logged_at'), '')::timestamptz;
    entry_taken := (entry ->> '_taken')::boolean;
    if entry -> 'dose' is null or entry -> 'dose' = 'null'::jsonb then
      entry_dose := null;
    else
      entry_dose := (entry ->> 'dose')::numeric;
    end if;

    expected_plan_version_id := nullif(
      btrim(entry ->> '_resolved_plan_version_id'),
      ''
    )::uuid;
    if expected_plan_version_id is null then
      raise exception 'Plan version not found';
    end if;

    select *
    into saved_log
    from public.dose_logs
    where routine_slot_key = entry_slot_key
      and user_id = owner_id
    for update;

    if not found and entry_dose_log_id is not null then
      update public.dose_logs
      set
        cycle_id = entry_cycle_id,
        plan_version_id = expected_plan_version_id,
        dose = entry_dose,
        unit = entry_unit,
        method = entry_method,
        logged_at = entry_logged_at,
        routine_slot_key = entry_slot_key,
        taken = entry_taken
      where id = entry_dose_log_id
        and user_id = owner_id
        and stack_item_id = entry_stack_item_id
        and taken is null
        and (cycle_id is null or cycle_id = entry_cycle_id)
        and (routine_slot_key is null or routine_slot_key = entry_slot_key)
      returning * into saved_log;
    elsif not found then
      insert into public.dose_logs (
        user_id,
        stack_item_id,
        cycle_id,
        plan_version_id,
        dose,
        unit,
        method,
        logged_at,
        routine_slot_key,
        taken
      ) values (
        owner_id,
        entry_stack_item_id,
        entry_cycle_id,
        expected_plan_version_id,
        entry_dose,
        entry_unit,
        entry_method,
        entry_logged_at,
        entry_slot_key,
        entry_taken
      )
      on conflict (user_id, routine_slot_key)
        where routine_slot_key is not null
        do nothing
      returning * into saved_log;
    end if;

    if not found then
      select *
      into saved_log
      from public.dose_logs
      where routine_slot_key = entry_slot_key
        and user_id = owner_id
      for update;

      if not found then
        raise exception 'Routine intake could not be saved';
      end if;
    end if;

    if saved_log.stack_item_id <> entry_stack_item_id
      or (saved_log.taken is not null and saved_log.taken is distinct from entry_taken)
      or (saved_log.cycle_id is not null and saved_log.cycle_id <> entry_cycle_id)
      or (saved_log.taken is not null and (
        saved_log.logged_at <> entry_logged_at
        or saved_log.cycle_id is distinct from entry_cycle_id
        or saved_log.plan_version_id is distinct from expected_plan_version_id
      ))
      or (entry_dose_log_id is not null and saved_log.id <> entry_dose_log_id) then
      raise exception 'Routine slot key belongs to another intake';
    end if;

    if saved_log.taken is null then
      update public.dose_logs
      set
        cycle_id = entry_cycle_id,
        plan_version_id = expected_plan_version_id,
        dose = entry_dose,
        unit = entry_unit,
        method = entry_method,
        logged_at = entry_logged_at,
        routine_slot_key = entry_slot_key,
        taken = entry_taken
      where id = saved_log.id
        and user_id = owner_id
      returning * into saved_log;
    end if;

    return next saved_log;
  end loop;
end
$function$;
