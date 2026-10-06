import type { CycleTimeline } from '../../../lib/planTimeline'
import { cyclePeriod } from '../../my-stack/lib/planCard'

/**
 * Zyklen aus My Stack als Zeitstreifen unter dem Verlauf eines Markers:
 * je Substanz eine Zeile, darin ihre Zyklen als Abschnitte, auf derselben
 * Zeitachse wie das Diagramm. Nur zur Orientierung — die App zeigt
 * Zeitraeume, keine Wirkung.
 */

export interface ZyklusAbschnitt {
  cycleId: string
  /** Erster Tag (yyyy-MM-dd). */
  von: string
  /** Letzter Tag; null = laeuft noch. */
  bis: string | null
  /** Lage im Fenster, 0–1, bereits auf das Fenster zugeschnitten. */
  start: number
  ende: number
}

export interface ZyklusZeile {
  stackItemId: string
  substanz: string
  /** Farbplatz 0–5, fest je Substanz (nicht nach Rang im Fenster); null = grau. */
  farbe: number | null
  abschnitte: ZyklusAbschnitt[]
}

export const MAX_ZEILEN = 6
const FARBEN = 6

const TAG_MS = 24 * 60 * 60 * 1000
const alsMs = (tag: string) => Date.parse(`${tag}T00:00:00Z`)

/**
 * @param fenster erster und letzter Tag der Diagramm-Achse (yyyy-MM-dd)
 * @param heute   heutiger Tag — Ende laufender Zyklen
 * @returns die Zeilen (hoechstens MAX_ZEILEN) und wie viele weitere es gaebe
 */
export function zyklusZeilen(
  timelines: readonly CycleTimeline[],
  namen: ReadonlyMap<string, string>,
  fenster: { von: string; bis: string },
  heute: string,
  timeZone: string,
): { zeilen: ZyklusZeile[]; weitere: number } {
  const fensterStart = alsMs(fenster.von)
  // Der letzte Tag zaehlt ganz mit.
  const fensterEnde = alsMs(fenster.bis) + TAG_MS
  const spanne = fensterEnde - fensterStart
  if (!(spanne > 0)) return { zeilen: [], weitere: 0 }

  // Farbe folgt der Substanz: feste Reihenfolge ueber alle Zyklen (erster
  // Start), damit ein anderer Zeitraum die Farben nicht neu verteilt.
  const reihenfolge = [...new Set(
    timelines
      .slice()
      .sort((a, b) => a.cycle.started_at.localeCompare(b.cycle.started_at))
      .map(timeline => timeline.cycle.stack_item_id),
  )]

  const proSubstanz = new Map<string, ZyklusAbschnitt[]>()
  for (const timeline of timelines) {
    const { first, last } = cyclePeriod(timeline, timeZone)
    const letzter = last !== null && last < first ? first : last
    const startMs = alsMs(first)
    const endeMs = alsMs(letzter ?? heute) + TAG_MS
    if (endeMs <= fensterStart || startMs >= fensterEnde) continue
    const abschnitt: ZyklusAbschnitt = {
      cycleId: timeline.cycle.id,
      von: first,
      bis: letzter,
      start: Math.max(0, (startMs - fensterStart) / spanne),
      ende: Math.min(1, (endeMs - fensterStart) / spanne),
    }
    const liste = proSubstanz.get(timeline.cycle.stack_item_id) ?? []
    liste.push(abschnitt)
    proSubstanz.set(timeline.cycle.stack_item_id, liste)
  }

  const alle = [...proSubstanz.entries()]
    .map(([stackItemId, abschnitte]) => {
      const platz = reihenfolge.indexOf(stackItemId)
      return {
        stackItemId,
        substanz: namen.get(stackItemId) ?? '—',
        farbe: platz >= 0 && platz < FARBEN ? platz : null,
        abschnitte: abschnitte.sort((a, b) => a.start - b.start),
      }
    })
    .sort((a, b) => a.abschnitte[0].start - b.abschnitte[0].start)

  return { zeilen: alle.slice(0, MAX_ZEILEN), weitere: Math.max(0, alle.length - MAX_ZEILEN) }
}
