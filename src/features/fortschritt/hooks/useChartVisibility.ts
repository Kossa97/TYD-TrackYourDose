import { useCallback, useMemo, useState } from 'react'
import type { CycleSubstance, OngoingSubstance } from '../types'
import {
  ensureVisible,
  groupSubstancesByPeptide,
  groupVisibilityState,
  readStoredVisibleIds,
  reconcileVisibleChartIds,
  setGroupVisibility,
  toggleMemberVisibility,
  visibleIdsEqual,
  writeStoredVisibleIds,
  type SubstanceCycleGroup,
  type VisibleChartIds,
} from '../lib/chartVisibility'

function inventoryKey(cycles: CycleSubstance[], ongoing: OngoingSubstance[]): string {
  const c = cycles.map(x => x.id).sort().join(',')
  const o = ongoing.map(x => x.id).sort().join(',')
  return `${c}|${o}`
}

export function useChartVisibility(
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[],
) {
  const groups = useMemo(
    () => groupSubstancesByPeptide(cycles, ongoing),
    [cycles, ongoing],
  )

  const key = useMemo(() => inventoryKey(cycles, ongoing), [cycles, ongoing])

  const [storedSelection, setStoredSelection] = useState<string[] | null>(() => readStoredVisibleIds())

  const visibleIds = useMemo(
    () => reconcileVisibleChartIds(storedSelection, cycles, ongoing),
    [storedSelection, key, cycles, ongoing],
  )

  const persist = useCallback((next: VisibleChartIds) => {
    const arr = [...next].sort()
    setStoredSelection(arr)
    writeStoredVisibleIds(arr)
  }, [])

  const toggleGroup = useCallback((group: SubstanceCycleGroup) => {
    const state = groupVisibilityState(group, visibleIds)
    const next = setGroupVisibility(group, state !== 'all', visibleIds)
    if (!visibleIdsEqual(visibleIds, next)) persist(next)
  }, [persist, visibleIds])

  const toggleCycle = useCallback((id: string) => {
    const next = toggleMemberVisibility(id, visibleIds)
    if (!visibleIdsEqual(visibleIds, next)) persist(next)
  }, [persist, visibleIds])

  const showIds = useCallback((ids: string[]) => {
    const next = ensureVisible(ids, visibleIds)
    if (!visibleIdsEqual(visibleIds, next)) persist(next)
  }, [persist, visibleIds])

  return {
    groups,
    visibleIds,
    toggleGroup,
    toggleCycle,
    showIds,
  }
}
