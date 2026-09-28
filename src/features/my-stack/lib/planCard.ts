import { differenceInCalendarDays, parseISO } from 'date-fns'
import { resolveScheduleSlots, type ResolvedRoutineGroup } from '../../../lib/intakeSchedule'
import { localDateTimeKey, type CycleTimeline, type PlanScheduleSnapshot } from '../../../lib/planTimeline'
import { shiftLocalDay } from './localDays'
import { WEEKDAY_KEYS, rhythmFromStorage } from './intakeRhythm'
import type { IntakeRhythm } from '../types'

/**
 * Was die Plankarte je Einnahmezeit zeigt.
 *
 * `days` sind die EIGENEN Wochentage dieser Einnahme („abends nur Mo, Mi, Fr").
 * Leer heisst: sie liegt an jedem Tag, an dem der Plan ueberhaupt gilt — der
 * Rhythmus darueber sagt, welche das sind.
 */
export interface PlanCardSlot {
  /** Stabil innerhalb einer Stufe: Tageszeit plus laufende Nummer. */
  id: string
  key: string
  time: string
  minutes: number
  routineGroup: ResolvedRoutineGroup
  dose: number | null
  unit: string | null
  days: string[]
}

// Ein beliebiger Montag; die sieben Tage ab dort decken jede Woche ab.
const REFERENZ_TAGE = WEEKDAY_KEYS.map((tag, index) => ({ tag, datum: new Date(2026, 0, 5 + index, 12) }))

/**
 * Die Einnahmezeiten einer Stufe, nach Uhrzeit sortiert.
 *
 * Jede gespeicherte Stelle wird einzeln durch `resolveScheduleSlots` geschickt
 * — einmal ohne Tag, dann je Wochentag. So gilt hier genau die Regel, nach der
 * der Kalender plant, statt einer zweiten Lesart von `slot_days`, und zwei
 * Einnahmen mit derselben Uhrzeit bleiben getrennt.
 *
 * Die `id` zaehlt in GESPEICHERTER Reihenfolge je Tageszeit („der zweite
 * Morgen"). Verschiebt sich eine Uhrzeit, bleibt sie dieselbe Einnahme.
 */
export function planCardSlots(version: PlanScheduleSnapshot): PlanCardSlot[] {
  const stelle = (wert: string | null, index: number) => (wert ?? '').split(',')[index] ?? ''
  const tageszeiten = (version.intake_time ?? '').split(',')
  const laufendeNummer = new Map<string, number>()

  return tageszeiten.flatMap((key, index) => {
    if (!key) return []
    const nummer = laufendeNummer.get(key) ?? 0
    laufendeNummer.set(key, nummer + 1)
    const einzeln = {
      intake_time: key,
      intake_time_custom: stelle(version.intake_time_custom, index),
      slot_doses: stelle(version.slot_doses, index),
      slot_days: stelle(version.slot_days, index),
    }
    const [slot] = resolveScheduleSlots(einzeln)
    if (!slot) return []
    const tage = REFERENZ_TAGE
      .filter(({ datum }) => resolveScheduleSlots(einzeln, datum).length > 0)
      .map(({ tag }) => tag)
    // An keinem Tag faellig heisst: der Kalender plant sie nie. Dann zeigt
    // die Karte sie auch nicht — sonst stuende sie als „jeden Tag" da.
    if (tage.length === 0) return []
    return [{
      id: `${key}#${nummer}`,
      key,
      time: slot.time,
      minutes: slot.minutes,
      routineGroup: slot.routineGroup,
      dose: slot.dose ?? version.dose,
      unit: version.unit,
      days: tage.length === WEEKDAY_KEYS.length ? [] : tage,
    }]
  })
    .sort((links, rechts) => links.minutes - rechts.minutes)
}

// Plan-Versionen speichern die Frequenz als Schluessel ('daily'); die
// Rhythmus- und Einnahmelogik kennt die alten deutschen Texte.
const LEGACY_FREQUENCY: Readonly<Record<string, string>> = {
  daily: 'Täglich',
  weekdays: 'Wochentage wählen',
  interval: 'Alle X Tage',
  cycle: 'Im Wechsel',
  on_demand: 'Bei Bedarf',
}

export function legacyFrequency(frequency: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_FREQUENCY, frequency) ? LEGACY_FREQUENCY[frequency] : frequency
}

export function versionRhythm(version: PlanScheduleSnapshot): IntakeRhythm {
  return rhythmFromStorage({
    frequency: legacyFrequency(version.frequency),
    x_days_interval: version.x_days_interval,
    interval_unit: version.interval_unit,
    cycle_on_days: version.cycle_on_days,
    cycle_off_days: version.cycle_off_days,
    schedule_days: version.schedule_days,
  })
}

/**
 * Gleiche Einnahmen zusammenfassen — fuer die Anzeige, nicht fuer die Daten.
 *
 * Bei „bestimmte Wochentage" speichert der Editor die Einnahmen JE TAG: aus
 * „Mo und Fr, morgens und abends" werden vier Stellen (Mo morgens, Fr
 * morgens, …). Einzeln gezeigt stand dieselbe Einnahme doppelt da, jede mit
 * einer eigenen Tagesleiste, und die Karte zaehlte vier Einnahmezeiten.
 *
 * Zusammen gehoert, was dieselbe Tageszeit, Uhrzeit und Menge hat; die Tage
 * werden vereinigt. Deckt eine Einnahme alle Tage des Plans ab, verliert sie
 * ihre Tagesleiste — die Tage stehen schon im Rhythmus darueber. Weicht sie
 * ab („abends nur montags"), bleibt die Leiste.
 *
 * `planDays`: die Tage des Rhythmus bei „bestimmte Wochentage", sonst null.
 */
