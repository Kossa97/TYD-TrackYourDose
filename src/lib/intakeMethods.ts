/**
 * Die Routen einer Einnahme. Gespeichert wird das deutsche Wort ('Subkutan'),
 * angezeigt die Uebersetzung. Hier und nur hier steht die Zuordnung — Plan-
 * Editor, My Stack und die Injektionsansichten lesen sie alle von hier.
 */
export const INTAKE_METHODS = [
  'Subkutan',
  'Intramuskulär',
  'Nasal',
  'Oral',
  'Transdermal',
  'Intravenös',
  'Andere',
] as const

export type IntakeMethod = (typeof INTAKE_METHODS)[number]

const LABEL_KEYS: Record<IntakeMethod, string> = {
  Subkutan: 'method_subkutan',
  Intramuskulär: 'method_intramusk',
  Nasal: 'method_nasal',
  Oral: 'method_oral',
  Transdermal: 'method_transdermal',
  Intravenös: 'method_intravenoese',
  Andere: 'method_andere',
}

type Translate = (key: string, options?: Record<string, unknown>) => unknown

function isIntakeMethod(value: string): value is IntakeMethod {
  return Object.prototype.hasOwnProperty.call(LABEL_KEYS, value)
}

/**
 * Die Route in der App-Sprache. Was keine bekannte Route ist — frei getippt
 * in alten Zeilen —, kommt unveraendert zurueck und geht nie als Schluessel
 * an i18next: ein Doppelpunkt oder Punkt darin waere dort Schluesselsyntax.
 */
export function methodLabel(t: Translate, method: string | null | undefined): string {
  const value = method?.trim() ?? ''
  return isIntakeMethod(value) ? String(t(LABEL_KEYS[value], { defaultValue: value })) : value
}
