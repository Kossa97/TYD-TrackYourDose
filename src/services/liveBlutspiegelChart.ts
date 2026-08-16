import { supabase } from '../lib/supabase'
import {
  loadDoseHistory,
  calculateHistoryBlutspiegelCurve,
} from './blutspiegelHistory'
import { evaluatePkReadiness } from '../features/my-stack/lib/pkReadiness'
import type { TrackingLevel } from '../features/my-stack/types'

// ── Public types ────────────────────────────────────────────────────────────

export interface ChartPoint {
  timestamp: number   // Unix ms
  level: number       // 0–100 (normalised)
  status: 'actual' | 'planned'
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
  interruptedAt: number | null
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
  dose: number | null
  unit: string | null
  method: string | null
  intake_time_custom: string | null
  stack_items: {
    id: string
    display_name: string
    tracking_level: TrackingLevel
    pk_profile_method: string | null
    ingredients: Array<{
      position: number
      substance_catalog: {
        pk_profile_id: string | null
        pk_profiles: PkRow | null
      } | null
    }>
  } | null
}

function linkedProfile(cycle: CycleRow): { id: string; profile: PkRow } | null {
  const links = cycle.stack_items?.ingredients
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(ingredient => ingredient.substance_catalog)
    .filter((catalog): catalog is NonNullable<typeof catalog> => Boolean(catalog)) ?? []
  const link = links.find(catalog => catalog.pk_profile_id && catalog.pk_profiles)
  return link?.pk_profile_id && link.pk_profiles
    ? { id: link.pk_profile_id, profile: link.pk_profiles }
    : null
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
    .select(`id, dose, unit, method, intake_time_custom,
      stack_items ( id, display_name, tracking_level, pk_profile_method,
        ingredients:stack_item_ingredients ( position,
          substance_catalog ( pk_profile_id,
            pk_profiles ( half_life_hours, tmax_hours, bioavailability_sc, category )
          )
        )
      )`)
    .eq('user_id', userId)
    .eq('active', true)

  if (!cycles?.length) return []

  const results: CycleChartData[] = []

  await Promise.all(
    (cycles as unknown as CycleRow[]).map(async cycle => {
      const linked = linkedProfile(cycle)
      const readiness = evaluatePkReadiness({
        trackingLevel: cycle.stack_items?.tracking_level ?? 'intake_only',
        pkProfileId: linked?.id ?? null,
        pkProfileMethod: cycle.stack_items?.pk_profile_method ?? null,
        method: cycle.method,
        dose: cycle.dose,
        unit: cycle.unit,
        scheduledAt: cycle.intake_time_custom,
      })
      if (readiness.status !== 'ready' || !linked) return
      const pk = linked.profile

      const { events, interruptedAt } = await loadDoseHistory(cycle.id)
      if (!events.some(e => e.status === 'taken')) return

      // 15-min resolution for smooth canvas rendering
      const curveRaw = calculateHistoryBlutspiegelCurve(
        events,
        pk.half_life_hours,
        pk.tmax_hours,
        pk.bioavailability_sc,
        15,
        interruptedAt ? new Date(interruptedAt) : null,
      )
      const points: ChartPoint[] = curveRaw.map(p => ({
        timestamp: p.time.getTime(),
        level:     p.level,
        status:    p.status,
      }))

      const doseMarkers: DoseMarker[] = events.map(ev => ({
        timestamp: ev.timestamp.getTime(),
        dose:      ev.dose,
        unit:      ev.unit,
        status:    ev.status === 'skipped' ? 'skipped' : 'taken',
      }))

      results.push({
        cycleId:      cycle.id,
        peptideName:  cycle.stack_items?.display_name ?? '?',
        accent:       CATEGORY_ACCENT[pk.category] ?? '#94a3b8',
        points,
        doseMarkers,
        peakMarkers:  detectPeaks(points),
        unit:         cycle.unit!,
        halfLifeHours: pk.half_life_hours,
        interruptedAt: interruptedAt ? new Date(interruptedAt).getTime() : null,
      })
    }),
  )

  return results
}
