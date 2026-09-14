// Was eine Frequenz ueber den Tag sagt.
//
// Die Frequenz stand bisher als blosser String in einer Liste im Formular,
// und daneben wusste `cycleAppliesToDay` fuer sich, was sie bedeutet. Zwei
// Wahrheiten: die Auswerte-Seite kannte '2x taeglich' und '3x taeglich'
// laengst — samt mehrerer Einnahmezeitpunkte je Tag, samt Eintrag im FAQ —,
// das Formular bot sie nur nie an. Und ein Enddatum liess sich dort gar nicht
// setzen, obwohl der Entwurf das Feld hat.
//
// Hier steht jetzt beides an einer Stelle: die Liste, und wie viele
// Einnahmezeitpunkte je Tag dazugehoeren.

/** Die Frequenzen, die das Formular anbietet — in dieser Reihenfolge. */
export const INTAKE_FREQUENCIES = [
  'Täglich',
  '2x täglich',
  '3x täglich',
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
 * „Bei Bedarf" ist kein Plan, sondern das Gegenteil: nichts ist faellig, nichts
 * kann verpasst werden. Schmerzmittel, Loperamid, das Notfallspray — man nimmt
 * sie, wenn man sie braucht, und will hinterher wissen, wie oft das war.
 */
export function isOnDemand(frequency: string): boolean {
  return frequency.trim() === 'Bei Bedarf'
}

/**
 * Wie viele Einnahmezeitpunkte ein Tag hat, an dem die Frequenz greift.
 * „Bei Bedarf" hat keinen — dort gibt es keinen geplanten Zeitpunkt.
 */
export function slotCountForFrequency(frequency: string): number {
  const normalized = frequency.trim()
  if (normalized === '3x täglich') return 3
  if (normalized === '2x täglich') return 2
  if (isOnDemand(normalized)) return 0
  return 1
}

/** Braucht die Frequenz die Wochentagsauswahl? */
export function needsWeekdays(frequency: string): boolean {
  return frequency.trim() === 'Wochentage wählen'
}

/** Braucht die Frequenz das X-Tage-Intervall? */
export function needsInterval(frequency: string): boolean {
  return frequency.trim() === 'Alle X Tage'
}
