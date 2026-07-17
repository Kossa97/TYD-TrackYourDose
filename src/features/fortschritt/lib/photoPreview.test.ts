import { describe, expect, test } from 'vitest'
import type { ProgressPhotoEntry } from '../types'
import { buildPhotoSlots, photoPreviewColumns } from './photoPreview'

function photo(id: string, taken_at: string): ProgressPhotoEntry {
  return {
    id,
    photo_url: `${id}.jpg`,
    display_url: `https://example.com/${id}.jpg`,
    taken_at,
    weight_kg: null,
    notes: null,
  }
}

describe('buildPhotoSlots', () => {
  test('puts selected-period photos first and fills with outside-period photos', () => {
    const selected = photo('selected', '2026-03-01')
    const outside = photo('outside', '2025-03-01')

    expect(buildPhotoSlots([selected], [outside, selected]).map(slot => [slot.photo.id, slot.inRange])).toEqual([
      ['selected', true],
      ['outside', false],
    ])
  })

  test('does not create empty slots when only a few photos exist', () => {
    const only = photo('only', '2026-03-01')
    expect(buildPhotoSlots([only], [only])).toHaveLength(1)
  })
})

describe('photoPreviewColumns', () => {
  test('uses a compact grid for the number of visible photos', () => {
    expect(photoPreviewColumns(1)).toBe(1)
    expect(photoPreviewColumns(2)).toBe(2)
    expect(photoPreviewColumns(3)).toBe(2)
    expect(photoPreviewColumns(4)).toBe(2)
    expect(photoPreviewColumns(5)).toBe(3)
    expect(photoPreviewColumns(6)).toBe(3)
  })
})