import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
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
import { numeric } from '../lib/metrics'
import { collectPagedRows } from '../lib/pagination'
import { PHOTO_BUCKET, SIGNED_URL_TTL_SECONDS } from '../constants'

function mapDailyLogs(rows: Record<string, unknown>[] | null): DailyLogEntry[] {
  return (rows ?? []).map(row => ({
    log_date: String(row.log_date),
    energie: row.energie != null ? Number(row.energie) : null,
    schlaf: row.schlaf != null ? Number(row.schlaf) : null,
    wohlbefinden: row.wohlbefinden != null ? Number(row.wohlbefinden) : null,
    libido: row.libido != null ? Number(row.libido) : null,
    body_fat_pct: row.body_fat_pct != null ? Number(row.body_fat_pct) : null,
  }))
}

/** Legacy-Fotos tragen eine volle Public-URL; neue Fotos nur den Storage-Pfad. */
export function isLegacyPhotoUrl(photoUrl: string): boolean {
  return photoUrl.startsWith('http://') || photoUrl.startsWith('https://')
}

async function resolvePhotoDisplayUrls(
  photos: Omit<ProgressPhotoEntry, 'display_url'>[],
): Promise<ProgressPhotoEntry[]> {
  const paths = photos.filter(p => !isLegacyPhotoUrl(p.photo_url)).map(p => p.photo_url)
  const signed = new Map<string, string>()
  if (paths.length > 0) {
    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl)
    }
  }
  return photos.map(p => ({
    ...p,
    display_url: isLegacyPhotoUrl(p.photo_url) ? p.photo_url : (signed.get(p.photo_url) ?? ''),
  }))
}

export function useFortschrittData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [dataReady, setDataReady] = useState(false)
  const initialLoadedRef = useRef(false)
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

  // Volle Historie: ältester Substanz-Start oder ältester Datenpunkt → heute.
  // Basis für den „Alles"-Chip im Verlauf, damit auch beendete Zyklen und
  // Daten vor dem ersten aktiven Zyklus sichtbar bleiben.
  const fullRange = useMemo<DateRange>(() => {
    let from = range.from
    const consider = (d: string | null | undefined) => {
      if (!d) return
      const day = d.slice(0, 10)
      if (day < from) from = day
    }
    for (const c of cycleSubstances) consider(c.startDate)
    for (const o of ongoingSubstances) consider(o.startDate)
    for (const l of dailyLogs) consider(l.log_date)
    for (const w of weightLogs) consider(w.logged_at)
    for (const b of bloodwork) consider(b.tested_at)
    for (const p of photos) consider(p.taken_at)
    return { from, to: range.to }
  }, [range, cycleSubstances, ongoingSubstances, dailyLogs, weightLogs, bloodwork, photos])

  const load = useCallback(async () => {
    if (!user) return
    if (!initialLoadedRef.current) setLoading(true)

    const [cyclesRes, peptidesRes] = await Promise.all([
      supabase
        .from('cycles')
        .select('id, peptide_id, name, start_date, end_date, active, peptides(name)')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true }),
      supabase.from('peptides').select('id, name').eq('user_id', user.id),
    ])

    const cycles = normalizeCycles(cyclesRes.data as unknown as CycleRow[])
    setCycleSubstances(cycles)

    const activeRange = rangeFromActiveSubstances(cycles, ongoingSubstances)
    const toBound = `${activeRange.to}T23:59:59`

    const [dailyRes, weightRes, bloodRes, photoRes, doseRes] = await Promise.all([
      collectPagedRows((from, to) =>
        supabase
          .from('daily_logs')
          .select('log_date, energie, schlaf, wohlbefinden, libido, body_fat_pct')
          .eq('user_id', user.id)
          .lte('log_date', activeRange.to)
          .order('log_date', { ascending: true })
          .range(from, to),
      ),
      supabase
        .from('weight_logs')
        .select('id, logged_at, weight_kg')
        .eq('user_id', user.id)
        .lte('logged_at', toBound)
        .order('logged_at', { ascending: true }),
      supabase
        .from('bloodwork')
        .select('id, marker, value, unit, tested_at')
        .eq('user_id', user.id)
        .lte('tested_at', activeRange.to)
        .order('tested_at', { ascending: false }),
      supabase
        .from('progress_photos')
        .select('id, photo_url, taken_at, weight_kg, notes')
        .eq('user_id', user.id)
        .lte('taken_at', activeRange.to)
        .order('taken_at', { ascending: false }),
      supabase
        .from('dose_logs')
        .select('peptide_id, logged_at, taken')
        .eq('user_id', user.id)
        .lte('logged_at', toBound),
    ])

    const errors = [cyclesRes, peptidesRes, dailyRes, weightRes, bloodRes, photoRes, doseRes]
      .map(res => res.error)
      .filter(Boolean)
    if (errors.length > 0) {
      console.error('Fortschritt: Daten laden fehlgeschlagen', errors)
      toast.error('Fortschritt-Daten konnten nicht vollständig geladen werden')
    }

    setDailyLogs(mapDailyLogs(dailyRes.data))
    setWeightLogs(
      (weightRes.data ?? [])
        .map((row: { id: string; logged_at: string; weight_kg: number | string }) => ({
          id: String(row.id),
          logged_at: String(row.logged_at),
          weight_kg: numeric(row.weight_kg),
        }))
        .filter((row): row is { id: string; logged_at: string; weight_kg: number } => row.weight_kg != null),
    )
    setBloodwork(
      (bloodRes.data ?? [])
        .map((row: { id: string; marker: string; value: number | string; unit: string; tested_at: string }) => ({
          id: String(row.id),
          marker: String(row.marker),
          value: numeric(row.value) ?? 0,
          unit: String(row.unit ?? ''),
          tested_at: String(row.tested_at),
        }))
        .filter(row => row.value != null),
    )

    const rawPhotos = (photoRes.data ?? []).map((row: { id: string; photo_url: string; taken_at: string; weight_kg: number | string | null; notes: string | null }) => ({
      id: String(row.id),
      photo_url: String(row.photo_url),
      taken_at: String(row.taken_at),
      weight_kg: numeric(row.weight_kg),
      notes: row.notes ?? null,
    }))
    setPhotos(await resolvePhotoDisplayUrls(rawPhotos))

    setDoseLogs((doseRes.data ?? []) as DoseLogEntry[])

    const names = new Map<string, string>()
    for (const p of peptidesRes.data ?? []) {
      names.set(String(p.id), String(p.name))
    }
    setPeptideNames(names)
    initialLoadedRef.current = true
    setDataReady(true)
    setLoading(false)
  }, [ongoingSubstances, user])

  useEffect(() => {
    void load()
  }, [load])

  const state: FortschrittOverviewState = {
    loading,
    dataReady,
    range,
    fullRange,
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
