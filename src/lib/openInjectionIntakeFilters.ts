import type { OpenInjectionIntake } from './injectionPersistence'

export type IntakeHistoryDays = 7 | 14 | 30 | 60 | 90 | 'all'
export type IntakeSortOrder = 'newest' | 'oldest'

export interface OpenIntakeFilterOptions {
  cycleId: string
  days: IntakeHistoryDays
  order: IntakeSortOrder
}

const DEFAULT_OPTIONS: OpenIntakeFilterOptions = {
  cycleId: 'all',
  days: 7,
  order: 'newest',
}

export function filterOpenInjectionIntakes(
  intakes: OpenInjectionIntake[],
  options: Partial<OpenIntakeFilterOptions> = {},
): OpenInjectionIntake[] {
  const filters = { ...DEFAULT_OPTIONS, ...options }

  return intakes
    .filter(intake => filters.cycleId === 'all' || intake.cycleId === filters.cycleId)
    .filter(intake => filters.days === 'all' || intake.daysOverdue <= filters.days)
    .sort((a, b) => {
      const difference = new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      return filters.order === 'newest' ? difference : -difference
    })
}
