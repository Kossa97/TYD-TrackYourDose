import { describe, expect, it } from 'vitest'
import {
  MAX_BUCKETS,
  aggregate,
  bucketCount,
  bucketStart,
  chooseBucketSize,
  summarise,
  type WellnessSample,
} from './wellnessBuckets'

/** Taegliche Eintraege ab `start`, `tage` Stueck, Wert aus `werte` zyklisch. */
function taeglich(start: string, tage: number, werte: number[]): WellnessSample[] {
  const [j, m, t] = start.split('-').map(Number)
  const basis = Date.UTC(j, m - 1, t)
  return Array.from({ length: tage }, (_, i) => ({
    date: new Date(basis + i * 86_400_000).toISOString().slice(0, 10),
    value: werte[i % werte.length],
  }))
}

describe('bucketStart', () => {
  it('laesst Tage unberuehrt', () => {
    expect(bucketStart('2026-03-01', 'day')).toBe('2026-03-01')
  })

  it('legt die Woche auf den Montag, auch am Sonntag', () => {
    // 2026-03-01 ist ein Sonntag. Er gehoert zur Woche davor, nicht zur
    // naechsten — getUTCDay() liefert dort 0, und minus eins waere Samstag.
    expect(new Date('2026-03-01T00:00:00Z').getUTCDay()).toBe(0)
    expect(bucketStart('2026-03-01', 'week')).toBe('2026-02-23')
    expect(bucketStart('2026-02-23', 'week')).toBe('2026-02-23')
    expect(bucketStart('2026-02-28', 'week')).toBe('2026-02-23')
  })

  it('faellt beim Monat auf den Ersten und beim Quartal auf Jan/Apr/Jul/Okt', () => {
    expect(bucketStart('2026-03-17', 'month')).toBe('2026-03-01')
    expect(bucketStart('2026-01-31', 'quarter')).toBe('2026-01-01')
    expect(bucketStart('2026-03-17', 'quarter')).toBe('2026-01-01')
    expect(bucketStart('2026-04-01', 'quarter')).toBe('2026-04-01')
    expect(bucketStart('2026-12-31', 'quarter')).toBe('2026-10-01')
  })

  it('haengt nicht an der Zeitzone des Rechners', () => {
    // Der Fall, der Date-Objekte hier verbietet: `new Date('2026-03-01')`
    // liest in westlichen Zonen den 28. Februar. Gerechnet wird auf den
    // Zeichen des Datums, also steht der Monat fest.
    expect(bucketStart('2026-03-01', 'month')).toBe('2026-03-01')
    expect(bucketStart('2026-01-01', 'month')).toBe('2026-01-01')
  })
})

describe('chooseBucketSize', () => {
  it('bleibt bei Tagen, solange es wenige sind', () => {
    expect(chooseBucketSize(taeglich('2026-01-01', 30, [5]))).toBe('day')
  })

  it('geht auf Wochen, sobald die Tage die Grenze reissen', () => {
    // 90 Tage = 90 Eimer bei „day", rund 14 bei „week".
    expect(chooseBucketSize(taeglich('2026-01-01', 90, [5]))).toBe('week')
  })

  it('geht bei einem Jahr auf Monate', () => {
    // 365 Tage sind 53 Wochen — auch das ist mehr als die Grenze.
    const jahr = taeglich('2026-01-01', 365, [5])
    expect(bucketCount(jahr, 'week')).toBeGreaterThan(MAX_BUCKETS)
    expect(chooseBucketSize(jahr)).toBe('month')
  })

  it('geht bei vielen Jahren auf Quartale', () => {
    expect(chooseBucketSize(taeglich('2020-01-01', 365 * 5, [5]))).toBe('quarter')
  })

  it('nimmt immer die FEINSTE Groesse, die passt', () => {
    // Die Regel ist nicht „ab X Tagen Wochen", sondern „so fein wie moeglich".
    // Wer ein Jahr lang nur einmal im Monat etwas eintraegt, bekommt Tage.
    const selten = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-${String(i + 1).padStart(2, '0')}-05`,
      value: 6,
    }))
    expect(chooseBucketSize(selten)).toBe('day')
  })
})

describe('aggregate', () => {
  it('fasst je Eimer zu Median, Spannweite und Anzahl zusammen', () => {
    const proben: WellnessSample[] = [
      { date: '2026-02-23', value: 4 },
      { date: '2026-02-24', value: 8 },
      { date: '2026-02-25', value: 6 },
    ]
    const [eimer] = aggregate(proben, 'week')
    expect(eimer.start).toBe('2026-02-23')
    expect(eimer.median).toBe(6)
    expect(eimer.min).toBe(4)
    expect(eimer.max).toBe(8)
    expect(eimer.count).toBe(3)
  })

  it('nimmt den Median, nicht den Mittelwert', () => {
    // Eine Grippewoche: sechs gute Tage, ein Totalausfall. Der Mittelwert
    // faellt auf 6,4 — der Median bleibt bei 7, und die Spannweite zeigt den
    // Ausreisser trotzdem.
    const woche: WellnessSample[] = [7, 7, 7, 7, 7, 7, 1].map((wert, i) => ({
      date: `2026-02-${String(23 + i).padStart(2, '0')}`,
      value: wert,
    }))
    const [eimer] = aggregate(woche, 'week')
    expect(eimer.median).toBe(7)
    expect(eimer.min).toBe(1)
    expect(eimer.count).toBe(7)
  })

  it('mittelt bei gerader Anzahl die beiden mittleren Werte', () => {
    const [eimer] = aggregate(
      [
        { date: '2026-02-23', value: 4 },
        { date: '2026-02-24', value: 7 },
      ],
      'week',
    )
    expect(eimer.median).toBe(5.5)
  })

  it('gibt die Eimer in zeitlicher Reihenfolge zurueck', () => {
    const gemischt: WellnessSample[] = [
      { date: '2026-03-15', value: 5 },
      { date: '2026-01-15', value: 5 },
      { date: '2026-02-15', value: 5 },
    ]
    expect(aggregate(gemischt, 'month').map(e => e.start))
      .toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
  })

  it('ueberspringt Werte, die keine Zahl sind', () => {
    const eimer = aggregate(
      [
        { date: '2026-02-23', value: 5 },
        { date: '2026-02-24', value: Number.NaN },
      ],
      'week',
    )
    expect(eimer[0].count).toBe(1)
  })

  it('liefert fuer gar keine Punkte auch keine Eimer', () => {
    expect(aggregate([], 'month')).toEqual([])
  })
})

describe('summarise', () => {
  it('rechnet Anfang und Ende auf den Eimern, nicht auf Einzeltagen', () => {
    const jahr = aggregate(taeglich('2026-01-01', 365, [5, 6, 7]), 'month')
    const zusammen = summarise(jahr)!
    expect(zusammen.entries).toBe(365)
    expect(zusammen.delta).toBe(Math.round((zusammen.last - zusammen.first) * 10) / 10)
  })

  it('schweigt, solange es nur einen Eimer gibt', () => {
    // „Veraenderung: 0" waere eine Aussage, die niemand belegen kann.
    expect(summarise(aggregate([{ date: '2026-01-01', value: 5 }], 'month'))).toBeNull()
    expect(summarise([])).toBeNull()
  })
})
