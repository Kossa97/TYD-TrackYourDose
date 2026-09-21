-- Slot-Schluessel von Zeitpunkt auf Wanduhr umstellen.
--
--   vorher   <cycle-uuid>@2026-09-22T06:00:00.000Z
--   nachher  <cycle-uuid>@2026-09-22T08:00
--
-- Warum: der Zeitteil wurde aus der Zeitzone des Geraets gebaut. Damit hing
-- die Identitaet einer Einnahme daran, wo das Telefon gerade stand --
-- "Dienstag 08:00" heisst in Berlin 06:00Z, in Tokio 23:00Z am Vortag. Wer
-- verreiste, bekam denselben Platz im Plan unter zwei Namen: der Dienstag
-- stand wieder offen da, und die bestaetigte Zeile liess sich nicht einmal
-- mehr wieder oeffnen, weil sie in keiner Tagesplanung mehr vorkam.
--
-- Die Datenbank liest den Schluessel nie -- sie vergleicht ihn nur und
-- upsertet darauf (`dose_logs_routine_slot_unique` auf
-- `(user_id, routine_slot_key)`). Deshalb aendert sich hier kein Schema und
-- keine Funktion, nur der Inhalt einer Textspalte.
--
-- Zurueckgerechnet wird mit `cycles.lifecycle_timezone` -- derselben Zone,
-- aus der schon `started_at` und `ended_at` gebildet sind
-- (`supabase-my-stack-plan-integrity.sql`). Fuer alle, die zu Hause
-- bestaetigt haben, trifft das die geplante Wanduhr exakt.
--
-- Idempotent: der Filter trifft nur die alte Form (ISO-Zeitstempel mit `Z`).
-- Ein zweiter Lauf findet nichts mehr und aendert null Zeilen.

begin;

-- ---------------------------------------------------------------------------
-- 1. Vorher zaehlen.
-- ---------------------------------------------------------------------------
create temporary table slot_key_migration_report on commit drop as
select
  count(*) filter (where alt_form)                        as alte_form,
  count(*) filter (where alt_form and zone is null)       as ohne_zeitzone,
  count(*) filter (where alt_form and zone is not null)   as umstellbar
from (
  select
    l.routine_slot_key ~ '^[^@]+@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$' as alt_form,
    c.lifecycle_timezone as zone
  from public.dose_logs l
  left join public.cycles c on c.id = l.cycle_id
  where l.routine_slot_key is not null
) s;

-- ---------------------------------------------------------------------------
-- 2. Kollisionen zuerst.
--
-- Genau der Fehler, der hier behoben wird, kann zwei Zeilen fuer denselben
-- Platz hinterlassen haben -- eine in Berlin bestaetigt, eine in Tokio. Nach
-- der Umrechnung tragen beide denselben Namen, und der Unique-Index laesst
-- das nicht zu. Solche Zeilen bleiben unveraendert stehen und werden
-- ausgewiesen, statt dass der ganze Lauf daran scheitert oder -- schlimmer --
-- eine von beiden verschwindet. Was mit ihnen geschieht, entscheidet ein
-- Mensch, der die Eintraege sieht.
-- ---------------------------------------------------------------------------
create temporary table slot_key_neu on commit drop as
select
  l.id,
  l.user_id,
  c.id::text || '@' || to_char(
    (split_part(l.routine_slot_key, '@', 2))::timestamptz at time zone c.lifecycle_timezone,
    'YYYY-MM-DD"T"HH24:MI'
  ) as neuer_schluessel
from public.dose_logs l
join public.cycles c on c.id = l.cycle_id
where l.routine_slot_key is not null
  and c.lifecycle_timezone is not null
  and l.routine_slot_key ~ '^[^@]+@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$';

create temporary table slot_key_kollision on commit drop as
-- (a) zwei alte Zeilen fallen auf denselben neuen Namen
select n.id from slot_key_neu n
join (
  select user_id, neuer_schluessel from slot_key_neu
  group by user_id, neuer_schluessel having count(*) > 1
) d on d.user_id = n.user_id and d.neuer_schluessel = n.neuer_schluessel
union
-- (b) der neue Name ist schon vergeben (eine Zeile aus der Zeit nach der
--     Umstellung traegt ihn bereits)
select n.id from slot_key_neu n
join public.dose_logs vorhanden
  on vorhanden.user_id = n.user_id
 and vorhanden.routine_slot_key = n.neuer_schluessel
 and vorhanden.id <> n.id;

-- ---------------------------------------------------------------------------
-- 3. Umstellen -- alles ausser den Kollisionen.
-- ---------------------------------------------------------------------------
update public.dose_logs l
set routine_slot_key = n.neuer_schluessel
from slot_key_neu n
where n.id = l.id
  and n.id not in (select id from slot_key_kollision);

-- ---------------------------------------------------------------------------
-- 4. Nachzaehlen.
-- ---------------------------------------------------------------------------
select
  r.alte_form                                    as vorher_alte_form,
  r.ohne_zeitzone                                as uebersprungen_ohne_zeitzone,
  (select count(*) from slot_key_kollision)      as uebersprungen_kollision,
  r.umstellbar - (select count(*) from slot_key_kollision) as umgestellt,
  (
    select count(*) from public.dose_logs
    where routine_slot_key ~ '^[^@]+@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$'
  )                                              as nachher_alte_form,
  (
    select count(*) from public.dose_logs
    where routine_slot_key ~ '^[^@]+@\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
  )                                              as nachher_wanduhr
from slot_key_migration_report r;

commit;
