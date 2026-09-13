// Zusammenfassen statt alles zeichnen.
//
// DAS PROBLEM
// Wohlbefinden wird taeglich auf einer Skala 1–10 eingetragen. Ueber ein Jahr
// sind das 365 Punkte, die in einen 42 mm hohen, 168 mm breiten Kasten
// gedrueckt werden — 0,46 mm je Tag. Benachbarte Tage springen bei einer
// Selbsteinschaetzung um zwei, drei Punkte; heraus kommt ein Zickzackband, aus
// dem niemand einen Verlauf liest. Auf Papier gibt es kein Hineinzoomen.
//
// DIE ANTWORT
// Nicht weniger Daten, sondern groebere Eimer. Je Eimer wird der MEDIAN
// gezeichnet — nicht der Mittelwert: ein einzelner Ausreisser („Grippe, alles
// auf 2") verschiebt den Mittelwert einer Woche spuerbar, den Median nicht.
// Die Spannweite des Eimers (min–max) bleibt als Strich sichtbar, damit das
// Glaetten nichts unterschlaegt.
//
// WARUM DATUMS-STRINGS UND KEINE Date-OBJEKTE
// `log_date` ist ein Kalendertag ohne Uhrzeit. `new Date('2026-03-01T00:00:00')`
// liest ihn in der Ortszeit, und je nach Zone faellt der Wert in den Vortag —
// womit ein Eintrag im falschen Monatseimer landet. Gerechnet wird deshalb auf
// den Zeichen des Datums und, wo eine Zahl noetig ist, in UTC.

export type BucketSize = 'day' | 'week' | 'month' | 'quarter'

export interface WellnessSample {
  /** yyyy-MM-dd */
  date: string
  value: number
}

export interface WellnessBucket {
  /** Beginn des Eimers als UTC-Millisekunden — nur fuer die X-Position. */
  t: number
  /** yyyy-MM-dd des Eimerbeginns. */
  start: string
  median: number
  min: number
  max: number
  count: number
}

/**
 * Wie viele Punkte ein Chart vertraegt. Bei 168 mm Breite sind das gut 4 mm je
 * Punkt — genug, dass zwei benachbarte Punkte als zwei Punkte erkennbar sind.
 */
export const MAX_BUCKETS = 40

const REIHENFOLGE: readonly BucketSize[] = ['day', 'week', 'month', 'quarter']

function teile(datum: string): [number, number, number] {
  const [j, m, t] = datum.split('-').map(Number)
  return [j, m, t]
}

function alsUtc(datum: string): number {
  const [j, m, t] = teile(datum)
  return Date.UTC(j, m - 1, t)
}

function alsDatum(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Der Kalendertag, mit dem der Eimer dieses Datums beginnt. */
export function bucketStart(datum: string, groesse: BucketSize): string {
  const [j, m] = teile(datum)
  if (groesse === 'day') return datum
  if (groesse === 'month') return `${String(j).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`
  if (groesse === 'quarter') {
    const quartalsMonat = m - ((m - 1) % 3)
    return `${String(j).padStart(4, '0')}-${String(quartalsMonat).padStart(2, '0')}-01`
  }
  // Woche: Montag. getUTCDay() liefert 0 fuer Sonntag — der gehoert zur
  // Vorwoche, also sechs Tage zurueck statt minus eins.
  const ms = alsUtc(datum)
  const wochentag = new Date(ms).getUTCDay()
  return alsDatum(ms - ((wochentag + 6) % 7) * 86_400_000)
}

function median(werte: number[]): number {
  const sortiert = [...werte].sort((a, b) => a - b)
  const mitte = Math.floor(sortiert.length / 2)
  const roh = sortiert.length % 2 === 1
    ? sortiert[mitte]
    : (sortiert[mitte - 1] + sortiert[mitte]) / 2
  return Math.round(roh * 10) / 10
}

/** Wie viele Eimer diese Groesse fuer diese Punkte ergaebe. */
export function bucketCount(samples: readonly WellnessSample[], groesse: BucketSize): number {
  return new Set(samples.map(s => bucketStart(s.date, groesse))).size
}

/**
 * Die FEINSTE Groesse, die unter der Obergrenze bleibt. Feiner ist immer
 * besser — zusammengefasst wird nur so weit, wie das Blatt es erzwingt.
 */
export function chooseBucketSize(
  samples: readonly WellnessSample[],
  max = MAX_BUCKETS,
): BucketSize {
  for (const groesse of REIHENFOLGE) {
    if (bucketCount(samples, groesse) <= max) return groesse
  }
  return 'quarter'
}

export function aggregate(
  samples: readonly WellnessSample[],
  groesse: BucketSize,
): WellnessBucket[] {
  const eimer = new Map<string, number[]>()
  for (const probe of samples) {
    if (!Number.isFinite(probe.value)) continue
    const start = bucketStart(probe.date, groesse)
    const vorhanden = eimer.get(start)
    if (vorhanden) vorhanden.push(probe.value)
    else eimer.set(start, [probe.value])
  }
  return [...eimer.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, werte]) => ({
      t: alsUtc(start),
      start,
      median: median(werte),
      min: Math.min(...werte),
      max: Math.max(...werte),
      count: werte.length,
    }))
}

export interface WellnessSummary {
  first: number
  last: number
  delta: number
  /** Alle Einzeleintraege, nicht die Eimer. */
  entries: number
}

/**
 * Anfang, Ende, Veraenderung — gerechnet auf den EIMERN, nicht auf dem ersten
 * und letzten Tag. Ein einzelner erster Tag ist kein Ausgangswert.
 */
export function summarise(buckets: readonly WellnessBucket[]): WellnessSummary | null {
  if (buckets.length < 2) return null
  const first = buckets[0].median
  const last = buckets[buckets.length - 1].median
  return {
    first,
    last,
    delta: Math.round((last - first) * 10) / 10,
    entries: buckets.reduce((summe, eimer) => summe + eimer.count, 0),
  }
}
