-- My Stack: die Darreichungsform 'liquid' entfernen.
--
-- NICHT AUSGEFUEHRT. Diese Datei wartet auf die ausdrueckliche Freigabe.
--
-- Warum getrennt: die App braucht diese Migration nicht. `getDosageForm`
-- faellt fuer eine unbekannte Form auf 'other' zurueck, ein Bestandseintrag
-- auf 'liquid' zeigt also weiter seine Textkarte, statt abzustuerzen. Diese
-- Datei raeumt nur nach — sie schreibt Nutzerdaten um und zieht danach die
-- Pruefregel enger. Beides ist nicht umkehrbar, also entscheidet der Mensch,
-- wann es laeuft.
--
-- Reihenfolge ist Pflicht: erst die Zeilen umschreiben, dann die Regel
-- enger ziehen. Andersherum weist Postgres die neue Pruefregel zurueck,
-- solange noch eine Zeile auf 'liquid' steht.
--
-- Vorher zaehlen, was betroffen ist:
--   select count(*) from public.stack_items where dosage_form = 'liquid';
--   select count(*) from public.substance_catalog
--    where 'liquid' = any(suggested_dosage_forms);

begin;

-- 1. Bestandseintraege auf 'other' umschreiben. 'other' und nicht 'drops':
--    'liquid' war der Sammelbegriff fuer alles Fluessige ohne eigene Form,
--    und 'other' ist genau dieser Sammelbegriff. Wer einen Eintrag genauer
--    einordnen will, kann ihn im Formular jederzeit auf 'drops', 'spray'
--    oder 'tube' stellen.
update public.stack_items
set dosage_form = 'other'
where dosage_form = 'liquid';

-- 2. 'liquid' aus den Vorschlaegen des Katalogs streichen. Die Vorschlaege
--    sind nur die obere Reihe im Formular; die volle Liste bleibt darunter
--    erreichbar. Ein leeres Feld ist deshalb kein Verlust — dann zeigt das
--    Formular die gaengigen Formen.
update public.substance_catalog
set suggested_dosage_forms = array_remove(suggested_dosage_forms, 'liquid')
where 'liquid' = any(suggested_dosage_forms);

-- 3. Die Pruefregel enger ziehen, damit 'liquid' nicht wieder hereinkommt.
alter table public.stack_items
  drop constraint if exists stack_items_dosage_form_check;

alter table public.stack_items
  add constraint stack_items_dosage_form_check
    check (dosage_form in (
      'vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops',
      'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube', 'other'
    ));

commit;

-- 4. Die Speicher-Funktion pruefte die Form ein zweites Mal, mit derselben
--    Liste im Rumpf. Sie steht in supabase-my-stack-tracking-depth.sql und
--    wird dort mit `create or replace` neu gesetzt — 'liquid' ist dort
--    absichtlich noch enthalten, damit ein Bestandseintrag beim Speichern
--    nicht abgewiesen wird, bevor diese Datei gelaufen ist. Nach dieser
--    Migration kann die Zeile dort ebenfalls fallen; das ist eine Aenderung
--    an der Funktion, keine an den Daten, und gehoert in denselben Schritt
--    wie das naechste Ausrollen der Funktion.
