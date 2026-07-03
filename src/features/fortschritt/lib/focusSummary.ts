import { format, parseISO } from 'date-fns'
import type {
  ActiveSubstance,
  BloodworkEntry,
  CycleSubstance,
  DailyLogEntry,
  DateRange,
  DoseLogEntry,
  MetricKey,
  OngoingSubstance,
  WeightLogEntry,
} from '../types'
import { buildMetricSeries, computeAdherence, computeDelta, type SeriesPoint } from './metrics'
import { cycleEndDate, substanceDayCount, todayIso } from './substances'

export interface FocusSummaryRow {
  label: string
  from: string
  to: string
  delta: string
}

export interface FocusSummary {
  title: string
  subtitle: string
  rows: FocusSummaryRow[]
  adherence: string | null
  doseDetail: string | null
  note: string | null
}

function formatMetricValue(value: number, unit: string): string {
  if (unit === 'kg') return `${value} kg`
  if (unit === '%') return `${value}%`
  if (unit === '/10') return `${value}`
  return unit ? `${value} ${unit}` : String(value)
}

function formatDelta(delta: number, unit: string): string {
  const sign = delta > 0 ? '+' : ''
  if (unit === 'kg') return `${sign}${delta} kg`
  if (unit === '%') return `${sign}${delta}%`
  if (unit === '/10') return `${sign}${delta}`
  return `${sign}${delta}`
}

function pointsInWindow(points: SeriesPoint[], from: string, to: string): SeriesPoint[] {
  return points.filter(p => p.date >= from && p.date <= to)
}

function summaryRow(label: string, points: SeriesPoint[], unit: string): FocusSummaryRow | null {
  const delta = computeDelta(points)
  if (!delta) return null
  return {
    label,
    from: formatMetricValue(delta.from, unit),
    to: formatMetricValue(delta.to, unit),
    delta: formatDelta(delta.delta, unit),
  }
}

export function buildFocusSummary(
  substance: ActiveSubstance,
  chartRange: DateRange,
  weights: WeightLogEntry[],
  dailyLogs: DailyLogEntry[],
  bloodwork: BloodworkEntry[],
  doseLogs: DoseLogEntry[],
  peptideNames: Map<string, string>,
): FocusSummary {
  const duringFrom = substance.startDate
  const duringTo = substance.mode === 'cycle' && substance.endDate && !substance.active
    ? substance.endDate
    : todayIso()

  const rows: FocusSummaryRow[] = []
  const metricDefs: { key: MetricKey; label: string; unit: string }[] = [
    { key: 'weight', label: 'Gewicht', unit: 'kg' },
    { key: 'energie', label: 'Energie', unit: '/10' },
    { key: 'schlaf', label: 'Schlaf', unit: '/10' },
    { key: 'wohlbefinden', label: 'Wohlbefinden', unit: '/10' },
  ]

  for (const def of metricDefs) {
    const all = buildMetricSeries(def.key, chartRange, weights, dailyLogs, bloodwork)
    const during = pointsInWindow(all, duringFrom, duringTo)
    const row = summaryRow(def.label, during, def.unit)
    if (row) rows.push(row)
  }

  const igf = buildMetricSeries('IGF-1', chartRange, weights, dailyLogs, bloodwork)
  const igfDuring = pointsInWindow(igf, duringFrom, duringTo)
  const igfRow = summaryRow('IGF-1', igfDuring, 'ng/mL')
  if (igfRow) rows.push(igfRow)

  let adherence: string | null = null
  let doseDetail: string | null = null
  if (substance.mode === 'cycle') {
    const adh = computeAdherence(
      doseLogs.filter(d => d.peptide_id === substance.peptideId),
      { from: duringFrom, to: duringTo },
      peptideNames,
    )
    if (adh.overall != null) {
      adherence = `${adh.overall}%`
      doseDetail = `${adh.taken} von ${adh.total} Dosen`
    }
  }

  const days = substanceDayCount(substance)
  const isActive = substance.mode === 'cycle' ? substance.active : true
  const endLabel = substance.mode === 'cycle' && substance.endDate
    ? format(parseISO(`${substance.endDate}T00:00:00`), 'dd.MM.')
    : 'offen'

  return {
    title: substance.name,
    subtitle: isActive
      ? `${format(parseISO(`${substance.startDate}T00:00:00`), 'dd.MM.')} – ${endLabel} · Tag ${days}${isActive ? ' · aktiv' : ''}`
      : `${format(parseISO(`${substance.startDate}T00:00:00`), 'dd.MM.')} – ${endLabel} · ${days} Tage`,
    rows,
    adherence,
    doseDetail,
    note: rows.length === 0 ? 'Noch keine Werte in diesem Zeitraum. Logge mit + Heute.' : null,
  }
}

export function substanceBarEnd(substance: ActiveSubstance): string {
  if (substance.mode === 'cycle') return cycleEndDate(substance)
  return todayIso()
}

export function allSubstances(
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[],
): ActiveSubstance[] {
  return [...cycles, ...ongoing]
}

/** Älteste aktive Substanz — Standard-Fokus für Wellness-Vergleich */
export function defaultFocusSubstanceId(
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[],
): string | null {
  const sorted = [...allSubstances(cycles, ongoing)].sort((a, b) => a.startDate.localeCompare(b.startDate))
  return sorted[0]?.id ?? null
}
