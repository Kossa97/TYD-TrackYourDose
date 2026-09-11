import type { DosageFormKey } from '../types'

// Womit eine Darreichungsform gefuellt ist, solange der Nutzer keine eigene
// Eintragsfarbe gesetzt hat.
//
// Vorher fielen alle Formen auf dasselbe Grau zurueck (`#64748b`). Das war
// keine Aussage ueber das Ding, sondern die Abwesenheit einer: eine Ampulle
// mit klarer Loesung, eine Tablette und ein Pflaster sahen aus demselben
// Material aus. Die Werte hier sind das, was man wirklich in der Hand haelt.
//
// Es sind Standardwerte, keine festen Farben: sobald im Farbschritt etwas
// gewaehlt ist, gilt das. Das hier ist der Ausgangspunkt davor.

// Alle Fluessigkeiten teilen dasselbe Wasserblau. Eine Injektionsloesung,
// Tropfen und ein Spray sind im Glas nicht zu unterscheiden — sie alle
// verschieden einzufaerben waere eine erfundene Unterscheidung.
const WASSER = '#9fd3e8'

const FUELLFARBEN: Record<DosageFormKey, string> = {
  // Flüssig, auch das Vial: als Pulver zum Aufloesen steht es im Regal, auf
  // der Buehne steht es fertig angesetzt.
  vial: WASSER,
  ampoule: WASSER,
  pen: WASSER,
  drops: WASSER,
  nasal_spray: WASSER,
  spray: WASSER,

  // Fest, jedes in seinem eigenen Material.
  tablet: '#e8e6e1', // gepresstes Weiss, leicht ins Warme
  capsule: '#e6e1d8', // Gelatine, elfenbein
  powder: '#efe9dc', // Pulver im Glas, cremeweiss
  gel: '#cfe3ea', // durchscheinend, ein Hauch blau
  // Tube und Pflaster zeigen die Eintragsfarbe bewusst nicht — sie haben ihr
  // eigenes Material und wuerden mit einer fremden Farbe zum Fremdkoerper im
  // Bild. Die Werte stehen der Vollstaendigkeit halber hier, benutzt werden
  // sie von diesen beiden Formen nicht.
  tube: '#ece9e4',
  patch: '#e0c9ae',

  // Ohne Buehnengrafik: hier faellt gar nichts an, der Wert wird nie benutzt.
  other: WASSER,
}

export function fuellfarbe(dosageForm: DosageFormKey): string {
  return FUELLFARBEN[dosageForm] ?? WASSER
}
