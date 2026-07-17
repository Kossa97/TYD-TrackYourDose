import type { CycleSubstance, OngoingSubstance } from '../types'

export interface CycleLegendItem {
  name: string
  color: string
  filled: boolean
}

export function buildCycleLegendItems(
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[],
): CycleLegendItem[] {
  const legend = new Map<string, CycleLegendItem>()
  const substances = [
    ...cycles.map(cycle => ({ name: cycle.name, color: cycle.color, filled: true })),
    ...ongoing.map(substance => ({ name: substance.name, color: substance.color, filled: false })),
  ]

  for (const substance of substances) {
    const key = `${substance.name}|${substance.color}`
    const previous = legend.get(key)
    if (!previous) {
      legend.set(key, substance)
    } else {
      previous.filled = previous.filled || substance.filled
    }
  }

  return [...legend.values()]
}
