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
 *   3. Die Profile aus `scripts/seed-pk-profiles.ts` nachziehen. Dieses Skript
 *      lief mit dem Anon-Key und schlaegt seit der RLS-Haertung fehl — die
 *      Datenbank kennt deshalb weder die Notizen, die dort inzwischen stehen,
 *      noch spaetere Korrekturen. Statt es wiederzubeleben werden seine Werte
 *      hier mit ausgegeben.
 *
 * Zweimal ausgefuehrt aendert der zweite Lauf nichts.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PK_PROFILE_ERWEITERUNG } from './pk-profile-source.mjs'

const ZIEL = 'supabase-pk-profiles-expansion.sql'

function quote(text) {
  return `'${String(text).replace(/'/g, "''")}'`
}

function textArray(werte) {
  if (werte.length === 0) return `'{}'::text[]`
  return `array[${werte.map(quote).join(', ')}]::text[]`
}

// Die Profile aus dem alten Seed-Skript einlesen. Regex statt Parser: die
// Datei ist eine flache Liste von Objektliteralen, und ein Parser dafuer waere
// mehr Maschinerie als Nutzen. Der Vertragstest prueft, dass die Zahl der
// gefundenen Eintraege zur Datei passt.
function seedProfile() {
  const text = readFileSync('scripts/seed-pk-profiles.ts', 'utf8')
  const muster = /\{\s*name: '([^']+)',\s*aliases: \[([^\]]*)\],\s*half_life_hours: ([\d.]+),\s*tmax_hours: ([\d.]+),\s*category: '([a-z0-9]+)'(?:,\s*bioavailability_sc: ([\d.]+))?(?:,\s*notes: '((?:[^'\\]|\\.)*)')?\s*\}/g
  const gefunden = []
  for (const treffer of text.matchAll(muster)) {
    gefunden.push({
      name: treffer[1],
      aliases: [...treffer[2].matchAll(/'([^']+)'/g)].map(a => a[1]),
      half_life_hours: Number(treffer[3]),
      tmax_hours: Number(treffer[4]),
      category: treffer[5],
      bioavailability_sc: treffer[6] === undefined ? 1 : Number(treffer[6]),
      notes: treffer[7] === undefined ? null : treffer[7].replace(/\\'/g, "'"),
    })
  }
  return gefunden
}

export const SEED_PROFILE = seedProfile()

const alleProfile = [...SEED_PROFILE, ...PK_PROFILE_ERWEITERUNG]

const zeilen = alleProfile.map(p => (
  `    (${quote(p.name)}, ${textArray(p.aliases)}, ${p.half_life_hours}, ${p.tmax_hours}, `
  + `${p.bioavailability_sc}, ${quote(p.category)}, ${p.notes === null ? 'null' : quote(p.notes)})`
)).join(',\n')

const sql = `-- GENERIERT von scripts/generate-pk-profiles-sql.mjs.
-- Nicht von Hand aendern — die Quelle ist scripts/pk-profile-source.mjs.
-- Neu erzeugen mit: npm run pk:sql
--
-- ${alleProfile.length} PK-Profile fuer den Live-Blutspiegel: ${SEED_PROFILE.length} aus
-- scripts/seed-pk-profiles.ts (dessen Upsert seit der RLS-Haertung nicht mehr
-- laeuft) und ${PK_PROFILE_ERWEITERUNG.length} aus scripts/pk-profile-source.mjs. Dazu die
-- Verknuepfung mit den Katalogzeilen gleichen Namens.
-- Ein zweiter Lauf aendert nichts.

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
  and lower(profil.name) in (${alleProfile.map(p => quote(p.name.toLowerCase())).join(', ')});

commit;
`

writeFileSync(ZIEL, sql)
console.log(`${ZIEL}: ${alleProfile.length} PK-Profile (${SEED_PROFILE.length} aus dem Seed, ${PK_PROFILE_ERWEITERUNG.length} neu)`)
