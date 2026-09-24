\set ON_ERROR_STOP on
-- Trockenlauf fuer supabase-my-stack-bestand.sql.
-- Nur gegen ein Wegwerf-PostgreSQL 16. Synthetische Daten; die Vials bilden
-- die Zahlenmuster des Produktivstands vom 24.09.2026 nach (Vorrat, Anfangs-
-- stand, Lager, angemischt ja/nein, archiviert) — keine Namen, keine Inhalte.
create extension if not exists pgcrypto;
create schema auth;
create table auth.users (id uuid primary key);
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (bucket_id text, name text);
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
\ir ../../supabase-schema.sql
\ir ../../supabase-schema-update.sql
\ir ../../supabase-cycles-update.sql
\ir ../../supabase-intake-reminder.sql
\ir ../../supabase-push.sql
\ir ../../supabase-intake-rhythm.sql
\ir ../../supabase-cycle-schedule-history.sql
\ir ../../supabase-inventory.sql
\ir ../../supabase-escalation.sql
\ir ../../supabase-archive.sql
\ir ../../supabase-injection.sql
\ir ../../supabase-injection-pro.sql
\ir ../../supabase-pk-profiles.sql
\ir ../../supabase-peptide-library.sql
\ir ../../supabase-rls-hardening.sql
alter table peptides add column pk_profile_id uuid references pk_profiles(id) on delete set null;
create index peptides_pk_profile_idx on peptides(pk_profile_id);
alter table cycles add column schedule_days text[] default '{}';
-- inventory_items entstand in Produktion ohne Datei im Repo; Spalten wie dort.
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  batch_number text,
  batch_source text,
  batch_file_url text,
  vials_count integer,
  mg_per_vial numeric,
  created_at timestamptz default now(),
  vials_initial integer,
  pk_profile_id uuid
);
alter table peptides add column if not exists inventory_item_id uuid references public.inventory_items(id) on delete set null;
\ir ../../supabase-my-stack-foundation.sql
\ir ../../supabase-my-stack-tracking-depth.sql
grant select, insert, update, delete on stack_items, cycles, dose_logs, stack_item_inventory to authenticated;

-- ── Ist-Zustand ─────────────────────────────────────────────────────────────
-- Eine Transaktion: die Vollstaendigkeitspruefung laeuft erst beim Commit.
begin;
insert into auth.users
select ('15000000-0000-0000-0000-00000000000' || n)::uuid from generate_series(1, 4) n;

-- n, Nutzer, vials_in_stock, vials_initial, Lager vials_count, Lager vials_initial, angemischt, archiviert
create temp table muster (n int, nutzer int, rest numeric, anfang numeric, lager int, lager_anfang int, angemischt boolean, archiviert boolean);
insert into muster values
  (1, 1, 0.95, 1, 2, 5, true, false),
  (2, 1, 0.96, 1, 3, 6, true, false),
  (3, 1, 1.00, 1, 1, 6, true, false),
  (4, 2, 1.00, 1, 3, 8, true, false),
  (5, 2, 1.00, 1, 3, 8, true, true),
  (6, 2, 1.00, 1, 4, 1, true, false),
  (7, 3, 1.00, 1, 2, 10, true, false),
  (8, 3, 5.00, 5, 4, 5, true, false),
  (9, 3, 5.00, 5, 4, 5, true, false),
  (10, 4, 5.60, 8, 8, 8, true, false),
  (11, 4, 7.10, 8, 7, 8, true, false),
  (12, 4, 9.96, 10, 10, 1, false, false),
  (13, 4, 10.00, 10, 10, 10, false, false);

insert into inventory_items (id, user_id, name, batch_number, batch_source, batch_file_url, vials_count, mg_per_vial, vials_initial)
select ('15000000-0000-0000-0003-' || lpad(n::text, 12, '0'))::uuid,
  ('15000000-0000-0000-0000-00000000000' || nutzer)::uuid,
  'Lager ' || n, 'L-' || n, 'Quelle ' || n, null, lager, 10, lager_anfang
from muster;
-- Neun Lagerposten ohne Eintrag, wie in Produktion.
insert into inventory_items (user_id, name, vials_count, mg_per_vial, vials_initial)
select '15000000-0000-0000-0000-000000000001', 'Verwaist ' || n, 1, 5, 1 from generate_series(1, 9) n;

