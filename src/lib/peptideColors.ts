export const PEPTIDE_COLORS = [
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#34d399', // emerald
  '#f97316', // orange
  '#60a5fa', // blue
  '#fb7185', // rose
  '#2dd4bf', // teal
  '#facc15', // yellow
  '#c084fc', // violet-light
  '#4ade80', // green
]

export function getPeptideColor(index: number): string {
  if (index < 0) return '#64748b'
  return PEPTIDE_COLORS[index % PEPTIDE_COLORS.length]
}

export function getRandomPeptideColor(random: () => number = Math.random): string {
  const index = Math.min(PEPTIDE_COLORS.length - 1, Math.floor(random() * PEPTIDE_COLORS.length))
  return PEPTIDE_COLORS[Math.max(0, index)]
}
