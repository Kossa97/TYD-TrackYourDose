-- Kombipraeparate im Substanzkatalog.
--
-- Ein Katalogeintrag kann aus mehreren Wirkstoffen bestehen — „CJC-1295 ohne
-- DAC + Ipamorelin", „Vitamin D3 + K2", „Dymista". Wird er im Formular
-- gewaehlt, legt der Entwurf je Bestandteil eine eigene Zutatenzeile an, und
-- der Blutspiegel rechnet je Wirkstoff aus dessen eigener Konzentration.
--
-- WARUM NAMEN UND KEINE IDs
-- `component_names` traegt die kanonischen Namen der Bestandteile, nicht ihre
-- ids. Der Katalog hat ohnehin einen Unique-Index auf lower(canonical_name),
-- der Name IST also der Schluessel. Namen sind im SQL-Editor lesbar, ueberleben
-- ein Neuaufsetzen der Tabelle, und ein Name, den die App nicht aufloesen kann,
-- bleibt wenigstens als benannte Zutat stehen statt lautlos zu verschwinden.
-- Dass jeder Name wirklich existiert, prueft der Vertragstest
-- `src/features/my-stack/lib/substanceCatalogSource.test.ts`.
--
-- WARUM KEIN EIGENES PK-PROFIL
-- Die Bestandteile haben verschiedene Halbwertszeiten. Ein gemeinsames Profil
-- waere eine erfundene Kurve. `pk_profile_id` bleibt bei Kombinationen null.
--
-- Reihenfolge: DIESE Datei zuerst, dann
-- `supabase-my-stack-catalog-expansion.sql` (generiert), die die Spalte fuellt.
-- Zweimal ausgefuehrt aendert sie nichts.

begin;

alter table public.substance_catalog
  add column if not exists component_names text[] not null default '{}';

comment on column public.substance_catalog.component_names is
  'Kanonische Namen der Bestandteile eines Kombipraeparats. Leer = eine einzelne Substanz.';

commit;
