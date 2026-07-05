import type { DateRange } from '../types'
import { isInRange } from './substances'

export function filterDatesInRange<T extends { date: string }>(items: T[], range: DateRange): T[] {
  return items.filter(item => isInRange(item.date, range))
}

export function filterByDateRange<T>(
  items: T[],
  range: DateRange,
  getDate: (item: T) => string,
): T[] {
  return items.filter(item => isInRange(getDate(item), range))
}
