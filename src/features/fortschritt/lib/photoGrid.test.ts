import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  PHOTO_GRID_STORAGE_KEY,
  photoGridColumns,
  readPhotoGridSize,
  writePhotoGridSize,
} from './photoGrid'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('photo grid preferences', () => {
  test('maps small, medium, and large sizes to three, two, and one columns', () => {
    expect(photoGridColumns('small')).toBe(3)
    expect(photoGridColumns('medium')).toBe(2)
    expect(photoGridColumns('large')).toBe(1)
  })

  test('reads and writes a valid size and falls back to medium', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })

    expect(readPhotoGridSize()).toBe('medium')
    writePhotoGridSize('large')
    expect(values.get(PHOTO_GRID_STORAGE_KEY)).toBe('large')
    expect(readPhotoGridSize()).toBe('large')

    values.set(PHOTO_GRID_STORAGE_KEY, 'invalid')
    expect(readPhotoGridSize()).toBe('medium')
  })
})
