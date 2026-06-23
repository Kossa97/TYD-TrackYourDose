// src/lib/peptideStock.ts
// Shared peptide vial-stock math, extracted from Dashboard so the injection
// tracker can debit stock on confirmation with identical behaviour.
import { format, parseISO } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface StockPeptide {
  vial_amount_mg: number | null
  reconstitution_ml: number | null
  reconstitution_date?: string | null
  vials_in_stock: number | null
  vials_initial: number | null
}

export function doseToVialDelta(dose: number, unit: string, peptide: StockPeptide): number | null {
  const normalizedUnit = unit.toLowerCase()
  if (normalizedUnit === 'ml') {
    if (!peptide.reconstitution_ml || peptide.reconstitution_ml <= 0) return null
    return dose / peptide.reconstitution_ml
  }
  if (!peptide.vial_amount_mg || peptide.vial_amount_mg <= 0) return null
  const doseMg = normalizedUnit === 'mcg'
    ? dose / 1000
    : normalizedUnit === 'mg'
      ? dose
      : null
  if (doseMg == null) return null
  return doseMg / peptide.vial_amount_mg
}

export function roundStock(value: number): number {
  return Math.round(value * 10000) / 10000
}

// Returns the next vials_in_stock value, or null when no change should apply
// (unknown delta, or crediting a dose that predates the current reconstitution).
export function computeNextVialStock(
  peptide: StockPeptide,
  dose: number,
  unit: string,
  mode: 'debit' | 'credit',
  loggedAt?: string,
): number | null {
  if (mode === 'credit' && loggedAt && peptide.reconstitution_date) {
    const logDay = format(parseISO(loggedAt), 'yyyy-MM-dd')
    const reconDay = format(parseISO(peptide.reconstitution_date), 'yyyy-MM-dd')
    if (logDay < reconDay) return null
  }
  const delta = doseToVialDelta(dose, unit, peptide)
  if (!delta || delta <= 0) return null

  const current = Number(peptide.vials_in_stock ?? 0)
  const maxStock = Number(peptide.vials_initial ?? 0)
  const next = mode === 'debit'
    ? Math.max(0, current - delta)
    : maxStock > 0
      ? Math.min(maxStock, current + delta)
      : current + delta
  return roundStock(next)
}

// Debit stock for a freshly-confirmed dose when the caller does not already hold
// the peptide in memory (e.g. the injection tracker). Best-effort: silently skips
// if the peptide can't be read or has no computable delta.
export async function debitPeptideStockForDoseById(
  supabase: SupabaseClient,
  userId: string,
  peptideId: string,
  dose: number,
  unit: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('peptides')
    .select('id, vial_amount_mg, reconstitution_ml, reconstitution_date, vials_in_stock, vials_initial')
    .eq('id', peptideId)
    .eq('user_id', userId)
    .single()
  if (error || !data) return
  const next = computeNextVialStock(data as StockPeptide, dose, unit, 'debit')
  if (next == null) return
  await supabase
    .from('peptides')
    .update({ vials_in_stock: next })
    .eq('id', peptideId)
    .eq('user_id', userId)
}
