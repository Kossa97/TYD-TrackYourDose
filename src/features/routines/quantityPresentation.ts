interface TrackedQuantity {
  dose: number | null
  unit: string | null
}

export function hasTrackedQuantity(
  quantity: TrackedQuantity,
): quantity is { dose: number; unit: string } {
  return quantity.dose != null && Boolean(quantity.unit?.trim())
}

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
  const quantity = { dose, unit }
  if (!hasTrackedQuantity(quantity)) return fallback

  const fraction = fractionGlyphs.find(([value]) => Math.abs(quantity.dose - value) < 0.001)
  if (fraction) return `${fraction[1]} ${quantity.unit}`

  const formattedDose = quantity.dose.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  return `${formattedDose} ${quantity.unit}`
}
