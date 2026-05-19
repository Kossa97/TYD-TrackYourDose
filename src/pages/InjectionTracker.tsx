import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Info } from 'lucide-react'

// ── Zone definitions ──────────────────────────────────────────────────────────
interface Zone {
  key: string
  label: string
  shortLabel: string
  view: 'front' | 'back'
  cx: number
  cy: number
  r?: number
}

const ZONES: Zone[] = [
  // Front
  { key: 'deltoid_l',  label: 'Deltoid links',         shortLabel: 'Del L', view: 'front', cx: 44,  cy: 97  },
  { key: 'deltoid_r',  label: 'Deltoid rechts',        shortLabel: 'Del R', view: 'front', cx: 156, cy: 97  },
  { key: 'bauch_l',    label: 'Bauch links',           shortLabel: 'Bau L', view: 'front', cx: 82,  cy: 152 },
  { key: 'bauch_r',    label: 'Bauch rechts',          shortLabel: 'Bau R', view: 'front', cx: 118, cy: 152 },
  { key: 'ober_l',     label: 'Oberschenkel links',    shortLabel: 'Obe L', view: 'front', cx: 80,  cy: 228 },
  { key: 'ober_r',     label: 'Oberschenkel rechts',   shortLabel: 'Obe R', view: 'front', cx: 120, cy: 228 },
  // Back
  { key: 'gesaess_l',  label: 'Gesäß links',           shortLabel: 'Ges L', view: 'back',  cx: 82,  cy: 182 },
  { key: 'gesaess_r',  label: 'Gesäß rechts',          shortLabel: 'Ges R', view: 'back',  cx: 118, cy: 182 },
  { key: 'ober_hl',    label: 'Oberschenkel hinten L', shortLabel: 'OhL',   view: 'back',  cx: 80,  cy: 240 },
  { key: 'ober_hr',    label: 'Oberschenkel hinten R', shortLabel: 'OhR',   view: 'back',  cx: 120, cy: 240 },
  { key: 'del_hl',     label: 'Deltoid hinten links',  shortLabel: 'DhL',   view: 'back',  cx: 44,  cy: 97  },
  { key: 'del_hr',     label: 'Deltoid hinten rechts', shortLabel: 'DhR',   view: 'back',  cx: 156, cy: 97  },
]

// ── Mock data (days since last injection) — will be real DB data later ────────
const MOCK_DAYS: Record<string, number> = {
  deltoid_l: 0,   // heute
  deltoid_r: 2,
  bauch_l:   6,
  bauch_r:   3,
  ober_l:    1,
  ober_r:    8,
  gesaess_l: 10,
  gesaess_r: 4,
  ober_hl:   0,
  ober_hr:   7,
  del_hl:    5,
  del_hr:    2,
}

// ── Color scale ───────────────────────────────────────────────────────────────
function zoneColor(days: number | undefined): { fill: string; glow: string; label: string; dot: string } {
  if (days === undefined) return { fill: 'rgba(60,80,110,0.35)', glow: 'transparent', label: '–', dot: '#4b5563' }
  if (days === 0) return { fill: 'rgba(239,68,68,0.25)',  glow: 'rgba(239,68,68,0.5)',  label: 'Heute',    dot: '#ef4444' }
  if (days === 1) return { fill: 'rgba(249,115,22,0.22)', glow: 'rgba(249,115,22,0.45)', label: 'Gestern', dot: '#f97316' }
  if (days <= 3)  return { fill: 'rgba(234,179,8,0.20)',  glow: 'rgba(234,179,8,0.4)',  label: `${days}T`, dot: '#eab308' }
  if (days <= 5)  return { fill: 'rgba(34,197,94,0.18)',  glow: 'rgba(34,197,94,0.35)', label: `${days}T`, dot: '#22c55e' }
  return                 { fill: 'rgba(16,185,129,0.22)', glow: 'rgba(16,185,129,0.45)', label: `${days}T`, dot: '#10b981' }
}

