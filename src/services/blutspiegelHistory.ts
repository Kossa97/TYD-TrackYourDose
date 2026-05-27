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
