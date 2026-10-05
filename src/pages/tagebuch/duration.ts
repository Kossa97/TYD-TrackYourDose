/**
 * Dauer eines Tagebuch-Eintrags. Gespeichert wird der Schluessel (`std_2`),
 * angezeigt seine Uebersetzung. Eigene Dauern bleiben Freitext.
 *
 * Aeltere Zeilen tragen den uebersetzten Text; die Migration
 * `supabase-effects-duration-keys.sql` stellt sie um. Alte Store-Builds
 * schreiben ihn weiter — deshalb erkennt die App ihn in jeder Sprache.
 */
import { LEGACY_DURATION_TEXTS } from './legacyDurationTexts'

export const DURATION_KEYS = [
  'min_15', 'min_30', 'std_1', 'std_2', 'std_4', 'std_8', 'std_12',
  'tag_1', 'tage_2', 'woche_1', 'noch_anhaltend',
] as const

export type DurationKey = typeof DURATION_KEYS[number]

const isDurationKey = (value: string): value is DurationKey =>
  (DURATION_KEYS as readonly string[]).includes(value)

/** Der Schluessel zu einem gespeicherten Wert — `null` fuer Freitext. */
export function durationKeyOf(stored: string | null): DurationKey | null {
  if (!stored) return null
  if (isDurationKey(stored)) return stored
  return LEGACY_DURATION_TEXTS[stored] ?? null
}

/** Was in der Liste steht: die Uebersetzung oder der Freitext. */
export function durationLabel(stored: string, t: (key: string) => string): string {
  const key = durationKeyOf(stored)
  return key ? t(key) : stored
}
