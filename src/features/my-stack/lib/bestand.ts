import { addDays, format, parseISO } from 'date-fns'
import { resolveTimelineIntakesForDay } from '../../../lib/intakeSchedule'
import type { CycleTimeline } from '../../../lib/planTimeline'
import { localDateTimeKey } from '../../../lib/planTimeline'
import type { DosageFormKey, StackItemIngredient, StackItemInventory } from '../types'

/**
 * Rechnungen zum Bestand einer Substanz — fuer jede Darreichungsform dieselben.
 *
 * Gezaehlt wird in der Einheit der Packung (`package_unit`): Vials, Tabletten,
 * Tropfen, ml. Wie eine Einnahme in diese Einheit umgerechnet wird, steht in
 * `dosisInPackungseinheit` und folgt Zeile fuer Zeile der Datenbank
 * (`apply_inventory_confirmation`): was die App als Reichweite verspricht,
 * muss die Datenbank beim Abbuchen genauso rechnen.
 */

/**
 * Was bei dieser Form „angebrochen" heisst. Ein Vial wird angemischt, eine
 * Flasche oder ein Pen geoeffnet — und ist danach nur begrenzt haltbar.
 * Tabletten, Kapseln, Pflaster, Ampullen (einmal auf, sofort leer) kennen das
 * nicht; dort gibt es keinen solchen Block.
 */
export type AnbruchArt = 'vial' | 'pen' | 'flasche'

export function anbruchArt(form: DosageFormKey | null | undefined): AnbruchArt | null {
  switch (form) {
    case 'vial': return 'vial'
    case 'pen': return 'pen'
    case 'drops':
    case 'spray':
    case 'nasal_spray':
      return 'flasche'
    default:
      return null
  }
}

/**
 * Wie viel ein einzelner Behaelter fasst, in Packungseinheiten. Beim Vial ist
 * die Packungseinheit das Vial selbst; sonst beschreibt die Packungsgroesse
 * einen Behaelter („eine Flasche mit 30 ml").
 */
export function behaelterGroesse(inventory: StackItemInventory): number | null {
  if (inventory.package_unit === 'vial') return 1
  const groesse = inventory.package_quantity
  return groesse != null && groesse > 0 ? groesse : null
}

function rund(wert: number, stellen = 4): number {
  const faktor = 10 ** stellen
  return Math.round(wert * faktor) / faktor
}

export interface VorratTeile {
  rest: number
  /** Ungeoeffnete Behaelter. */
  voll: number
  /** Was im angebrochenen Behaelter noch ist, in Packungseinheiten; 0 = keiner. */
  angebrochen: number
  /** Derselbe Rest als Anteil des Behaelters (0–1), oder null ohne Behaeltergroesse. */
  angebrochenAnteil: number | null
}

/**
 * Teilt den Vorrat in volle Behaelter und den angebrochenen. Beim Vial ist der
 * Nachkommateil das angemischte Vial: 2,95 Vials sind zwei volle und eines
 * mit 95 %.
 */
export function vorratTeile(inventory: StackItemInventory): VorratTeile {
  const rest = Math.max(0, inventory.remaining_quantity ?? 0)
  const groesse = behaelterGroesse(inventory)
  if (!groesse || !teiltInBehaelter(inventory)) {
    return { rest, voll: rest, angebrochen: 0, angebrochenAnteil: null }
  }
  const angebrochen = rund(rest % groesse)
  const voll = Math.round((rest - angebrochen) / groesse)
  return {
    rest,
    voll,
    angebrochen,
    angebrochenAnteil: angebrochen > 0 ? rund(angebrochen / groesse, 4) : null,
  }
}

// Nur wo ein Behaelter angebrochen wird, ergibt die Teilung Sinn. Tabletten
// „in einer Packung zu 60" sind 42 Tabletten, nicht 0 volle Packungen und
// eine zu 70 %.
function teiltInBehaelter(inventory: StackItemInventory): boolean {
  return inventory.package_unit === 'vial' || inventory.opened_at != null
}

/** Bis wann der angebrochene Behaelter haelt (`YYYY-MM-DD`), oder null. */
export function haltbarBis(inventory: StackItemInventory): string | null {
  if (!inventory.opened_at || !inventory.use_within_days) return null
  return format(addDays(parseISO(inventory.opened_at), inventory.use_within_days), 'yyyy-MM-dd')
}

/**
 * Eine Einnahme in Packungseinheiten — dieselbe Regel wie
 * `apply_inventory_confirmation`: jede Zutat mit der Packungseinheit als Bezug
 * muss dieselbe Menge ergeben, sonst ist die Umrechnung mehrdeutig (null).
 */
export function dosisInPackungseinheit(
  dose: number | null,
  unit: string | null,
  ingredients: readonly StackItemIngredient[],
  inventory: StackItemInventory,
): number | null {
  if (dose == null || !unit || dose <= 0 || ingredients.length === 0) return null
  const packung = inventory.package_unit
  const deltas = ingredients.map(zutat => {
    if (zutat.basis_unit !== packung) return null
    const menge = zutat.amount_value
    const bezug = zutat.basis_value
    if (unit === zutat.basis_unit) return dose
    if (menge != null && menge > 0 && bezug != null) {
      if (unit === zutat.amount_unit) return dose / menge * bezug
      if (unit === 'mg' && zutat.amount_unit === 'mcg') return dose * 1000 / menge * bezug
      if (unit === 'mcg' && zutat.amount_unit === 'mg') return dose / 1000 / menge * bezug
    }
    if (packung === 'vial' && unit.toLowerCase() === 'ml' && (inventory.reconstitution_ml ?? 0) > 0) {
      return dose / inventory.reconstitution_ml!
    }
    return null
  })
  if (deltas.some(delta => delta == null || !(delta > 0))) return null
  const erste = deltas[0]!
  if (deltas.some(delta => delta !== erste)) return null
  return packung === 'vial' ? rund(erste) : erste
}

