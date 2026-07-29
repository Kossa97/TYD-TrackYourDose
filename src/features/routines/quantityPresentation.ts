const fractionGlyphs: [number, string][] = [
  [0.5, '\u00BD'],
  [1 / 3, '\u2153'],
  [0.25, '\u00BC'],
]

export function formatTrackedQuantity(
  dose: number | null,
  unit: string | null,
  fallback: string,
): string {
  if (dose == null || !unit?.trim()) return fallback

  const fraction = fractionGlyphs.find(([value]) => Math.abs(dose - value) < 0.001)
  if (fraction) return `${fraction[1]} ${unit}`

  const formattedDose = dose.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  return `${formattedDose} ${unit}`
}
