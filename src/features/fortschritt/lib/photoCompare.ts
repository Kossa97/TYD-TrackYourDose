import { differenceInDays, intervalToDuration, parseISO } from 'date-fns'
import type { ProgressPhotoEntry } from '../types'

/** Früheres Foto links, späteres rechts (bei gleichem Datum nach ID). */
export function orderPhotosForCompare(
  a: ProgressPhotoEntry,
  b: ProgressPhotoEntry,
): [ProgressPhotoEntry, ProgressPhotoEntry] {
  const cmp = a.taken_at.localeCompare(b.taken_at)
  if (cmp < 0) return [a, b]
  if (cmp > 0) return [b, a]
  return a.id.localeCompare(b.id) <= 0 ? [a, b] : [b, a]
}

/** Deutsche Zeitspanne zwischen zwei Foto-Daten (inklusive Endtag). */
export function formatPhotoInterval(from: string, to: string): string {
  const start = parseISO(`${from}T00:00:00`)
  const end = parseISO(`${to}T00:00:00`)
  const days = differenceInDays(end, start)

  if (days === 0) return 'Gleicher Tag'
  if (days === 1) return '1 Tag'

  const dur = intervalToDuration({ start, end })
  const parts: string[] = []

  if (dur.years) {
    parts.push(`${dur.years} ${dur.years === 1 ? 'Jahr' : 'Jahre'}`)
  }
  if (dur.months) {
    parts.push(`${dur.months} ${dur.months === 1 ? 'Monat' : 'Monate'}`)
  }
  if (!dur.years && !dur.months) {
    parts.push(`${days} Tage`)
  } else if (dur.days && dur.days > 0) {
    parts.push(`${dur.days} ${dur.days === 1 ? 'Tag' : 'Tage'}`)
  }

  return parts.join(', ')
}

export function findPhotosByIds(
  photos: ProgressPhotoEntry[],
  ids: string[],
): ProgressPhotoEntry[] {
  const map = new Map(photos.map(p => [p.id, p]))
  return ids.map(id => map.get(id)).filter((p): p is ProgressPhotoEntry => p != null)
}
