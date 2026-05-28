import { supabase } from '../lib/supabase'
import {
  loadDoseHistory,
  calculateHistoryBlutspiegelCurve,
} from './blutspiegelHistory'

// ── Public types ────────────────────────────────────────────────────────────

export interface ChartPoint {
  timestamp: number   // Unix ms
  level: number       // 0–100 (normalised)
}

export interface DoseMarker {
  timestamp: number
  dose: number
  unit: string
  status: 'taken' | 'skipped'
}

export interface PeakMarker {
  timestamp: number
  level: number
}

export interface CycleChartData {
  cycleId: string
  peptideName: string
  accent: string
  points: ChartPoint[]
  doseMarkers: DoseMarker[]
  peakMarkers: PeakMarker[]
  unit: string
  halfLifeHours: number
}

// ── Internals ───────────────────────────────────────────────────────────────

const CATEGORY_ACCENT: Record<string, string> = {
  peptide: '#00ccf5',
  glp1:    '#10b981',
  hormone: '#f59e0b',
  sarm:    '#a855f7',
  other:   '#94a3b8',
}

interface PkRow {
  half_life_hours: number
  tmax_hours: number
  bioavailability_sc: number
  category: string
}

interface CycleRow {
  id: string
  unit: string
  peptides: {
    name: string
    pk_profiles: PkRow | null
  } | null
}

/** Local maxima with level > 20, de-duplicated within 1 h. */
function detectPeaks(pts: ChartPoint[]): PeakMarker[] {
  const peaks: PeakMarker[] = []
  for (let i = 1; i < pts.length - 1; i++) {
    const { level, timestamp } = pts[i]
    if (level > pts[i - 1].level && level > pts[i + 1].level && level > 20) {
      const last = peaks[peaks.length - 1]
      if (!last || timestamp - last.timestamp >= 60 * 60_000) {
        peaks.push({ timestamp, level })
      }
    }
  }
  return peaks
}

// ── Public loader ────────────────────────────────────────────────────────────

export async function loadAllCycleChartData(userId: string): Promise<CycleChartData[]> {
  const { data: cycles } = await supabase
    .from('cycles')
    .select(`id, unit,
      peptides ( name,
        pk_profiles ( half_life_hours, tmax_hours, bioavailability_sc, category )
      )`)
    .eq('user_id', userId)
    .eq('active', true)

  if (!cycles?.length) return []

  const results: CycleChartData[] = []

  await Promise.all(
    (cycles as unknown as CycleRow[]).map(async cycle => {
      const pk = cycle.peptides?.pk_profiles
      if (!pk) return

      const events = await loadDoseHistory(cycle.id)
      if (!events.some(e => e.status === 'taken')) return

      // 15-min resolution for smooth canvas rendering
      const curveRaw = calculateHistoryBlutspiegelCurve(
        events, pk.half_life_hours, pk.tmax_hours, pk.bioavailability_sc, 15,
      )
      const points: ChartPoint[] = curveRaw.map(p => ({
        timestamp: p.time.getTime(),
        level:     p.level,
      }))

      const doseMarkers: DoseMarker[] = events.map(ev => ({
        timestamp: ev.timestamp.getTime(),
        dose:      ev.dose,
        unit:      cycle.unit,
        status:    ev.status,
      }))

      results.push({
        cycleId:      cycle.id,
        peptideName:  cycle.peptides?.name ?? '?',
        accent:       CATEGORY_ACCENT[pk.category] ?? '#94a3b8',
        points,
        doseMarkers,
        peakMarkers:  detectPeaks(points),
        unit:         cycle.unit,
        halfLifeHours: pk.half_life_hours,
      })
    }),
  )

  return results
}
