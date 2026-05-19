import { useState, useRef, useEffect, Suspense } from 'react'
import { RotateCcw, Zap, Activity, Info, Undo2, ChevronDown, ChevronUp } from 'lucide-react'
import { BodyScene } from '../components/injection/BodyScene'
import { ZoneDetailSheet } from '../components/injection/ZoneDetailSheet'

// ── Zone definitions with 3D positions ───────────────────────────────────────
export interface InjectionZone {
  key:      string
  label:    string
  muscle:   string
  position: [number, number, number]  // Three.js world coords
}

export const ZONES: InjectionZone[] = [
  // Front zones
  { key: 'deltoid_l',  label: 'Deltoid links',            muscle: 'Schulter',     position: [-0.40, 0.70, 0.06]  },
  { key: 'deltoid_r',  label: 'Deltoid rechts',           muscle: 'Schulter',     position: [0.40,  0.70, 0.06]  },
  { key: 'bauch_l',    label: 'Bauch links',              muscle: 'Abdomen',      position: [-0.11, 0.33, 0.18]  },
  { key: 'bauch_r',    label: 'Bauch rechts',             muscle: 'Abdomen',      position: [0.11,  0.33, 0.18]  },
  { key: 'ober_l',     label: 'Oberschenkel links',       muscle: 'Quadrizeps',   position: [-0.14, -0.37, 0.10] },
  { key: 'ober_r',     label: 'Oberschenkel rechts',      muscle: 'Quadrizeps',   position: [0.14,  -0.37, 0.10] },
  // Back zones
  { key: 'gesaess_l',  label: 'Gesäß links',              muscle: 'Gluteus',      position: [-0.16, -0.06, -0.17]},
  { key: 'gesaess_r',  label: 'Gesäß rechts',             muscle: 'Gluteus',      position: [0.16,  -0.06, -0.17]},
  { key: 'trizeps_l',  label: 'Trizeps links',            muscle: 'Trizeps',      position: [-0.40, 0.45, -0.06] },
  { key: 'trizeps_r',  label: 'Trizeps rechts',           muscle: 'Trizeps',      position: [0.40,  0.45, -0.06] },
  { key: 'wade_l',     label: 'Wade links',               muscle: 'Gastrocnemius',position: [-0.12, -0.95, 0.08] },
  { key: 'wade_r',     label: 'Wade rechts',              muscle: 'Gastrocnemius',position: [0.12,  -0.95, 0.08] },
]

// ── Smart rotation logic ──────────────────────────────────────────────────────
const HEALING_DAYS   = 2   // minimum days before reuse
const OPTIMAL_DAYS   = 5   // fully healed

// Recovery score 0–100
function recoveryPct(days: number | undefined): number {
  if (days === undefined) return 100
  if (days === 0) return 8
  if (days === 1) return 30
  if (days === 2) return 55
  if (days === 3) return 72
  if (days === 4) return 85
  if (days === 5) return 94
  return 100
}

// Find optimal next zone: highest recovery + balance left/right
function findRecommended(days: Record<string, number>): string | null {
  const scored = ZONES.map(z => ({
    key:   z.key,
    score: recoveryPct(days[z.key]),
    avail: (days[z.key] ?? 100) >= HEALING_DAYS,
  })).filter(z => z.avail).sort((a, b) => b.score - a.score)

  return scored[0]?.key ?? null
}

// ── Mock initial data ─────────────────────────────────────────────────────────
const MOCK_DAYS: Record<string, number> = {
  deltoid_l: 0,  deltoid_r: 3,
  bauch_l:   6,  bauch_r:   2,
  ober_l:    1,  ober_r:    8,
  gesaess_l: 12, gesaess_r: 4,
  trizeps_l: 5,  trizeps_r: 0,
  wade_l:    7,  wade_r:    9,
}

interface HistEntry { key: string; label: string; prev: number | undefined; ts: number }

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingBody() {
  return (
    <div style={{
      height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: '2.5px solid rgba(0,204,245,0.15)',
        borderTopColor: '#00ccf5',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ fontSize: '0.72rem', color: 'rgba(154,170,191,0.45)' }}>3D Körper wird geladen…</p>
    </div>
  )
}

