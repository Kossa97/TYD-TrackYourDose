import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ComposedChart, Scatter, AreaChart,
} from 'recharts'
import { format } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'
import { Activity, CalendarDays, ChevronDown, Info, Loader2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  return (
    <div style={{ background: 'rgba(7,9,26,0.96)', border: '1px solid rgba(0,204,245,0.25)', borderRadius: 10, padding: '8px 12px' }}>
      <p style={{ fontSize: '0.7rem', color: 'rgba(154,170,191,0.6)', marginBottom: 3 }}>
        {format(new Date(ts), 'dd. MMM yyyy, HH:mm', { locale: deLocale })}
      </p>
      <p style={{ fontSize: '0.9rem', fontWeight: 900, color: '#00ccf5' }}>{level}% Wirkstoffspiegel</p>
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
  pkProfileId,
  peptideName,
  pk,
  level,
  accent,
}: {
  cycleId: string
  pkProfileId: string
  peptideName: string
  pk: PkProfileEmbed
  level: CurrentBlutspiegelLevel | undefined
  accent: string
}) {
  const navigate = useNavigate()
  const spark = (level?.sparkData ?? Array(20).fill(0)).map((v, i) => ({ i, v }))
  const trend = level ? TREND_META[level.trend] : TREND_META.stable

  return (
    <div style={{
      background: `linear-gradient(145deg, ${accent}0d, rgba(6,10,24,0.92))`,
      border: `1px solid ${accent}28`,
      borderRadius: 18,
      padding: '14px 14px 12px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Hintergrund-Glow */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: accent, opacity: 0.06, filter: 'blur(24px)', pointerEvents: 'none' }} />

      {/* Header: Peptid + Kategorie + Level */}
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

      {/* Sparkline — letzte 10h */}
      <div style={{ margin: '0 -2px 10px' }}>
        <ResponsiveContainer width="100%" height={52}>
          <AreaChart data={spark} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
            <defs>
              <linearGradient id={`spk-${cycleId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={accent} stopOpacity={0.38} />
                <stop offset="95%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={accent}
              fill={`url(#spk-${cycleId})`}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <p style={{ fontSize: '0.55rem', color: 'rgba(154,170,191,0.4)', textAlign: 'right', marginTop: -2, fontFamily: 'monospace' }}>
          Verlauf · letzte 10h
        </p>
      </div>

      {/* Stats 3er-Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'Nächste Dosis', value: level?.nextDoseIn ?? '—', color: '#eaeefc' },
          { label: 'Level danach', value: level ? `~${level.levelAfterNextDose.toFixed(0)}%` : '—', color: accent },
          { label: 'Peak',         value: level?.peakLabel ?? '—',   color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '7px 8px' }}>
            <p style={{ fontSize: '0.52rem', color: 'rgba(154,170,191,0.5)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
            <p style={{ fontSize: '0.82rem', fontWeight: 900, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* PK-Parameter Zeile */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { k: 'T½',    v: `${pk.half_life_hours}h` },
          { k: 'Tmax',  v: `${pk.tmax_hours}h` },
          { k: 'F',     v: `${Math.round(pk.bioavailability_sc * 100)}%` },
        ].map(({ k, v }) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.45)', fontFamily: 'monospace' }}>{k}:</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(213,224,242,0.7)' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Zyklus-Verlauf Button */}
      <button
        type="button"
        onClick={() => navigate(`/simulation?pk=${pkProfileId}`)}
        style={{
          width: '100%', padding: '9px 0', borderRadius: 12,
          background: `${accent}12`, border: `1px solid ${accent}28`,
          color: accent, fontSize: '0.75rem', fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.02em',
        }}
      >
        Zyklus-Verlauf ansehen →
      </button>
    </div>
  )
}

const WINDOW_HOURS = 12

// ── Haupt-Komponente ───────────────────────────────────────────────────────

export function BlutspiegelSimulation() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const pkFromUrl = searchParams.get('pk')

  const [pkProfiles, setPkProfiles]   = useState<PkProfile[]>([])
  const [protocolCycles, setProtocolCycles] = useState<ProtocolCycle[]>([])
  const [protocolLoading, setProtocolLoading] = useState(false)
  const [protocolOpen, setProtocolOpen] = useState(false)
  const [selectedProtocolCycleId, setSelectedProtocolCycleId] = useState<string | null>(null)
  const [selectedPkId, setSelectedPkId] = useState('')
  const [dose, setDose]               = useState('')
  const [unit, setUnit]               = useState<'mg' | 'mcg' | 'IU'>('mcg')
  const [route, setRoute]             = useState<'SC' | 'IM' | 'oral'>('SC')
  const [multiDose, setMultiDose]     = useState(false)
  const [interval, setInterval]       = useState('8')
  const [numDoses, setNumDoses]       = useState('3')
  const [simResult, setSimResult]       = useState<PkResult | null>(null)
  const [pageInfoOpen, setPageInfoOpen] = useState(false)
  const [protocolSimMode, setProtocolSimMode] = useState<'single' | 'history'>('single')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyEvents, setHistoryEvents] = useState<DoseEvent[]>([])
  const [historyCurve, setHistoryCurve] = useState<BlutspiegelCurvePoint[]>([])
  const [historyNoConfirmed, setHistoryNoConfirmed] = useState(false)

  // Live-Übersicht für alle aktiven Zyklen
  const [liveData, setLiveData] = useState<Map<string, CurrentBlutspiegelLevel>>(new Map())
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveRefreshing, setLiveRefreshing] = useState(false)
  const liveIntervalRef = useRef<number | null>(null)

  // Zyklus-Verlauf Chart — 12h-Fenster + Wisch-Navigation
  const [windowOffsetHours, setWindowOffsetHours] = useState(0)
  const histChartRef = useRef<HTMLDivElement>(null)
  const histPanStartX = useRef<number | null>(null)
  const histPanStartOffset = useRef(0)
  const histIsPanning = useRef(false)

  // Lade PK-Profile und aktive Zyklen
  useEffect(() => {
    supabase.from('pk_profiles').select('*').order('name').then(({ data }) => {
      const profiles = (data as PkProfile[]) ?? []
      setPkProfiles(profiles)
      if (pkFromUrl && profiles.some(p => p.id === pkFromUrl)) {
        setSelectedPkId(pkFromUrl)
        setProtocolOpen(true)
      } else if (profiles.length > 0) {
        setSelectedPkId(profiles[0].id)
      }
    })
  }, [pkFromUrl])

  useEffect(() => {
    if (!user) return
    setProtocolLoading(true)
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
        setProtocolLoading(false)
      })
  }, [user])

  const linkedProtocolCycles = useMemo(
    () => protocolCycles.filter(c => c.peptides?.pk_profile_id),
    [protocolCycles],
  )
  const unlinkedProtocolCycles = useMemo(
    () => protocolCycles.filter(c => !c.peptides?.pk_profile_id),
    [protocolCycles],
  )

  const selectedProfile = useMemo(
    () => pkProfiles.find(p => p.id === selectedPkId) ?? null,
    [pkProfiles, selectedPkId],
  )

  const applyProtocolCycle = useCallback((cycle: ProtocolCycle) => {
    const pkId = cycle.peptides?.pk_profile_id
    if (!pkId) return
    setSelectedPkId(pkId)
    setDose(String(cycle.dose))
    setUnit(normalizeUnit(cycle.unit))
    setRoute(methodToRoute(cycle.method))
    setSelectedProtocolCycleId(cycle.id)
  }, [])

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

  useEffect(() => {
    if (protocolSimMode !== 'history' || !selectedProtocolCycleId || !selectedProfile) {
      setHistoryEvents([])
      setHistoryCurve([])
      setHistoryNoConfirmed(false)
      setHistoryLoading(false)
      return
    }

    let cancelled = false
    setHistoryLoading(true)
    setHistoryNoConfirmed(false)

    void loadDoseHistory(selectedProtocolCycleId).then((events) => {
      if (cancelled) return

      if (events.length === 0 || !events.some(e => e.status === 'taken')) {
        setHistoryEvents(events)
        setHistoryCurve([])
        setHistoryNoConfirmed(true)
        setHistoryLoading(false)
        return
      }

      const curve = calculateHistoryBlutspiegelCurve(
        events,
        selectedProfile.half_life_hours,
        selectedProfile.tmax_hours,
        selectedProfile.bioavailability_sc,
      )

      setHistoryEvents(events)
      setHistoryCurve(curve)
      setHistoryNoConfirmed(curve.length === 0)
      setHistoryLoading(false)
    })

    return () => { cancelled = true }
  }, [protocolSimMode, selectedProtocolCycleId, selectedProfile])

  // Fenster zurücksetzen wenn Zyklus gewechselt wird
  useEffect(() => { setWindowOffsetHours(0) }, [selectedProtocolCycleId])

  const historyChartData = useMemo(
    () => historyCurve.map(p => ({ ts: p.time.getTime(), level: p.level })),
    [historyCurve],
  )

  // 12h-Sichtfenster basierend auf Wisch-Offset
  const historyWindowDomain = useMemo((): [number, number] => {
    if (!historyChartData.length) return [0, 0]
    const dataStart = historyChartData[0].ts
    const dataEnd   = historyChartData[historyChartData.length - 1].ts
    const windowMs  = WINDOW_HOURS * 3_600_000
    const offsetMs  = windowOffsetHours * 3_600_000
    const windowEnd   = dataEnd - offsetMs
    const windowStart = windowEnd - windowMs
    return [Math.max(dataStart, windowStart), Math.min(dataEnd, windowEnd)]
  }, [historyChartData, windowOffsetHours])

  const histTicks = useMemo(() => {
    const [start, end] = historyWindowDomain
    if (start === 0 && end === 0) return []
    const spanH = (end - start) / 3_600_000
    const tickIntervalMs =
      spanH <= 12 ? 2 * 3_600_000 :
      spanH <= 48 ? 6 * 3_600_000 :
      spanH <= 168 ? 24 * 3_600_000 :
      48 * 3_600_000
    const ticks: number[] = []
    const firstTick = Math.ceil(start / tickIntervalMs) * tickIntervalMs
    for (let t = firstTick; t <= end; t += tickIntervalMs) ticks.push(t)
    return ticks
  }, [historyWindowDomain])

  const formatHistTick = useCallback((ts: number) => {
    const spanH = (historyWindowDomain[1] - historyWindowDomain[0]) / 3_600_000
    if (spanH <= 48)  return format(new Date(ts), 'HH:mm', { locale: deLocale })
    if (spanH <= 168) return format(new Date(ts), 'EEE', { locale: deLocale })
    return format(new Date(ts), 'd. MMM', { locale: deLocale })
  }, [historyWindowDomain])

  const visibleHistoryData = useMemo(() => {
    const [start, end] = historyWindowDomain
    if (start === 0 && end === 0) return historyChartData
    return historyChartData.filter(p => p.ts >= start && p.ts <= end)
  }, [historyChartData, historyWindowDomain])

  const histMaxOffsetHours = useMemo(() => {
    if (!historyChartData.length) return 0
    const spanH = (historyChartData[historyChartData.length - 1].ts - historyChartData[0].ts) / 3_600_000
    return Math.max(0, spanH - WINDOW_HOURS)
  }, [historyChartData])

  const historyTakenMarkers = useMemo(
    () => historyEvents
      .filter(e => e.status === 'taken')
      .map(e => ({ ts: e.timestamp.getTime(), level: levelAtTime(historyCurve, e.timestamp) })),
    [historyEvents, historyCurve],
  )

  const visibleTakenMarkers = useMemo(
    () => historyTakenMarkers.filter(m =>
      m.ts >= historyWindowDomain[0] && m.ts <= historyWindowDomain[1],
    ),
    [historyTakenMarkers, historyWindowDomain],
  )

  const historyStats = useMemo(() => {
    if (!historyCurve.length || !historyEvents.length) return null
    const taken = historyEvents.filter(e => e.status === 'taken').length
    const total = historyEvents.length
    const last = historyCurve[historyCurve.length - 1]
    let peak = historyCurve[0]
    for (const p of historyCurve) {
      if (p.level > peak.level) peak = p
    }
    const avg = historyCurve.reduce((s, p) => s + p.level, 0) / historyCurve.length
    return {
      taken,
      total,
      current: last.level,
      peak: peak.level,
      peakDate: peak.time,
      avg: Math.round(avg * 10) / 10,
    }
  }, [historyCurve, historyEvents])

  // Auto-fill Dosis aus aktivem Zyklus wenn Peptid-Name übereinstimmt
  useEffect(() => {
    if (!selectedProfile) return
    const profileNames = [selectedProfile.name, ...selectedProfile.aliases].map(n => n.toLowerCase())
    const match = protocolCycles.find(c =>
      profileNames.includes(c.peptides?.name?.toLowerCase() ?? '')
    )
    if (match) { setDose(String(match.dose)); setUnit(normalizeUnit(match.unit)) }
  }, [selectedProfile, protocolCycles])

  // ── 60fps Wisch-Handler für Zyklus-Verlauf-Chart ──────────────────────────
  const handleHistPanStart = useCallback((clientX: number) => {
    histIsPanning.current = true
    histPanStartX.current = clientX
    histPanStartOffset.current = windowOffsetHours
  }, [windowOffsetHours])

  const handleHistPanMove = useCallback((clientX: number) => {
    if (!histIsPanning.current || histPanStartX.current === null) return
    // Leichter visueller Nudge — kein React-Re-render während der Geste
    const panDeltaPx = clientX - histPanStartX.current
    if (histChartRef.current) {
      histChartRef.current.style.transform = `translateX(${panDeltaPx * 0.12}px)`
    }
  }, [])

  const handleHistPanEnd = useCallback((clientX: number) => {
    if (!histIsPanning.current || histPanStartX.current === null) return
    const panDeltaPx = clientX - histPanStartX.current
    if (histChartRef.current) histChartRef.current.style.transform = ''
    histIsPanning.current = false
    histPanStartX.current = null
    if (!historyChartData.length) return
    const containerW = histChartRef.current?.offsetWidth ?? 300
    // Swipe rechts (panDeltaPx > 0) → weiter in die Vergangenheit (offset erhöhen)
    const deltaHours = -(panDeltaPx / containerW) * WINDOW_HOURS * 2
    setWindowOffsetHours(prev =>
      Math.max(0, Math.min(histMaxOffsetHours, histPanStartOffset.current + deltaHours))
    )
  }, [historyChartData.length, histMaxOffsetHours])

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
                      pkProfileId={c.peptides!.pk_profile_id!}
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

      {/* Seiten-Erklärung (einklappbar) */}
      <div style={{ ...PANEL, padding: pageInfoOpen ? 16 : '12px 16px' }}>
        <button
          type="button"
          onClick={() => setPageInfoOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#00ccf5',
            fontSize: '0.82rem', fontWeight: 800, fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={16} />
            {pageInfoOpen ? 'Weniger anzeigen' : 'Mehr erfahren'}
          </span>
          <ChevronDown
            size={18}
            style={{ transition: 'transform 0.2s', transform: pageInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
        {pageInfoOpen && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(0,204,245,0.85)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Was macht diese Funktion?
              </p>
              <p style={{ fontSize: '0.8rem', color: 'rgba(213,224,242,0.75)', lineHeight: 1.55 }}>
                Die Blutspiegel-Simulation zeigt dir, wie sich ein Peptid nach der Injektion in deinem Körper verhält — wann es wirkt, wann es am stärksten ist und wann es abgebaut ist.
              </p>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(154,170,191,0.65)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Wichtig zu wissen
              </p>
              <p style={{ fontSize: '0.78rem', color: 'rgba(213,224,242,0.62)', lineHeight: 1.55 }}>
                Die Werte sind Schätzungen basierend auf wissenschaftlichen Durchschnittswerten. Individuelle Faktoren wie Körpergewicht, Stoffwechsel und Injektionstechnik beeinflussen die tatsächlichen Werte.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Aus meinem Protokoll simulieren */}
      <div style={{ ...PANEL, padding: protocolOpen ? 16 : '12px 16px' }}>
        <button
          type="button"
          onClick={() => setProtocolOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#00ccf5',
            fontSize: '0.82rem', fontWeight: 800, fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarDays size={16} />
            Aus meinem Protokoll simulieren
          </span>
          <ChevronDown
            size={18}
            style={{ transition: 'transform 0.2s', transform: protocolOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
        {protocolOpen && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              display: 'flex', gap: 6, padding: 4, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {([
                { id: 'single' as const, label: 'Einzeldosis simulieren' },
                { id: 'history' as const, label: 'Zyklus-Verlauf simulieren' },
              ]).map(({ id, label }) => {
                const active = protocolSimMode === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setProtocolSimMode(id)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 9, border: 'none',
                      fontSize: '0.68rem', fontWeight: 800, fontFamily: 'inherit', lineHeight: 1.3,
                      cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
                      background: active ? 'rgba(0,204,245,0.18)' : 'transparent',
                      color: active ? '#00ccf5' : 'rgba(154,170,191,0.55)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {protocolLoading ? (
              <p style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.5)' }}>Lädt aktive Zyklen …</p>
            ) : protocolCycles.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.5)', lineHeight: 1.5 }}>
                Noch keine aktiven Zyklen mit PK-Profil
              </p>
            ) : (
              <>
                {linkedProtocolCycles.length === 0 && (
                  <p style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.5)', lineHeight: 1.5, marginBottom: 4 }}>
                    Noch keine aktiven Zyklen mit PK-Profil
                  </p>
                )}
                {linkedProtocolCycles.map(cycle => {
                  const selected = selectedProtocolCycleId === cycle.id
                  return (
                    <button
                      key={cycle.id}
                      type="button"
                      onClick={() => applyProtocolCycle(cycle)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 14,
                        background: selected ? 'rgba(0,204,245,0.10)' : 'rgba(255,255,255,0.03)',
                        border: selected ? '1px solid rgba(0,204,245,0.35)' : '1px solid rgba(255,255,255,0.08)',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <p style={{ fontSize: '0.88rem', fontWeight: 800, color: '#eaeefc', marginBottom: 2 }}>
                        {cycle.peptides?.name ?? 'Peptid'}
                      </p>
                      <p style={{ fontSize: '0.78rem', color: 'rgba(0,204,245,0.85)', fontWeight: 700 }}>
                        {cycle.dose} {cycle.unit}
                      </p>
                    </button>
                  )
                })}
                {unlinkedProtocolCycles.map(cycle => (
                  <div
                    key={cycle.id}
                    style={{
                      padding: '12px 14px', borderRadius: 14,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      opacity: 0.5,
                    }}
                  >
                    <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(234,238,252,0.55)', marginBottom: 2 }}>
                      {cycle.peptides?.name ?? 'Peptid'} · {cycle.dose} {cycle.unit}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: 'rgba(154,170,191,0.55)', lineHeight: 1.45 }}>
                      Kein PK-Profil — beim Einlagern Substanz aus der Liste wählen
                    </p>
                  </div>
                ))}
              </>
            )}

            {protocolSimMode === 'history' && selectedProtocolCycleId && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {historyLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 12px', justifyContent: 'center' }}>
                    <Loader2 size={18} color="#00ccf5" className="animate-spin" />
                    <p style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.6)' }}>Einnahmen werden geladen …</p>
                  </div>
                )}

                {!historyLoading && historyNoConfirmed && (
                  <p style={{
                    fontSize: '0.78rem', color: 'rgba(154,170,191,0.65)', lineHeight: 1.55,
                    padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    Noch keine bestätigten Einnahmen in diesem Zyklus. Bestätige zuerst Einnahmen im Kalender.
                  </p>
                )}

                {!historyLoading && historyCurve.length > 0 && selectedProfile && (
                  <>
                    <div style={{ paddingBottom: 8 }}>
                      {/* Header + Navigation */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#eaeefc' }}>
                          Zyklus-Verlauf — {selectedProfile.name}
                        </p>
                        {windowOffsetHours > 0 && (
                          <button
                            type="button"
                            onClick={() => setWindowOffsetHours(0)}
                            style={{
                              fontSize: '0.6rem', fontWeight: 800, color: '#00ccf5',
                              background: 'rgba(0,204,245,0.10)', border: '1px solid rgba(0,204,245,0.25)',
                              borderRadius: 8, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Jetzt ↩
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.45)', marginBottom: 6 }}>
                        12h-Fenster · ← wischen für ältere Daten
                      </p>

                      {/* Fortschrittsbalken: zeigt wo im Zyklus wir sind */}
                      {histMaxOffsetHours > 0 && (
                        <div style={{
                          height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)',
                          marginBottom: 10, overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', borderRadius: 99, background: '#00ccf5',
                            width: `${Math.round((1 - windowOffsetHours / histMaxOffsetHours) * 100)}%`,
                            transition: 'width 0.2s',
                          }} />
                        </div>
                      )}

                      {/* Chart-Container mit Wisch-Erkennung */}
                      <div
                        style={{ touchAction: 'pan-y', userSelect: 'none', cursor: histIsPanning.current ? 'grabbing' : 'grab' }}
                        onPointerDown={e => {
                          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                          handleHistPanStart(e.clientX)
                        }}
                        onPointerMove={e => handleHistPanMove(e.clientX)}
                        onPointerUp={e => handleHistPanEnd(e.clientX)}
                        onPointerCancel={e => handleHistPanEnd(e.clientX)}
                      >
                        <div ref={histChartRef} style={{ willChange: 'transform' }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <ComposedChart data={visibleHistoryData} margin={{ top: 20, right: 12, left: 8, bottom: 28 }}>
                              <defs>
                                <linearGradient id="pkHistGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#00ccf5" stopOpacity={0.32} />
                                  <stop offset="95%" stopColor="#00ccf5" stopOpacity={0} />
                                </linearGradient>
                              </defs>

                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

                              <XAxis
                                dataKey="ts"
                                type="number"
                                scale="time"
                                domain={historyWindowDomain}
                                ticks={histTicks}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: 'rgba(154,170,191,0.45)', fontSize: 10 }}
                                tickFormatter={formatHistTick}
                                label={{
                                  value: 'Zeit (← wischen für Vergangenheit)',
                                  position: 'insideBottom',
                                  offset: -4,
                                  fill: 'rgba(154,170,191,0.4)',
                                  fontSize: 9,
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
                                  fill: 'rgba(154,170,191,0.45)',
                                  fontSize: 9,
                                  fontWeight: 600,
                                }}
                              />

                              <Tooltip content={<HistoryChartTooltip />} cursor={{ stroke: 'rgba(0,204,245,0.3)', strokeWidth: 1 }} />

                              {historyEvents
                                .filter(e => e.status === 'skipped' &&
                                  e.timestamp.getTime() >= historyWindowDomain[0] &&
                                  e.timestamp.getTime() <= historyWindowDomain[1]
                                )
                                .map(e => (
                                  <ReferenceLine
                                    key={`skip-${e.timestamp.getTime()}`}
                                    x={e.timestamp.getTime()}
                                    stroke="rgba(154,170,191,0.35)"
                                    strokeDasharray="4 3"
                                    strokeWidth={1.5}
                                    label={{
                                      value: '⚠️ übersprungen',
                                      position: 'insideTopLeft',
                                      fill: 'rgba(154,170,191,0.55)',
                                      fontSize: 7,
                                      fontWeight: 700,
                                    }}
                                  />
                                ))}

                              <Area
                                type="monotone"
                                dataKey="level"
                                stroke="#00ccf5"
                                strokeWidth={2.5}
                                fill="url(#pkHistGrad)"
                                dot={false}
                                activeDot={{ r: 4, fill: '#07091a', stroke: '#00ccf5', strokeWidth: 2 }}
                                isAnimationActive={false}
                              />

                              <Scatter
                                data={visibleTakenMarkers}
                                dataKey="level"
                                fill="#10b981"
                                stroke="#07091a"
                                strokeWidth={1.5}
                                r={5}
                                isAnimationActive={false}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {historyStats && (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 8,
                        padding: '12px 14px', borderRadius: 14,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        {[
                          {
                            label: 'Einnahmen',
                            value: `${historyStats.taken} von ${historyStats.total} Dosen eingenommen`,
                            color: '#10b981',
                          },
                          {
                            label: 'Aktueller Spiegel',
                            value: `${historyStats.current} %`,
                            color: '#00ccf5',
                          },
                          {
                            label: 'Höchster Spiegel',
                            value: `${historyStats.peak} % · ${format(historyStats.peakDate, 'd. MMM yyyy', { locale: deLocale })}`,
                            color: '#f59e0b',
                          },
                          {
                            label: 'Durchschnitt',
                            value: `${historyStats.avg} % über den Zyklus`,
                            color: 'rgba(213,224,242,0.75)',
                          },
                        ].map(({ label, value, color }) => (
                          <div key={label}>
                            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(154,170,191,0.55)', marginBottom: 2 }}>
                              {label}
                            </p>
                            <p style={{ fontSize: '0.88rem', fontWeight: 800, color }}>{value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Konfiguration */}
      <div style={PANEL}>
        <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#eaeefc', marginBottom: 12 }}>Konfiguration</p>

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
      {!simResult && !(protocolSimMode === 'history' && historyCurve.length > 0) && (
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
