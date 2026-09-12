/**
 * Erzeugt `supabase-pk-profiles-expansion.sql` aus
 * `scripts/pk-profile-source.mjs`.
 *
 *   npm run pk:sql
 *
 * Zwei Schritte in einer Datei:
 *   1. Die Profile upserten (Unique-Index auf pk_profiles.name).
 *   2. Die Katalogzeilen damit verknuepfen — ueber denselben Namen. Nur wo
 *      noch kein Profil haengt: eine bestehende Verknuepfung wird nicht
 *      ueberschrieben.
 *
 * Zweimal ausgefuehrt aendert der zweite Lauf nichts.
 */
import { writeFileSync } from 'node:fs'
import { PK_PROFILE_ERWEITERUNG } from './pk-profile-source.mjs'

const ZIEL = 'supabase-pk-profiles-expansion.sql'

function quote(text) {
  return `'${String(text).replace(/'/g, "''")}'`
}

function textArray(werte) {
  if (werte.length === 0) return `'{}'::text[]`
  return `array[${werte.map(quote).join(', ')}]::text[]`
}

const zeilen = PK_PROFILE_ERWEITERUNG.map(p => (
  `    (${quote(p.name)}, ${textArray(p.aliases)}, ${p.half_life_hours}, ${p.tmax_hours}, `
  + `${p.bioavailability_sc}, ${quote(p.category)}, ${quote(p.notes)})`
)).join(',\n')

const sql = `-- GENERIERT von scripts/generate-pk-profiles-sql.mjs.
-- Nicht von Hand aendern — die Quelle ist scripts/pk-profile-source.mjs.
-- Neu erzeugen mit: npm run pk:sql
--
-- ${PK_PROFILE_ERWEITERUNG.length} PK-Profile fuer den Live-Blutspiegel, plus die Verknuepfung
-- mit den Katalogzeilen gleichen Namens. Ein zweiter Lauf aendert nichts.

begin;

with quelle (name, aliases, half_life_hours, tmax_hours, bioavailability_sc, category, notes) as (
  values
${zeilen}
)
insert into public.pk_profiles as ziel (
  name, aliases, half_life_hours, tmax_hours, bioavailability_sc, vd_l_kg, category, notes
)
select name, aliases, half_life_hours, tmax_hours, bioavailability_sc, 0.3, category, notes
from quelle
on conflict (name) do update set
  aliases = excluded.aliases,
  half_life_hours = excluded.half_life_hours,
  tmax_hours = excluded.tmax_hours,
  bioavailability_sc = excluded.bioavailability_sc,
  category = excluded.category,
  notes = excluded.notes,
  updated_at = now();

-- Die Katalogzeilen an ihr Profil haengen. Nur dort, wo noch keines haengt:
-- eine bestehende Verknuepfung ist eine Entscheidung und wird nicht
-- ueberschrieben.
update public.substance_catalog katalog
set pk_profile_id = profil.id, updated_at = now()
from public.pk_profiles profil
where katalog.pk_profile_id is null
  and lower(katalog.canonical_name) = lower(profil.name)
  and lower(profil.name) in (${PK_PROFILE_ERWEITERUNG.map(p => quote(p.name.toLowerCase())).join(', ')});

commit;
`

writeFileSync(ZIEL, sql)
console.log(`${ZIEL}: ${PK_PROFILE_ERWEITERUNG.length} PK-Profile`)
