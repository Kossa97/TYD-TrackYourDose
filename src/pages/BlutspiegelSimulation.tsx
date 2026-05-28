import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ComposedChart, Scatter, AreaChart,
} from 'recharts'
import { format } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'
import { Activity, Info, Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  calculateHistoryBlutspiegelCurve,
  getCurrentBlutspiegelLevel,
  loadDoseHistory,
  type BlutspiegelCurvePoint,
  type BlutspiegelTrend,
  type CurrentBlutspiegelLevel,
  type DoseEvent,
} from '../services/blutspiegelHistory'

// ── Typen ─────────────────────────────────────────────────────────────────

interface PkProfile {
  id: string
  name: string
  aliases: string[]
  half_life_hours: number
  tmax_hours: number
  bioavailability_sc: number
  vd_l_kg: number
  notes: string | null
  category: string
}

interface PkProfileEmbed {
  name: string
  half_life_hours: number
  tmax_hours: number
  bioavailability_sc: number
  category: string
}

interface ProtocolCycle {
  id: string
  peptide_id: string
  dose: number
  unit: string
  method: string
  peptides: {
    name: string
    pk_profile_id: string | null
    pk_profiles: PkProfileEmbed | null
  } | null
}

type PkCategory = 'peptide' | 'glp1' | 'hormone' | 'sarm' | 'other'

const CATEGORY_ACCENT: Record<PkCategory, string> = {
  peptide: '#00ccf5',
  glp1: '#10b981',
  hormone: '#f59e0b',
  sarm: '#a855f7',
  other: '#94a3b8',
}

const TREND_META: Record<BlutspiegelTrend, { label: string; icon: string; color: string }> = {
  rising:  { label: 'Steigend', icon: '↑', color: '#10b981' },
  falling: { label: 'Fallend',  icon: '↓', color: '#f43f5e' },
  stable:  { label: 'Stabil',   icon: '→', color: '#94a3b8' },
}

function normCat(raw: string | undefined): PkCategory {
  if (raw === 'peptide' || raw === 'glp1' || raw === 'hormone' || raw === 'sarm') return raw
  return 'other'
}

function normalizeUnit(unit: string): 'mg' | 'mcg' | 'IU' {
  const u = unit.trim().toLowerCase()
  if (u === 'mg') return 'mg'
  if (u === 'iu') return 'IU'
  return 'mcg'
}

function methodToRoute(method: string): 'SC' | 'IM' | 'oral' {
  const m = method.trim().toLowerCase()
  if (m.includes('intramuskul')) return 'IM'
  if (m === 'oral' || m.includes('oral')) return 'oral'
  return 'SC'
}

// ── PK-Mathematik ─────────────────────────────────────────────────────────

/**
 * 1-Compartment Modell mit First-Order-Absorption (normalisiert auf % von Peak).
 * Formel: C(t) = (F × ka / (ka − ke)) × (e^−ke×t − e^−ka×t)
 * ke = ln2 / t½, ka = ln2 / Tmax (Approximation per Spec)
 */
function computeSingleDose(
  profile: PkProfile,
  tStart: number,
  tEnd: number,
  steps: number,
): { rawT: number[]; rawC: number[] } {
  const ke = Math.LN2 / profile.half_life_hours
  const ka = Math.LN2 / profile.tmax_hours
  const F  = profile.bioavailability_sc
  const dt = (tEnd - tStart) / steps
  const rawT: number[] = []
  const rawC: number[] = []

  for (let i = 0; i <= steps; i++) {
    const t = tStart + i * dt
    let c: number
    if (t <= 0) {
      c = 0
    } else if (Math.abs(ka - ke) < 1e-8) {
      // Degenerate: ka ≈ ke → use limit
      c = F * ka * t * Math.exp(-ke * t)
    } else {
      c = F * (ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t))
    }
    rawT.push(t)
    rawC.push(Math.max(0, c))
  }
  return { rawT, rawC }
}

interface ChartPoint { t: number; c: number }

interface PkResult {
  data: ChartPoint[]
  tmaxActual: number
  peakPct: number
  t10: number
  accumFactor: number
}

function runSimulation(
  profile: PkProfile,
  multiDose: boolean,
  intervalH: number,
  numDoses: number,
): PkResult {
  const steps  = 300
  const xMax   = profile.half_life_hours * 5

  const { rawT, rawC } = computeSingleDose(profile, 0, xMax, steps)

  let concentrations: number[]

  if (multiDose && intervalH > 0 && numDoses > 1) {
    const keM = Math.LN2 / profile.half_life_hours
    const kaM = Math.LN2 / profile.tmax_hours
    const FM  = profile.bioavailability_sc
    concentrations = rawT.map((t) => {
      let total = 0
      for (let d = 0; d < numDoses; d++) {
        const tShifted = t - d * intervalH
        if (tShifted < 0) continue
        if (Math.abs(kaM - keM) < 1e-8) {
          total += FM * kaM * tShifted * Math.exp(-keM * tShifted)
        } else {
          total += Math.max(0, FM * (kaM / (kaM - keM)) * (Math.exp(-keM * tShifted) - Math.exp(-kaM * tShifted)))
        }
      }
      return Math.max(0, total)
    })
  } else {
    concentrations = rawC
  }

  const peak     = Math.max(...concentrations)
  const peakIdx  = concentrations.indexOf(peak)
  const tmaxActual = rawT[peakIdx] ?? profile.tmax_hours
  const pctArr   = concentrations.map(c => (peak > 0 ? (c / peak) * 100 : 0))

  // Zeit bis <10% (nach dem Peak)
  let t10 = xMax
  for (let i = peakIdx; i < rawT.length; i++) {
    if (pctArr[i] < 10) { t10 = rawT[i]; break }
  }

  // Akkumulationsfaktor: nur relevant bei Mehrfachdosis
  let accumFactor = 1
  if (multiDose && numDoses > 1) {
    const { rawC: singleC } = computeSingleDose(profile, 0, xMax, steps)
    const singlePeak = Math.max(...singleC)
    accumFactor = singlePeak > 0 ? peak / singlePeak : 1
  }

  const data: ChartPoint[] = rawT.map((t, i) => ({
    t: Math.round(t * 10) / 10,
    c: Math.round(pctArr[i] * 10) / 10,
  }))

  return { data, tmaxActual, peakPct: 100, t10, accumFactor }
}

