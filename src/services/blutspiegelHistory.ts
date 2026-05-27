// Lädt alle bestätigten Einnahmen eines Zyklus aus der Datenbank
// und gibt sie als sortierte Liste von { timestamp, dose, status } zurück.

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
}

interface DoseLogRow {
  logged_at: string
  dose: number
  taken: boolean
}

/**
 * Einnahme-Bestätigungen liegen in `dose_logs` (Spalte `taken`:
 * `true` = eingenommen, `false` = übersprungen, `null` = noch offen).
 * Verknüpfung zum Zyklus über `peptide_id` + Datumsbereich des Zyklus.
 */
export async function loadDoseHistory(cycleId: string): Promise<DoseEvent[]> {
  const { data: cycle, error: cycleError } = await supabase
    .from('cycles')
    .select('peptide_id, start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) return []

  const { peptide_id, start_date, end_date } = cycle as CycleRow

  let query = supabase
    .from('dose_logs')
    .select('logged_at, dose, taken')
    .eq('peptide_id', peptide_id)
    .gte('logged_at', start_date)
    .not('taken', 'is', null)
    .order('logged_at', { ascending: true })

  if (end_date) {
    query = query.lte('logged_at', `${end_date}T23:59:59.999`)
  }

  const { data, error } = await query

  if (error || !data) return []

  return (data as DoseLogRow[])
    .map((row) => ({
      timestamp: new Date(row.logged_at),
      dose: Number(row.dose),
      status: row.taken ? 'taken' as const : 'skipped' as const,
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}
