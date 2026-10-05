-- Tagebuch: ein Eintrag verweist nur auf eigene Einnahmen und eigene Substanzen.
--
-- Die Zugriffsregel „Own effects" prueft nur `effects.user_id`. Die
-- Fremdschluessel `dose_log_id` und `stack_item_id` pruefen nur, dass die Zeile
-- existiert — nicht, wem sie gehoert. Das Tagebuch verknuepft Eintraege jetzt
-- mit Einnahmen; dieser Trigger stellt sicher, dass beides derselben Person
-- gehoert und die Einnahme zur gewaehlten Substanz passt.
--
-- Greift nur bei INSERT und bei UPDATE dieser Spalten (oder von user_id).
-- Bestehende Zeilen werden nicht angefasst; die Pruefabfrage am Ende zaehlt,
-- ob es Zeilen gibt, die gegen die Regel verstossen.
--
-- Idempotent (create or replace), kein drop.

begin;

create or replace function public.check_effect_references()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  log_owner uuid;
  log_item uuid;
begin
  if new.stack_item_id is not null and not exists (
    select 1 from public.stack_items
    where id = new.stack_item_id and user_id = new.user_id
  ) then
    raise exception 'effect_stack_item_not_owned' using errcode = '42501';
  end if;

  if new.dose_log_id is not null then
    select user_id, stack_item_id into log_owner, log_item
    from public.dose_logs
    where id = new.dose_log_id;

    if log_owner is distinct from new.user_id then
      raise exception 'effect_dose_log_not_owned' using errcode = '42501';
    end if;
    -- Einnahme und Eintrag gehoeren zur selben Substanz. Faellt die Substanz
    -- weg (on delete set null), bleibt der Verweis auf die Einnahme bestehen.
    if new.stack_item_id is not null and log_item is distinct from new.stack_item_id then
      raise exception 'effect_dose_log_other_substance' using errcode = '23514';
    end if;
  end if;

  return new;
end
$$;

create or replace trigger effects_check_references
before insert or update of user_id, stack_item_id, dose_log_id
on public.effects
for each row
execute function public.check_effect_references();

commit;

-- Pruefabfrage (aendert nichts): Zeilen, die gegen die Regel verstossen.
-- Erwartet: 0 | 0 | 0.
select
  count(*) filter (where e.stack_item_id is not null and s.user_id is distinct from e.user_id) as fremde_substanz,
  count(*) filter (where e.dose_log_id is not null and d.user_id is distinct from e.user_id) as fremde_einnahme,
  count(*) filter (where e.dose_log_id is not null and e.stack_item_id is not null
                     and d.stack_item_id is distinct from e.stack_item_id) as andere_substanz
from public.effects e
left join public.stack_items s on s.id = e.stack_item_id
left join public.dose_logs d on d.id = e.dose_log_id;
