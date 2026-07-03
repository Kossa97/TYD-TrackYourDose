import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import type {
  BloodworkEntry,
  CycleRow,
  CycleSubstance,
  DailyLogEntry,
  DateRange,
  DoseLogEntry,
  FortschrittOverviewState,
  OngoingSubstance,
  ProgressPhotoEntry,
  WeightLogEntry,
} from '../types'
import { normalizeCycles, rangeFromActiveSubstances } from '../lib/substances'
import { extendedDataFrom } from '../lib/verlaufRange'
import { numeric } from '../lib/metrics'

function mapDailyLogs(rows: Record<string, unknown>[] | null): DailyLogEntry[] {
  return (rows ?? []).map(row => ({
    log_date: String(row.log_date),
    energie: row.energie != null ? Number(row.energie) : null,
    schlaf: row.schlaf != null ? Number(row.schlaf) : null,
    wohlbefinden: row.wohlbefinden != null
      ? Number(row.wohlbefinden)
      : (row.libido != null ? Number(row.libido) : null),
    libido: row.libido != null ? Number(row.libido) : null,
    body_fat_pct: row.body_fat_pct != null ? Number(row.body_fat_pct) : null,
  }))
}

export function useFortschrittData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [cycleSubstances, setCycleSubstances] = useState<CycleSubstance[]>([])
  const [ongoingSubstances] = useState<OngoingSubstance[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLogEntry[]>([])
  const [bloodwork, setBloodwork] = useState<BloodworkEntry[]>([])
  const [photos, setPhotos] = useState<ProgressPhotoEntry[]>([])
  const [doseLogs, setDoseLogs] = useState<DoseLogEntry[]>([])
  const [peptideNames, setPeptideNames] = useState<Map<string, string>>(new Map())

  const range = useMemo<DateRange>(
    () => rangeFromActiveSubstances(cycleSubstances, ongoingSubstances),
    [cycleSubstances, ongoingSubstances],
  )

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [{ data: cyclesData }, { data: peptidesData }] = await Promise.all([
      supabase
        .from('cycles')
        .select('id, peptide_id, name, start_date, end_date, active, peptides(name)')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('start_date', { ascending: true }),
      supabase.from('peptides').select('id, name').eq('user_id', user.id),
    ])

    const cycles = normalizeCycles(cyclesData as unknown as CycleRow[])
    setCycleSubstances(cycles)

    const activeRange = rangeFromActiveSubstances(cycles, ongoingSubstances)
    const dataFrom = extendedDataFrom([...cycles, ...ongoingSubstances])
    const toBound = `${activeRange.to}T23:59:59`

    const [
      { data: dailyData },
      { data: weightData },
      { data: bloodData },
      { data: photoData },
      { data: doseData },
    ] = await Promise.all([
      supabase
        .from('daily_logs')
        .select('log_date, energie, schlaf, wohlbefinden, libido, body_fat_pct')
        .eq('user_id', user.id)
        .gte('log_date', dataFrom)
        .lte('log_date', activeRange.to)
        .order('log_date', { ascending: true }),
      supabase
        .from('weight_logs')
        .select('logged_at, weight_kg')
        .eq('user_id', user.id)
        .gte('logged_at', dataFrom)
        .lte('logged_at', toBound)
        .order('logged_at', { ascending: true }),
      supabase
        .from('bloodwork')
        .select('id, marker, value, unit, tested_at')
        .eq('user_id', user.id)
        .gte('tested_at', dataFrom)
        .lte('tested_at', activeRange.to)
        .order('tested_at', { ascending: false }),
      supabase
        .from('progress_photos')
        .select('id, photo_url, taken_at, weight_kg, notes')
        .eq('user_id', user.id)
        .gte('taken_at', dataFrom)
        .lte('taken_at', activeRange.to)
        .order('taken_at', { ascending: false }),
      supabase
        .from('dose_logs')
        .select('peptide_id, logged_at, taken')
        .eq('user_id', user.id)
        .gte('logged_at', dataFrom)
        .lte('logged_at', toBound),
    ])

    setDailyLogs(mapDailyLogs(dailyData))
    setWeightLogs(
      (weightData ?? [])
        .map((row: { logged_at: string; weight_kg: number | string }) => ({
          logged_at: String(row.logged_at),
          weight_kg: numeric(row.weight_kg),
        }))
        .filter((row): row is WeightLogEntry => row.weight_kg != null),
    )
    setBloodwork(
      (bloodData ?? [])
        .map((row: { id: string; marker: string; value: number | string; unit: string; tested_at: string }) => ({
          id: String(row.id),
          marker: String(row.marker),
          value: numeric(row.value) ?? 0,
          unit: String(row.unit ?? ''),
          tested_at: String(row.tested_at),
        }))
        .filter(row => row.value != null),
    )
    setPhotos(
      (photoData ?? []).map((row: { id: string; photo_url: string; taken_at: string; weight_kg: number | string | null; notes: string | null }) => ({
        id: String(row.id),
        photo_url: String(row.photo_url),
        taken_at: String(row.taken_at),
        weight_kg: numeric(row.weight_kg),
        notes: row.notes ?? null,
      })),
    )
    setDoseLogs((doseData ?? []) as DoseLogEntry[])

    const names = new Map<string, string>()
    for (const p of peptidesData ?? []) {
      names.set(String(p.id), String(p.name))
    }
    setPeptideNames(names)
    setLoading(false)
  }, [ongoingSubstances, user])

  useEffect(() => {
    void load()
  }, [load])

  const state: FortschrittOverviewState = {
    loading,
    range,
    cycleSubstances,
    ongoingSubstances,
    dailyLogs,
    weightLogs,
    bloodwork,
    photos,
    doseLogs,
    peptideNames,
  }

  return { state, reload: load }
}