insert into stack_items (
  id, user_id, display_name, dosage_form, default_method, default_unit, vial_amount_mg, vial_amount_unit,
  reconstitution_ml, vials_in_stock, vials_initial, reconstitution_date, expiry_days,
  batch_number, batch_source, batch_file_url, inventory_item_id, archived
)
select ('15000000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid,
  ('15000000-0000-0000-0000-00000000000' || nutzer)::uuid,
  'Vial ' || n, 'vial', 'Subkutan', 'mcg', 10, 'mg',
  2, rest, anfang, case when angemischt then date '2026-09-01' end, 28,
  case when n <> 1 then 'C-' || n end, null, case when n = 2 then 'https://synthetic.invalid/analyse.pdf' end,
  ('15000000-0000-0000-0003-' || lpad(n::text, 12, '0'))::uuid, archiviert
from muster;

insert into stack_item_ingredients (stack_item_id, custom_name, amount_value, amount_unit, basis_value, basis_unit, position)
select ('15000000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid, 'Wirkstoff', 10, 'mg', 1, 'vial', 0 from muster;

-- Die uebrigen Formen: eine Tablette mit eigenem Bestand, ein Nasenspray mit
-- Vial-Altwerten (darf nicht uebernommen werden) und ein Vial ohne
-- Zusammensetzung — das geht nur unterhalb von 'complete'.
insert into stack_items (id, user_id, display_name, dosage_form, default_method, vial_amount_mg, reconstitution_ml, inventory_item_id, tracking_level)
values
  ('15000000-0000-0000-0001-000000000020', '15000000-0000-0000-0000-000000000001', 'Tablette', 'tablet', 'Oral', null, null, null, 'complete'),
  ('15000000-0000-0000-0001-000000000021', '15000000-0000-0000-0000-000000000002', 'Nasenspray', 'nasal_spray', 'Nasal', 5, null, '15000000-0000-0000-0003-000000000001', 'complete'),
  ('15000000-0000-0000-0001-000000000022', '15000000-0000-0000-0000-000000000003', 'Vial ohne Zusammensetzung', 'vial', 'Subkutan', 5, 1, null, 'with_amount'),
  ('15000000-0000-0000-0001-000000000023', '15000000-0000-0000-0000-000000000003', 'Mischvial', 'vial', 'Subkutan', 15, 2, null, 'complete');
insert into stack_item_ingredients (stack_item_id, custom_name, amount_value, amount_unit, basis_value, basis_unit, position)
values
  ('15000000-0000-0000-0001-000000000020', 'Wirkstoff', 50, 'mg', 1, 'tablet', 0),
  ('15000000-0000-0000-0001-000000000021', 'Wirkstoff', 100, 'mcg', 1, 'spray', 0),
  ('15000000-0000-0000-0001-000000000023', 'Wirkstoff A', 10, 'mg', 1, 'vial', 0),
  ('15000000-0000-0000-0001-000000000023', 'Wirkstoff B', 5, 'mg', 1, 'vial', 1);
-- Nicht in Produktion, aber moeglich: Altzaehler ohne Anfangsstand, leeres
-- Chargenfeld am Eintrag, 3 ml Fluessigkeit.
insert into stack_items (id, user_id, display_name, dosage_form, default_method, vial_amount_mg, vial_amount_unit,
  reconstitution_ml, vials_in_stock, vials_initial, batch_number, inventory_item_id)
values ('15000000-0000-0000-0001-000000000024', '15000000-0000-0000-0000-000000000003', 'Altzaehler', 'vial', 'Subkutan', 10, 'mg',
  3, 5, 0, '  ', '15000000-0000-0000-0003-000000000009');
insert into stack_item_ingredients (stack_item_id, custom_name, amount_value, amount_unit, basis_value, basis_unit, position)
values ('15000000-0000-0000-0001-000000000024', 'Wirkstoff', 10, 'mg', 1, 'vial', 0);
insert into stack_item_inventory (user_id, stack_item_id, enabled, package_quantity, package_unit, remaining_quantity)
values ('15000000-0000-0000-0000-000000000001', '15000000-0000-0000-0001-000000000020', true, 30, 'tablet', 12);

-- Eine alte Vial-Buchung, gebucht vor der Umstellung (wie in Produktion).
insert into dose_logs (id, user_id, stack_item_id, dose, unit, method, logged_at, taken)
values ('15000000-0000-0000-0004-000000000001', '15000000-0000-0000-0000-000000000001', '15000000-0000-0000-0001-000000000001', 500, 'mcg', 'Subkutan', '2026-09-20 08:00+00', true);
insert into vial_stock_movements (user_id, stack_item_id, dose_log_id, source_dose_log_id, delta_vials, applied)
values ('15000000-0000-0000-0000-000000000001', '15000000-0000-0000-0001-000000000001', '15000000-0000-0000-0004-000000000001', '15000000-0000-0000-0004-000000000001', 0.05, true);
commit;

create temp table zaehlung (lauf text, bestaende bigint, vial_bestaende bigint, uebernommen bigint, vorrat_summe numeric, stack_items bigint, lager bigint, vial_buchungen bigint, altfelder_summe numeric);
-- plpgsql, weil legacy_migrated_at erst mit der Migration entsteht.
create function pg_temp.zaehle(lauf text) returns void language plpgsql as $$
begin
  insert into zaehlung select lauf,
    (select count(*) from stack_item_inventory),
    (select count(*) from stack_item_inventory where package_unit = 'vial'),
    case when exists (select 1 from information_schema.columns where table_name = 'stack_item_inventory' and column_name = 'legacy_migrated_at')
      then (select count(*) from stack_item_inventory where (to_jsonb(stack_item_inventory) ->> 'legacy_migrated_at') is not null) else 0 end,
    (select coalesce(sum(remaining_quantity), 0) from stack_item_inventory where package_unit = 'vial'),
    (select count(*) from stack_items),
    (select count(*) from inventory_items),
    (select count(*) from vial_stock_movements),
    (select sum(coalesce(vials_in_stock, 0)) + (select sum(vials_count) from inventory_items) from stack_items);
end
$$;
select pg_temp.zaehle('vorher');

-- ── Migration, zweimal ──────────────────────────────────────────────────────
\ir ../../supabase-my-stack-bestand.sql
select pg_temp.zaehle('lauf 1');
\ir ../../supabase-my-stack-bestand.sql
select pg_temp.zaehle('lauf 2');

\echo 'Zaehlung:'
select * from zaehlung;

do $$
declare
  eins zaehlung; zwei zaehlung; vorher zaehlung;
begin
  select * into vorher from zaehlung where lauf = 'vorher';
  select * into eins from zaehlung where lauf = 'lauf 1';
  select * into zwei from zaehlung where lauf = 'lauf 2';
  assert vorher.bestaende = 1, 'vorher: nur der Tablettenbestand';
  assert eins.vial_bestaende = 14, format('14 Vials uebernommen erwartet, %s', eins.vial_bestaende);
  assert eins.bestaende = 15, 'Tablettenbestand bleibt, keine weiteren Zeilen';
  assert eins.vorrat_summe = 72.57, format('Vorrat 72.57 erwartet, %s', eins.vorrat_summe);
  assert (eins.bestaende, eins.vial_bestaende, eins.vorrat_summe) = (zwei.bestaende, zwei.vial_bestaende, zwei.vorrat_summe), 'zweiter Lauf aendert nichts';
  assert (vorher.stack_items, vorher.lager, vorher.vial_buchungen, vorher.altfelder_summe)
    = (zwei.stack_items, zwei.lager, zwei.vial_buchungen, zwei.altfelder_summe), 'Altdaten unberuehrt';
end $$;

\echo 'Uebernommene Vials:'
select right(stack_item_id::text, 2) as vial, package_quantity, remaining_quantity, batch_number, batch_source,
  batch_file_url is not null as analyse, opened_at, use_within_days, reconstitution_ml
from stack_item_inventory where package_unit = 'vial' order by stack_item_id;

do $$
begin
  assert (select remaining_quantity from stack_item_inventory where stack_item_id = '15000000-0000-0000-0001-000000000001') = 2.95, 'neues Modell: Lager + Rest';
  assert (select remaining_quantity from stack_item_inventory where stack_item_id = '15000000-0000-0000-0001-000000000010') = 5.60, 'altes Modell: Zaehler zaehlt alles';
  assert (select package_quantity from stack_item_inventory where stack_item_id = '15000000-0000-0000-0001-000000000006') = 5, 'Packung mindestens so gross wie der Vorrat';
  assert (select batch_number from stack_item_inventory where stack_item_id = '15000000-0000-0000-0001-000000000001') = 'L-1', 'Charge aus dem Lager, wenn am Eintrag leer';
  assert (select opened_at from stack_item_inventory where stack_item_id = '15000000-0000-0000-0001-000000000012') is null, 'nicht angemischt bleibt leer';
  assert not exists (select 1 from stack_item_inventory where stack_item_id in ('15000000-0000-0000-0001-000000000021', '15000000-0000-0000-0001-000000000022', '15000000-0000-0000-0001-000000000023')), 'Nasenspray, Vial ohne Zusammensetzung und Mischvial nicht uebernommen';
  assert (select remaining_quantity from stack_item_inventory where stack_item_id = '15000000-0000-0000-0001-000000000024') = 5, 'Altzaehler ohne Anfangsstand zaehlt alles';
  assert (select package_quantity from stack_item_inventory where stack_item_id = '15000000-0000-0000-0001-000000000010') = 8, 'Packung aus dem Anfangsstand des Eintrags';
  assert (select batch_number from stack_item_inventory where stack_item_id = '15000000-0000-0000-0001-000000000024') = 'L-9', 'leeres Feld am Eintrag verdeckt das Lager nicht';
  assert (select remaining_quantity from stack_item_inventory where stack_item_id = '15000000-0000-0000-0001-000000000020') = 12, 'Tablettenbestand unveraendert';
end $$;

-- ── Buchungen nach der Umstellung ───────────────────────────────────────────
insert into dose_logs (id, user_id, stack_item_id, dose, unit, method, logged_at, taken) values
  ('15000000-0000-0000-0004-000000000002', '15000000-0000-0000-0000-000000000001', '15000000-0000-0000-0001-000000000001', 500, 'mcg', 'Subkutan', now(), true),
  ('15000000-0000-0000-0004-000000000003', '15000000-0000-0000-0000-000000000001', '15000000-0000-0000-0001-000000000001', 1, 'mg', 'Subkutan', now(), true),
  ('15000000-0000-0000-0004-000000000004', '15000000-0000-0000-0000-000000000001', '15000000-0000-0000-0001-000000000001', 0.2, 'ml', 'Subkutan', now(), true),
  ('15000000-0000-0000-0004-000000000005', '15000000-0000-0000-0000-000000000001', '15000000-0000-0000-0001-000000000001', 2, 'IU', 'Subkutan', now(), true),
  ('15000000-0000-0000-0004-000000000006', '15000000-0000-0000-0000-000000000003', '15000000-0000-0000-0001-000000000022', 1, 'mg', 'Subkutan', now(), true),
  ('15000000-0000-0000-0004-000000000007', '15000000-0000-0000-0000-000000000001', '15000000-0000-0000-0001-000000000020', 50, 'mg', 'Oral', now(), true);

select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', false);
set role authenticated;
do $$
declare
  rest numeric;
begin
  -- 500 mcg aus einem 10-mg-Vial = 0,05 Vial.
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000002');
  assert rest = 2.90, format('mcg-Buchung: 2.90 erwartet, %s', rest);
  -- Zweimal bestaetigt bucht nur einmal.
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000002');
  assert rest = 2.90, 'idempotent';
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000003');
  assert rest = 2.80, format('mg-Buchung: 2.80 erwartet, %s', rest);
  -- 0,2 ml aus 2 ml Fluessigkeit = 0,1 Vial.
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000004');
  assert rest = 2.70, format('ml-Buchung: 2.70 erwartet, %s', rest);
  begin
    perform apply_inventory_confirmation('15000000-0000-0000-0004-000000000005');
    assert false, 'IU laesst sich nicht umrechnen';
  exception when raise_exception then
    assert sqlerrm = 'Inventory conversion is ambiguous or unsupported', sqlerrm;
  end;
  assert (select vials_in_stock from stack_items where id = '15000000-0000-0000-0001-000000000001') = 0.95, 'Altfeld wird nicht mehr fortgeschrieben';

  -- Rueckgaengig: neue Buchung zurueck auf den Bestand.
  rest := reverse_inventory_confirmation('15000000-0000-0000-0004-000000000003', 'undo');
  assert rest = 2.80, format('undo neu: 2.80 erwartet, %s', rest);
  -- Alte Vial-Buchung von vor der Umstellung: Gutschrift auf den Bestand.
  rest := reverse_inventory_confirmation('15000000-0000-0000-0004-000000000001', 'undo');
  assert rest = 2.85, format('undo alt: 2.85 erwartet, %s', rest);
  assert (select vials_in_stock from stack_items where id = '15000000-0000-0000-0001-000000000001') = 0.95, 'Altfeld bleibt beim Rueckgaengig unberuehrt';
  -- Erneut bestaetigt: die alte Buchung wird wiederverwendet, jetzt auf den Bestand.
  update dose_logs set taken = true where id = '15000000-0000-0000-0004-000000000001';
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000001');
  assert rest = 2.80, format('reapply alt: 2.80 erwartet, %s', rest);
  assert (select count(*) from stack_item_inventory_movements where source_dose_log_id = '15000000-0000-0000-0004-000000000001') = 0, 'keine zweite Buchung neben der alten';

  -- Tablette: unveraendert ueber das allgemeine Modell.
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000007');
  assert rest = 11, format('Tablette: 11 erwartet, %s', rest);

  -- Bestand korrigieren ist ein einfaches Update der eigenen Zeile.
  update stack_item_inventory set remaining_quantity = 0 where stack_item_id = '15000000-0000-0000-0001-000000000001';
  update dose_logs set taken = true where id = '15000000-0000-0000-0004-000000000003';
  -- Leeres Vial: die Einnahme geht durch, gebucht wird nichts (wie bisher).
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000003');
  assert rest = 0, format('leer: 0 erwartet, %s', rest);
  assert (select count(*) from stack_item_inventory_movements where source_dose_log_id = '15000000-0000-0000-0004-000000000003' and applied) = 0, 'leer: keine Buchung';
  -- Leere Tablette meldet sich weiterhin.
  update stack_item_inventory set remaining_quantity = 0 where stack_item_id = '15000000-0000-0000-0001-000000000020';
  update dose_logs set taken = true where id = '15000000-0000-0000-0004-000000000007';
  perform reverse_inventory_confirmation('15000000-0000-0000-0004-000000000007', 'undo');
  update stack_item_inventory set remaining_quantity = 0 where stack_item_id = '15000000-0000-0000-0001-000000000020';
  update dose_logs set taken = true where id = '15000000-0000-0000-0004-000000000007';
  begin
    perform apply_inventory_confirmation('15000000-0000-0000-0004-000000000007');
    assert false, 'leere Tablette meldet sich';
  exception when raise_exception then
    assert sqlerrm = 'Insufficient inventory for confirmation', sqlerrm;
  end;
end $$;

-- Vial ohne Bestandszeile: der alte Weg, unveraendert.
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000003', false);
insert into dose_logs (id, user_id, stack_item_id, dose, unit, method, logged_at, taken) values
  ('15000000-0000-0000-0004-000000000008', '15000000-0000-0000-0000-000000000003', '15000000-0000-0000-0001-000000000024', 0.2, 'ml', 'Subkutan', now(), true),
  ('15000000-0000-0000-0004-000000000009', '15000000-0000-0000-0000-000000000003', '15000000-0000-0000-0001-000000000023', 1, 'mg', 'Subkutan', now(), true);
do $$
declare
  rest numeric;
begin
  -- 0,2 ml aus 3 ml: auf vier Stellen gerundet.
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000008');
  assert rest = 4.9333, format('ml gerundet: 4.9333 erwartet, %s', rest);
  -- Mischvial bleibt auf dem alten Weg und bucht 1/15 Vial vom Altfeld.
  update stack_items set vials_in_stock = 1 where id = '15000000-0000-0000-0001-000000000023';
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000009');
  assert rest = 0.93, format('Mischvial: 0.93 erwartet (Altfeld numeric(8,2)), %s', rest);

  update stack_items set vials_in_stock = 1 where id = '15000000-0000-0000-0001-000000000022';
  rest := apply_inventory_confirmation('15000000-0000-0000-0004-000000000006');
  assert rest = 0.8, format('Altweg: 0.8 erwartet, %s', rest);
  rest := reverse_inventory_confirmation('15000000-0000-0000-0004-000000000006', 'undo');
  assert rest = 1, format('Altweg undo: 1 erwartet, %s', rest);
end $$;

-- Fremde Zeilen bleiben fremd.
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000002', false);
do $$
begin
  begin
    perform apply_inventory_confirmation('15000000-0000-0000-0004-000000000002');
    assert false, 'fremder Eintrag';
  exception when raise_exception then
    assert sqlerrm = 'Confirmed dose log not found', sqlerrm;
  end;
  assert (select count(*) from stack_item_inventory) = 3, format('RLS: 3 eigene Bestaende erwartet, %s', (select count(*) from stack_item_inventory));
end $$;
reset role;

\echo 'Trockenlauf bestanden.'