export function groupPlanCardSlots(slots: readonly PlanCardSlot[], planDays: readonly string[] | null): PlanCardSlot[] {
  const gruppen = new Map<string, PlanCardSlot>()
  for (const slot of slots) {
    const schluessel = `${slot.routineGroup}|${slot.time}|${slot.dose ?? ''}|${slot.unit ?? ''}`
    const vorhanden = gruppen.get(schluessel)
    if (!vorhanden) {
      gruppen.set(schluessel, { ...slot, days: [...slot.days] })
      continue
    }
    // Leer heisst „an jedem Tag des Plans" — das schluckt jede Auswahl.
    vorhanden.days = vorhanden.days.length === 0 || slot.days.length === 0
      ? []
      : WEEKDAY_KEYS.filter(tag => vorhanden.days.includes(tag) || slot.days.includes(tag))
  }
  return [...gruppen.values()].map(slot => (
    slot.days.length > 0 && planDays && planDays.length > 0 && planDays.every(tag => slot.days.includes(tag))
      ? { ...slot, days: [] }
      : slot
  ))
}

/** Die Einnahmen einer Stufe so, wie Karte und Verlauf sie zeigen. */
export function planDisplaySlots(version: PlanScheduleSnapshot): PlanCardSlot[] {
  const rhythmus = versionRhythm(version)
  return groupPlanCardSlots(planCardSlots(version), rhythmus.kind === 'weekdays' ? rhythmus.weekdays : null)
}

export type PlanSlotChange = 'initial' | 'same' | 'increased' | 'decreased' | 'changed' | 'new' | 'removed'

export interface PlanStepRow {
  slot: PlanCardSlot
  /** Dieselbe Einnahme in der Stufe davor; null bei der ersten Stufe und bei neuen. */
  previous: PlanCardSlot | null
  change: PlanSlotChange
}

function gleicheTage(links: string[], rechts: string[]): boolean {
  return links.length === rechts.length && links.every((tag, index) => tag === rechts[index])
}

function vergleiche(jetzt: PlanCardSlot, vorher: PlanCardSlot): PlanSlotChange {
  const gleicheMenge = jetzt.dose === vorher.dose && jetzt.unit === vorher.unit
  if (gleicheMenge && jetzt.time === vorher.time && gleicheTage(jetzt.days, vorher.days)) return 'same'
  // Nur die Menge hat sich bewegt, in derselben Einheit: das ist eine
  // Titrationsstufe, und die Richtung ist das, was man wissen will.
  if (
    jetzt.time === vorher.time
    && gleicheTage(jetzt.days, vorher.days)
    && jetzt.unit === vorher.unit
    && jetzt.dose != null
    && vorher.dose != null
  ) {
    return jetzt.dose > vorher.dose ? 'increased' : 'decreased'
  }
  return 'changed'
}

/**
 * Der ganze Plan einer Stufe, jede Einnahme verglichen mit der Stufe davor.
 *
 * Zugeordnet wird ueber die Tageszeit und ihre Reihenfolge („der zweite
 * Morgen"), nicht ueber die Uhrzeit — sonst waere eine verschobene Einnahme
 * eine entfallene plus eine neue. Was es in der Stufe davor gab und jetzt
 * nicht mehr, steht am Ende als „entfaellt".
 */
export function planStepRows(
  version: PlanScheduleSnapshot,
  previousVersion: PlanScheduleSnapshot | null,
): PlanStepRow[] {
  const jetzt = planDisplaySlots(version)
  if (!previousVersion) return jetzt.map(slot => ({ slot, previous: null, change: 'initial' }))

  const vorher = new Map(planDisplaySlots(previousVersion).map(slot => [slot.id, slot]))
  const zeilen: PlanStepRow[] = jetzt.map(slot => {
    const alt = vorher.get(slot.id) ?? null
    vorher.delete(slot.id)
    return { slot, previous: alt, change: alt ? vergleiche(slot, alt) : 'new' }
  })
  for (const entfallen of vorher.values()) {
    zeilen.push({ slot: entfallen, previous: entfallen, change: 'removed' })
  }
  return zeilen
}

/** Kalendertage von `from` bis `to` (beide `YYYY-MM-DD`), beide mitgezaehlt. */
export function inclusiveDayCount(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from)) + 1
}

function localDay(value: string, timeZone: string): string {
  return localDateTimeKey(new Date(value), timeZone).slice(0, 10)
}

/**
 * Erster und letzter Tag des Zyklus. Das Ende ist in der Datenbank eine
 * Grenze („ab hier nicht mehr") — der letzte Einnahmetag ist der Tag davor.
 */
export function cyclePeriod(
  timeline: CycleTimeline,
  timeZone: string,
): { first: string; last: string | null; endKey: string | null } {
  const { cycle } = timeline
  const first = cycle.start_local_date ?? localDay(cycle.started_at, timeZone)
  if (cycle.end_local_date) {
    return { first, last: shiftLocalDay(cycle.end_local_date, -1), endKey: `${cycle.end_local_date}|00:00:00` }
  }
  if (cycle.ended_at) {
    return {
      first,
      last: localDay(new Date(new Date(cycle.ended_at).getTime() - 1).toISOString(), timeZone),
      endKey: localDateTimeKey(new Date(cycle.ended_at), timeZone),
    }
  }
  return { first, last: null, endKey: null }
}
