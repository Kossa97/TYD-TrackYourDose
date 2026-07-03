import type { FortschrittTab } from './types'

export const FORTSCHRITT_TABS: { key: FortschrittTab; label: string }[] = [
  { key: 'uebersicht', label: 'Übersicht' },
  { key: 'verlauf', label: 'Verlauf' },
  { key: 'fotos', label: 'Fotos' },
  { key: 'labs', label: 'Labs' },
]

export const METRIC_THRESHOLDS = {
  weight_kg: 0.3,
  wellness: 0.5,
  body_fat_pct: 0.3,
  lab_relative: 0.05,
} as const

export const MIN_POINTS_FOR_TREND = 3
export const MIN_POINTS_FOR_SPARKLINE = 3
export const MIN_POINTS_FOR_DELTA = 2
export const MAX_TOP_CHANGES = 3
export const MAX_VISIBLE_SUBSTANCES = 5

export const WELLNESS_FIELDS = ['energie', 'schlaf', 'wohlbefinden', 'libido'] as const