// ── SVG Body Silhouette ───────────────────────────────────────────────────────
function BodySilhouette({ view }: { view: 'front' | 'back' }) {
  const fill = 'rgba(15,22,42,0.9)'
  const stroke = 'rgba(100,140,180,0.22)'
  const sw = 1.5

  return (
    <g>
      {/* Head */}
      <ellipse cx="100" cy="36" rx="24" ry="28" fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Neck */}
      <rect x="92" y="62" width="16" height="14" rx="5" fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Torso */}
      <path d="M66,73 Q57,80 55,97 L55,178 Q55,186 67,186 L133,186 Q145,186 145,178 L145,97 Q143,80 134,73 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Left shoulder */}
      <ellipse cx="51" cy="82" rx="17" ry="11" fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Right shoulder */}
      <ellipse cx="149" cy="82" rx="17" ry="11" fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Left upper arm */}
      <path d="M33,80 Q26,88 25,105 L25,158 Q25,165 34,166 L54,166 Q60,164 60,157 L60,93 Q58,83 48,79 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Right upper arm */}
      <path d="M167,80 Q174,88 175,105 L175,158 Q175,165 166,166 L146,166 Q140,164 140,157 L140,93 Q142,83 152,79 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Left forearm */}
      <path d="M27,157 L27,215 Q27,222 35,222 L52,222 Q58,222 60,215 L60,157 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Right forearm */}
      <path d="M173,157 L173,215 Q173,222 165,222 L148,222 Q142,222 140,215 L140,157 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Left leg */}
      <path d="M65,186 L65,298 Q65,306 75,306 L96,306 Q104,306 104,298 L104,186 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      {/* Right leg */}
      <path d="M96,186 L96,298 Q96,306 104,306 L125,306 Q135,306 135,298 L135,186 Z"
        fill={fill} stroke={stroke} strokeWidth={sw} />

      {/* Back-specific spine line */}
      {view === 'back' && (
        <line x1="100" y1="78" x2="100" y2="178" stroke="rgba(100,140,180,0.12)" strokeWidth="1" strokeDasharray="4 4" />
      )}
    </g>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function InjectionTracker() {
  const { t } = useTranslation()
  const [view, setView] = useState<'front' | 'back'>('front')
  const [selected, setSelected] = useState<string | null>(null)
  const [days, setDays] = useState<Record<string, number>>(MOCK_DAYS)

  const visibleZones = ZONES.filter(z => z.view === view)

  // Best recommendation: zone with most days since last use (min 2)
  const allZones = ZONES
  const recommended = allZones
    .map(z => ({ ...z, d: days[z.key] ?? 999 }))
    .filter(z => (days[z.key] ?? 999) >= 2)
    .sort((a, b) => b.d - a.d)[0]

  function logZone(key: string) {
    setDays(prev => ({ ...prev, [key]: 0 }))
    setSelected(key)
    setTimeout(() => setSelected(null), 1200)
  }

  const sortedList = ZONES.slice().sort((a, b) => (days[b.key] ?? 999) - (days[a.key] ?? 999))

  return (
    <div className="pb-24">

      {/* ── Header ── */}
      <div className="mb-5 pt-1">
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#eaeefc' }}>
          💉 Injektionsstellen
        </h1>
        <p style={{ fontSize: '0.72rem', color: 'rgba(154,170,191,0.55)', marginTop: 3 }}>
          Rotationsprotokoll – tippe auf eine Zone zum Markieren
        </p>
      </div>

      {/* ── Recommendation Banner ── */}
      {recommended && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(0,204,245,0.08))',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 14, padding: '10px 14px',
          marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.2rem' }}>⭐</span>
          <div>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(16,185,129,0.8)', marginBottom: 1 }}>
              Empfohlen
            </p>
            <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#eaeefc' }}>
              {recommended.label}
              <span style={{ color: 'rgba(16,185,129,0.8)', fontWeight: 400, marginLeft: 6, fontSize: '0.72rem' }}>
                · zuletzt vor {recommended.d === 999 ? 'noch nie' : `${recommended.d} Tagen`}
              </span>
            </p>
          </div>
          <button
            onClick={() => { logZone(recommended.key); if (recommended.view !== view) setView(recommended.view) }}
            style={{
              marginLeft: 'auto', padding: '6px 12px', borderRadius: 8,
              background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.35)',
              color: '#10b981', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
            }}>
            ✓ Markieren
          </button>
        </div>
      )}

      {/* ── Front / Back Toggle ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['front', 'back'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 10, fontWeight: 700,
              fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.15s',
              background: view === v ? 'rgba(0,204,245,0.15)' : 'rgba(10,14,30,0.8)',
              border: view === v ? '1px solid rgba(0,204,245,0.4)' : '1px solid rgba(255,255,255,0.06)',
              color: view === v ? '#00ccf5' : 'rgba(154,170,191,0.6)',
            }}>
            {v === 'front' ? '👤 Vorderseite' : '🔄 Rückseite'}
          </button>
        ))}
      </div>

      {/* ── SVG Body Map ── */}
      <div style={{
        background: 'rgba(8,12,26,0.9)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20, padding: '12px 0', marginBottom: 16,
        display: 'flex', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 200 330" width="200" height="330" style={{ overflow: 'visible' }}>
          <BodySilhouette view={view} />

          {/* Injection zone circles */}
          {visibleZones.map(zone => {
            const d = days[zone.key]
            const c = zoneColor(d)
            const r = zone.r ?? 15
            const isSelected = selected === zone.key
            const isRec = recommended?.key === zone.key

            return (
              <g key={zone.key} onClick={() => logZone(zone.key)} style={{ cursor: 'pointer' }}>
                {/* Glow ring */}
                <circle cx={zone.cx} cy={zone.cy} r={r + 5}
                  fill="none" stroke={c.glow} strokeWidth="1.5" opacity={0.6} />
                {/* Zone circle */}
                <circle cx={zone.cx} cy={zone.cy} r={r}
                  fill={c.fill}
                  stroke={isSelected ? '#ffffff' : isRec ? '#10b981' : c.dot}
                  strokeWidth={isSelected ? 2.5 : isRec ? 2 : 1.5}
                  style={{ transition: 'all 0.2s' }}
                />
                {/* Pulse animation on selected */}
                {isSelected && (
                  <circle cx={zone.cx} cy={zone.cy} r={r + 8}
                    fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1"
                    style={{ animation: 'ob-ring-pulse 0.8s ease-out forwards' }}
                  />
                )}
                {/* Label inside circle */}
                <text x={zone.cx} y={zone.cy - 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={c.dot} fontSize="7.5" fontWeight="700" style={{ pointerEvents: 'none' }}>
                  {zone.shortLabel}
                </text>
                <text x={zone.cx} y={zone.cy + 6.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fill={c.dot} fontSize="6.5" fontWeight="600" opacity={0.85} style={{ pointerEvents: 'none' }}>
                  {c.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── Legend ── */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16,
        background: 'rgba(8,12,26,0.8)', border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12, padding: '8px 12px', flexWrap: 'wrap',
      }}>
        {[
          { dot: '#10b981', label: '5+ Tage · frei' },
          { dot: '#eab308', label: '2–4 Tage · ok' },
          { dot: '#f97316', label: 'Gestern · warten' },
          { dot: '#ef4444', label: 'Heute · Pause' },
        ].map(leg => (
          <div key={leg.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: leg.dot, flexShrink: 0 }} />
            <span style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.6)' }}>{leg.label}</span>
          </div>
        ))}
      </div>

      {/* ── Zone List ── */}
      <div style={{
        background: 'rgba(8,12,26,0.9)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <RotateCcw size={12} style={{ color: 'rgba(0,204,245,0.6)' }} />
          <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(154,170,191,0.5)' }}>
            Alle Zonen · Sortiert nach Rotation
          </span>
        </div>

        {sortedList.map((zone, i) => {
          const d = days[zone.key]
          const c = zoneColor(d)
          const isRec = recommended?.key === zone.key
          return (
            <div key={zone.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px',
                borderBottom: i < sortedList.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                background: isRec ? 'rgba(16,185,129,0.04)' : 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => logZone(zone.key)}
            >
              {/* Color dot */}
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: c.dot,
                boxShadow: `0 0 6px ${c.dot}88`,
              }} />

              {/* Zone name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#eaeefc', lineHeight: 1 }}>
                  {zone.label}
                  {isRec && (
                    <span style={{
                      marginLeft: 6, fontSize: '0.55rem', fontWeight: 700,
                      background: 'rgba(16,185,129,0.2)', color: '#10b981',
                      padding: '1px 5px', borderRadius: 4, verticalAlign: 'middle',
                    }}>⭐ Empfohlen</span>
                  )}
                </p>
                <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.4)', marginTop: 2 }}>
                  {zone.view === 'front' ? 'Vorderseite' : 'Rückseite'}
                </p>
              </div>

              {/* Days */}
              <p style={{
                fontSize: '0.78rem', fontWeight: 700, color: c.dot,
                minWidth: 52, textAlign: 'right',
              }}>
                {d === undefined ? '–' : d === 0 ? 'Heute' : d === 1 ? 'Gestern' : `vor ${d}T`}
              </p>

              {/* Log button */}
              <button
                onClick={e => { e.stopPropagation(); logZone(zone.key) }}
                style={{
                  padding: '4px 10px', borderRadius: 7, fontSize: '0.65rem', fontWeight: 700,
                  background: 'rgba(0,204,245,0.1)', border: '1px solid rgba(0,204,245,0.2)',
                  color: 'rgba(0,204,245,0.7)', cursor: 'pointer', flexShrink: 0,
                }}>
                ✓
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Info hint ── */}
      <div style={{
        marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 7,
        padding: '10px 12px', borderRadius: 10,
        background: 'rgba(0,204,245,0.04)', border: '1px solid rgba(0,204,245,0.1)',
      }}>
        <Info size={13} style={{ color: 'rgba(0,204,245,0.5)', flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.5)', lineHeight: 1.5 }}>
          Injektion mindestens <strong style={{ color: 'rgba(154,170,191,0.75)' }}>2 Tage</strong> rotieren um Narbenbildung zu vermeiden. Grüne Zonen sind am längsten frei.
        </p>
      </div>

    </div>
  )
}