export type Reichweite =
  | { art: 'tage'; tage: number; bis: string }
  | { art: 'laenger'; tage: number }
  | { art: 'unbekannt' }
  | { art: 'kein_plan' }
  | { art: 'leer' }

export const REICHWEITE_HORIZONT_TAGE = 180

/**
 * Wie lange der Vorrat nach dem Plan noch reicht — mit allen geplanten Stufen,
 * denn eine Titration verbraucht in drei Wochen mehr als heute.
 *
 * Gezaehlt werden die Einnahmen ab jetzt; heute nur die, die noch kommen.
 * `tage` ist die Zahl der Tage, deren Einnahmen der Vorrat noch ganz deckt,
 * `bis` der letzte davon.
 */
export function reichweite(input: {
  inventory: StackItemInventory
  ingredients: readonly StackItemIngredient[]
  timelines: readonly CycleTimeline[]
  now: Date
  timeZone: string
  horizonDays?: number
}): Reichweite {
  const { inventory, ingredients, timelines, now, timeZone } = input
  const horizont = input.horizonDays ?? REICHWEITE_HORIZONT_TAGE
  let rest = Math.max(0, inventory.remaining_quantity ?? 0)
  if (rest <= 0) return { art: 'leer' }
  if (timelines.length === 0) return { art: 'kein_plan' }

  const heute = localDateTimeKey(now, timeZone).slice(0, 10)
  let gedeckt = 0
  let letzterTag = heute
  let sahEinnahme = false
  for (let tag = 0; tag < horizont; tag += 1) {
    const datum = format(addDays(parseISO(heute), tag), 'yyyy-MM-dd')
    let bedarf = 0
    for (const timeline of timelines) {
      for (const einnahme of resolveTimelineIntakesForDay(timeline, datum, timeZone)) {
        if (tag === 0 && new Date(einnahme.scheduledAt) <= now) continue
        const delta = dosisInPackungseinheit(einnahme.dose, einnahme.unit, ingredients, inventory)
        if (delta == null) return { art: 'unbekannt' }
        bedarf += delta
        sahEinnahme = true
      }
    }
    if (bedarf > rest + 1e-9) {
      return sahEinnahme ? { art: 'tage', tage: gedeckt, bis: letzterTag } : { art: 'kein_plan' }
    }
    rest -= bedarf
    gedeckt = tag + 1
    letzterTag = datum
  }
  return sahEinnahme ? { art: 'laenger', tage: horizont } : { art: 'kein_plan' }
}

/** Einheiten pro ml auf der Spritze. U-100 ist der Normalfall. */
export function spritzenEinheitenProMl(syringeType: string | null | undefined): number {
  const text = (syringeType ?? '').replace(',', '.')
  // Das fruehere Formular speicherte „ml:Einheiten", die Datenbank-Vorgabe
  // lautet „1 mL (100 Einheiten)".
  const paar = /^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(text)
    ?? /(\d+(?:\.\d+)?)\s*ml\D*?(\d+(?:\.\d+)?)/i.exec(text)
  if (paar) {
    const ml = Number(paar[1])
    const einheiten = Number(paar[2])
    if (ml > 0 && einheiten > 0) return einheiten / ml
  }
  return 100
}

export interface SpritzenRechnung {
  /** Wirkstoff je ml der angemischten Loesung, in `einheit`. */
  proMl: number
  einheit: string
  /** Wirkstoff im Vial und die zugefuegte Fluessigkeit — fuer den Hinweis. */
  imVial: number
  ml: number
  einheitenProMl: number
}

/**
 * Konzentration eines angemischten Vials: der eine Wirkstoff pro Vial geteilt
 * durch die zugefuegte Fluessigkeit. Ohne beides (oder bei Mischungen) null.
 */
export function spritzenRechnung(
  ingredients: readonly StackItemIngredient[],
  reconstitutionMl: number | null | undefined,
  syringeType: string | null | undefined,
): SpritzenRechnung | null {
  if (ingredients.length !== 1 || !reconstitutionMl || reconstitutionMl <= 0) return null
  const [zutat] = ingredients
  if (zutat.basis_unit !== 'vial' || !zutat.amount_value || !zutat.amount_unit || !zutat.basis_value) return null
  const imVial = zutat.amount_value / zutat.basis_value
  return {
    proMl: imVial / reconstitutionMl,
    einheit: zutat.amount_unit,
    imVial,
    ml: reconstitutionMl,
    einheitenProMl: spritzenEinheitenProMl(syringeType),
  }
}

/** Wie viele Einheiten fuer diese Dosis aufzuziehen sind, auf eine Stelle. */
export function aufzuziehendeEinheiten(
  dose: number | null,
  unit: string | null,
  rechnung: SpritzenRechnung,
): number | null {
  if (dose == null || !unit || dose <= 0) return null
  let ml: number | null = null
  if (unit.toLowerCase() === 'ml') ml = dose
  else if (unit === rechnung.einheit) ml = dose / rechnung.proMl
  else if (unit === 'mcg' && rechnung.einheit === 'mg') ml = dose / 1000 / rechnung.proMl
  else if (unit === 'mg' && rechnung.einheit === 'mcg') ml = dose * 1000 / rechnung.proMl
  if (ml == null || !Number.isFinite(ml)) return null
  return Math.round(ml * rechnung.einheitenProMl * 10) / 10
}
