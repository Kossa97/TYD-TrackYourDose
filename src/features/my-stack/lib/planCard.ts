import { resolveScheduleSlots, type ResolvedRoutineGroup } from '../../../lib/intakeSchedule'
import type { PlanScheduleSnapshot } from '../../../lib/planTimeline'
import { WEEKDAY_KEYS } from './intakeRhythm'

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
  routineGroup: ResolvedRoutineGroup
  dose: number | null
  unit: string | null
  days: string[]
}

// Ein beliebiger Montag; die sieben Tage ab dort decken jede Woche ab.
const REFERENZ_MONTAG = new Date(2026, 0, 5, 12)
const REFERENZ_TAGE = WEEKDAY_KEYS.map((tag, index) => ({
  tag,
  datum: new Date(REFERENZ_MONTAG.getFullYear(), REFERENZ_MONTAG.getMonth(), REFERENZ_MONTAG.getDate() + index, 12),
}))

/**
 * Die Einnahmezeiten einer Stufe, nach Uhrzeit sortiert.
 *
 * Die Wochentage kommen aus `resolveScheduleSlots` selbst — je Wochentag
 * einmal gefragt, welche Einnahmen an ihm liegen. So gilt hier genau die
 * Regel, nach der der Kalender plant, statt einer zweiten Lesart von
 * `slot_days`.
 */
export function planCardSlots(version: PlanScheduleSnapshot): PlanCardSlot[] {
  const alle = resolveScheduleSlots(version)
  const identitaet = (slot: { key: string; time: string }) => `${slot.key}|${slot.time}`
  const tageJeSlot = new Map<string, string[]>()
  for (const { tag, datum } of REFERENZ_TAGE) {
    for (const slot of resolveScheduleSlots(version, datum)) {
      const tage = tageJeSlot.get(identitaet(slot)) ?? []
      tage.push(tag)
      tageJeSlot.set(identitaet(slot), tage)
    }
  }

  const laufendeNummer = new Map<string, number>()
  return alle.map(slot => {
    const nummer = laufendeNummer.get(slot.key) ?? 0
    laufendeNummer.set(slot.key, nummer + 1)
    const tage = tageJeSlot.get(identitaet(slot)) ?? []
    return {
      id: `${slot.key}#${nummer}`,
      key: slot.key,
      time: slot.time,
      routineGroup: slot.routineGroup,
      dose: slot.dose ?? version.dose,
      unit: version.unit,
      days: tage.length === WEEKDAY_KEYS.length ? [] : tage,
    }
  })
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
  const jetzt = planCardSlots(version)
  if (!previousVersion) return jetzt.map(slot => ({ slot, previous: null, change: 'initial' }))

  const vorher = new Map(planCardSlots(previousVersion).map(slot => [slot.id, slot]))
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
  const tag = (wert: string) => {
    const [jahr, monat, tagImMonat] = wert.split('-').map(Number)
    return Date.UTC(jahr, monat - 1, tagImMonat)
  }
  return Math.round((tag(to) - tag(from)) / 86_400_000) + 1
}