// ── Zone list row ─────────────────────────────────────────────────────────────
function ZoneRow({ zone, days, isRec, onSelect, onLog }: {
  zone: InjectionZone; days: number | undefined; isRec: boolean
  onSelect: () => void; onLog: () => void
}) {
  const d = days
  const pct = recoveryPct(d)
  const color = d === undefined ? '#10b981' : d === 0 ? '#ef4444' : d === 1 ? '#f97316' : d <= 3 ? '#eab308' : d <= 5 ? '#22c55e' : '#10b981'

  return (
    <div onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
      cursor: 'pointer', transition: 'background 0.12s',
      background: isRec ? 'rgba(0,204,245,0.04)' : 'transparent',
    }}>
      {/* Recovery arc */}
      <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
        <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${pct * 0.879} 87.9`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
            style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.52rem', fontWeight: 800, color,
        }}>
          {pct}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#eaeefc', lineHeight: 1 }}>
            {zone.label}
          </p>
          {isRec && (
            <span style={{
              fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase',
              background: 'rgba(0,204,245,0.12)', color: '#00ccf5',
              border: '1px solid rgba(0,204,245,0.22)', padding: '1px 5px', borderRadius: 4,
            }}>⭐</span>
          )}
        </div>
        <p style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.4)' }}>{zone.muscle}</p>
      </div>

      <p style={{ fontSize: '0.72rem', fontWeight: 700, color, minWidth: 52, textAlign: 'right' }}>
        {d === undefined ? 'Frei' : d === 0 ? 'Heute' : d === 1 ? 'Gestern' : `vor ${d}T`}
      </p>

      <button
        onClick={e => { e.stopPropagation(); onLog() }}
        disabled={(d ?? 100) < HEALING_DAYS}
        style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: (d ?? 100) >= HEALING_DAYS ? 'rgba(0,204,245,0.09)' : 'rgba(255,255,255,0.03)',
          border: (d ?? 100) >= HEALING_DAYS ? '1px solid rgba(0,204,245,0.2)' : '1px solid rgba(255,255,255,0.05)',
          color: (d ?? 100) >= HEALING_DAYS ? 'rgba(0,204,245,0.65)' : 'rgba(154,170,191,0.2)',
          fontSize: '0.75rem', cursor: (d ?? 100) >= HEALING_DAYS ? 'pointer' : 'not-allowed',
        }}>
        ✓
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function InjectionTracker3D() {
  const [days,       setDays]       = useState<Record<string, number>>(MOCK_DAYS)
  const [selected,   setSelected]   = useState<string | null>(null)
  const [history,    setHistory]    = useState<HistEntry[]>([])
  const [undoToast,  setUndoToast]  = useState<HistEntry | null>(null)
  const [listOpen,   setListOpen]   = useState(false)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])

  const recommended = findRecommended(days)
  const selectedZone = ZONES.find(z => z.key === selected) ?? null

  function logZone(key: string) {
    const zone = ZONES.find(z => z.key === key)!
    const entry: HistEntry = { key, label: zone.label, prev: days[key], ts: Date.now() }
    setDays(p => ({ ...p, [key]: 0 }))
    setHistory(p => [entry, ...p].slice(0, 15))
    setUndoToast(entry)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndoToast(null), 6000)
  }

  function undo(entry: HistEntry) {
    setDays(p => {
      const n = { ...p }
      if (entry.prev === undefined) delete n[entry.key]
      else n[entry.key] = entry.prev
      return n
    })
    setHistory(p => p.filter(e => e.ts !== entry.ts))
    if (undoToast?.ts === entry.ts) {
      setUndoToast(null)
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }

  // Stats
  const freeCount  = ZONES.filter(z => (days[z.key] ?? 100) >= OPTIMAL_DAYS).length
  const warnCount  = ZONES.filter(z => { const d = days[z.key]; return d !== undefined && d < HEALING_DAYS }).length
  const avgRecovery = Math.round(ZONES.reduce((s, z) => s + recoveryPct(days[z.key]), 0) / ZONES.length)

  const sortedZones = [...ZONES].sort((a, b) => recoveryPct(days[b.key]) - recoveryPct(days[a.key]))

  return (
    <div style={{ paddingBottom: 96 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 18, paddingTop: 4 }}>
        <h1 style={{
          fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#eaeefc', lineHeight: 1.1,
        }}>💉 Injektionsstellen</h1>
        <p style={{ fontSize: '0.72rem', color: 'rgba(154,170,191,0.45)', marginTop: 3 }}>
          3D Rotationsprotokoll · Tippe eine Zone an
        </p>
      </div>

      {/* ── Stats strip ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { icon: <Zap size={12} />,      label: 'Recovery ∅', value: `${avgRecovery}%`, color: avgRecovery >= 80 ? '#10b981' : avgRecovery >= 50 ? '#eab308' : '#ef4444' },
          { icon: <Activity size={12} />, label: 'Frei',        value: `${freeCount}`,   color: '#10b981' },
          { icon: <Activity size={12} />, label: 'Pause',       value: `${warnCount}`,   color: warnCount > 0 ? '#ef4444' : '#4b5563' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, borderRadius: 12, padding: '9px 8px', textAlign: 'center',
            background: 'rgba(8,12,26,0.9)', border: '1px solid rgba(255,255,255,0.055)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2, color: s.color, opacity: 0.75 }}>
              {s.icon}
              <span style={{ fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(154,170,191,0.4)' }}>
                {s.label}
              </span>
            </div>
            <p style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Recommendation banner ── */}
      {recommended && (() => {
        const z = ZONES.find(x => x.key === recommended)!
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 11,
            background: 'linear-gradient(135deg, rgba(0,204,245,0.08), rgba(0,100,180,0.05))',
            border: '1px solid rgba(0,204,245,0.18)', borderRadius: 14,
            padding: '11px 14px', marginBottom: 14,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(0,204,245,0.12)', border: '1.5px solid rgba(0,204,245,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
            }}>⭐</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(0,204,245,0.7)', marginBottom: 2 }}>Optimale Zone heute</p>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#eaeefc' }}>{z.label}</p>
              <p style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.42)', marginTop: 1 }}>
                {z.muscle} · Recovery {recoveryPct(days[z.key])}%
              </p>
            </div>
            <button onClick={() => { logZone(z.key) }} style={{
              padding: '8px 14px', borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(0,204,245,0.20), rgba(0,120,200,0.12))',
              border: '1px solid rgba(0,204,245,0.30)',
              color: '#00ccf5', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer',
            }}>✓ Hier</button>
          </div>
        )
      })()}

      {/* ── 3D Body Canvas ── */}
      <div style={{
        background: 'linear-gradient(175deg, rgba(8,14,32,0.98), rgba(5,9,22,1))',
        border: '1px solid rgba(0,204,245,0.08)',
        borderRadius: 24, overflow: 'hidden', marginBottom: 14,
        boxShadow: '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
        position: 'relative',
      }}>
        {/* Gesture hint */}
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          fontSize: '0.55rem', fontWeight: 600, color: 'rgba(154,170,191,0.35)',
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '3px 7px',
          backdropFilter: 'blur(4px)',
        }}>
          <span>👆</span> Drehen · Zoomen
        </div>

        {/* Spin-animation for loading */}
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

        <Suspense fallback={<LoadingBody />}>
          <BodyScene
            zones={ZONES}
            days={days}
            recommended={recommended}
            selected={selected}
            onZoneClick={key => setSelected(prev => prev === key ? null : key)}
            autoRotate={true}
            height={480}
          />
        </Suspense>

        {/* Legend */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '5px 10px',
          justifyContent: 'center', padding: '10px 16px 14px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          {[
            { c: '#10b981', l: '5+ T · frei' },
            { c: '#eab308', l: '2–3 T · ok' },
            { c: '#f97316', l: 'Gestern' },
            { c: '#ef4444', l: 'Heute · Pause' },
          ].map(x => (
            <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: x.c, boxShadow: `0 0 5px ${x.c}99` }} />
              <span style={{ fontSize: '0.55rem', color: 'rgba(154,170,191,0.5)' }}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zone list (collapsible) ── */}
      <div style={{
        background: 'rgba(8,12,26,0.92)', border: '1px solid rgba(255,255,255,0.055)',
        borderRadius: 18, overflow: 'hidden', marginBottom: 12,
      }}>
        <button
          onClick={() => setListOpen(p => !p)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: listOpen ? '1px solid rgba(255,255,255,0.045)' : 'none',
          }}
        >
          <RotateCcw size={13} color="rgba(0,204,245,0.5)" />
          <span style={{ flex: 1, textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(154,170,191,0.45)' }}>
            Alle Zonen · Rotation
          </span>
          {listOpen ? <ChevronUp size={14} color="rgba(154,170,191,0.4)" /> : <ChevronDown size={14} color="rgba(154,170,191,0.4)" />}
        </button>

        {listOpen && sortedZones.map((zone, i) => (
          <div key={zone.key} style={{ borderBottom: i < sortedZones.length - 1 ? '1px solid rgba(255,255,255,0.032)' : 'none' }}>
            <ZoneRow
              zone={zone}
              days={days[zone.key]}
              isRec={recommended === zone.key}
              onSelect={() => setSelected(prev => prev === zone.key ? null : zone.key)}
              onLog={() => logZone(zone.key)}
            />
          </div>
        ))}
      </div>

      {/* ── History ── */}
      {history.length > 0 && (
        <div style={{
          background: 'rgba(8,12,26,0.92)', border: '1px solid rgba(255,255,255,0.055)',
          borderRadius: 16, overflow: 'hidden', marginBottom: 12,
        }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.045)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Undo2 size={12} color="rgba(154,170,191,0.4)" />
            <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(154,170,191,0.4)' }}>
              Verlauf
            </span>
          </div>
          {history.slice(0, 5).map((e, i) => (
            <div key={e.ts} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
              borderBottom: i < Math.min(history.length, 5) - 1 ? '1px solid rgba(255,255,255,0.032)' : 'none',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00ccf5', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(234,238,252,0.8)' }}>{e.label}</p>
                <p style={{ fontSize: '0.57rem', color: 'rgba(154,170,191,0.36)', marginTop: 1 }}>
                  {new Date(e.ts).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr
                </p>
              </div>
              <button onClick={() => undo(e)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8,
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.16)',
                color: 'rgba(239,68,68,0.65)', fontSize: '0.63rem', fontWeight: 700, cursor: 'pointer',
              }}>
                <Undo2 size={10} /> Rückgängig
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Info ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '10px 13px', borderRadius: 11,
        background: 'rgba(0,204,245,0.03)', border: '1px solid rgba(0,204,245,0.08)',
      }}>
        <Info size={13} color="rgba(0,204,245,0.4)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: '0.61rem', color: 'rgba(154,170,191,0.45)', lineHeight: 1.55 }}>
          Mindestens <strong style={{ color: 'rgba(154,170,191,0.7)' }}>2 Tage</strong> Pause pro Zone.
          Der Recovery-Score berechnet sich aus der Zeit seit der letzten Injektion.
        </p>
      </div>

      {/* ── Zone Detail Sheet ── */}
      <ZoneDetailSheet
        zone={selectedZone}
        days={selectedZone ? days[selectedZone.key] : undefined}
        isRec={selected === recommended}
        onClose={() => setSelected(null)}
        onLog={key => { logZone(key); setSelected(null) }}
      />

      {/* ── Undo toast ── */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: 86, left: '50%', transform: 'translateX(-50%)',
          zIndex: 300, width: 'calc(100% - 32px)', maxWidth: 380,
          background: 'rgba(8,13,32,0.97)', border: '1px solid rgba(0,204,245,0.22)',
          borderRadius: 15, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 10px 40px rgba(0,0,0,0.55)',
          backdropFilter: 'blur(14px)',
          animation: 'ob-step-enter 0.2s ease-out',
        }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b98166', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#eaeefc' }}>{undoToast.label} markiert</p>
            <p style={{ fontSize: '0.61rem', color: 'rgba(154,170,191,0.48)', marginTop: 1 }}>Heute · Recovery-Zähler gestartet</p>
          </div>
          <button onClick={() => undo(undoToast)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9,
            background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)',
            color: '#f87171', fontSize: '0.71rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}>
            <Undo2 size={12} /> Rückgängig
          </button>
        </div>
      )}
    </div>
  )
}
