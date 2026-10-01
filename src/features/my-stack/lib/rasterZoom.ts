/**
 * Die Rechnung hinter dem Zoom vom Karussell ins Raster.
 *
 * Der ganze Uebergang haengt an EINER Zahl, dem Fortschritt `p` von 0
 * (Karussell) bis 1 (Raster). Ob ihn eine Feder treibt (Menue, X) oder die
 * Finger (Zoom-Geste), ist dem Rest egal: jedes Bild wird aus `p` berechnet.
 * Deshalb steht hier nichts, was React oder das DOM kennt.
 */

/** Die Zoomstufen, von nah nach fern. Zeilen: wie viele auf einen Bildschirm passen. */
export const ZOOM_STUFEN = [
  { spalten: 4, zeilen: 4, abstand: 8 },
  { spalten: 6, zeilen: 8, abstand: 6 },
] as const

export type ZoomStufe = (typeof ZOOM_STUFEN)[number]

export function kachelMass(
  stufe: ZoomStufe,
  flaeche: { breite: number; hoehe: number },
): { breite: number; hoehe: number } {
  const breite = Math.max(0, (flaeche.breite - (stufe.spalten - 1) * stufe.abstand) / stufe.spalten)
  const hoehe = Math.max(0, (flaeche.hoehe - (stufe.zeilen - 1) * stufe.abstand) / stufe.zeilen)
  return { breite: Math.floor(breite), hoehe: Math.floor(hoehe) }
}

export const clamp01 = (wert: number) => (Number.isFinite(wert) ? Math.min(1, Math.max(0, wert)) : 0)
export const mische = (von: number, nach: number, t: number) => von + (nach - von) * t

/**
 * Wann jede Kachel zu erscheinen beginnt, als Anteil von `p`.
 *
 * Zufaellig, aber gleichmaessig verteilt: die Schwellen sind die Plaetze
 * 0…n-1, gemischt und leicht verwackelt. Rein zufaellige Zahlen ballten sich
 * mal, mal klafften Luecken — dann kaeme die Haelfte auf einmal und danach
 * lange nichts.
 */
export const ERSCHEINEN_AB = 0.12
export const ERSCHEINEN_BIS = 0.62

export function erscheinSchwellen(anzahl: number, zufall: () => number = Math.random): number[] {
  const n = Math.max(0, Math.floor(anzahl))
  const plaetze = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1))
    ;[plaetze[i], plaetze[j]] = [plaetze[j], plaetze[i]]
  }
  const spanne = ERSCHEINEN_BIS - ERSCHEINEN_AB
  return plaetze.map(platz => {
    const wackeln = (zufall() - 0.5) * 0.6
    return ERSCHEINEN_AB + spanne * clamp01((platz + 0.5 + wackeln) / Math.max(1, n))
  })
}

/** Wie weit eine einzelne Kachel ist (0…1), mit weichem Auslauf. */
export const ERSCHEIN_FENSTER = 0.38
export function kachelFortschritt(p: number, schwelle: number, fenster = ERSCHEIN_FENSTER): number {
  const t = clamp01((p - schwelle) / fenster)
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Eine Feder fuer `p`. Leicht unterkritisch gedaempft: sie kommt zuegig an
 * und schwingt kaum merklich nach — das ist der Unterschied zwischen
 * „animiert" und „bewegt sich wie etwas Echtes".
 */
export interface Feder { wert: number; tempo: number }
export const FEDER = { steifigkeit: 190, daempfung: 25 }

export function federSchritt(zustand: Feder, ziel: number, dt: number, feder = FEDER): Feder {
  // Lange Bilder (Tab im Hintergrund, Ruckler) in Teilschritte zerlegen,
  // sonst wird die Rechnung instabil und die Feder schiesst ueber.
  let { wert, tempo } = zustand
  let rest = Math.min(dt, 0.1)
  while (rest > 0) {
    const schritt = Math.min(rest, 1 / 120)
    const beschleunigung = -feder.steifigkeit * (wert - ziel) - feder.daempfung * tempo
    tempo += beschleunigung * schritt
    wert += tempo * schritt
    rest -= schritt
  }
  return { wert, tempo }
}

export function federRuht(zustand: Feder, ziel: number): boolean {
  return Math.abs(zustand.wert - ziel) < 0.001 && Math.abs(zustand.tempo) < 0.01
}

/**
 * Der Flug der aktiven Substanz: von ihrem Kasten im Karussell (`von`) zu
 * ihrem Kasten im Raster (`nach`). Geliefert wird, was auf den Kasten im
 * Raster anzuwenden ist — Verschiebung und Faktor, Ursprung oben links.
 */
export interface Kasten { x: number; y: number; breite: number; hoehe: number }
export function flug(von: Kasten, nach: Kasten, p: number): { dx: number; dy: number; skala: number } {
  const t = clamp01(p)
  const startSkala = nach.breite > 0 ? von.breite / nach.breite : 1
  return {
    dx: mische(von.x - nach.x, 0, t),
    dy: mische(von.y - nach.y, 0, t),
    skala: mische(startSkala, 1, t),
  }
}
