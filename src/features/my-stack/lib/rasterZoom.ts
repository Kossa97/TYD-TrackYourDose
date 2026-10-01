/**
 * Die Rechnung hinter dem Zoom vom Karussell ins Raster.
 *
 * Der ganze Uebergang haengt an EINER Zahl, dem Fortschritt `p` von 0
 * (Karussell) bis 1 (Raster). Ob ihn eine Feder treibt (Menue, X) oder die
 * Finger (Zoom-Geste), ist dem Rest egal: jedes Bild wird aus `p` berechnet.
 * Deshalb steht hier nichts, was React oder das DOM kennt.
 */

/**
 * Die Zoomstufen, von nah nach fern. Eine Stufe begrenzt, wie viele
 * Substanzen hoechstens auf EINE Seite kommen; wie sie sich darauf verteilen,
 * entscheidet `seitenAufteilung` nach Anzahl und Bildschirm. Was nicht passt,
 * kommt auf weitere Seiten.
 */
export const ZOOM_STUFEN = [
  { maxSpalten: 4, maxZeilen: 4, abstand: 8 },
  { maxSpalten: 6, maxZeilen: 8, abstand: 6 },
] as const

export type ZoomStufe = (typeof ZOOM_STUFEN)[number]

/** Hoehe zu Breite, bei der ein Objekt seine Kachel gut fuellt — die meisten Formen sind hochkant. */
export const OBJEKT_HOCHKANT = 1.4

export interface SeitenAufteilung {
  spalten: number
  zeilen: number
  proSeite: number
  seiten: number
  kachelBreite: number
  kachelHoehe: number
}

/**
 * Wie sich `anzahl` Substanzen auf den Bildschirm verteilen.
 *
 * Probiert jede Spaltenzahl bis zur Grenze der Stufe; es gewinnt die, bei
 * der ein Objekt am groessten wird (hochkant gemessen), bei Gleichstand die
 * mit weniger leeren Plaetzen. Die Kacheln teilen sich die ganze Flaeche —
 * vier Substanzen werden 2×2 und gross, sechzehn 4×4.
 */
export function seitenAufteilung(
  anzahl: number,
  stufe: ZoomStufe,
  flaeche: { breite: number; hoehe: number },
): SeitenAufteilung {
  const n = Math.max(0, Math.floor(anzahl))
  const proSeite = Math.max(1, Math.min(n, stufe.maxSpalten * stufe.maxZeilen))
  const breite = (spalten: number) => (flaeche.breite - (spalten - 1) * stufe.abstand) / spalten
  const hoehe = (zeilen: number) => (flaeche.hoehe - (zeilen - 1) * stufe.abstand) / zeilen

  let beste = { spalten: 1, zeilen: proSeite, groesse: -Infinity, leer: Infinity }
  for (let spalten = 1; spalten <= Math.min(stufe.maxSpalten, proSeite); spalten++) {
    const zeilen = Math.ceil(proSeite / spalten)
    if (zeilen > stufe.maxZeilen) continue
    const groesse = Math.min(breite(spalten) * OBJEKT_HOCHKANT, hoehe(zeilen))
    const leer = spalten * zeilen - proSeite
    if (groesse > beste.groesse + 0.5 || (Math.abs(groesse - beste.groesse) <= 0.5 && leer < beste.leer)) {
      beste = { spalten, zeilen, groesse, leer }
    }
  }
  return {
    spalten: beste.spalten,
    zeilen: beste.zeilen,
    proSeite,
    seiten: n === 0 ? 0 : Math.ceil(n / proSeite),
    kachelBreite: Math.max(0, Math.floor(breite(beste.spalten))),
    kachelHoehe: Math.max(0, Math.floor(hoehe(beste.zeilen))),
  }
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
export const ERSCHEINEN_BIS = 0.5

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
export const ERSCHEIN_FENSTER = 0.5
export function kachelFortschritt(p: number, schwelle: number, fenster = ERSCHEIN_FENSTER): number {
  const t = clamp01((p - schwelle) / fenster)
  return 1 - Math.pow(1 - t, 4)
}

/**
 * Eine Feder fuer `p`. Knapp unter der kritischen Daempfung: sie gleitet
 * ruhig hinein, ohne sichtbares Nachschwingen, und braucht knapp eine
 * Sekunde — mit einer halben war sie zu hastig.
 */
export interface Feder { wert: number; tempo: number }
export const FEDER = { steifigkeit: 110, daempfung: 20 }

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
 * ihrem Kasten im Raster (`nach`).
 *
 * Geflogen wird ein eigenes Objekt in der GROSSEN Ausgangsgroesse, das nur
 * schrumpft: Verkleinern bleibt scharf und kostet nichts, weil das Bild
 * einmal gemalt und dann nur noch skaliert wird. Die Kachel selbst
 * hochzuziehen war entweder unscharf (als fertiges Bild) oder teuer (in
 * jedem Bild neu gemalt). Geliefert wird, was auf das Objekt an seinem
 * Startplatz anzuwenden ist — Verschiebung und Faktor, Ursprung oben links.
 */
export interface Kasten { x: number; y: number; breite: number; hoehe: number }
export function flug(von: Kasten, nach: Kasten, p: number): { dx: number; dy: number; skala: number } {
  const t = clamp01(p)
  const zielSkala = von.breite > 0 ? nach.breite / von.breite : 1
  return {
    dx: mische(0, nach.x - von.x, t),
    dy: mische(0, nach.y - von.y, t),
    skala: mische(1, zielSkala, t),
  }
}

// ── Die Zoom-Geste ──────────────────────────────────────────────────────────

/** Wie weit zwei Finger zusammen (< 1) oder auseinander (> 1) sind, bezogen auf den Anfang. */
export function fingerSkala(start: number, jetzt: number): number {
  return start > 0 ? jetzt / start : 1
}

/** Zusammenziehen im Karussell: bei halbem Fingerabstand ist das Raster ganz da. */
export const ZUSAMMEN_VOLL = 0.5
export function fortschrittHinein(skala: number): number {
  return clamp01((1 - skala) / (1 - ZUSAMMEN_VOLL))
}

/** Auseinanderziehen im Raster: beim 1,8-fachen Abstand ist das Karussell ganz zurueck. */
export const AUSEINANDER_VOLL = 1.8
export function fortschrittHinaus(skala: number): number {
  return 1 - clamp01((skala - 1) / (AUSEINANDER_VOLL - 1))
}

/** Ab welcher Fingerskala im Raster die Zoomstufe wechselt. */
export const STUFE_DICHTER_AB = 0.78
export const STUFE_WEITER_AB = 1.28

/**
 * Beim Loslassen: wohin? Ein schneller Schwung entscheidet, sonst der Weg —
 * wer mehr als ein Drittel gezogen hat, will dorthin.
 */
export function zielBeimLoslassen(p: number, tempo: number): 0 | 1 {
  if (tempo > 1.2) return 1
  if (tempo < -1.2) return 0
  return p >= 0.35 ? 1 : 0
}
