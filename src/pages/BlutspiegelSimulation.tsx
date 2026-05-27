import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { Activity, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

interface ActiveCycle {
  peptide_id: string
  dose: number
  unit: string
  peptides: { name: string }
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

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function PkTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(7,9,26,0.96)', border: '1px solid rgba(0,204,245,0.25)', borderRadius: 10, padding: '8px 12px' }}>
      <p style={{ fontSize: '0.7rem', color: 'rgba(154,170,191,0.6)', marginBottom: 3 }}>t = {label} h</p>
      <p style={{ fontSize: '0.9rem', fontWeight: 900, color: '#00ccf5' }}>{payload[0].value}%</p>
    </div>
  )
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────

export function BlutspiegelSimulation() {
  const { user } = useAuth()

  const [pkProfiles, setPkProfiles]   = useState<PkProfile[]>([])
  const [activeCycles, setActiveCycles] = useState<ActiveCycle[]>([])
  const [selectedPkId, setSelectedPkId] = useState('')
  const [dose, setDose]               = useState('')
  const [unit, setUnit]               = useState<'mg' | 'mcg' | 'IU'>('mcg')
  const [route, setRoute]             = useState<'SC' | 'IM' | 'oral'>('SC')
  const [multiDose, setMultiDose]     = useState(false)
  const [interval, setInterval]       = useState('8')
  const [numDoses, setNumDoses]       = useState('3')
  const [simResult, setSimResult]     = useState<PkResult | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)

  // Lade PK-Profile und aktive Zyklen
  useEffect(() => {
    supabase.from('pk_profiles').select('*').order('name').then(({ data }) => {
      const profiles = (data as PkProfile[]) ?? []
      setPkProfiles(profiles)
      if (profiles.length > 0) setSelectedPkId(profiles[0].id)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('cycles')
      .select('peptide_id, dose, unit, peptides(name)')
      .eq('user_id', user.id)
      .eq('active', true)
      .then(({ data }) => setActiveCycles((data as unknown as ActiveCycle[]) ?? []))
  }, [user])

  const selectedProfile = useMemo(
    () => pkProfiles.find(p => p.id === selectedPkId) ?? null,
    [pkProfiles, selectedPkId]
  )

  // Auto-fill Dosis aus aktivem Zyklus wenn Peptid-Name übereinstimmt
  useEffect(() => {
    if (!selectedProfile) return
    const profileNames = [selectedProfile.name, ...selectedProfile.aliases].map(n => n.toLowerCase())
    const match = activeCycles.find(c =>
      profileNames.includes(c.peptides?.name?.toLowerCase() ?? '')
    )
    if (match) { setDose(String(match.dose)); setUnit(match.unit as 'mg' | 'mcg' | 'IU') }
  }, [selectedProfile, activeCycles])

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
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(0,204,245,0.74)', marginBottom: 4 }}>
              Pharmakokinstik
            </p>
            <h1 style={{ fontSize: '1.55rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#f8fbff', lineHeight: 1.05 }}>
              Blutspiegel-Simulation
            </h1>
            <p style={{ fontSize: '0.72rem', color: 'rgba(213,224,242,0.52)', marginTop: 5, lineHeight: 1.5 }}>
              Geschätzter Wirkstoffspiegel basierend auf PK-Modellen
            </p>
          </div>
          <button
            onClick={() => setShowTooltip(v => !v)}
            style={{ marginTop: 4, color: 'rgba(154,170,191,0.5)', flexShrink: 0 }}
          >
            <Info size={18} />
          </button>
        </div>
        {showTooltip && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(0,204,245,0.07)', border: '1px solid rgba(0,204,245,0.15)', fontSize: '0.72rem', color: 'rgba(213,224,242,0.65)', lineHeight: 1.55 }}>
            Zeigt den geschätzten relativen Wirkstoffspiegel im Blut basierend auf pharmakokinetischen Modellen (1-Compartment, First-Order-Absorption). Kein medizinischer Rat. Individuelle Werte können abweichen.
          </div>
        )}
      </div>

      {/* Konfiguration */}
      <div style={PANEL}>
        <p style={{ fontSize: '0.7rem', fontWeight: 800, color: '#eaeefc', marginBottom: 12 }}>Konfiguration</p>

        {/* Peptid-Auswahl */}
        <div style={{ marginBottom: 12 }}>
          <label style={LABEL}>Wirkstoff</label>
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
            <label style={LABEL}>Dosis</label>
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
            <label style={LABEL}>Einheit</label>
            <select value={unit} onChange={e => setUnit(e.target.value as 'mg' | 'mcg' | 'IU')} style={{ ...INPUT, width: 'auto' }}>
              <option>mcg</option>
              <option>mg</option>
              <option>IU</option>
            </select>
          </div>
          <div>
            <label style={LABEL}>Route</label>
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

            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={simResult.data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
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
                />
                <YAxis
                  domain={[0, 105]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'rgba(154,170,191,0.45)', fontSize: 10 }}
                  tickFormatter={v => `${v}%`}
                  ticks={[0, 25, 50, 75, 100]}
                />

                <Tooltip content={<PkTooltip />} cursor={{ stroke: 'rgba(0,204,245,0.3)', strokeWidth: 1 }} />

                {/* Tmax — Peak */}
                <ReferenceLine
                  x={Math.round(simResult.tmaxActual * 10) / 10}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: 'Tmax', position: 'top', fill: '#f59e0b', fontSize: 9, fontWeight: 700 }}
                />

                {/* Halbwertzeit */}
                <ReferenceLine
                  x={selectedProfile.half_life_hours}
                  stroke="#8b5cf6"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{ value: 'T½', position: 'top', fill: '#8b5cf6', fontSize: 9, fontWeight: 700 }}
                />

                {/* Ende der Wirkung <10% */}
                {simResult.t10 < selectedProfile.half_life_hours * 5 && (
                  <ReferenceLine
                    x={Math.round(simResult.t10 * 10) / 10}
                    stroke="rgba(255,255,255,0.28)"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    label={{ value: '<10%', position: 'top', fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 700 }}
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
              </AreaChart>
            </ResponsiveContainer>

            {/* Legende Referenzlinien */}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { color: '#f59e0b', label: 'Tmax (Peak)' },
                { color: '#8b5cf6', label: 'Halbwertzeit' },
                { color: 'rgba(255,255,255,0.35)', label: 'Ende Wirkung (<10%)' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 16, height: 1.5, background: color, borderRadius: 1 }} />
                  <span style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.55)', fontWeight: 700 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info-Box */}
          <div style={{ ...PANEL, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              {
                label: 'Peak-Konzentration',
                value: '100 %',
                sub: 'normalisierter Maximalwert',
                color: '#00ccf5',
              },
              {
                label: 'Zeit bis Peak (Tmax)',
                value: `${Math.round(simResult.tmaxActual * 10) / 10} h`,
                sub: 'Zeitpunkt max. Spiegel',
                color: '#f59e0b',
              },
              {
                label: 'Effektives Ende',
                value: simResult.t10 < selectedProfile.half_life_hours * 5
                  ? `${Math.round(simResult.t10 * 10) / 10} h`
                  : `>${Math.round(selectedProfile.half_life_hours * 5)} h`,
                sub: 'Zeit bis <10 % des Peaks',
                color: 'rgba(213,224,242,0.5)',
              },
              {
                label: 'Akkumulationsfaktor',
                value: multiDose ? `${simResult.accumFactor.toFixed(2)}×` : '—',
                sub: multiDose ? 'Multi- vs. Einzeldosis' : 'Einzeldosis gewählt',
                color: multiDose ? '#10b981' : 'rgba(154,170,191,0.35)',
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px' }}>
                <p style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.5)', marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.4)', marginTop: 4 }}>{sub}</p>
              </div>
            ))}
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
            Wirkstoff wählen und Simulation starten
          </p>
        </div>
      )}
    </div>
  )
}
