import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CycleSubstance, OngoingSubstance } from '../types'
import {
  ensureVisible,
  groupSubstancesByPeptide,
  groupVisibilityState,
  readStoredVisibleIds,
  reconcileVisibleChartIds,
  setGroupVisibility,
  toggleMemberVisibility,
  writeStoredVisibleIds,
  type SubstanceCycleGroup,
  type VisibleChartIds,
} from '../lib/chartVisibility'

export function useChartVisibility(
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[],
) {
  const groups = useMemo(
    () => groupSubstancesByPeptide(cycles, ongoing),
    [cycles, ongoing],
  )

  const [visibleIds, setVisibleIds] = useState<VisibleChartIds>(() =>
    reconcileVisibleChartIds(readStoredVisibleIds(), cycles, ongoing),
  )

  // Wenn sich die geladenen Zyklen ändern (Reload, neuer Zyklus), Auswahl abgleichen.
  useEffect(() => {
    setVisibleIds(prev => {
      const stored = [...prev]
      return reconcileVisibleChartIds(stored, cycles, ongoing)
    })
  }, [cycles, ongoing])

  const persist = useCallback((next: VisibleChartIds) => {
    setVisibleIds(next)
    writeStoredVisibleIds(next)
  }, [])

  const toggleGroup = useCallback((group: SubstanceCycleGroup) => {
    const state = groupVisibilityState(group, visibleIds)
    persist(setGroupVisibility(group, state !== 'all', visibleIds))
  }, [persist, visibleIds])

  const toggleCycle = useCallback((id: string) => {
    persist(toggleMemberVisibility(id, visibleIds))
  }, [persist, visibleIds])

  const showIds = useCallback((ids: string[]) => {
    persist(ensureVisible(ids, visibleIds))
  }, [persist, visibleIds])

  return {
    groups,
    visibleIds,
    toggleGroup,
    toggleCycle,
    showIds,
  }
}
