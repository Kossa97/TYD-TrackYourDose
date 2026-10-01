/**
 * Wie das Raster in My Stack seine Flaeche aufteilt.
 *
 * Die Kacheln werden so gross wie moeglich, solange ALLE Substanzen ohne
 * Scrollen auf den Bildschirm passen. Probiert wird jede Spaltenzahl; es
 * gewinnt die, bei der ein Objekt am hoechsten wird. Hoeher, nicht breiter:
 * die Formen sind hochkant (ein Vial ist etwa anderthalbmal so hoch wie
 * breit), und eine breite, flache Kachel gaebe ihnen nichts.
 *
 * Zwei Untergrenzen halten den Namen auf dem Objekt lesbar:
 * - eine Kachel wird nie schmaler als `minBreite` — das begrenzt die
 *   Spaltenzahl (auf dem iPhone: drei);
 * - ein Objekt wird nie niedriger als `minHoehe`. Passt es so nicht mehr
 *   auf den Bildschirm, wird GESCROLLT statt weiter verkleinert, und zwar mit
 *   der vollen Spaltenzahl und Kacheln in ihrer natuerlichen Hoehe.
 */
export interface RasterEingabe {
  anzahl: number
  /** Nutzbare Flaeche in px. */
  breite: number
  hoehe: number
  abstand?: number
  minBreite?: number
  minHoehe?: number
  /** Hoehe einer Kachel zu ihrer Breite, wenn Platz keine Rolle spielt. */
  seitenVerhaeltnis?: number
}

export interface RasterAufteilung {
  spalten: number
  zeilen: number
  kachelHoehe: number
  /** `false`: es wird gescrollt, weil sonst die Objekte zu klein wuerden. */
  passt: boolean
}

export const RASTER_ABSTAND = 12
export const RASTER_MIN_BREITE = 110
export const RASTER_MIN_HOEHE = 100
export const RASTER_SEITENVERHAELTNIS = 1.4

export function rasterAufteilung({
  anzahl,
  breite,
  hoehe,
  abstand = RASTER_ABSTAND,
  minBreite = RASTER_MIN_BREITE,
  minHoehe = RASTER_MIN_HOEHE,
  seitenVerhaeltnis = RASTER_SEITENVERHAELTNIS,
}: RasterEingabe): RasterAufteilung {
  const n = Math.max(0, Math.floor(anzahl))
  if (n === 0 || breite <= 0) return { spalten: 1, zeilen: 0, kachelHoehe: 0, passt: true }

  const kachelBreite = (spalten: number) => (breite - (spalten - 1) * abstand) / spalten
  const maxSpalten = Math.max(1, Math.min(n, Math.floor((breite + abstand) / (minBreite + abstand))))

  let beste: RasterAufteilung | null = null
  for (let spalten = 1; spalten <= maxSpalten; spalten++) {
    const zeilen = Math.ceil(n / spalten)
    const zeilenHoehe = (hoehe - (zeilen - 1) * abstand) / zeilen
    const kachelHoehe = Math.min(kachelBreite(spalten) * seitenVerhaeltnis, zeilenHoehe)
    if (!beste || kachelHoehe > beste.kachelHoehe) beste = { spalten, zeilen, kachelHoehe, passt: true }
  }

  if (beste && beste.kachelHoehe >= minHoehe) return { ...beste, kachelHoehe: Math.floor(beste.kachelHoehe) }

  // Zu klein, um alles zu zeigen: volle Spaltenzahl, natuerliche Hoehe, scrollen.
  return {
    spalten: maxSpalten,
    zeilen: Math.ceil(n / maxSpalten),
    kachelHoehe: Math.floor(kachelBreite(maxSpalten) * seitenVerhaeltnis),
    passt: false,
  }
}
