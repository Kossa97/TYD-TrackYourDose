/**
 * Bezug eines Tagebuch-Eintrags zu einer Einnahme (`effects.dose_log_id`).
 * Zur Auswahl stehen bestaetigte Einnahmen (`taken = true`) der gewaehlten
 * Substanz vor dem Zeitpunkt des Eintrags — die Wahl ist freiwillig.
 */
export const INTAKE_OPTIONS = 5

export interface IntakeOption {
  id: string
  dose: number | null
  unit: string | null
  logged_at: string
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/**
 * „45 min", „2 h", „3 Tage" — ab 72 h in Tagen, damit die Zahl immer Mehrzahl ist.
 * Der Eintrag hat keine Sekunden: liegt die Einnahme in derselben Minute, ist der Abstand 0.
 */
export function intakeGap(fromIso: string, toIso: string, t: Translate): string | null {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (!Number.isFinite(ms) || ms <= -60_000) return null
  const minutes = Math.max(0, Math.round(ms / 60_000))
  if (minutes < 60) return t('tagebuch_abstand_min', { n: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 72) return t('tagebuch_abstand_h', { n: hours })
  return t('tagebuch_abstand_tage', { n: Math.round(hours / 24) })
}

/** „250 mcg" — ohne Menge (nur „genommen") leer. */
export function intakeDose(option: Pick<IntakeOption, 'dose' | 'unit'>, language: string): string {
  if (option.dose == null) return ''
  const amount = new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(Number(option.dose))
  return option.unit ? `${amount} ${option.unit}` : amount
}
