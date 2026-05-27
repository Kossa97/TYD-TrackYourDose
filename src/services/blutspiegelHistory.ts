// Lädt alle bestätigten Einnahmen eines Zyklus aus der Datenbank
// und gibt sie als sortierte Liste von { timestamp, dose, status } zurück.

import { format } from 'date-fns'
import { supabase } from '../lib/supabase'

export interface DoseEvent {
  timestamp: Date   // Zeitpunkt der Einnahme
  dose: number      // Dosis in der Einheit des Zyklus
  status: 'taken' | 'skipped'
}

interface CycleRow {
  peptide_id: string
  start_date: string
  end_date: string | null
  dose: number
  unit: string
}

interface DoseLogRow {
  logged_at: string
  dose: number | null
  taken: boolean
}

/**
 * Einnahme-Bestätigungen liegen in `dose_logs` (Spalte `taken`:
 * `true` = eingenommen, `false` = übersprungen, `null` = noch offen).
 * Verknüpfung zum Zyklus über `peptide_id` + Datumsbereich des Zyklus.
 */
export async function loadDoseHistory(cycleId: string): Promise<DoseEvent[]> {
  // 1. Zyklus laden
  const { data: cycle, error: cycleError } = await supabase
    .from('cycles')
    .select('peptide_id, start_date, end_date, dose, unit')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) return []

  const { peptide_id, start_date, end_date, dose: cycleDose } = cycle as CycleRow

  // Oberes Datum: end_date, aber höchstens heute wenn end_date fehlt oder in der Zukunft liegt
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const upperDate =
    !end_date || end_date > todayIso ? todayIso : end_date

  // 2. dose_logs laden
  const { data, error } = await supabase
    .from('dose_logs')
    .select('logged_at, dose, taken')
    .eq('peptide_id', peptide_id)
    .gte('logged_at', start_date)
    .lte('logged_at', `${upperDate}T23:59:59.999`)
    .not('taken', 'is', null)
    .order('logged_at', { ascending: true })

  if (error || !data) return []

  // 3. Mapping + 4. Rückgabe
  return (data as DoseLogRow[]).map((log) => ({
    timestamp: new Date(log.logged_at),
    dose: log.dose != null ? Number(log.dose) : Number(cycleDose),
    status: log.taken === true ? 'taken' as const : 'skipped' as const,
  }))
}

export interface BlutspiegelCurvePoint {
  time: Date
  level: number
}

function doseContributionAt(
  dose: number,
  bioavailability: number,
  deltaTHours: number,
  ke: number,
  ka: number,
): number {
  if (deltaTHours <= 0) return 0

  const scaled = dose * bioavailability
  if (Math.abs(ka - ke) < 1e-8) {
    return scaled * ka * deltaTHours * Math.exp(-ke * deltaTHours)
  }
  return scaled * (ka / (ka - ke)) * (Math.exp(-ke * deltaTHours) - Math.exp(-ka * deltaTHours))
}

/** Berechnet den Blutspiegel-Verlauf basierend auf echten Einnahme-Events. */
export function calculateHistoryBlutspiegelCurve(
  events: DoseEvent[],
  halfLifeHours: number,
  tmaxHours: number,
  bioavailability: number = 1.0,
  resolutionMinutes: number = 30,
): BlutspiegelCurvePoint[] {
  if (events.length === 0 || halfLifeHours <= 0 || tmaxHours <= 0 || resolutionMinutes <= 0) {
    return []
  }

  const ke = Math.LN2 / halfLifeHours
  const ka = Math.LN2 / tmaxHours
  const start = events[0].timestamp
  const end = new Date()

  if (start.getTime() > end.getTime()) return []

  const stepMs = resolutionMinutes * 60_000
  const raw: BlutspiegelCurvePoint[] = []

  for (let tMs = start.getTime(); tMs <= end.getTime(); tMs += stepMs) {
    let total = 0

    for (const event of events) {
      if (event.status !== 'taken') continue
      const deltaTHours = (tMs - event.timestamp.getTime()) / 3_600_000
      total += doseContributionAt(event.dose, bioavailability, deltaTHours, ke, ka)
    }

    raw.push({ time: new Date(tMs), level: Math.max(0, total) })
  }

  const peak = Math.max(...raw.map(p => p.level), 0)
  if (peak <= 0) {
    return raw.map(p => ({ time: p.time, level: 0 }))
  }

  return raw.map(p => ({
    time: p.time,
    level: Math.round((p.level / peak) * 1000) / 10,
  }))
}
