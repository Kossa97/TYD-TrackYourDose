import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'

// ── CSS animations (injected once) ───────────────────────────────────────
const STAT_CSS = `
@keyframes qsc-fire-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes qsc-intake-pulse {
  0%,100% { box-shadow: 0 0 8px rgba(0,204,245,0.30); }
  50%     { box-shadow: 0 0 22px rgba(0,204,245,0.68), 0 0 38px rgba(0,204,245,0.20); }
}
@keyframes qsc-celebrate {
  0%,100% { box-shadow: 0 0 8px rgba(16,185,129,0.38); }
  50%     { box-shadow: 0 0 20px rgba(16,185,129,0.75), 0 0 40px rgba(16,185,129,0.26); }
}
`
let cssReady = false
function ensureCSS() {
  if (cssReady || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.id = 'qsc-animations'
  el.textContent = STAT_CSS
  document.head.appendChild(el)
  cssReady = true
}

const CELL_BASE = {
  borderRadius: 18,
  padding: '11px 9px',
  minWidth: 0,
} as const

const LABEL_STYLE = {
  fontSize: '0.52rem',
  fontWeight: 800,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'rgba(154,170,191,0.58)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const

const HINT_STYLE = {
  fontSize: '0.55rem',
  color: 'rgba(154,170,191,0.48)',
  marginTop: 4,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const

// ── 1. NextIntakeStat — conic-gradient progress border ───────────────────

export function NextIntakeStat({
  nextIntake,
  todayDone,
  label,
  hint,
}: {
  nextIntake: string | null
  todayDone: boolean
  label: string
  hint: string
}) {
  ensureCSS()
  const accent = todayDone ? '#10b981' : '#00ccf5'
  const [progress, setProgress] = useState(0)
  const [underOneHour, setUnderOneHour] = useState(false)

  useEffect(() => {
    function compute() {
      if (todayDone) { setProgress(1); setUnderOneHour(false); return }
      if (!nextIntake) { setProgress(0); setUnderOneHour(false); return }
      const [h, m] = nextIntake.split(':').map(Number)
      const nextMin = h * 60 + m
      const now = new Date()
      const curMin = now.getHours() * 60 + now.getMinutes()
      setProgress(nextMin > 0 ? Math.min(1, curMin / nextMin) : 0)
      setUnderOneHour(nextMin > curMin && nextMin - curMin < 60)
    }
    compute()
    const id = setInterval(compute, 30_000)
    return () => clearInterval(id)
  }, [nextIntake, todayDone])

  const value    = todayDone ? '✓' : (nextIntake ?? '–')
  const empty    = todayDone ? 'rgba(16,185,129,0.13)' : 'rgba(0,204,245,0.11)'
  const deg      = progress * 360

  return (
    <div
      style={{
        padding: 2,
        borderRadius: 20,
        // Conic gradient traces the border: filled = progress, rest = unfilled
        background: `conic-gradient(from -90deg, ${accent} ${deg}deg, ${empty} ${deg}deg)`,
        animation: underOneHour ? 'qsc-intake-pulse 1.8s ease-in-out infinite' : undefined,
        willChange: underOneHour ? 'box-shadow' : undefined,
      }}
    >
      <div style={{ ...CELL_BASE, background: 'rgba(2,6,18,0.90)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          {/* Clock icon inline SVG to avoid an extra import */}
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
            stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx={12} cy={12} r={10} />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p style={LABEL_STYLE}>{label}</p>
        </div>
        <p style={{
          fontSize: value.length > 4 ? '1.03rem' : '1.34rem',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: accent,
          lineHeight: 1,
        }}>
          {value}
        </p>
        <p style={HINT_STYLE}>{hint}</p>
      </div>
    </div>
  )
}

// ── 2. StreakStat — rotating fire conic-gradient border ──────────────────

const FIRE_GRADIENT = [
  '',                                                                                // level 0 (unused)
  '#f97316 0%, #fbbf24 30%, #f97316 60%, #d97706 100%',                           // level 1 (1–3 days)
  '#f97316 0%, #fbbf24 20%, #ef4444 45%, #fbbf24 70%, #f97316 100%',              // level 2 (4–7 days)
  '#f97316 0%, #fef08a 15%, #ef4444 35%, #fbbf24 55%, #dc2626 75%, #fef08a 90%, #f97316 100%', // level 3 (8+)
]
const FIRE_SPEED   = ['', '2.8s', '2.0s', '1.1s']
const FIRE_OPACITY = [0,   0.48,   0.72,   0.94]

export function StreakStat({
  streak,
  label,
  hint,
}: {
  streak: number
  label: string
  hint: string
}) {
  ensureCSS()
  const level   = streak === 0 ? 0 : streak <= 3 ? 1 : streak <= 7 ? 2 : 3
  const accent  = streak === 0 ? '#64748b' : '#f59e0b'
  const hasfire = level > 0
  const glow    = level === 3
    ? '0 0 20px rgba(249,115,22,0.44), 0 0 40px rgba(249,115,22,0.16)'
    : undefined

  return (
    <div style={{
      position: 'relative',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: glow,
      willChange: hasfire ? 'transform' : undefined,
    }}>
      {/* Rotating gradient — clipped by parent overflow:hidden */}
      {hasfire && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            // Center a large square so all card edges are covered at any rotation angle
            top: '50%',
            left: '50%',
            width: 280,
            height: 280,
            marginTop: -140,
            marginLeft: -140,
            background: `conic-gradient(${FIRE_GRADIENT[level]})`,
            opacity: FIRE_OPACITY[level],
            animation: `qsc-fire-rotate ${FIRE_SPEED[level]} linear infinite`,
            willChange: 'transform',
          }}
        />
      )}

      {/* Inner card — sits on top, margin creates the visible fire strip */}
      <div style={{
        ...CELL_BASE,
        position: 'relative',
        margin: hasfire ? 2 : 0,
        borderRadius: hasfire ? 17 : 20,
        background: 'rgba(2,6,18,0.92)',
        border: !hasfire ? '1px solid rgba(255,255,255,0.07)' : undefined,
        zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          <Flame size={13} color={streak > 0 ? '#f97316' : '#64748b'} fill={streak > 2 ? '#f97316' : 'none'} />
          <p style={LABEL_STYLE}>{label}</p>
        </div>
        <p style={{ fontSize: '1.34rem', fontWeight: 900, letterSpacing: '-0.04em', color: accent, lineHeight: 1 }}>
          {streak}
        </p>
        <p style={HINT_STYLE}>{hint}</p>
      </div>
    </div>
  )
}

// ── 3. TodayStat — SVG progress ring ─────────────────────────────────────

const RING_R   = 17
const RING_SZ  = 44
const RING_C   = RING_SZ / 2
const RING_CIR = 2 * Math.PI * RING_R

export function TodayStat({
  completionLevel,
  label,
}: {
  completionLevel: number
  label: string
}) {
  ensureCSS()
  const pct    = Math.min(100, Math.max(0, completionLevel))
  const done   = pct === 100
  const color  = pct >= 50 ? '#10b981' : '#00ccf5'
  const filled = RING_CIR * (pct / 100)
  const empty  = RING_CIR - filled
  // strokeDashoffset shifts start point to 12-o'clock (default is 3-o'clock = circ*0.25 back)
  const offset = RING_CIR * 0.25

  return (
    <div style={{
      ...CELL_BASE,
      background: 'rgba(2,6,18,0.48)',
      border: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      animation: done ? 'qsc-celebrate 1.8s ease-in-out infinite' : undefined,
      willChange: done ? 'box-shadow' : undefined,
    }}>
      <svg width={RING_SZ} height={RING_SZ} viewBox={`0 0 ${RING_SZ} ${RING_SZ}`}>
        {/* Background track */}
        <circle
          cx={RING_C} cy={RING_C} r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={3.5}
        />
        {/* Progress arc */}
        {pct > 0 && (
          <circle
            cx={RING_C} cy={RING_C} r={RING_R}
            fill="none"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${empty}`}
            strokeDashoffset={offset}
            style={{
              filter: done
                ? `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 9px ${color}66)`
                : `drop-shadow(0 0 2px ${color}99)`,
              transition: 'stroke 0.4s ease',
            }}
          />
        )}
        {/* Percentage text, centered */}
        <text
          x={RING_C}
          y={RING_C}
          textAnchor="middle"
          dominantBaseline="central"
          fill={pct === 0 ? 'rgba(154,170,191,0.4)' : color}
          style={{
            fontSize: 9,
            fontWeight: 900,
            fontFamily: 'inherit',
          }}
        >
          {pct}%
        </text>
      </svg>

      {/* Label below ring */}
      <p style={{
        ...LABEL_STYLE,
        color: done ? color : 'rgba(154,170,191,0.58)',
      }}>
        {label}
      </p>
    </div>
  )
}
