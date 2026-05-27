import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'

// ── CSS animations ────────────────────────────────────────────────────────
const STAT_CSS = `
/* Intake: border pulse when <1h */
@keyframes qsc-intake-pulse {
  0%,100% { box-shadow: 0 0 10px rgba(0,204,245,0.32); }
  50%     { box-shadow: 0 0 24px rgba(0,204,245,0.72), 0 0 44px rgba(0,204,245,0.22); }
}

/* Fire level 1 — 1-3 days: soft orange flicker */
@keyframes qsc-fire-1 {
  0%,100% {
    box-shadow:
      0 0 0 1.5px #f97316,
      0 0 6px  2px rgba(249,115,22,0.45),
      0 0 14px 3px rgba(249,115,22,0.20);
  }
  50% {
    box-shadow:
      0 0 0 1.5px #fbbf24,
      0 0 10px 3px rgba(251,191,36,0.60),
      0 0 20px 5px rgba(251,191,36,0.22);
  }
}

/* Fire level 2 — 4-7 days: orange/red, faster */
@keyframes qsc-fire-2 {
  0%,100% {
    box-shadow:
      0 0 0 2px #f97316,
      0 0 10px 3px rgba(249,115,22,0.60),
      0 0 24px 6px rgba(239, 68, 68,0.32),
      0 0 40px 8px rgba(249,115,22,0.16);
  }
  33% {
    box-shadow:
      0 0 0 2px #ef4444,
      0 0  8px 3px rgba(239, 68, 68,0.70),
      0 0 20px 5px rgba(249,115,22,0.40),
      0 0 36px 8px rgba(239, 68, 68,0.18);
  }
  66% {
    box-shadow:
      0 0 0 2px #fbbf24,
      0 0 14px 4px rgba(251,191,36,0.65),
      0 0 28px 7px rgba(249,115,22,0.45),
      0 0 46px 10px rgba(251,191,36,0.18);
  }
}

/* Fire level 3 — 8+ days: inferno, fast irregular */
@keyframes qsc-fire-3 {
  0% {
    box-shadow:
      0 0 0 2.5px #fef08a,
      0 0 10px 4px  #f97316,
      0 0 24px 7px  rgba(239, 68, 68,0.60),
      0 0 44px 12px rgba(249,115,22,0.32),
      0 0 70px 18px rgba(239, 68, 68,0.14);
  }
  25% {
    box-shadow:
      0 0 0 3px   #ef4444,
      0 0 16px 6px  #fbbf24,
      0 0 34px 10px rgba(249,115,22,0.68),
      0 0 58px 16px rgba(239, 68, 68,0.28),
      0 0 90px 22px rgba(249,115,22,0.12);
  }
  50% {
    box-shadow:
      0 0 0 2px   #f97316,
      0 0  8px 3px  #ef4444,
      0 0 20px 6px  rgba(251,191,36,0.55),
      0 0 40px 10px rgba(249,115,22,0.30),
      0 0 64px 16px rgba(239, 68, 68,0.14);
  }
  75% {
    box-shadow:
      0 0 0 3px   #fef08a,
      0 0 20px 7px  #f97316,
      0 0 38px 11px rgba(239, 68, 68,0.65),
      0 0 66px 18px rgba(249,115,22,0.34),
      0 0 96px 24px rgba(239, 68, 68,0.14);
  }
  100% {
    box-shadow:
      0 0 0 2.5px #fef08a,
      0 0 10px 4px  #f97316,
      0 0 24px 7px  rgba(239, 68, 68,0.60),
      0 0 44px 12px rgba(249,115,22,0.32),
      0 0 70px 18px rgba(239, 68, 68,0.14);
  }
}

/* Today 100%: celebration glow */
@keyframes qsc-celebrate {
  0%,100% { box-shadow: 0 0 10px rgba(16,185,129,0.42); }
  50%     { box-shadow: 0 0 22px rgba(16,185,129,0.80), 0 0 44px rgba(16,185,129,0.28); }
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

  const value   = todayDone ? '✓' : (nextIntake ?? '–')
  const empty   = todayDone ? 'rgba(16,185,129,0.14)' : 'rgba(0,204,245,0.12)'
  const deg     = progress * 360

  return (
    // Outer wrapper: 1.5px padding shows the conic-gradient as a thin border strip
    <div
      style={{
        padding: '1.5px',
        borderRadius: 20,
        background: `conic-gradient(from -90deg, ${accent} ${deg}deg, ${empty} ${deg}deg)`,
        animation: underOneHour ? 'qsc-intake-pulse 1.8s ease-in-out infinite' : undefined,
        willChange: underOneHour ? 'box-shadow' : undefined,
      }}
    >
      {/* Inner card — fully opaque so gradient can't bleed through */}
      <div style={{
        background: 'rgb(5, 8, 20)',
        borderRadius: 18,
        padding: '11px 9px',
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
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

// ── 2. StreakStat — animated box-shadow fire border ───────────────────────
//
// box-shadow: 0 0 0 Npx COLOR → solid ring around all 4 sides (like outline)
// Additional spread/blur layers create the glow/fire effect.
// This goes uniformly around the entire card perimeter unlike rotating gradients.

const FIRE_ANIM = ['', 'qsc-fire-1 2.4s ease-in-out infinite', 'qsc-fire-2 1.5s ease-in-out infinite', 'qsc-fire-3 0.85s ease-in-out infinite']

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
  const level  = streak === 0 ? 0 : streak <= 3 ? 1 : streak <= 7 ? 2 : 3
  const accent = streak === 0 ? '#64748b' : '#f59e0b'
  const hasfire = level > 0

  return (
    <div style={{
      background: 'rgb(5, 8, 20)',
      borderRadius: 18,
      padding: '11px 9px',
      minWidth: 0,
      border: !hasfire ? '1px solid rgba(255,255,255,0.07)' : 'none',
      animation: hasfire ? FIRE_ANIM[level] : undefined,
      willChange: hasfire ? 'box-shadow' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <Flame
          size={13}
          color={streak > 0 ? '#f97316' : '#64748b'}
          fill={streak >= 4 ? '#f97316' : 'none'}
        />
        <p style={LABEL_STYLE}>{label}</p>
      </div>
      <p style={{
        fontSize: '1.34rem',
        fontWeight: 900,
        letterSpacing: '-0.04em',
        color: accent,
        lineHeight: 1,
      }}>
        {streak}
      </p>
      <p style={HINT_STYLE}>{hint}</p>
    </div>
  )
}

// ── 3. TodayStat — large SVG progress ring ───────────────────────────────

const RING_SZ  = 64
const RING_C   = RING_SZ / 2   // 32
const RING_R   = 26
const RING_SW  = 4.5           // stroke width
const RING_CIR = 2 * Math.PI * RING_R   // ≈ 163.4

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
  // Offset to start arc at 12-o'clock (default SVG start = 3-o'clock → shift 25%)
  const offset = RING_CIR * 0.25

  return (
    <div style={{
      background: 'rgb(5, 8, 20)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 18,
      padding: '10px 6px',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      animation: done ? 'qsc-celebrate 1.8s ease-in-out infinite' : undefined,
      willChange: done ? 'box-shadow' : undefined,
    }}>
      <svg
        width={RING_SZ}
        height={RING_SZ}
        viewBox={`0 0 ${RING_SZ} ${RING_SZ}`}
      >
        {/* Background track */}
        <circle
          cx={RING_C} cy={RING_C} r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={RING_SW}
        />
        {/* Progress arc */}
        {pct > 0 && (
          <circle
            cx={RING_C} cy={RING_C} r={RING_R}
            fill="none"
            stroke={color}
            strokeWidth={RING_SW}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${empty}`}
            strokeDashoffset={offset}
            style={{
              filter: done
                ? `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 10px ${color}88)`
                : `drop-shadow(0 0 3px ${color}cc)`,
              transition: 'stroke 0.4s ease',
            }}
          />
        )}
        {/* Percentage in center */}
        <text
          x={RING_C}
          y={RING_C}
          textAnchor="middle"
          dominantBaseline="central"
          fill={pct === 0 ? 'rgba(154,170,191,0.40)' : color}
          style={{
            fontSize: 11,
            fontWeight: 900,
            fontFamily: 'inherit',
          }}
        >
          {pct}%
        </text>
      </svg>

      <p style={{
        ...LABEL_STYLE,
        color: done ? color : 'rgba(154,170,191,0.58)',
      }}>
        {label}
      </p>
    </div>
  )
}
