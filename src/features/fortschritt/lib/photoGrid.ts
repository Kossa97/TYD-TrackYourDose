export type PhotoGridSize = 'small' | 'medium' | 'large'

export const PHOTO_GRID_STORAGE_KEY = 'peptid-tracker:foto-grid-size'

export const PHOTO_GRID_OPTIONS: ReadonlyArray<{ value: PhotoGridSize; label: string }> = [
  { value: 'small', label: 'Klein' },
  { value: 'medium', label: 'Mittel' },
  { value: 'large', label: 'Groß' },
]

const isPhotoGridSize = (value: string | null): value is PhotoGridSize =>
  value === 'small' || value === 'medium' || value === 'large'

export function photoGridColumns(size: PhotoGridSize): number {
  if (size === 'small') return 3
  if (size === 'large') return 1
  return 2
}

export function readPhotoGridSize(): PhotoGridSize {
  try {
    const value = typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(PHOTO_GRID_STORAGE_KEY)
    return isPhotoGridSize(value) ? value : 'medium'
  } catch {
    return 'medium'
  }
}

export function writePhotoGridSize(size: PhotoGridSize): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PHOTO_GRID_STORAGE_KEY, size)
    }
  } catch {
    // Local storage may be unavailable in private or restricted contexts.
  }
}
