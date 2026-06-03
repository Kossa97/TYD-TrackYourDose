import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Area, ResponsiveContainer, AreaChart } from 'recharts'
import { FEATURES } from '../config/features'
import { format } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'
import { Activity, ChevronDown, ChevronUp, Info, Loader2 } from 'lucide-react'
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
import { loadAllCycleChartData, type CycleChartData } from '../services/liveBlutspiegelChart'
import { LiveBlutspiegelChart } from '../components/LiveBlutspiegelChart'
import { LiveCycleChartCanvas, type LiveCycleChartHandle } from '../components/liveCycleChart/LiveCycleChartCanvas'
import { SimulationChartCanvas } from '../components/liveCycleChart/SimulationChartCanvas'
import type { NamedMarker } from '../components/liveCycleChart/chartMath'
import { lerpLevel } from '../components/liveCycleChart/chartMath'

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
  vd_l_kg: number | null
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

  // Volle Präzision behalten — Runden der Zeit auf 0,1 h würde Punkte auf
  // denselben x-Wert kollabieren und im Canvas Treppenstufen erzeugen.
  // Das Ablesen rundet erst bei der Anzeige (Chip).
  const data: ChartPoint[] = rawT.map((t, i) => ({ t, c: pctArr[i] }))

  return { data, tmaxActual, peakPct: 100, t10, accumFactor }
}

// ── Design-Tokens ──────────────────────────────────────────────────────────

const PANEL = {
  background: 'linear-gradient(145deg, var(--surface), var(--surface))',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: 16,
} as const

const LABEL = {
  fontSize: '0.6rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: 6,
} as const

