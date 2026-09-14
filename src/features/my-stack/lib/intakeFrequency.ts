// Was eine Frequenz ueber den Tag sagt — und was sie NICHT sagt.
//
// Erster Anlauf hatte „2x taeglich" und „3x taeglich" in dieselbe Liste
// gesteckt wie „Mo-Fr" und „Wochentage waehlen". Das mischt zwei Fragen, die
// nichts miteinander zu tun haben:
//
//   AN WELCHEN TAGEN?      taeglich, jeden zweiten, Mo/Mi/Fr, alle X Tage …
//   WIE OFT AM TAG?        einmal, morgens und abends, dreimal …
//
// In einer Liste heisst das: wer Mo/Mi/Fr waehlt, bekommt genau eine Einnahme
// am Tag — morgens UND abends an denselben Tagen ist nicht ausdrueckbar,
// obwohl das ein voellig normaler Plan ist. Deshalb steht hier nur noch die
// Tagesfrage. Die Zahl der Einnahmezeitpunkte bestimmt der Nutzer daneben,
// indem er Zeitpunkte hinzufuegt; die Auswertung liest sie ohnehin aus
// `intake_time` und nicht aus der Frequenz.

/** Die Frequenzen, die das Formular anbietet — an welchen TAGEN. */
export const INTAKE_FREQUENCIES = [
  'Täglich',
  'Jeden 2. Tag',
  '5 Tage an / 2 aus',
  'Mo-Fr',
  'Wöchentlich',
  'Alle X Tage',
  'Wochentage wählen',
  'Bei Bedarf',
] as const

export type IntakeFrequency = typeof INTAKE_FREQUENCIES[number]

/**
 * Frequenzen aus der Zeit, als die Tageszahl noch in der Frequenz steckte.
 * Sie stehen in bestehenden Zyklen und werden weiter verstanden — beim Laden
 * ins Formular werden sie zu „Täglich" plus der entsprechenden Zahl von
 * Einnahmezeitpunkten, was dasselbe bedeutet.
 */
export const LEGACY_DAILY_FREQUENCIES: Record<string, number> = {
  '2x täglich': 2,
  '3x täglich': 3,
}

/**
 * Mehr als vier Einnahmen am Tag plant niemand im Voraus — und die Tabelle
 * kennt nur drei benannte Tageszeiten, die vierte waere ohnehin eine zweite
 * mit eigener Uhrzeit.
 */
export const MAX_INTAKE_SLOTS = 4

/**
 * „Bei Bedarf" ist kein Plan, sondern das Gegenteil: nichts ist faellig,
 * nichts kann verpasst werden. Schmerzmittel, Loperamid, das Notfallspray —
 * man nimmt sie, wenn man sie braucht, und will hinterher wissen, wie oft.
 */
export function isOnDemand(frequency: string): boolean {
  return frequency.trim() === 'Bei Bedarf'
}

/**
 * Wie viele Einnahmezeitpunkte ein Tag MINDESTENS hat. Das ist keine
 * Obergrenze mehr: ein geplanter Tag hat mindestens einen Zeitpunkt, wie viele
 * es wirklich werden, entscheidet der Nutzer. Nur „Bei Bedarf" hat keinen, und
 * die alten Tagesfrequenzen bringen ihre Zahl noch mit.
 */
export function slotCountForFrequency(frequency: string): number {
  const normalized = frequency.trim()
  if (isOnDemand(normalized)) return 0
  return LEGACY_DAILY_FREQUENCIES[normalized] ?? 1
}

/** Braucht die Frequenz die Wochentagsauswahl? */
export function needsWeekdays(frequency: string): boolean {
  return frequency.trim() === 'Wochentage wählen'
}

/** Braucht die Frequenz das X-Tage-Intervall? */
export function needsInterval(frequency: string): boolean {
  return frequency.trim() === 'Alle X Tage'
}
