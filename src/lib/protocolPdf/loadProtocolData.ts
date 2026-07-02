// Eigenständiger Daten-Loader für den PDF-Generator. Lädt genau die Spalten,
// die das PDF braucht (inkl. Dosis/Methode/Frequenz der Zyklen), unabhängig
// vom Dashboard-State in Protokoll.tsx.

import { supabase } from '../supabase'
import type {
  ProtocolData,
  PdfDateRange,
  PdfProfile,
  PdfCycle,
} from './types'

// Supabase-Embeds können Objekt ODER Array sein — normalisieren.
function embedName(peptides: { name: string } | { name: string }[] | null | undefined): string | null {
  if (!peptides) return null
  return Array.isArray(peptides) ? (peptides[0]?.name ?? null) : peptides.name
}

interface CycleRow {
  id: string
  name: string
  peptide_id: string | null
  dose: number | null
  unit: string | null
  method: string | null
  frequency: string | null
  start_date: string
  end_date: string | null
  active: boolean
  peptides: { name: string } | { name: string }[] | null
}

const CYCLE_COLS =
  'id, name, peptide_id, dose, unit, method, frequency, start_date, end_date, active, peptides(name)'

function toCycle(row: CycleRow): PdfCycle {
  return {
    id: row.id,
    name: row.name,
    peptide_name: embedName(row.peptides),
    dose: row.dose,
    unit: row.unit,
    method: row.method,
    frequency: row.frequency,
    start_date: row.start_date,
    end_date: row.end_date,
    active: row.active,
  }
}

export async function loadProtocolData(userId: string, range: PdfDateRange): Promise<ProtocolData> {
  const toBound = `${range.to}T23:59:59`

  const [
    profileRes,
    activeRes,
    completedRes,
    weightRes,
    bloodRes,
    doseRes,
    effectRes,
    reviewRes,
    dailyRes,
    peptidesRes,
  ] = await Promise.all([
    supabase.from('profiles')
      .select('display_name, username, age, gender, height_cm, weight_kg')
      .eq('id', userId).maybeSingle(),
    supabase.from('cycles').select(CYCLE_COLS)
      .eq('user_id', userId).eq('active', true)
      .order('start_date', { ascending: false }),
    supabase.from('cycles').select(CYCLE_COLS)
      .eq('user_id', userId).eq('active', false)
      .order('start_date', { ascending: false }),
    supabase.from('weight_logs').select('logged_at, weight_kg')
      .eq('user_id', userId)
      .gte('logged_at', range.from).lte('logged_at', toBound)
      .order('logged_at', { ascending: true }),
    supabase.from('bloodwork').select('tested_at, marker, value, unit')
      .eq('user_id', userId)
      .gte('tested_at', range.from).lte('tested_at', range.to)
      .order('tested_at', { ascending: true }),
    supabase.from('dose_logs').select('peptide_id, logged_at, taken')
      .eq('user_id', userId)
      .gte('logged_at', range.from).lte('logged_at', toBound),
    supabase.from('effects').select('type, description, severity, occurred_at, peptides(name)')
      .eq('user_id', userId)
      .gte('occurred_at', range.from).lte('occurred_at', toBound)
      .order('occurred_at', { ascending: false }),
    supabase.from('reviews').select('rating, experience, peptides(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase.from('daily_logs').select('log_date, energie, schlaf, libido')
      .eq('user_id', userId)
      .gte('log_date', range.from).lte('log_date', range.to)
      .order('log_date', { ascending: true }),
    supabase.from('peptides').select('id, name').eq('user_id', userId),
  ])

  const cycles: PdfCycle[] = [
    ...((activeRes.data as CycleRow[] | null) ?? []).map(toCycle),
    ...((completedRes.data as CycleRow[] | null) ?? []).map(toCycle),
  ]

  const peptideNames = new Map<string, string>()
  for (const p of (peptidesRes.data as { id: string; name: string }[] | null) ?? []) {
    peptideNames.set(p.id, p.name)
  }

  return {
    profile: (profileRes.data as PdfProfile | null) ?? null,
    cycles,
    weightLogs: ((weightRes.data as { logged_at: string; weight_kg: number | string }[] | null) ?? [])
      .map(w => ({ logged_at: w.logged_at, weight_kg: Number(w.weight_kg) }))
      .filter(w => Number.isFinite(w.weight_kg)),
    bloodwork: ((bloodRes.data as { tested_at: string; marker: string; value: number | string; unit: string | null }[] | null) ?? [])
      .map(b => ({ tested_at: b.tested_at, marker: b.marker, value: b.value, unit: b.unit })),
    doseLogs: ((doseRes.data as { peptide_id: string | null; logged_at: string; taken: boolean | null }[] | null) ?? []),
    effects: ((effectRes.data as { type: 'effect' | 'side_effect'; description: string; severity: number; occurred_at: string; peptides: { name: string } | { name: string }[] | null }[] | null) ?? [])
      .map(e => ({
        type: e.type, description: e.description, severity: e.severity,
        occurred_at: e.occurred_at, peptide_name: embedName(e.peptides),
      })),
    reviews: ((reviewRes.data as { rating: number; experience: 'gut' | 'mittel' | 'schlecht' | null; peptides: { name: string } | { name: string }[] | null }[] | null) ?? [])
      .map(r => ({ rating: r.rating, experience: r.experience, peptide_name: embedName(r.peptides) })),
    dailyLogs: ((dailyRes.data as { log_date: string; energie: number | null; schlaf: number | null; libido: number | null }[] | null) ?? []),
    peptideNames,
  }
}
