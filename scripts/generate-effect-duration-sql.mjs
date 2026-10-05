/**
 * Erzeugt `supabase-effects-duration-keys.sql` und
 * `src/pages/tagebuch/legacyDurationTexts.ts`.
 *
 *   npm run effects:duration:sql
 *
 * Das Tagebuch hat die Dauer frueher als uebersetzten Text gespeichert
 * („2 Std", „2 hrs", „2 horas" …) — je nach Sprache, in der die App gerade
 * lief. Seitdem speichert es den Schluessel (`std_2`). Die Migration stellt
 * die alten Zeilen um. Die Zuordnung Text → Schluessel kommt aus den
 * Sprachdateien selbst; eigene Freitexte bleiben, wie sie sind.
 *
 * Dieselbe Zuordnung bekommt die App: gebuendelte Store-Builds alter Versionen
 * schreiben weiter Texte, auch nach der Migration. Die App erkennt sie so in
 * jeder Sprache, und die Migration laesst sich spaeter einfach wiederholen.
 *
 * Zweimal ausgefuehrt aendert der zweite Lauf nichts: ein Schluessel ist kein
 * Text aus der Liste.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ZIEL = 'supabase-effects-duration-keys.sql'
const ZIEL_APP = 'src/pages/tagebuch/legacyDurationTexts.ts'
const SPRACHEN = ['de', 'en', 'ar', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'tr', 'zh']

/** Muss zu `DURATION_KEYS` in `src/pages/tagebuch/duration.ts` passen — der Vertragstest prueft das. */
export const DURATION_KEYS = [
  'min_15', 'min_30', 'std_1', 'std_2', 'std_4', 'std_8', 'std_12',
  'tag_1', 'tage_2', 'woche_1', 'noch_anhaltend',
]

/** Jeder gespeicherte Text mit seinem Schluessel, sortiert. Wirft bei Mehrdeutigkeit. */
export function textZuSchluessel() {
  const zuordnung = new Map()
  for (const sprache of SPRACHEN) {
    const texte = JSON.parse(readFileSync(resolve(`src/i18n/locales/${sprache}.json`), 'utf8'))
    for (const key of DURATION_KEYS) {
      const text = texte[key]
      if (typeof text !== 'string' || !text.trim()) throw new Error(`${sprache}.${key} fehlt`)
      const bisher = zuordnung.get(text)
      if (bisher && bisher !== key) throw new Error(`„${text}" ist mehrdeutig: ${bisher} und ${key}`)
      zuordnung.set(text, key)
    }
  }
  for (const key of DURATION_KEYS) {
    if (zuordnung.has(key)) throw new Error(`Schluessel ${key} ist zugleich ein Text — Migration waere nicht idempotent`)
  }
  return [...zuordnung.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

function quote(text) {
  return `'${String(text).replace(/'/g, "''")}'`
}

export function buildSql() {
  const paare = textZuSchluessel()
  return `-- Erzeugt von scripts/generate-effect-duration-sql.mjs — nicht von Hand aendern.
-- Tagebuch: die Dauer als Schluessel statt als uebersetzter Text.
-- Nur Zeilen, deren Dauer genau einer der ${paare.length} bekannten Texte ist.
-- Idempotent: ein zweiter Lauf findet nichts mehr.

begin;

update public.effects e
set duration = zuordnung.schluessel
from (values
${paare.map(([text, key]) => `  (${quote(text)}, ${quote(key)})`).join(',\n')}
) as zuordnung(text, schluessel)
where e.duration = zuordnung.text;

commit;
`
}

export function buildAppTable() {
  const paare = textZuSchluessel()
  return `// Erzeugt von scripts/generate-effect-duration-sql.mjs — nicht von Hand aendern.
// Alte, uebersetzte Dauer-Texte aller Sprachen → Schluessel (siehe duration.ts).
import type { DurationKey } from './duration'

export const LEGACY_DURATION_TEXTS: Readonly<Record<string, DurationKey>> = {
${paare.map(([text, key]) => `  ${JSON.stringify(text)}: ${JSON.stringify(key).replace(/"/g, "'")},`).join('\n')}
}
`
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync(ZIEL, buildSql())
  writeFileSync(ZIEL_APP, buildAppTable())
  console.log(`${ZIEL}: ${textZuSchluessel().length} Texte → ${DURATION_KEYS.length} Schluessel`)
}
