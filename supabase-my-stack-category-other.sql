-- My Stack — Kategorie „Sonstiges" (`other`)
--
-- WARUM
-- Der Katalog hat 182 Einträge und deckt trotzdem nicht alles ab. Wer seine
-- Substanz frei einträgt, musste sie bisher in eines von fünf Fächern zwingen.
-- Jede dieser Wahlen ist eine Behauptung, die die App später auswertet — beim
-- Vial entscheidet die Kategorie, ob nach einer Rekonstitution oder nach einer
-- fertigen Konzentration gefragt wird. `other` ist die ehrliche Antwort darauf
-- und trägt deshalb bewusst KEINE Aussage: die App behandelt es wie „noch
-- nicht gewählt" (siehe `strengthShapeFor` in src/features/my-stack/lib/dosageForms.ts).
--
-- WAS DIESE DATEI TUT
-- Sie erweitert die beiden CHECK-Constraints. Additiv: keine bestehende Zeile
-- verletzt die neue Bedingung, keine Zeile wird geändert, nichts gelöscht.
-- Zweimal laufen lassen ist folgenlos.
--
-- WAS SIE NICHT TUT
-- Die Liste steht ein zweites Mal INNERHALB von `public.save_stack_item`.
-- Diese Funktion wird beim Einspielen des My-Stack-Schemas ohnehin als Ganzes
-- neu geschrieben (`supabase-my-stack-foundation.sql`,
-- `supabase-my-stack-tracking-depth.sql`) — dort ist `other` ergänzt. Sie hier
-- zu flicken hieße, eine Funktion zu überschreiben, die der nächste
-- Schema-Lauf ersetzt.

begin;

alter table public.substance_catalog
  drop constraint if exists substance_catalog_default_category_check;

alter table public.substance_catalog
  add constraint substance_catalog_default_category_check
  check (default_category in ('peptide', 'medication', 'hormone', 'supplement', 'vitamin', 'other'));

alter table public.stack_items
  drop constraint if exists stack_items_category_check;

alter table public.stack_items
  add constraint stack_items_category_check
  check (category in ('peptide', 'medication', 'hormone', 'supplement', 'vitamin', 'other'));

commit;

-- Nachzählen:
--   select conrelid::regclass::text, pg_get_constraintdef(oid)
--   from pg_constraint where conname in (
--     'substance_catalog_default_category_check', 'stack_items_category_check');
--   select count(*) from public.substance_catalog;   -- unverändert
--   select count(*) from public.stack_items;         -- unverändert
