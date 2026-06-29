import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { OpenInjectionIntake } from './injectionPersistence'
import type { InjectionLog3D } from './injectionLogTypes'

export type InjectionTrackerTab = 'overview' | 'open' | 'history'

export const INJECTION_TRACKER_TABS: InjectionTrackerTab[] = ['overview', 'open', 'history']

export function formatInjectionTrackerTabCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

export interface InjectionTrackerSummaryInput {
  logs: InjectionLog3D[]
  openIntakes: OpenInjectionIntake[]
  now: Date
  recentDays?: number
}

export interface InjectionTrackerSummary {
  openIntakeCount: number
  confirmedIntakeCount: number
  pendingSiteCount: number
  recentLogCount: number
  latestLog: InjectionLog3D | null
  lastUsedDaysAgo: number | null
}

function daysAgo(now: Date, isoDate: string): number {
  return differenceInCalendarDays(now, parseISO(isoDate))
}

export function buildInjectionTrackerSummary({
  logs,
  openIntakes,
  now,
  recentDays = 7,
}: InjectionTrackerSummaryInput): InjectionTrackerSummary {
  const latestLog = [...logs]
    .sort((a, b) => parseISO(b.logged_at).getTime() - parseISO(a.logged_at).getTime())[0] ?? null

  return {
    openIntakeCount: openIntakes.filter(intake => intake.status === 'open').length,
    confirmedIntakeCount: openIntakes.filter(intake => intake.status === 'confirmed').length,
    pendingSiteCount: openIntakes.length,
    recentLogCount: logs.filter(log => {
      const age = daysAgo(now, log.logged_at)
      return age >= 0 && age <= recentDays
    }).length,
    latestLog,
    lastUsedDaysAgo: latestLog ? daysAgo(now, latestLog.logged_at) : null,
  }
}
