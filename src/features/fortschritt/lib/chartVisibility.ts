import type { CycleSubstance, OngoingSubstance } from '../types'

export const CHART_VISIBILITY_STORAGE_KEY = 'tyd-fortschritt-chart-visible-ids'

export interface SubstanceCycleGroup {
  key: string
  name: string
  color: string
  cycles: CycleSubstance[]
  ongoing: OngoingSubstance | null
}

/** Alle sichtbaren Einträge im Chart (Zyklus- oder Ongoing-IDs). */
export type VisibleChartIds = Set<string>

export function groupSubstancesByPeptide(
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[],
): SubstanceCycleGroup[] {
  const groups = new Map<string, SubstanceCycleGroup>()

  for (const cycle of cycles) {
    const key = cycle.peptideId || cycle.name
    const existing = groups.get(key)
    if (existing) {
      existing.cycles.push(cycle)
    } else {
      groups.set(key, {
        key,
        name: cycle.name,
        color: cycle.color,
        cycles: [cycle],
        ongoing: null,
      })
    }
  }

  for (const item of ongoing) {
    const key = `ongoing:${item.id}`
    groups.set(key, {
      key,
      name: item.name,
      color: item.color,
      cycles: [],
      ongoing: item,
    })
  }

  for (const group of groups.values()) {
    group.cycles.sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  return [...groups.values()].sort((a, b) => {
    const aStart = a.cycles[0]?.startDate ?? a.ongoing?.startDate ?? ''
    const bStart = b.cycles[0]?.startDate ?? b.ongoing?.startDate ?? ''
    return aStart.localeCompare(bStart)
  })
}

/** Aktive zuerst (neueste oben), darunter beendete (neueste oben). */
export function partitionCyclesForDisplay(cycles: CycleSubstance[]): {
  active: CycleSubstance[]
  inactive: CycleSubstance[]
} {
  const active = cycles
    .filter(c => c.active)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  const inactive = cycles
    .filter(c => !c.active)
    .sort((a, b) => {
      const endA = a.endDate ?? a.startDate
      const endB = b.endDate ?? b.startDate
      return endB.localeCompare(endA)
    })
  return { active, inactive }
}

export function groupMemberIds(group: SubstanceCycleGroup): string[] {
  const ids = group.cycles.map(c => c.id)
  if (group.ongoing) ids.push(group.ongoing.id)
  return ids
}

/** Standard: nur aktive Zyklen + dauerhafte Substanzen. */
export function defaultVisibleChartIds(
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[],
): VisibleChartIds {
  const visible = new Set<string>()
  for (const o of ongoing) visible.add(o.id)
  for (const c of cycles.filter(c => c.active)) visible.add(c.id)
  return visible
}

export function allChartMemberIds(
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[],
): Set<string> {
  return new Set([
    ...cycles.map(c => c.id),
    ...ongoing.map(o => o.id),
  ])
}

/** Gespeicherte Auswahl mit aktuellen Daten abgleichen; neue Einträge erhalten Defaults. */
export function reconcileVisibleChartIds(
  stored: string[] | null,
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[],
): VisibleChartIds {
  const allIds = allChartMemberIds(cycles, ongoing)
  if (allIds.size === 0) return new Set()

  const defaults = defaultVisibleChartIds(cycles, ongoing)

  if (stored == null) {
    return new Set([...defaults].filter(id => allIds.has(id)))
  }

  const visible = new Set(stored.filter(id => allIds.has(id)))
  // Explizit leere Auswahl ([]) bleibt leer; nur bei gespeicherter Teilauswahl neue Defaults ergänzen.
  if (stored.length > 0) {
    for (const id of allIds) {
      if (!stored.includes(id) && defaults.has(id)) {
        visible.add(id)
      }
    }
  }
  return visible
}

export function readStoredVisibleIds(): string[] | null {
  try {
    const raw = localStorage.getItem(CHART_VISIBILITY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return null
  }
}

export function writeStoredVisibleIds(ids: Iterable<string>): void {
  try {
    localStorage.setItem(CHART_VISIBILITY_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Speicher voll oder privat — Auswahl bleibt session-lokal
  }
}

export function filterCyclesByVisibility(
  cycles: CycleSubstance[],
  visibleIds: VisibleChartIds,
): CycleSubstance[] {
  return cycles.filter(c => visibleIds.has(c.id))
}

export function filterOngoingByVisibility(
  ongoing: OngoingSubstance[],
  visibleIds: VisibleChartIds,
): OngoingSubstance[] {
  return ongoing.filter(o => visibleIds.has(o.id))
}

export type GroupVisibilityState = 'all' | 'none' | 'partial'

export function groupVisibilityState(
  group: SubstanceCycleGroup,
  visibleIds: VisibleChartIds,
): GroupVisibilityState {
  const members = groupMemberIds(group)
  if (members.length === 0) return 'none'
  const visibleCount = members.filter(id => visibleIds.has(id)).length
  if (visibleCount === 0) return 'none'
  if (visibleCount === members.length) return 'all'
  return 'partial'
}

export function setGroupVisibility(
  group: SubstanceCycleGroup,
  visible: boolean,
  current: VisibleChartIds,
): VisibleChartIds {
  const next = new Set(current)
  for (const id of groupMemberIds(group)) {
    if (visible) next.add(id)
    else next.delete(id)
  }
  return next
}

export function toggleMemberVisibility(
  id: string,
  current: VisibleChartIds,
): VisibleChartIds {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function ensureVisible(
  ids: string[],
  current: VisibleChartIds,
): VisibleChartIds {
  const next = new Set(current)
  for (const id of ids) next.add(id)
  return next
}

export function visibleIdsEqual(a: VisibleChartIds, b: VisibleChartIds): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}
