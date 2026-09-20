-- Indizes fuer die Abfragen, die die App tatsaechlich stellt.
--
-- Befund (gemessen am 2026-09-20, Logs der letzten 24 Stunden):
--
--   /rest/v1/dose_logs   5159 Anfragen
--   /rest/v1/cycles      2792 Anfragen
--   /rest/v1/stack_items  238 Anfragen
--
-- Auf 238 Ladevorgaenge kamen also ueber 5000 Dosis-Abfragen. Der Grund ist
-- eine Schleife je Zyklus (siehe `blutspiegelHistory.ts`), und jede einzelne
-- dieser Abfragen las die GANZE Tabelle:
--
--   explain: Seq Scan on dose_logs
--            Filter: (taken AND (cycle_id = ...))
--
-- `dose_logs` trug ausser dem Primaerschluessel und einem partiellen
-- Unique-Index keinen einzigen Index, `cycles` gar keinen -- nicht einmal auf
-- `user_id`, ueber das jede RLS-Pruefung laeuft. Bei 10.804 Zeilen in
-- `dose_logs` und 153 Zyklen ergibt das je Seitenaufruf hunderte
-- Rundreisen, jede mit einem vollstaendigen Tabellendurchlauf.
--
-- Diese Datei legt NUR AN. Sie liest, aendert und loescht keine einzige Zeile,
-- und sie ruehrt keine Spalte und keine Tabelle an. Ein Index ist eine
-- Beilage; rueckgaengig macht ihn ein `drop index`.
--
-- Jede Anweisung ist mit `if not exists` geschrieben: zweimal laufen lassen
-- ist erlaubt und aendert beim zweiten Mal nichts.
--
-- `concurrently` steht bewusst NICHT hier: die Anweisung laeuft dann nicht in
-- einer Transaktion, und der SQL-Editor umschliesst das Skript mit einer. Bei
-- diesen Tabellengroessen dauert die Sperre Millisekunden.

-- ── Die beiden heissen Pfade ────────────────────────────────────────────────

-- „Gib mir die genommenen Dosen dieses Zyklus, nach Zeit sortiert."
-- Die Sortierspalte gehoert mit in den Index, sonst bleibt ein Sort stehen.
create index if not exists dose_logs_cycle_logged_at_idx
  on public.dose_logs (cycle_id, logged_at);

-- Die zweite Abfrage je Zyklus: die Altzeilen ohne `cycle_id`, ueber die
-- Substanz und einen Zeitraum gesucht.
create index if not exists dose_logs_stack_item_logged_at_idx
  on public.dose_logs (stack_item_id, logged_at);

-- Jede Liste, die ein Nutzer von seinen Einnahmen sieht -- und jede
-- RLS-Pruefung auf dieser Tabelle.
create index if not exists dose_logs_user_logged_at_idx
  on public.dose_logs (user_id, logged_at desc);

-- `cycles` trug ausser dem Primaerschluessel nichts. Beide Spalten werden in
-- praktisch jeder Abfrage gefiltert.
create index if not exists cycles_user_id_idx
  on public.cycles (user_id);
create index if not exists cycles_stack_item_id_idx
  on public.cycles (stack_item_id);

-- ── Die uebrigen Fremdschluessel ohne deckenden Index ───────────────────────
-- Der Supabase-Advisor meldet sie als `unindexed_foreign_keys`. Sie sind
-- heute nicht der Engpass, aber ohne sie muss Postgres bei jedem Loeschen
-- oder Aendern der Elternzeile die Kindtabelle vollstaendig durchsuchen.

create index if not exists dose_logs_vial_id_idx
  on public.dose_logs (vial_id);
create index if not exists dose_logs_plan_version_id_idx
  on public.dose_logs (plan_version_id);

create index if not exists bloodwork_user_id_idx
  on public.bloodwork (user_id);

create index if not exists cycle_migration_conflicts_stack_item_id_idx
  on public.cycle_migration_conflicts (stack_item_id);
create index if not exists cycle_pause_periods_cycle_id_idx
  on public.cycle_pause_periods (cycle_id);
create index if not exists cycle_pause_periods_user_id_idx
  on public.cycle_pause_periods (user_id);
create index if not exists cycle_plan_versions_user_id_idx
  on public.cycle_plan_versions (user_id);

create index if not exists dose_escalations_cycle_id_idx
  on public.dose_escalations (cycle_id);
create index if not exists dose_escalations_user_id_idx
  on public.dose_escalations (user_id);

create index if not exists effects_dose_log_id_idx
  on public.effects (dose_log_id);
create index if not exists effects_stack_item_id_idx
  on public.effects (stack_item_id);
create index if not exists effects_user_id_idx
  on public.effects (user_id);

create index if not exists injection_logs_cycle_id_idx
  on public.injection_logs (cycle_id);
create index if not exists injection_logs_stack_item_id_idx
  on public.injection_logs (stack_item_id);

create index if not exists inventory_items_pk_profile_id_idx
  on public.inventory_items (pk_profile_id);
create index if not exists inventory_items_user_id_idx
  on public.inventory_items (user_id);

create index if not exists reviews_stack_item_id_idx
  on public.reviews (stack_item_id);
create index if not exists reviews_user_id_idx
  on public.reviews (user_id);

create index if not exists stack_item_ingredients_catalog_substance_id_idx
  on public.stack_item_ingredients (catalog_substance_id);
create index if not exists stack_item_inventory_user_id_idx
  on public.stack_item_inventory (user_id);
create index if not exists stack_item_inventory_movements_inventory_id_idx
  on public.stack_item_inventory_movements (inventory_id);

create index if not exists stack_items_inventory_item_id_idx
  on public.stack_items (inventory_item_id);

create index if not exists substance_catalog_pk_profile_id_idx
  on public.substance_catalog (pk_profile_id);

create index if not exists vial_stock_movements_stack_item_id_idx
  on public.vial_stock_movements (stack_item_id);
create index if not exists vials_stack_item_id_idx
  on public.vials (stack_item_id);
create index if not exists vials_user_id_idx
  on public.vials (user_id);

-- Der Planer rechnet mit Statistiken. Nach neuen Indizes einmal einsammeln,
-- damit er sie ab der ersten Abfrage benutzt statt erst nach dem naechsten
-- Autovacuum.
analyze public.dose_logs;
analyze public.cycles;
