/**
 * Erzeugt `supabase-my-stack-catalog-expansion.sql` aus
 * `scripts/substance-catalog-source.mjs`.
 *
 *   npm run catalog:sql
 *
 * Die SQL-Datei wird NICHT von Hand gepflegt. Sie ist der Ausdruck der
 * Quelldatei fuer den Supabase-SQL-Editor — dort greift RLS nicht, und seit
 * der Haertung (supabase-rls-hardening.sql) ist das der einzige Weg, Katalog-
 * zeilen zu schreiben.
 *
 * Der Upsert trifft den bestehenden Unique-Index
 * `substance_catalog_canonical_name_idx` auf lower(canonical_name): bekannte
 * Substanzen werden aktualisiert, neue angelegt, keine doppelt. Zweimal
 * ausgefuehrt aendert der zweite Lauf nichts.
 */
import { writeFileSync } from 'node:fs'
import { SUBSTANCE_CATALOG } from './substance-catalog-source.mjs'

const ZIEL = 'supabase-my-stack-catalog-expansion.sql'

/** Einfache Anfuehrungszeichen verdoppeln — mehr braucht es fuer Namen nicht. */
function quote(text) {
  return `'${String(text).replace(/'/g, "''")}'`
}

function textArray(werte) {
  if (werte.length === 0) return `'{}'::text[]`
  return `array[${werte.map(quote).join(', ')}]::text[]`
}

const zeilen = SUBSTANCE_CATALOG.map(eintrag => (
  `    (${quote(eintrag.name)}, ${textArray(eintrag.aliases)}, ${quote(eintrag.category)}, `
  + `${textArray(eintrag.dosageForms)}, ${textArray(eintrag.units)}, `
  + `${eintrag.pkProfile === null ? 'null' : quote(eintrag.pkProfile)}, `
  + `${textArray(eintrag.components ?? [])})`
)).join(',\n')

// Umbenennungen laufen VOR dem Upsert. Sonst trifft er die alte Schreibweise
// nicht und legt eine zweite Zeile an — waehrend die alte die id behaelt, an
// der `stack_item_ingredients.catalog_substance_id` haengt.
// Die `not exists`-Bedingung schuetzt vor einer Unique-Verletzung, falls der
// Zielname schon dasteht (etwa weil die Umbenennung bereits gelaufen ist).
const umbenennungen = SUBSTANCE_CATALOG
  .filter(eintrag => eintrag.renameFrom)
  .map(eintrag => (
    `update public.substance_catalog set canonical_name = ${quote(eintrag.name)}, updated_at = now()\n`
    + `where lower(canonical_name) = lower(${quote(eintrag.renameFrom)})\n`
    + `  and not exists (\n`
    + `    select 1 from public.substance_catalog andere\n`
    + `    where lower(andere.canonical_name) = lower(${quote(eintrag.name)})\n`
    + `  );`
  ))
  .join('\n\n')

const umbenennungsBlock = umbenennungen
  ? `-- ${SUBSTANCE_CATALOG.filter(e => e.renameFrom).length} Umbenennung(en): bestehende Zeilen behalten ihre id.\n${umbenennungen}\n\n`
  : ''

const sql = `-- GENERIERT von scripts/generate-substance-catalog-sql.mjs.
-- Nicht von Hand aendern — die Quelle ist scripts/substance-catalog-source.mjs.
-- Neu erzeugen mit: npm run catalog:sql
--
-- ${SUBSTANCE_CATALOG.length} Substanzen, davon ${SUBSTANCE_CATALOG.filter(e => (e.components ?? []).length > 0).length} Kombipraeparate.
-- Der Upsert trifft den Unique-Index auf lower(canonical_name): bekannte
-- Zeilen werden aktualisiert, neue angelegt. Ein zweiter Lauf aendert nichts.
--
-- SETZT supabase-my-stack-catalog-combinations.sql VORAUS — dort entsteht
-- die Spalte component_names, die diese Datei fuellt.

begin;

${umbenennungsBlock}with quelle (canonical_name, aliases, default_category, suggested_dosage_forms, suggested_units, pk_profile_name, component_names) as (
  values
${zeilen}
),
aufgeloest as (
  select
    quelle.canonical_name,
    quelle.aliases,
    quelle.default_category,
    quelle.suggested_dosage_forms,
    quelle.suggested_units,
    quelle.component_names,
    -- Das PK-Profil wird ueber Name ODER Alias gesucht, wie schon im
    -- Foundation-Seed: der Katalog schreibt "Semaglutid", das Profil
    -- "Semaglutide".
    (
      select profil.id
      from public.pk_profiles profil
      where quelle.pk_profile_name is not null
        and (
          lower(profil.name) = lower(quelle.pk_profile_name)
          or exists (
            select 1
            from unnest(profil.aliases) profil_alias
            where lower(profil_alias) = lower(quelle.pk_profile_name)
          )
        )
      order by (lower(profil.name) = lower(quelle.pk_profile_name)) desc, profil.id
      limit 1
    ) as pk_profile_id
  from quelle
)
insert into public.substance_catalog as ziel (
  canonical_name,
  aliases,
  default_category,
  suggested_dosage_forms,
  suggested_units,
  pk_profile_id,
  component_names,
  active
)
select
  canonical_name,
  aliases,
  default_category,
  suggested_dosage_forms,
  suggested_units,
  pk_profile_id,
  component_names,
  true
from aufgeloest
on conflict (lower(canonical_name)) do update set
  aliases = excluded.aliases,
  default_category = excluded.default_category,
  suggested_dosage_forms = excluded.suggested_dosage_forms,
  suggested_units = excluded.suggested_units,
  -- Eine bestehende Verknuepfung wird nicht geloescht, nur ergaenzt: steht in
  -- der Quelle kein Profil, bleibt das gefundene stehen.
  pk_profile_id = coalesce(excluded.pk_profile_id, ziel.pk_profile_id),
  component_names = excluded.component_names,
  active = true,
  updated_at = now();

commit;
`

writeFileSync(ZIEL, sql)
const kombis = SUBSTANCE_CATALOG.filter(eintrag => (eintrag.components ?? []).length > 0).length
console.log(`${ZIEL}: ${SUBSTANCE_CATALOG.length} Substanzen, davon ${kombis} Kombipraeparate`)
