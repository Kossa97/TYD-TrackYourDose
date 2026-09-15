-- Rhythmus und Menge je Einnahmezeitpunkt.
--
-- „Einnahmefrequenz" sind in Wirklichkeit drei unabhaengige Fragen:
--
--   AN WELCHEN TAGEN   taeglich, bestimmte Wochentage, im Abstand von N
--                      Tagen/Wochen/Monaten, X Tage an und Y aus
--   WIE OFT AM TAG     ein bis vier Einnahmezeitpunkte (steht in `intake_time`)
--   WIE VIEL           je Zeitpunkt, nicht je Tag
--
-- `frequency` trug bisher alle drei durcheinander, als einer von acht festen
-- Texten. Damit liess sich weder ein Depot alle zehn Wochen abbilden noch die
-- Pille mit drei Wochen an und einer Woche Pause, noch „morgens 1000 mg,
-- abends 500 mg".
--
-- `frequency` bleibt der Formtext und behaelt seine bisherigen Werte —
-- bestehende Zyklen muessen NICHT angefasst werden und gelten unveraendert
-- weiter. Die Zahlen, die eine Form braucht, stehen daneben:
--
--   interval_unit    'day' | 'week' | 'month', zu `x_days_interval`
--   cycle_on_days    zu frequency = 'Im Wechsel'
--   cycle_off_days   dito
--   slot_doses       Mengen je Zeitpunkt, kommagetrennt und in derselben
--                    Reihenfolge wie `intake_time` — leere Stellen erlaubt,
--                    dann gilt dort `dose`. Leer/NULL heisst: ueberall `dose`,
--                    wie bei jedem Zyklus vor dieser Aenderung.
--   slot_days        Wochentage je Zeitpunkt, kommagetrennt wie `intake_time`,
--                    die Tage eines Zeitpunkts mit `|`: „Mo|Mi,Mo" heisst
--                    morgens an Mo und Mi, abends nur an Mo. Ein leerer
--                    Eintrag heisst: an jedem Tag, den der Rhythmus auswaehlt.
--                    Damit laesst sich sagen, was vorher fehlte — montags
--                    zweimal, mittwochs einmal.
--
-- Idempotent: zweimal ausgefuehrt aendert der zweite Lauf nichts.

begin;

alter table public.cycles
  add column if not exists interval_unit text,
  add column if not exists cycle_on_days integer,
  add column if not exists cycle_off_days integer,
  add column if not exists slot_doses text,
  add column if not exists slot_days text;

-- Nur die drei Einheiten, die die App kennt. Ohne Pruefung liefe ein Tippfehler
-- still als „Tage" durch, und ein Depot alle sechs Monate waere alle sechs Tage.
alter table public.cycles
  drop constraint if exists cycles_interval_unit_check;
alter table public.cycles
  add constraint cycles_interval_unit_check
  check (interval_unit is null or interval_unit in ('day', 'week', 'month'));

alter table public.cycles
  drop constraint if exists cycles_cycle_days_check;
alter table public.cycles
  add constraint cycles_cycle_days_check
  check (
    (cycle_on_days is null or cycle_on_days between 1 and 90)
    and (cycle_off_days is null or cycle_off_days between 1 and 90)
  );

comment on column public.cycles.interval_unit is
  'Einheit zu x_days_interval: day | week | month. NULL = Tage (alte Zyklen).';
comment on column public.cycles.cycle_on_days is
  'Wechselzyklus: Tage am Stueck mit Einnahme. Gilt bei frequency = ''Im Wechsel''.';
comment on column public.cycles.cycle_off_days is
  'Wechselzyklus: Tage Pause danach.';
comment on column public.cycles.slot_doses is
  'Menge je Einnahmezeitpunkt, kommagetrennt wie intake_time. NULL = ueberall dose.';
comment on column public.cycles.slot_days is
  'Wochentage je Zeitpunkt, kommagetrennt wie intake_time, Tage mit | getrennt. NULL = alle Tage.';

commit;
