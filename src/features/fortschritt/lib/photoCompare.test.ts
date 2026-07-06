import { describe, expect, it } from 'vitest'
import type { ProgressPhotoEntry } from '../types'
import {
  formatPhotoInterval,
  orderPhotosForCompare,
} from './photoCompare'

function photo(id: string, taken_at: string): ProgressPhotoEntry {
  return {
    id,
    photo_url: `path/${id}.jpg`,
    display_url: `https://example.com/${id}.jpg`,
    taken_at,
    weight_kg: null,
    notes: null,
  }
}

describe('orderPhotosForCompare', () => {
  it('places earlier photo on the left', () => {
    const earlier = photo('a', '2026-01-01')
    const later = photo('b', '2026-03-15')
    expect(orderPhotosForCompare(later, earlier)).toEqual([earlier, later])
    expect(orderPhotosForCompare(earlier, later)).toEqual([earlier, later])
  })

  it('uses id as tiebreaker for same date', () => {
    const left = photo('aaa', '2026-02-01')
    const right = photo('bbb', '2026-02-01')
    expect(orderPhotosForCompare(right, left)).toEqual([left, right])
  })
})

describe('formatPhotoInterval', () => {
  it('formats same day', () => {
    expect(formatPhotoInterval('2026-06-01', '2026-06-01')).toBe('Gleicher Tag')
  })

  it('formats single day', () => {
    expect(formatPhotoInterval('2026-06-01', '2026-06-02')).toBe('1 Tag')
  })

  it('formats days only for short spans', () => {
    expect(formatPhotoInterval('2026-06-01', '2026-06-15')).toBe('14 Tage')
  })

  it('formats months and days', () => {
    expect(formatPhotoInterval('2026-01-01', '2026-03-15')).toBe('2 Monate, 14 Tage')
  })

  it('formats years', () => {
    expect(formatPhotoInterval('2024-01-01', '2026-07-01')).toBe('2 Jahre, 6 Monate')
  })
})