const INPUT = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  background: 'var(--surface-input)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
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
          color: 'var(--accent)', cursor: 'pointer', flexShrink: 0,
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
            background: 'var(--surface)', border: '1px solid var(--accent-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            fontSize: '0.72rem', fontWeight: 500, lineHeight: 1.5,
            color: 'var(--text-dim)', pointerEvents: 'none',
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
  const chartRef                        = useRef<LiveCycleChartHandle>(null)
  const [showJetzt, setShowJetzt]       = useState(false)
  const [hasHistory, setHasHistory]     = useState(false)

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
    }, 10_000)
    return () => window.clearInterval(id)
  }, [events, pk.half_life_hours, pk.tmax_hours, pk.bioavailability_sc])

  // Volle Kurve als Chart-Daten
  const chartData = useMemo(
    () => curve.map(p => ({ ts: p.time.getTime(), level: p.level })),
    [curve],
  )

  // Einnahme-Marker (alle, ungefiltert — Fenster-Clipping macht die Canvas-Komponente)
  const doseMarkers = useMemo(
    () => events
      .filter(ev => ev.status === 'taken')
      .map(ev => ({ ts: ev.timestamp.getTime(), level: lerpLevel(chartData, ev.timestamp.getTime()) })),
    [events, chartData],
  )

  // Peak-Marker: tatsächliches lokales Maximum der akkumulierten Kurve nach jeder Injektion
  // (nicht theoretisches Tmax — das stimmt nur für Einzeldosen ohne Akkumulation)
  const peakMarkers = useMemo(() => {
    const taken = events.filter(ev => ev.status === 'taken')
    if (!taken.length || !chartData.length) return []
    return taken.map((ev, i) => {
      const fromTs = ev.timestamp.getTime()
      const toTs   = taken[i + 1]?.timestamp.getTime() ?? chartData[chartData.length - 1].ts
      // Suche das Maximum der Kurve zwischen dieser und der nächsten Injektion
      const window = chartData.filter(p => p.ts >= fromTs && p.ts <= toTs)
      if (!window.length) return null
      const peak = window.reduce((max, p) => p.level > max.level ? p : max, window[0])
      return { ts: peak.ts, level: peak.level }
    }).filter((m): m is { ts: number; level: number } => m !== null)
  }, [events, chartData])

  // Wirkungsbeginn: erster Punkt wo der akkumulierte Spiegel >= 25%
  const onsetMarkers = useMemo((): NamedMarker[] => {
    const onset = chartData.find(p => p.level >= 25)
    return onset ? [{ ts: onset.ts, label: 'Wirkungsbeginn', color: '#06b6d4' }] : []
  }, [chartData])

  const trend    = level ? TREND_META[level.trend] : TREND_META.stable
  const hasCurve = curve.length > 0

  return (
    <div
      className="live-cycle-card"
      style={{
        background: `linear-gradient(145deg, ${accent}14, var(--surface))`,
        border: `1px solid ${accent}38`,
      }}
    >
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: accent, opacity: 0.06, filter: 'blur(24px)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '0.92rem', fontWeight: 850, color: 'var(--text)', marginBottom: 4 }}>{peptideName}</p>
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
            {/* Hinweis + Navigationsbuttons in einer Zeile */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, minHeight: 40 }}>
              <div>
                <p style={{ fontSize: '0.52rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
                  7-Tage-Fenster · wischen für Verlauf · halten zum Ablesen
                </p>
                {/* Legende */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { bg: '#06b6d4', label: 'Wirkungsbeginn' },
                    { bg: '#10b981', label: 'Einnahme' },
                    { bg: '#f59e0b', label: 'Peak' },
                  ].map(({ bg, label }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: bg, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigationsbuttons rechts — nebeneinander, gleicher Stil */}
              {(hasHistory || showJetzt) && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, paddingLeft: 12 }}>
                  {hasHistory && (
                    <button type="button" className="live-cycle-nav-btn" onClick={() => chartRef.current?.jumpToStart()}>
                      ⏮ Zyklusstart
                    </button>
                  )}
                  {showJetzt && (
                    <button type="button" className="live-cycle-nav-btn" onClick={() => chartRef.current?.jumpToNow()}>
                      Live ↩
                    </button>
                  )}
                </div>
              )}
            </div>

            <LiveCycleChartCanvas
              ref={chartRef}
              points={chartData}
              doseMarkers={doseMarkers}
              peakMarkers={peakMarkers}
              namedMarkers={onsetMarkers}
              accent={accent}
              windowMs={WINDOW_HOURS * 3_600_000}
              height={180}
              onNavState={(sj, hh) => { setShowJetzt(sj); setHasHistory(hh) }}
            />
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
            <p style={{ fontSize: '0.52rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
              Einnahmen im Kalender bestätigen für vollständigen Verlauf
            </p>
          </>
        )}
      </div>

      {/* Stats — einheitliches 2×3-Raster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {[
          {
            label: 'Peak',
            value: level?.peakLabel ?? '—',
            sub: 'Zeitpunkt, an dem nach der letzten Injektion der meiste Wirkstoff im Blut ist.',
          },
          {
            label: 'Halbwertzeit T½ (h)',
            value: `${pk.half_life_hours} h`,
            sub: `Nach ${pk.half_life_hours} h ist die Hälfte abgebaut. Nach ${pk.half_life_hours * 2} h sind es 75 %, nach ${pk.half_life_hours * 5} h ist der Wirkstoff praktisch weg. Je länger die Halbwertzeit, desto seltener muss dosiert werden.`,
          },
          {
            label: 'Tmax (h)',
            value: `${pk.tmax_hours} h`,
            sub: `Nach der Injektion dauert es ca. ${pk.tmax_hours} h, bis der Wirkstoff seinen Höchstwert im Blut erreicht. Erst ab diesem Punkt bist du auf dem Wirkungsmaximum.`,
          },
          {
            label: 'Bioverfügbarkeit F (%)',
            value: `${Math.round(pk.bioavailability_sc * 100)} %`,
            sub: `Von der injizierten Menge kommen ${Math.round(pk.bioavailability_sc * 100)} % in den Blutkreislauf an. Bei subkutaner Injektion (SC) ist dieser Wert typischerweise hoch.`,
          },
          {
            label: 'Verteilungsvolumen Vd (L/kg)',
            value: pk.vd_l_kg != null ? `${pk.vd_l_kg} L/kg` : '—',
            sub: `Gibt an, wie stark sich der Wirkstoff im Körpergewebe verteilt.${pk.vd_l_kg != null && pk.vd_l_kg > 1 ? ' Hoher Wert — speichert sich stark im Gewebe, was oft eine längere Wirkdauer erklärt.' : ' Niedriger Wert — bleibt hauptsächlich im Blut.'}`,
          },
          {
            label: 'Eliminationskonstante ke (1/h)',
            value: `${(Math.LN2 / pk.half_life_hours).toFixed(3)} /h`,
            sub: `Pro Stunde werden ${((Math.LN2 / pk.half_life_hours) * 100).toFixed(1)} % des noch vorhandenen Wirkstoffs abgebaut. Kleiner Wert = langsamer Abbau = lange Wirkdauer.`,
          },
        ].map(({ label, value, sub }) => (
          <div key={label} className="live-cycle-stat-cell">
            <p style={{
              fontSize: '0.48rem', color: 'var(--text-muted)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3,
            }}>{label}</p>
            <p style={{ fontSize: '0.88rem', fontWeight: 900, color: 'var(--text)', marginBottom: 3, lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: '0.46rem', color: 'var(--text-muted)', lineHeight: 1.4, opacity: 0.75 }}>{sub}</p>
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
  const [simOpen, setSimOpen]             = useState(true)

  // Live-Übersicht für alle aktiven Zyklen
  const [liveData, setLiveData]           = useState<Map<string, CurrentBlutspiegelLevel>>(new Map())
  const [liveLoading, setLiveLoading]     = useState(false)
  const [liveRefreshing, setLiveRefreshing] = useState(false)
  const liveIntervalRef = useRef<number | null>(null)

  // Verlaufs-Chart
  const [chartData, setChartData]         = useState<CycleChartData[]>([])
  const [chartLoading, setChartLoading]   = useState(false)
  const chartIntervalRef = useRef<number | null>(null)

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
          pk_profiles ( name, half_life_hours, tmax_hours, bioavailability_sc, vd_l_kg, category )
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

  // Verlaufs-Chart: laden + alle 10s neu laden
  useEffect(() => {
    if (!user) return
    setChartLoading(true)
    const load = () => loadAllCycleChartData(user.id).then(data => {
      setChartData(data)
      setChartLoading(false)
    })
    void load()
    chartIntervalRef.current = window.setInterval(() => void load(), 10_000)
    return () => { if (chartIntervalRef.current) window.clearInterval(chartIntervalRef.current) }
  }, [user])

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

  // Sim-Kurve als Canvas-Punkte (ts = Stunden, level = %)
  const simPoints = useMemo(
    () => (simResult ? simResult.data.map(p => ({ ts: p.t, level: p.c })) : []),
    [simResult],
  )

  // Dezente Marker (Labels erscheinen nur beim Ablesen in der Nähe)
  const simMarkers = useMemo((): NamedMarker[] => {
    if (!simResult || !selectedProfile) return []

    // Wirkungsbeginn: erster Punkt wo Level > 25% (Anstiegsphase)
    const onset = simResult.data.find(p => p.c >= 25)

    const list = [
      ...(onset ? [{ ts: onset.t, label: 'Wirkungsbeginn', color: '#06b6d4' }] : []),
      { ts: simResult.tmaxActual, label: 'Peak', color: '#f59e0b' },
      { ts: selectedProfile.half_life_hours, label: '½ Halbwertzeit', color: '#a78bfa' },
    ]
    if (simResult.t10 < selectedProfile.half_life_hours * 5) {
      list.push({ ts: simResult.t10, label: 'Wirkungsende', color: '#9aa6bf' })
    }
    return list
  }, [simResult, selectedProfile])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>

      {/* Header */}
      <div style={{ ...PANEL, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 88% 10%, rgba(0,204,245,0.15), transparent 34%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>
            Pharmakokinetik
          </p>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1.05 }}>
            Blutspiegel-Simulation
          </h1>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 5, lineHeight: 1.5 }}>
            Sieh auf einen Blick, wann dein Peptid wirkt und wann es wieder abgebaut ist
          </p>
          <p className="disclaimer" style={{ marginTop: 6 }}>
            Alle Werte basieren auf pharmakologischen Modellen und sind Schätzungen — kein medizinischer Rat.
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
              <p style={{ fontSize: '0.85rem', fontWeight: 850, color: 'var(--text)' }}>Live-Blutspiegel</p>
              <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 700 }}>
                · alle 5s
              </span>
            </div>
            {liveRefreshing && <Loader2 size={14} color="var(--accent)" className="animate-spin" />}
          </div>

          {liveLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', justifyContent: 'center' }}>
              <Loader2 size={18} color="var(--accent)" className="animate-spin" />
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
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

      {/* ── Verlaufs-Graph ───────────────────────────────────────────────── */}
      {FEATURES.LIVE_VERLAUF_CHART && (chartLoading || chartData.length > 0) && (
        <div style={PANEL}>
          <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>
            Verlaufs-Graph
          </p>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
            7-Tage-Fenster mit echten Einnahmen · wischen zum Scrollen
          </p>
          <LiveBlutspiegelChart cycles={chartData} loading={chartLoading} />
        </div>
      )}

      {/* Manuelle Simulation */}
      <div style={PANEL}>
        {/* Header — klickbar zum Ein-/Ausklappen */}
        <button
          type="button"
          onClick={() => setSimOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 8,
            background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', marginBottom: simOpen ? 2 : 0,
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text)', marginBottom: 1 }}>
              Manuelle Simulation
            </p>
            {!simOpen && (
              <p style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>
                Tippen zum Öffnen
              </p>
            )}
          </div>
          {simOpen
            ? <ChevronUp size={16} color="var(--text-muted)" />
            : <ChevronDown size={16} color="var(--text-muted)" />}
        </button>

        {simOpen && <>
        <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
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
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--accent-weak)' }}>
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
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>Mehrfachdosis simulieren</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>Zeigt Akkumulation über mehrere Gaben</p>
          </div>
          <button
            onClick={() => setMultiDose(v => !v)}
            style={{
              width: 44, height: 24, borderRadius: 99,
              background: multiDose ? 'var(--accent)' : 'var(--surface-raised)',
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
            background: selectedProfile ? 'var(--accent-weak)' : 'var(--surface-raised)',
            border: selectedProfile ? '1px solid var(--accent-border)' : '1px solid var(--border)',
            color: selectedProfile ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '0.9rem', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: selectedProfile ? 'pointer' : 'not-allowed', transition: 'all 0.18s',
          }}
        >
          <Activity size={16} /> Simulation starten
        </button>
        </>}
      </div>

      {/* Chart + Ergebnisse — nur sichtbar wenn Sim offen oder Ergebnis vorhanden */}
      {simOpen && <>
      {simResult && selectedProfile && (
        <>
          <div style={{ ...PANEL, paddingBottom: 20 }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
              Blutspiegel-Kurve — {selectedProfile.name}
            </p>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Relativer Wirkstoffspiegel in % (normalisiert auf Peak = 100 %)
            </p>

            <SimulationChartCanvas
              points={simPoints}
              markers={simMarkers}
              phaseSplitTs={simResult.tmaxActual}
              accent="#00ccf5"
              height={260}
            />
          </div>

          {/* Ergebnisse & Parameter — kombiniert, einfach erklärt */}
          <div style={PANEL}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
              Ergebnisse & Parameter — einfach erklärt
            </p>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Was die Simulation für <strong style={{ color: 'var(--text-dim)' }}>{selectedProfile.name}</strong> bedeutet — in einfachen Worten.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                {
                  label: 'Höchster Spiegel (Peak)',
                  value: '100 %',
                  explain: 'Der maximale Wirkstoffspiegel, den du mit dieser Dosis erreichst — normiert auf 100 %. Alle anderen Werte werden relativ dazu angezeigt.',
                },
                {
                  label: `Zeit bis zum Peak — Tmax (${Math.round(simResult.tmaxActual * 10) / 10} h)`,
                  value: `${Math.round(simResult.tmaxActual * 10) / 10} Stunden`,
                  explain: `Nach der Injektion dauert es ca. ${Math.round(simResult.tmaxActual * 10) / 10} Stunden, bis der Wirkstoff seinen Höchstwert im Blut erreicht. Erst ab diesem Punkt bist du auf dem Wirkungsmaximum.`,
                },
                {
                  label: `Halbwertzeit — T½ (${selectedProfile.half_life_hours} h)`,
                  value: `${selectedProfile.half_life_hours} Stunden`,
                  explain: `Nach ${selectedProfile.half_life_hours} Stunden ist die Hälfte des Wirkstoffs abgebaut. Nach ${selectedProfile.half_life_hours * 2} h sind es 75 %, nach ${selectedProfile.half_life_hours * 5} h ist er praktisch vollständig eliminiert. Je länger die Halbwertzeit, desto seltener muss dosiert werden.`,
                },
                {
                  label: 'Wirkungsdauer (bis < 10 %)',
                  value: simResult.t10 < selectedProfile.half_life_hours * 5
                    ? `${Math.round(simResult.t10 * 10) / 10} Stunden`
                    : `über ${Math.round(selectedProfile.half_life_hours * 5)} Stunden`,
                  explain: 'Ab dem Zeitpunkt, wo der Spiegel unter 10 % fällt, ist die Wirkung vernachlässigbar gering. Das gibt dir einen Anhaltspunkt, wie lange eine Dosis tatsächlich aktiv wirkt.',
                },
                {
                  label: `Bioverfügbarkeit — F (${Math.round(selectedProfile.bioavailability_sc * 100)} %)`,
                  value: `${Math.round(selectedProfile.bioavailability_sc * 100)} %`,
                  explain: `Von der injizierten Menge kommen tatsächlich ${Math.round(selectedProfile.bioavailability_sc * 100)} % in den Blutkreislauf an. Der Rest wird vor der Wirkung abgebaut. Bei subkutaner Injektion (SC) ist dieser Wert typischerweise hoch.`,
                },
                {
                  label: `Verteilungsvolumen — Vd (${selectedProfile.vd_l_kg != null ? selectedProfile.vd_l_kg + ' L/kg' : '—'})`,
                  value: selectedProfile.vd_l_kg != null ? `${selectedProfile.vd_l_kg} L/kg` : '—',
                  explain: `Gibt an, wie stark sich der Wirkstoff im Körpergewebe verteilt.${selectedProfile.vd_l_kg != null && selectedProfile.vd_l_kg > 1 ? ' Hoher Wert (> 1 L/kg) — der Wirkstoff speichert sich stark im Gewebe, nicht nur im Blut. Das erklärt oft eine längere Wirkdauer.' : ' Niedriger Wert — der Wirkstoff bleibt hauptsächlich im Blut.'}`,
                },
                {
                  label: `Eliminationskonstante — ke (${(Math.LN2 / selectedProfile.half_life_hours).toFixed(3)} /h)`,
                  value: `${(Math.LN2 / selectedProfile.half_life_hours).toFixed(3)} /h`,
                  explain: `Pro Stunde werden ${((Math.LN2 / selectedProfile.half_life_hours) * 100).toFixed(1)} % des noch vorhandenen Wirkstoffs abgebaut. Kleiner Wert = langsamer Abbau = lange Wirkdauer.`,
                },
                ...(multiDose ? [{
                  label: `Akkumulationsfaktor (${simResult.accumFactor.toFixed(2)}×)`,
                  value: `${simResult.accumFactor.toFixed(2)}×`,
                  explain: `Bei regelmäßiger Einnahme mit deinem gewählten Intervall ist der Steady-State-Spiegel ${simResult.accumFactor.toFixed(2)}-mal so hoch wie nach der ersten Dosis. ${simResult.accumFactor > 2 ? 'Das ist eine starke Akkumulation — der Wirkstoff sammelt sich deutlich an.' : simResult.accumFactor > 1.5 ? 'Der Wirkstoff reichert sich spürbar an.' : 'Die Akkumulation ist gering.'}`,
                }] : []),
              ] as { label: string; value: string; explain: string }[])
              .map(({ label, value, explain }) => (
                <div key={label} className="pk-stat-row">
                  <div>
                    <p style={{ fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4, lineHeight: 1.3 }}>{label}</p>
                    <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</p>
                  </div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', lineHeight: 1.6, paddingTop: 2 }}>{explain}</p>
                </div>
              ))}
            </div>
            {selectedProfile.notes && (
              <p style={{ marginTop: 12, fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.55, padding: '10px 12px', background: 'var(--accent-weak)', borderRadius: 10, borderLeft: '2px solid var(--accent-border)' }}>
                <strong style={{ color: 'var(--text-dim)' }}>Hinweis: </strong>{selectedProfile.notes}
              </p>
            )}
          </div>
        </>
      )}

      {/* Empty state wenn noch keine Simulation */}
      {!simResult && (
        <div style={{ ...PANEL, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent-weak)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={26} color="var(--accent)" />
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Peptid wählen und Simulation starten
          </p>
        </div>
      )}
      </>}

      <p className="disclaimer" style={{ textAlign: 'center', padding: '4px 8px 12px' }}>
        Konsultiere einen Arzt, bevor du Peptide verwendest.
      </p>
    </div>
  )
}
