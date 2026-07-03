import { format } from 'date-fns'

export function hoverDateIso(label: number | string): string {
  return format(new Date(Number(label)), 'yyyy-MM-dd')
}

export function cycleStartsOnDate<T extends { startDate: string }>(bands: T[], dateIso: string): T[] {
  return bands.filter(b => b.startDate === dateIso)
}
