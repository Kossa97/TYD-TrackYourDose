import type { ProgressPhotoEntry } from '../types'

export interface PhotoPreviewSlot {
  photo: ProgressPhotoEntry
  inRange: boolean
}

const sortNewestFirst = (photos: ProgressPhotoEntry[]) =>
  [...photos].sort((a, b) => b.taken_at.localeCompare(a.taken_at))

export function buildPhotoSlots(
  inRange: ProgressPhotoEntry[],
  allPhotos: ProgressPhotoEntry[],
  limit = 6,
): PhotoPreviewSlot[] {
  const inRangeIds = new Set(inRange.map(photo => photo.id))
  const selected = sortNewestFirst(inRange)
  const outside = sortNewestFirst(allPhotos.filter(photo => !inRangeIds.has(photo.id)))

  return [...selected, ...outside]
    .slice(0, limit)
    .map(photo => ({ photo, inRange: inRangeIds.has(photo.id) }))
}

export function photoPreviewColumns(count: number): number {
  if (count <= 1) return 1
  if (count <= 4) return 2
  return 3
}