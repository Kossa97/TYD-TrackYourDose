import type { StageFormSpec } from '../../stage/types'

// Classic break-off ampoule: rounded tip, broad head tapering into a soft
// constriction, conical shoulder, straight cylinder, flat base with a punt.
export const AMPOULE_OUTER_PATH = 'M60 7 C 66 7 68 12 68.5 18 C 70 30 74 44 77 58 C 79.5 69 80 76 79 82 C 78 88 74 90.5 72 95 C 70.5 98.5 71 103 74 107 C 80 115 88 122 91.5 130 C 93.6 135 94 140 94 146 L 94 262 C 94 272 89 277 80 277 L 40 277 C 31 277 26 272 26 262 L 26 146 C 26 140 26.4 135 28.5 130 C 32 122 40 115 46 107 C 49 103 49.5 98.5 48 95 C 46 90.5 42 88 41 82 C 40 76 40.5 69 43 58 C 46 44 50 30 51.5 18 C 52 12 54 7 60 7 Z'

// The inward-offset contour. It draws the glass wall thickness — the double
// line that separates a hollow body from a silhouette — and it clips the
// liquid, so a glass floor stays visible underneath.
export const AMPOULE_INNER_PATH = 'M60 11.5 C 64.4 11.5 64.9 14.4 65.4 19.2 C 66.8 31 70.9 45 73.8 59 C 76.1 69.6 76.6 76.1 75.7 81.6 C 74.8 87 71.1 89.6 69.1 94 C 67.7 97.4 68.1 101.9 70.9 105.8 C 76.7 113.7 84.9 120.7 88.4 130.9 C 90.4 135.8 90.6 140.8 90.6 146.6 L 90.6 261 C 90.6 269 86.6 273.4 79.2 273.4 L 40.8 273.4 C 33.4 273.4 29.4 269 29.4 261 L 29.4 146.6 C 29.4 140.8 29.6 135.8 31.6 130.9 C 35.1 120.7 43.3 113.7 49.1 105.8 C 51.9 101.9 52.3 97.4 50.9 94 C 48.9 89.6 45.2 87 44.3 81.6 C 43.4 76.1 43.9 69.6 46.2 59 C 49.1 45 53.2 31 54.6 19.2 C 55.1 14.4 55.6 11.5 60 11.5 Z'

// A sealed ampoule is never full to the brim. The head space is real, and it
// hands the surface the room it needs to slosh at all.
export const AMPOULE_FILL = 0.94

// Proportional label placement so the carousel and the detail view keep the
// same ratio: 99/146.7 and 247/365 both land here.
export const AMPOULE_LABEL = { topPct: 0.676, heightPct: 0.142 } as const

// The ampoule scales uniformly, so its viewBox aspect fixes its width.
export const AMPOULE_ASPECT = 72 / 274

export const AMPOULE_SPEC: StageFormSpec = {
  viewBox: { x: 24, y: 5, width: 72, height: 274 },
  // Only the straight cylinder. That keeps the chamber rectangular, so the
  // geometry needs no width profile for the conical neck — the same trick the
  // vial already uses.
  chamber: { x: 29.4, y: 146.6, width: 61.2, height: 126.8, aspect: 0.483 },
  hasMeaningfulFill: false,
}