// ── Design-Tokens ──────────────────────────────────────────────────────────

const PANEL = {
  background: 'linear-gradient(145deg, rgba(9,14,34,0.94), rgba(4,7,18,0.96))',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  padding: 16,
} as const

const LABEL = {
  fontSize: '0.6rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(154,170,191,0.60)',
  display: 'block',
  marginBottom: 6,
} as const

const INPUT = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#eaeefc',
  fontSize: '0.88rem',
  fontWeight: 700,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
} as const

// ── UI-Hilfen (Erklärungsebene) ────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 4 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Mehr Infos"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, padding: 0, border: 'none', background: 'transparent',
          color: '#00ccf5', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Info size={14} strokeWidth={2.5} />
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', zIndex: 50, left: '50%', bottom: 'calc(100% + 8px)',
            transform: 'translateX(-50%)', width: 'max(200px, 14vw)', maxWidth: 260,
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(7,9,26,0.98)', border: '1px solid rgba(0,204,245,0.22)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            fontSize: '0.72rem', fontWeight: 500, lineHeight: 1.5,
            color: 'rgba(213,224,242,0.88)', pointerEvents: 'none',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}

function FieldLabel({ children, tip }: { children: string; tip: string }) {
  return (
    <label style={{ ...LABEL, display: 'flex', alignItems: 'center', marginBottom: 6 }}>
      <span>{children}</span>
      <InfoTip text={tip} />
    </label>
  )
}

function PkChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(7,9,26,0.96)', border: '1px solid rgba(0,204,245,0.25)', borderRadius: 10, padding: '8px 12px' }}>
      <p style={{ fontSize: '0.7rem', color: 'rgba(154,170,191,0.6)', marginBottom: 3 }}>Nach {label} Stunden</p>
      <p style={{ fontSize: '0.9rem', fontWeight: 900, color: '#00ccf5' }}>{payload[0].value}% Wirkstoffspiegel</p>
    </div>
  )
}

function levelAtTime(curve: BlutspiegelCurvePoint[], time: Date): number {
  if (!curve.length) return 0
  const t = time.getTime()
  let best = curve[0]
  let bestDiff = Math.abs(best.time.getTime() - t)
  for (const p of curve) {
    const d = Math.abs(p.time.getTime() - t)
    if (d < bestDiff) { bestDiff = d; best = p }
  }
  return best.level
}

function HistoryChartTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ payload?: { ts: number; level: number } }>
}) {
  if (!active || !payload?.[0]?.payload) return null
  const { ts, level } = payload[0].payload
  const d = new Date(ts)
  return (
    <div style={{
      background: 'rgba(7,9,26,0.97)', border: '1px solid rgba(0,204,245,0.22)',
      borderRadius: 12, padding: '10px 14px', minWidth: 140,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(154,170,191,0.55)', marginBottom: 1 }}>
        {format(d, 'EEE, dd. MMM yyyy', { locale: deLocale })}
      </p>
      <p style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(154,170,191,0.75)', marginBottom: 6 }}>
        {format(d, 'HH:mm', { locale: deLocale })} Uhr
      </p>
      <p style={{ fontSize: '1.1rem', fontWeight: 900, color: '#00ccf5', letterSpacing: '-0.02em' }}>
        {typeof level === 'number' ? level.toFixed(1) : level}
        <span style={{ fontSize: '0.72rem', fontWeight: 700, marginLeft: 3 }}>%</span>
      </p>
      <p style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.4)', marginTop: 2 }}>Wirkstoffspiegel</p>
    </div>
  )
}

const METRIC_EXPLANATIONS = {
  peak: {
    title: 'Peak-Konzentration',
    explain: 'Der höchste Wirkstoffspiegel in deinem Blut. Zu diesem Zeitpunkt ist die Wirkung am stärksten.',
  },
  tmax: {
    title: 'Zeit bis zum Peak (Tmax)',
    explain: 'So lange dauert es nach der Injektion, bis der Wirkstoff seinen Höchstwert erreicht.',
  },
  halfLife: {
    title: 'Halbwertzeit',
    explain: 'Nach dieser Zeit ist die Hälfte des Wirkstoffs abgebaut. Nach 2 Halbwertzeiten sind es 75 %, nach 5 Halbwertzeiten ist der Wirkstoff praktisch weg.',
  },
  duration: {
    title: 'Wirkungsdauer',
    explain: 'Geschätzte Zeit, bis der Spiegel unter 10 % fällt — ab hier ist die Wirkung vernachlässigbar.',
  },
  accum: {
    title: 'Akkumulationsfaktor',
    explain: 'Zeigt, wie stark sich der Wirkstoff bei regelmäßiger Einnahme im Körper ansammelt. Wert 2,0 bedeutet: Nach mehreren Dosen ist der Spiegel doppelt so hoch wie nach der ersten Injektion.',
  },
} as const

// ── Live-Zyklus-Karte ─────────────────────────────────────────────────────

function LiveCycleCard({
  cycleId,
  peptideName,
  pk,
  level,
  accent,
}: {
  cycleId: string
  peptideName: string
  pk: PkProfileEmbed
  level: CurrentBlutspiegelLevel | undefined
  accent: string
}) {
  const [curve, setCurve]               = useState<BlutspiegelCurvePoint[]>([])
  const [events, setEvents]             = useState<DoseEvent[]>([])
  const [curveLoading, setCurveLoading] = useState(true)
  const [windowOffsetHours, setWindowOffsetHours] = useState(0)
  const chartRef    = useRef<HTMLDivElement>(null)
  const panStartX   = useRef<number | null>(null)
  const panStartOff = useRef(0)
  const isPanning   = useRef(false)
  const rafId       = useRef<number | null>(null)

  // Einmaliges Laden der Einnahmen + Kurvenberechnung
  useEffect(() => {
    setCurveLoading(true)
    void loadDoseHistory(cycleId).then(evts => {
      setEvents(evts)
      if (evts.some(e => e.status === 'taken')) {
        setCurve(calculateHistoryBlutspiegelCurve(
          evts, pk.half_life_hours, pk.tmax_hours, pk.bioavailability_sc,
        ))
      }
      setCurveLoading(false)
    })
  }, [cycleId, pk.half_life_hours, pk.tmax_hours, pk.bioavailability_sc])

  // Live-Wachstum: Kurve jede Minute bis "jetzt" erweitern (kein DB-Call)
  useEffect(() => {
    if (!events.some(e => e.status === 'taken')) return
    const id = window.setInterval(() => {
      setCurve(calculateHistoryBlutspiegelCurve(
        events, pk.half_life_hours, pk.tmax_hours, pk.bioavailability_sc,
      ))
    }, 60_000)
    return () => window.clearInterval(id)
  }, [events, pk.half_life_hours, pk.tmax_hours, pk.bioavailability_sc])

  // Volle Kurve als Chart-Daten (ungefiltert — Recharts clipped via XAxis domain)
  const chartData = useMemo(
    () => curve.map(p => ({ ts: p.time.getTime(), level: p.level })),
    [curve],
  )

  // 7-Tage-Sichtfenster
  const windowDomain = useMemo((): [number, number] => {
    if (!chartData.length) return [0, 0]
    const dataEnd   = chartData[chartData.length - 1].ts
    const dataStart = chartData[0].ts
    const wEnd   = dataEnd - windowOffsetHours * 3_600_000
    const wStart = wEnd - WINDOW_HOURS * 3_600_000
    return [Math.max(dataStart, wStart), Math.min(dataEnd, wEnd)]
  }, [chartData, windowOffsetHours])

  // Tages-Ticks (alle 24h für 7-Tage-Fenster)
  const tickList = useMemo(() => {
    const [s, e] = windowDomain
    if (s === 0 && e === 0) return []
    const tickMs = 24 * 3_600_000  // 1 Tag
    const result: number[] = []
    const first = Math.ceil(s / tickMs) * tickMs
    for (let t = first; t <= e; t += tickMs) result.push(t)
    return result
  }, [windowDomain])

  // Einnahme-Marker (nur im sichtbaren Fenster, für Scatter)
  const visibleIntakeMarkers = useMemo(
    () => events
      .filter(ev => ev.status === 'taken'
        && ev.timestamp.getTime() >= windowDomain[0]
        && ev.timestamp.getTime() <= windowDomain[1])
      .map(ev => ({ ts: ev.timestamp.getTime(), level: levelAtTime(curve, ev.timestamp) })),
    [events, curve, windowDomain],
  )

  // Peak-Marker: für jede Einnahme der theoretische Peak-Zeitpunkt (tmax nach Einnahme)
  const visiblePeakMarkers = useMemo(
    () => events
      .filter(ev => ev.status === 'taken')
      .map(ev => {
        const peakTs = ev.timestamp.getTime() + pk.tmax_hours * 3_600_000
        return { ts: peakTs, level: levelAtTime(curve, new Date(peakTs)) }
      })
      .filter(m => m.ts >= windowDomain[0] && m.ts <= windowDomain[1]),
    [events, curve, pk.tmax_hours, windowDomain],
  )

  const maxOffset = useMemo(() => {
    if (!chartData.length) return 0
    return Math.max(0, (chartData[chartData.length - 1].ts - chartData[0].ts) / 3_600_000 - WINDOW_HOURS)
  }, [chartData])

  // Wochentag + Datum für X-Achse
  const formatTick = useCallback(
    (ts: number) => format(new Date(ts), 'EEE\ndd.', { locale: deLocale }),
    [],
  )

  const handlePanStart = useCallback((clientX: number) => {
    isPanning.current = true
    panStartX.current = clientX
    panStartOff.current = windowOffsetHours
  }, [windowOffsetHours])

  // Aktiengraph-Style: Daten folgen dem Finger 1:1, live während des Wischens.
  // Wischen nach rechts (dx>0) zeigt die Vergangenheit → Offset steigt.
  const handlePanMove = useCallback((clientX: number) => {
    if (!isPanning.current || panStartX.current === null || !chartData.length) return
    const dx = clientX - panStartX.current
    if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      const width = chartRef.current?.offsetWidth ?? 320
      const deltaH = (dx / width) * WINDOW_HOURS
      setWindowOffsetHours(Math.max(0, Math.min(maxOffset, panStartOff.current + deltaH)))
    })
  }, [chartData.length, maxOffset])

  const handlePanEnd = useCallback(() => {
    // Da wo der Finger aufhört, bleibt das Fenster stehen — kein Snap, kein Momentum.
    isPanning.current = false
    panStartX.current = null
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [])

  const trend    = level ? TREND_META[level.trend] : TREND_META.stable
  const hasCurve = curve.length > 0

  return (
    <div style={{
      background: `linear-gradient(145deg, ${accent}0d, rgba(6,10,24,0.92))`,
      border: `1px solid ${accent}28`,
      borderRadius: 18,
      padding: '14px 14px 12px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: accent, opacity: 0.06, filter: 'blur(24px)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '0.92rem', fontWeight: 850, color: '#f8fbff', marginBottom: 4 }}>{peptideName}</p>
          <span style={{
            fontSize: '0.55rem', padding: '2px 7px', borderRadius: 99,
            background: `${accent}18`, color: accent, fontWeight: 800,
            border: `1px solid ${accent}30`, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {pk.category}
          </span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {level ? (
            <>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: accent, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {level.currentLevel.toFixed(1)}<span style={{ fontSize: '1rem' }}>%</span>
              </p>
              <p style={{ fontSize: '0.6rem', fontWeight: 800, color: trend.color, marginTop: 2, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                {trend.icon} {trend.label.toUpperCase()}
              </p>
            </>
          ) : (
            <Loader2 size={20} color={accent} className="animate-spin" />
          )}
        </div>
      </div>

      {/* Chart-Bereich */}
      <div style={{ margin: '0 -2px 10px' }}>
        {curveLoading ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={16} color={accent} className="animate-spin" />
          </div>
        ) : hasCurve ? (
          <>
            {/* Nav-Zeile */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <p style={{ fontSize: '0.52rem', color: 'rgba(154,170,191,0.38)', fontFamily: 'monospace' }}>
                7-Tage-Fenster · → wischen für Verlauf
              </p>
              {windowOffsetHours > 0 && (
                <button
                  type="button"
                  onClick={() => setWindowOffsetHours(0)}
                  style={{
                    fontSize: '0.52rem', fontWeight: 800, color: accent,
                    background: `${accent}15`, border: `1px solid ${accent}25`,
                    borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Jetzt ↩
                </button>
              )}
            </div>

            {/* Fortschrittsbalken */}
            {maxOffset > 0 && (
              <div style={{ height: 2, borderRadius: 99, background: 'rgba(255,255,255,0.06)', marginBottom: 5, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, background: accent,
                  width: `${Math.round((1 - windowOffsetHours / maxOffset) * 100)}%`,
                }} />
              </div>
            )}

            {/* Legende */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span style={{ fontSize: '0.5rem', color: 'rgba(154,170,191,0.45)' }}>Einnahme</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                <span style={{ fontSize: '0.5rem', color: 'rgba(154,170,191,0.45)' }}>Peak</span>
              </div>
            </div>

            {/* Wisch-Container — voller chartData, XAxis clippt auf windowDomain */}
            <div
              style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}
              onPointerDown={e => {
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                handlePanStart(e.clientX)
              }}
              onPointerMove={e => handlePanMove(e.clientX)}
              onPointerUp={handlePanEnd}
              onPointerCancel={handlePanEnd}
            >
              <div ref={chartRef}>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 6, right: 8, left: 2, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id={`liveGrad-${cycleId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={accent} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />

                    <XAxis
                      dataKey="ts"
                      type="number"
                      scale="time"
                      domain={windowDomain}
                      ticks={tickList}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tick={{ fill: 'rgba(154,170,191,0.5)', fontSize: 9 }}
                      tickFormatter={formatTick}
                      interval={0}
                    />

                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'rgba(154,170,191,0.5)', fontSize: 9 }}
                      tickFormatter={v => `${v}%`}
                      width={38}
                      label={{
                        value: 'Spiegel %',
                        angle: -90,
                        position: 'insideLeft',
                        offset: 8,
                        fill: 'rgba(154,170,191,0.35)',
                        fontSize: 8,
                      }}
                    />

                    <Tooltip
                      content={<HistoryChartTooltip />}
                      cursor={{ stroke: `${accent}55`, strokeWidth: 1, strokeDasharray: '4 2' }}
                    />

                    <Area
                      type="monotone"
                      dataKey="level"
                      stroke={accent}
                      strokeWidth={2}
                      fill={`url(#liveGrad-${cycleId})`}
                      dot={false}
                      activeDot={{ r: 4, fill: '#07091a', stroke: accent, strokeWidth: 2 }}
                      isAnimationActive={false}
                    />

                    {/* Einnahme-Marker (grün) */}
                    <Scatter
                      data={visibleIntakeMarkers}
                      dataKey="level"
                      fill="#10b981"
                      stroke="#07091a"
                      strokeWidth={1.5}
                      r={5}
                      isAnimationActive={false}
                    />

                    {/* Peak-Marker nach jeder Einnahme (orange) */}
                    <Scatter
                      data={visiblePeakMarkers}
                      dataKey="level"
                      fill="#f59e0b"
                      stroke="#07091a"
                      strokeWidth={1.5}
                      r={4}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          /* Fallback: noch keine bestätigten Einnahmen */
          <>
            <ResponsiveContainer width="100%" height={60}>
              <AreaChart
                data={(level?.sparkData ?? Array(20).fill(0)).map((v, i) => ({ i, v }))}
                margin={{ top: 4, right: 2, bottom: 0, left: 2 }}
              >
                <defs>
                  <linearGradient id={`spk-${cycleId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={accent} stopOpacity={0.38} />
                    <stop offset="95%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={accent} fill={`url(#spk-${cycleId})`} dot={false} strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
            <p style={{ fontSize: '0.52rem', color: 'rgba(154,170,191,0.35)', textAlign: 'center', marginTop: 6 }}>
              Einnahmen im Kalender bestätigen für vollständigen Verlauf
            </p>
          </>
        )}
      </div>

      {/* Stats 3er-Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'Nächste Dosis', value: level?.nextDoseIn ?? '—', color: '#eaeefc' },
          { label: 'Level danach',  value: level ? `~${level.levelAfterNextDose.toFixed(0)}%` : '—', color: accent },
          { label: 'Peak',          value: level?.peakLabel ?? '—', color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '7px 8px' }}>
            <p style={{ fontSize: '0.52rem', color: 'rgba(154,170,191,0.5)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            <p style={{ fontSize: '0.82rem', fontWeight: 900, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* PK-Parameter */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {([
          { k: 'T½',   v: `${pk.half_life_hours}h`, tip: 'Halbwertzeit — nach dieser Zeit sind 50% abgebaut' },
          { k: 'Tmax', v: `${pk.tmax_hours}h`,       tip: 'Zeit bis zum Peak nach der Injektion' },
          { k: 'F',    v: `${Math.round(pk.bioavailability_sc * 100)}%`, tip: 'Bioverfügbarkeit — wie viel tatsächlich wirkt' },
        ] as const).map(({ k, v, tip }) => (
          <div key={k} title={tip} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'help' }}>
            <span style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.45)', fontFamily: 'monospace' }}>{k}:</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(213,224,242,0.7)' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const WINDOW_HOURS = 7 * 24 // 7 Tage

// ── Haupt-Komponente ───────────────────────────────────────────────────────

export function BlutspiegelSimulation() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const pkFromUrl = searchParams.get('pk')

  const [pkProfiles, setPkProfiles]       = useState<PkProfile[]>([])
  const [protocolCycles, setProtocolCycles] = useState<ProtocolCycle[]>([])
  const [selectedPkId, setSelectedPkId]   = useState('')
  const [dose, setDose]                   = useState('')
  const [unit, setUnit]                   = useState<'mg' | 'mcg' | 'IU'>('mcg')
  const [route, setRoute]                 = useState<'SC' | 'IM' | 'oral'>('SC')
  const [multiDose, setMultiDose]         = useState(false)
  const [interval, setInterval]           = useState('8')
  const [numDoses, setNumDoses]           = useState('3')
  const [simResult, setSimResult]         = useState<PkResult | null>(null)

  // Live-Übersicht für alle aktiven Zyklen
  const [liveData, setLiveData]           = useState<Map<string, CurrentBlutspiegelLevel>>(new Map())
  const [liveLoading, setLiveLoading]     = useState(false)
  const [liveRefreshing, setLiveRefreshing] = useState(false)
  const liveIntervalRef = useRef<number | null>(null)

  // Lade PK-Profile
  useEffect(() => {
    supabase.from('pk_profiles').select('*').order('name').then(({ data }) => {
      const profiles = (data as PkProfile[]) ?? []
      setPkProfiles(profiles)
      if (pkFromUrl && profiles.some(p => p.id === pkFromUrl)) {
        setSelectedPkId(pkFromUrl)
      } else if (profiles.length > 0) {
        setSelectedPkId(profiles[0].id)
      }
    })
  }, [pkFromUrl])

  useEffect(() => {
    if (!user) return
    supabase
      .from('cycles')
      .select(`id, peptide_id, dose, unit, method,
        peptides ( name, pk_profile_id,
          pk_profiles ( name, half_life_hours, tmax_hours, bioavailability_sc, category )
        )`)
      .eq('user_id', user.id)
      .eq('active', true)
      .then(({ data }) => {
        setProtocolCycles((data as unknown as ProtocolCycle[]) ?? [])
      })
  }, [user])

  const selectedProfile = useMemo(
    () => pkProfiles.find(p => p.id === selectedPkId) ?? null,
    [pkProfiles, selectedPkId],
  )

  // ── Live-Übersicht: alle Zyklen mit PK-Profil laden ───────────────────
  const loadLiveLevels = useCallback(async (isRefresh = false) => {
    const cyclesWithPk = protocolCycles.filter(c => c.peptides?.pk_profiles)
    if (!cyclesWithPk.length) return
    if (isRefresh) setLiveRefreshing(true)
    else setLiveLoading(true)

    const results = await Promise.all(
      cyclesWithPk.map(async c => {
        const pk = c.peptides!.pk_profiles!
        const level = await getCurrentBlutspiegelLevel(
          c.id,
          pk.half_life_hours,
          pk.tmax_hours,
          pk.bioavailability_sc,
        )
        return [c.id, level] as [string, CurrentBlutspiegelLevel]
      })
    )
    setLiveData(new Map(results))
    if (isRefresh) setLiveRefreshing(false)
    else setLiveLoading(false)
  }, [protocolCycles])

  // Initial laden sobald Zyklen da sind
  useEffect(() => {
    if (protocolCycles.length > 0) void loadLiveLevels()
  }, [protocolCycles, loadLiveLevels])

  // Auto-Refresh alle 5 Sekunden
  useEffect(() => {
    if (liveIntervalRef.current) window.clearInterval(liveIntervalRef.current)
    const cyclesWithPk = protocolCycles.filter(c => c.peptides?.pk_profiles)
    if (!cyclesWithPk.length) return
    liveIntervalRef.current = window.setInterval(() => void loadLiveLevels(true), 5000)
    return () => { if (liveIntervalRef.current) window.clearInterval(liveIntervalRef.current) }
  }, [protocolCycles, loadLiveLevels])

  // Auto-fill Dosis aus aktivem Zyklus wenn Peptid-Name übereinstimmt
  useEffect(() => {
    if (!selectedProfile) return
    const profileNames = [selectedProfile.name, ...selectedProfile.aliases].map(n => n.toLowerCase())
    const match = protocolCycles.find(c =>
      profileNames.includes(c.peptides?.name?.toLowerCase() ?? '')
    )
    if (match) { setDose(String(match.dose)); setUnit(normalizeUnit(match.unit)) }
  }, [selectedProfile, protocolCycles])

  const startSimulation = useCallback(() => {
    if (!selectedProfile) return
    const result = runSimulation(
      selectedProfile,
      multiDose,
      Number(interval),
      Math.min(10, Math.max(1, Number(numDoses))),
    )
    setSimResult(result)
  }, [selectedProfile, multiDose, interval, numDoses])

  // X-Achsen Ticks
  const xTicks = useMemo(() => {
    if (!selectedProfile) return []
    const max = selectedProfile.half_life_hours * 5
    const step = max > 40 ? 10 : max > 20 ? 5 : max > 10 ? 2 : 1
    const ticks: number[] = []
    for (let t = 0; t <= max; t += step) ticks.push(Math.round(t * 10) / 10)
    return ticks
  }, [selectedProfile])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>

      {/* Header */}
      <div style={{ ...PANEL, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 88% 10%, rgba(0,204,245,0.15), transparent 34%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(0,204,245,0.74)', marginBottom: 4 }}>
            Pharmakokinetik
          </p>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#f8fbff', lineHeight: 1.05 }}>
            Blutspiegel-Simulation
          </h1>
          <p style={{ fontSize: '0.72rem', color: 'rgba(213,224,242,0.52)', marginTop: 5, lineHeight: 1.5 }}>
            Sieh auf einen Blick, wann dein Peptid wirkt und wann es wieder abgebaut ist
          </p>
        </div>
      </div>

      {/* ── Live-Übersicht aller aktiven Zyklen ─────────────────────────── */}
      {(liveLoading || protocolCycles.filter(c => c.peptides?.pk_profiles).length > 0) && (
        <div style={PANEL}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: liveLoading ? 0 : 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0,
                display: 'inline-block',
                animation: 'liveBlutPulse 1.5s ease-in-out infinite',
              }} />
              <style>{`@keyframes liveBlutPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
              <p style={{ fontSize: '0.85rem', fontWeight: 850, color: '#eaeefc' }}>Live-Blutspiegel</p>
              <span style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.5)', fontFamily: 'monospace', fontWeight: 700 }}>
                · alle 5s
              </span>
            </div>
            {liveRefreshing && <Loader2 size={14} color="#00ccf5" className="animate-spin" />}
          </div>

          {liveLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', justifyContent: 'center' }}>
              <Loader2 size={18} color="#00ccf5" className="animate-spin" />
              <p style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.6)' }}>
                Live-Spiegel wird berechnet…
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {protocolCycles
                .filter(c => c.peptides?.pk_profiles)
                .map(c => {
                  const pk = c.peptides!.pk_profiles!
                  const accent = CATEGORY_ACCENT[normCat(pk.category)]
                  return (
                    <LiveCycleCard
                      key={c.id}
                      cycleId={c.id}
                      peptideName={c.peptides!.name}
                      pk={pk}
                      level={liveData.get(c.id)}
                      accent={accent}
                    />
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Manuelle Simulation */}
      <div style={PANEL}>
        <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#eaeefc', marginBottom: 2 }}>Manuelle Simulation</p>
        <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.45)', marginBottom: 14, lineHeight: 1.5 }}>
          Simuliere den theoretischen Verlauf einer Einzeldosis — wähle Substanz, Dosis und Route.
          Die Werte sind Schätzungen auf Basis pharmakologischer Durchschnittsdaten.
        </p>

        {/* Peptid-Auswahl */}
        <div style={{ marginBottom: 12 }}>
          <FieldLabel
            tip="Wähle den Wirkstoff, den du simulieren möchtest. Die pharmakokinetischen Daten (Halbwertzeit, Tmax) werden automatisch geladen."
          >
            Peptid
          </FieldLabel>
          {pkProfiles.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.45)', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
              Noch keine PK-Profile hinterlegt. Im Admin-Panel hinzufügen.
            </p>
          ) : (
            <select
              value={selectedPkId}
              onChange={e => setSelectedPkId(e.target.value)}
              style={INPUT}
            >
              {pkProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name} — T½ {p.half_life_hours}h</option>
              ))}
            </select>
          )}
        </div>

        {/* Dosis + Einheit */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 12 }}>
          <div>
            <FieldLabel
              tip="Die Menge, die du injizierst. Tipp: Schau in deinen aktiven Zyklus für deine übliche Dosis."
            >
              Dosis
            </FieldLabel>
            <input
              type="number"
              inputMode="decimal"
              placeholder="z.B. 250"
              value={dose}
              onChange={e => setDose(e.target.value)}
              style={INPUT}
            />
          </div>
          <div>
            <FieldLabel
              tip="mcg = Mikrogramm (kleiner), mg = Milligramm (größer), IU = Internationale Einheiten (für HGH/HCG)"
            >
              Einheit
            </FieldLabel>
            <select value={unit} onChange={e => setUnit(e.target.value as 'mg' | 'mcg' | 'IU')} style={{ ...INPUT, width: 'auto' }}>
              <option>mcg</option>
              <option>mg</option>
              <option>IU</option>
            </select>
          </div>
          <div>
            <FieldLabel
              tip="SC = subkutan (unter die Haut, langsamer), IM = intramuskulär (in den Muskel, etwas schneller)"
            >
              Applikationsroute
            </FieldLabel>
            <select value={route} onChange={e => setRoute(e.target.value as 'SC' | 'IM' | 'oral')} style={{ ...INPUT, width: 'auto' }}>
              <option>SC</option>
              <option>IM</option>
              <option>oral</option>
            </select>
          </div>
        </div>

        {/* Mehrfachdosis Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: multiDose ? 12 : 0 }}>
          <div>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#eaeefc' }}>Mehrfachdosis simulieren</p>
            <p style={{ fontSize: '0.65rem', color: 'rgba(154,170,191,0.5)', marginTop: 2 }}>Zeigt Akkumulation über mehrere Gaben</p>
          </div>
          <button
            onClick={() => setMultiDose(v => !v)}
            style={{
              width: 44, height: 24, borderRadius: 99,
              background: multiDose ? '#00ccf5' : 'rgba(255,255,255,0.12)',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
              left: multiDose ? 23 : 3,
            }} />
          </button>
        </div>

        {multiDose && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={LABEL}>Dosierungsintervall (h)</label>
              <input type="number" value={interval} onChange={e => setInterval(e.target.value)} style={INPUT} />
            </div>
            <div>
              <label style={LABEL}>Anzahl Dosen (max 10)</label>
              <input type="number" min="2" max="10" value={numDoses} onChange={e => setNumDoses(e.target.value)} style={INPUT} />
            </div>
          </div>
        )}

        <button
          onClick={startSimulation}
          disabled={!selectedProfile}
          style={{
            width: '100%', marginTop: 14, padding: '12px 0', borderRadius: 14,
            background: selectedProfile ? 'rgba(0,204,245,0.16)' : 'rgba(255,255,255,0.05)',
            border: selectedProfile ? '1px solid rgba(0,204,245,0.32)' : '1px solid rgba(255,255,255,0.08)',
            color: selectedProfile ? '#00ccf5' : 'rgba(154,170,191,0.3)',
            fontSize: '0.9rem', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: selectedProfile ? 'pointer' : 'not-allowed', transition: 'all 0.18s',
          }}
        >
          <Activity size={16} /> Simulation starten
        </button>
      </div>

      {/* Chart */}
      {simResult && selectedProfile && (
        <>
          <div style={{ ...PANEL, paddingBottom: 20 }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#eaeefc', marginBottom: 4 }}>
              Blutspiegel-Kurve — {selectedProfile.name}
            </p>
            <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.45)', marginBottom: 14 }}>
              Relativer Wirkstoffspiegel in % (normalisiert auf Peak = 100 %)
            </p>

            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={simResult.data} margin={{ top: 36, right: 12, left: 8, bottom: 28 }}>
                <defs>
                  <linearGradient id="pkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00ccf5" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#00ccf5" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

                <XAxis
                  dataKey="t"
                  ticks={xTicks}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'rgba(154,170,191,0.45)', fontSize: 10 }}
                  tickFormatter={v => `${v}h`}
                  label={{
                    value: 'Zeit nach Injektion (Stunden)',
                    position: 'insideBottom',
                    offset: -4,
                    fill: 'rgba(154,170,191,0.55)',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <YAxis
                  domain={[0, 105]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'rgba(154,170,191,0.45)', fontSize: 10 }}
                  tickFormatter={v => `${v}%`}
                  ticks={[0, 25, 50, 75, 100]}
                  label={{
                    value: 'Wirkstoffspiegel (%)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 12,
                    fill: 'rgba(154,170,191,0.55)',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />

                <Tooltip content={<PkChartTooltip />} cursor={{ stroke: 'rgba(0,204,245,0.3)', strokeWidth: 1 }} />

                {/* Tmax — Peak */}
                <ReferenceLine
                  x={Math.round(simResult.tmaxActual * 10) / 10}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: '⚡ Peak — maximale Wirkung',
                    position: 'insideTopLeft',
                    fill: '#f59e0b',
                    fontSize: 8,
                    fontWeight: 700,
                  }}
                />

                {/* Halbwertzeit */}
                <ReferenceLine
                  x={selectedProfile.half_life_hours}
                  stroke="#8b5cf6"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: '½ Halbwertzeit — halbe Menge abgebaut',
                    position: 'insideTop',
                    fill: '#a78bfa',
                    fontSize: 8,
                    fontWeight: 700,
                  }}
                />

                {/* Ende der Wirkung <10% */}
                {simResult.t10 < selectedProfile.half_life_hours * 5 && (
                  <ReferenceLine
                    x={Math.round(simResult.t10 * 10) / 10}
                    stroke="rgba(255,255,255,0.28)"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{
                      value: '🔚 Wirkungsende',
                      position: 'insideTopRight',
                      fill: 'rgba(255,255,255,0.55)',
                      fontSize: 8,
                      fontWeight: 700,
                    }}
                  />
                )}

                {/* 10% Referenzlinie horizontal */}
                <ReferenceLine y={10} stroke="rgba(255,255,255,0.10)" strokeDasharray="2 4" />

                <Area
                  type="monotone"
                  dataKey="c"
                  stroke="#00ccf5"
                  strokeWidth={2.5}
                  fill="url(#pkGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#07091a', stroke: '#00ccf5', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legende Referenzlinien */}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { color: '#f59e0b', label: '⚡ Peak — maximale Wirkung' },
                { color: '#8b5cf6', label: '½ Halbwertzeit' },
                { color: 'rgba(255,255,255,0.35)', label: '🔚 Wirkungsende' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 16, height: 1.5, background: color, borderRadius: 1 }} />
                  <span style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.55)', fontWeight: 700 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info-Box — Werte erklärt */}
          <div style={PANEL}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#eaeefc', marginBottom: 12 }}>
              Deine Ergebnisse — einfach erklärt
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  ...METRIC_EXPLANATIONS.peak,
                  value: '100 %',
                  color: '#00ccf5',
                },
                {
                  ...METRIC_EXPLANATIONS.tmax,
                  value: `${Math.round(simResult.tmaxActual * 10) / 10} Stunden`,
                  color: '#f59e0b',
                },
                {
                  ...METRIC_EXPLANATIONS.halfLife,
                  value: `${selectedProfile.half_life_hours} Stunden`,
                  color: '#a78bfa',
                },
                {
                  ...METRIC_EXPLANATIONS.duration,
                  value: simResult.t10 < selectedProfile.half_life_hours * 5
                    ? `${Math.round(simResult.t10 * 10) / 10} Stunden`
                    : `über ${Math.round(selectedProfile.half_life_hours * 5)} Stunden`,
                  color: 'rgba(213,224,242,0.75)',
                },
                ...(multiDose
                  ? [{
                      ...METRIC_EXPLANATIONS.accum,
                      value: `${simResult.accumFactor.toFixed(2)}×`,
                      color: '#10b981',
                    }]
                  : []),
              ].map(({ title, value, explain, color }) => (
                <div
                  key={title}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 14,
                    padding: '14px 16px',
                  }}
                >
                  <p style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(154,170,191,0.65)', marginBottom: 4 }}>
                    {title}
                  </p>
                  <p style={{ fontSize: '1.35rem', fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 8 }}>
                    {value}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'rgba(213,224,242,0.58)', lineHeight: 1.55 }}>
                    {explain}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* PK-Parameter des gewählten Profils */}
          <div style={{ ...PANEL }}>
            <p style={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(154,170,191,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
              PK-Parameter — {selectedProfile.name}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { k: 'Halbwertzeit', v: `${selectedProfile.half_life_hours} h` },
                { k: 'Tmax (Profil)', v: `${selectedProfile.tmax_hours} h` },
                { k: 'Bioverfügbarkeit', v: `${Math.round(selectedProfile.bioavailability_sc * 100)} %` },
                { k: 'Vd', v: `${selectedProfile.vd_l_kg} L/kg` },
                { k: 'Kategorie', v: selectedProfile.category },
                { k: 'ke', v: `${(Math.LN2 / selectedProfile.half_life_hours).toFixed(3)} /h` },
              ].map(({ k, v }) => (
                <div key={k} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(0,204,245,0.05)', border: '1px solid rgba(0,204,245,0.10)' }}>
                  <p style={{ fontSize: '0.55rem', color: 'rgba(154,170,191,0.45)', marginBottom: 3 }}>{k}</p>
                  <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#eaeefc' }}>{v}</p>
                </div>
              ))}
            </div>
            {selectedProfile.notes && (
              <p style={{ marginTop: 10, fontSize: '0.72rem', color: 'rgba(154,170,191,0.5)', lineHeight: 1.5 }}>
                {selectedProfile.notes}
              </p>
            )}
          </div>
        </>
      )}

      {/* Empty state wenn noch keine Simulation */}
      {!simResult && (
        <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(0,204,245,0.08)', border: '1px solid rgba(0,204,245,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={26} color="rgba(0,204,245,0.55)" />
          </div>
          <p style={{ fontSize: '0.85rem', color: 'rgba(154,170,191,0.45)' }}>
            Peptid wählen und Simulation starten
          </p>
        </div>
      )}

      <p style={{
        fontSize: '0.68rem',
        lineHeight: 1.55,
        color: 'rgba(255,255,255,0.30)',
        textAlign: 'center',
        padding: '4px 8px 12px',
      }}>
        Diese Simulation dient ausschließlich zu Informationszwecken und ersetzt keine medizinische Beratung.
        Konsultiere einen Arzt, bevor du Peptide verwendest.
      </p>
    </div>
  )
}
