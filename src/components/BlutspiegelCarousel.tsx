import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Activity, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  getCurrentBlutspiegelLevel,
  type BlutspiegelTrend,
  type CurrentBlutspiegelLevel,
} from '../services/blutspiegelHistory'

// ── Typen & Kategorie-Farben ────────────────────────────────────────────────

type PkCategory = 'peptide' | 'glp1' | 'hormone' | 'sarm' | 'other'

interface PkProfileEmbed {
  name: string
  half_life_hours: number
  tmax_hours: number
  bioavailability_sc: number
  category: string
}

interface CycleWithPk {
  id: string
  dose: number
  unit: string
  active: boolean
  end_date: string | null
  peptides: {
    name: string
    pk_profile_id: string | null
    pk_profiles: PkProfileEmbed | null
  } | null
}

interface CarouselCard {
  cycleId: string
  pkProfileId: string
  peptideName: string
  profileName: string
  category: PkCategory
  accent: string
  dose: number
  halfLifeHours: number
  level: CurrentBlutspiegelLevel
}

const CATEGORY_ACCENT: Record<PkCategory, string> = {
  peptide: '#00ccf5',
  glp1: '#10b981',
  hormone: '#f59e0b',
  sarm: '#a855f7',
  other: '#94a3b8',
}

const CATEGORY_LABEL: Record<PkCategory, string> = {
  peptide: 'Peptid',
  glp1: 'GLP-1',
  hormone: 'Hormon',
  sarm: 'SARM',
  other: 'Sonstige',
}

const SWIPE_THRESHOLD_PX = 50
const SWIPE_TRANSITION = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'

const shellStyle: CSSProperties = {
  background: 'linear-gradient(155deg, rgba(9,14,34,0.96), rgba(4,7,18,0.98))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  boxShadow: '0 16px 48px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.05)',
  position: 'relative',
  overflow: 'hidden',
}

function normalizeCategory(raw: string | undefined): PkCategory {
  if (raw === 'peptide' || raw === 'glp1' || raw === 'hormone' || raw === 'sarm') return raw
  return 'other'
}

function isCycleActiveForCarousel(cycle: CycleWithPk, todayKey: string): boolean {
  if (cycle.active) return true
  if (cycle.end_date && cycle.end_date >= todayKey) return true
  return false
}

function formatPeakDisplay(peakLabel: string): string {
  if (!peakLabel || peakLabel === '—') return '—'
  if (peakLabel.startsWith('Peak')) return peakLabel
  return `Peak ${peakLabel}`
}

// ── SVG: Sparkline ──────────────────────────────────────────────────────────

function Sparkline({
  data,
  accent,
  className = 'w-full h-[60px]',
}: {
  data: number[]
  accent: string
  className?: string
}) {
  const w = 280
  const h = 60
  const pad = 2
  const values = data.length ? data : [0]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2)
      const y = pad + (1 - (v - min) / span) * (h - pad * 2)
      return `${x},${y}`
    })
    .join(' ')

  const last = values[values.length - 1] ?? 0
  const lastX = pad + ((values.length - 1) / Math.max(values.length - 1, 1)) * (w - pad * 2)
  const lastY = pad + (1 - (last - min) / span) * (h - pad * 2)

  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity={0.9}
      />
      <circle cx={lastX} cy={lastY} r="3" fill={accent} />
    </svg>
  )
}

const TREND_DISPLAY: Record<BlutspiegelTrend, { label: string; color: string }> = {
  rising: { label: '↑ STEIGEND', color: '#10b981' },
  falling: { label: '↓ FALLEND', color: '#f43f5e' },
  stable: { label: '→ STABIL', color: '#94a3b8' },
}

function LevelDisplay({
  value,
  accent,
  unit,
  trend,
}: {
  value: number
  accent: string
  unit: string
  trend: BlutspiegelTrend
}) {
  const { label, color } = TREND_DISPLAY[trend]
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div>
        <p
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: accent,
            lineHeight: 1,
            letterSpacing: '-0.03em',
          }}
        >
          {clamped.toFixed(2)}
        </p>
        <p
          style={{
            fontSize: '0.62rem',
            color: 'rgba(154,170,191,0.62)',
            marginTop: 4,
          }}
        >
          % {unit}
        </p>
      </div>
      <p
        style={{
          fontSize: '0.58rem',
          fontWeight: 700,
          fontFamily: 'monospace',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color,
          whiteSpace: 'nowrap',
        }}
        aria-label={label}
      >
        {label}
      </p>
    </div>
  )
}

const categoryBadgeStyle = (accent: string): CSSProperties => ({
  display: 'inline-block',
  padding: '3px 8px',
  borderRadius: 999,
  fontSize: '0.55rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: accent,
  background: `${accent}18`,
  border: `1px solid ${accent}33`,
})

function LiveIndicator() {
  return (
    <>
      <span
        className="blutspiegel-live-dot"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#ef4444',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: '0.55rem',
          fontWeight: 700,
          fontFamily: 'monospace',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#ef4444',
        }}
      >
        LIVE
      </span>
    </>
  )
}

// ── Karte ───────────────────────────────────────────────────────────────────

function BlutspiegelCard({ card }: { card: CarouselCard }) {
  const navigate = useNavigate()
  const { accent, level, peptideName, category, pkProfileId } = card

  return (
    <div
      className="w-full sm:max-w-[800px] sm:mx-auto"
      style={{ ...shellStyle, padding: '16px 16px 14px', minHeight: 280 }}
    >
      <style>{`
        @keyframes blutspiegel-live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .blutspiegel-live-dot {
          animation: blutspiegel-live-pulse 1.5s ease-in-out infinite;
        }
      `}</style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 88% 8%, ${accent}22, transparent 38%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Mobile (< sm) */}
      <div className="relative sm:hidden">
        <div
          className="absolute top-0 left-0 z-[2] flex items-center gap-1.5"
          style={{ top: 0, left: 0 }}
        >
          <LiveIndicator />
        </div>

        <div style={{ marginBottom: 12, paddingTop: 4 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.95rem', fontWeight: 850, color: '#f8fbff', lineHeight: 1.2, marginBottom: 6 }}>
              {peptideName}
            </p>
            <span style={categoryBadgeStyle(accent)}>{CATEGORY_LABEL[category]}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <LevelDisplay
            value={level.currentLevel}
            accent={accent}
            unit={level.unit}
            trend={level.trend}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <p style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.52)' }}>
              Verlauf
            </p>
            <Sparkline data={level.sparkData} accent={accent} className="w-full h-[60px]" />
          </div>
        </div>

        <p
          style={{
            textAlign: 'right',
            fontSize: '0.62rem',
            fontWeight: 750,
            color: 'rgba(154,170,191,0.58)',
          }}
        >
          {formatPeakDisplay(level.peakLabel)}
        </p>
      </div>

      {/* Desktop (≥ sm) */}
      <div className="relative hidden sm:grid sm:grid-cols-3 sm:min-h-[200px]">
        <div className="flex flex-col items-center justify-center px-4 py-4 gap-3">
          <LevelDisplay
            value={level.currentLevel}
            accent={accent}
            unit={level.unit}
            trend={level.trend}
          />
          <span style={categoryBadgeStyle(accent)}>{CATEGORY_LABEL[category]}</span>
        </div>

        <div className="flex flex-col border-l border-white/[0.06] px-5 py-4 min-h-[200px]">
          <p
            style={{
              fontSize: '0.58rem',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(154,170,191,0.52)',
              marginBottom: 8,
            }}
          >
            VERLAUF
          </p>
          <Sparkline
            data={level.sparkData}
            accent={accent}
            className="w-full h-[60px] flex-1"
          />
        </div>

        <div className="flex flex-col justify-between border-l border-white/[0.06] px-5 py-4 min-h-[200px]">
          <div className="flex items-center gap-1.5">
            <LiveIndicator />
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: '1.35rem',
                fontWeight: 900,
                color: '#f8fbff',
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
              }}
            >
              {peptideName}
            </p>
          </div>
          <p
            style={{
              fontSize: '0.72rem',
              fontWeight: 750,
              color: 'rgba(154,170,191,0.58)',
              textAlign: 'right',
            }}
          >
            {formatPeakDisplay(level.peakLabel)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/simulation?pk=${pkProfileId}`)}
        style={{
          width: '100%',
          background: 'transparent',
          border: `1px solid ${accent}40`,
          borderRadius: '10px',
          padding: '10px',
          fontSize: '12px',
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          color: accent,
          cursor: 'pointer',
          marginTop: '12px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        Details & Simulation →
      </button>
    </div>
  )
}

// ── Karussell ─────────────────────────────────────────────────────────────────

export function BlutspiegelCarousel() {
  const { user } = useAuth()
  const [cards, setCards] = useState<CarouselCard[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dragPx, setDragPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const dragStartX = useRef(0)
  const dragPxRef = useRef(0)
  const pointerActive = useRef(false)

  const loadLevels = useCallback(async (showLoader: boolean) => {
    if (!user) {
      setCards([])
      setLoading(false)
      return
    }

    if (showLoader) setLoading(true)

    const todayKey = format(new Date(), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('cycles')
      .select(`
        id,
        dose,
        unit,
        active,
        end_date,
        peptides (
          name,
          pk_profile_id,
          pk_profiles (
            name,
            half_life_hours,
            tmax_hours,
            bioavailability_sc,
            category
          )
        )
      `)
      .eq('user_id', user.id)

    if (error || !data) {
      setCards([])
      setLoading(false)
      return
    }

    const eligible = (data as unknown as CycleWithPk[]).filter((cycle) => {
      const pkId = cycle.peptides?.pk_profile_id
      const pk = cycle.peptides?.pk_profiles
      if (!pkId || !pk) return false
      return isCycleActiveForCarousel(cycle, todayKey)
    })

    if (!eligible.length) {
      setCards([])
      setLoading(false)
      return
    }

    const levels = await Promise.all(
      eligible.map(async (cycle) => {
        const pk = cycle.peptides!.pk_profiles!
        const category = normalizeCategory(pk.category)
        const level = await getCurrentBlutspiegelLevel(
          cycle.id,
          pk.half_life_hours,
          pk.tmax_hours,
          pk.bioavailability_sc,
        )
        return {
          cycleId: cycle.id,
          pkProfileId: cycle.peptides!.pk_profile_id!,
          peptideName: cycle.peptides!.name,
          profileName: pk.name,
          category,
          accent: CATEGORY_ACCENT[category],
          dose: Number(cycle.dose),
          halfLifeHours: pk.half_life_hours,
          level,
        } satisfies CarouselCard
      }),
    )

    setCards(levels)
    setActiveIndex((prev) => (levels.length ? Math.min(prev, levels.length - 1) : 0))
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadLevels(true)
  }, [loadLevels])

  useEffect(() => {
    if (!user || !cards.length) return

    const id = window.setInterval(() => {
      void loadLevels(false)
    }, 10_000)

    return () => window.clearInterval(id)
  }, [user, cards.length, loadLevels])

  const finishDrag = useCallback(() => {
    if (!pointerActive.current) return
    pointerActive.current = false
    setIsDragging(false)

    const delta = dragPxRef.current
    setDragPx(0)
    dragPxRef.current = 0

    if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
      setActiveIndex((i) => {
        if (delta > 0) return Math.max(0, i - 1)
        return Math.min(cards.length - 1, i + 1)
      })
    }
  }, [cards.length])

  const onPointerDown = (clientX: number) => {
    if (cards.length <= 1) return
    pointerActive.current = true
    dragStartX.current = clientX
    dragPxRef.current = 0
    setIsDragging(true)
    setDragPx(0)
  }

  const onPointerMove = (clientX: number) => {
    if (!pointerActive.current) return
    let delta = clientX - dragStartX.current
    const maxDrag = 120
    if (activeIndex === 0 && delta > 0) delta *= 0.35
    if (activeIndex === cards.length - 1 && delta < 0) delta *= 0.35
    delta = Math.max(-maxDrag, Math.min(maxDrag, delta))
    dragPxRef.current = delta
    setDragPx(delta)
  }

  if (loading) {
    return (
      <div
        style={{
          ...shellStyle,
          padding: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minHeight: 200,
        }}
      >
        <Loader2 size={22} color="#00ccf5" className="animate-spin" />
        <span style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.65)', fontWeight: 700 }}>
          Live-Spiegel wird berechnet…
        </span>
      </div>
    )
  }

  if (!cards.length) {
    return (
      <div style={{ ...shellStyle, padding: 20, textAlign: 'center' }}>
        <Activity size={28} color="rgba(0,204,245,0.55)" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: '0.82rem', fontWeight: 750, color: 'rgba(234,238,252,0.88)', lineHeight: 1.5, marginBottom: 14 }}>
          Verknüpfe Peptide mit PK-Profilen um den Live-Spiegel zu sehen
        </p>
        <Link
          to="/simulation"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.72rem',
            fontWeight: 800,
            color: '#00ccf5',
          }}
        >
          Zur Simulation
        </Link>
      </div>
    )
  }

  const trackTransform = `translateX(calc(${-activeIndex * 100}% + ${dragPx}px))`

  return (
    <div>
      <div
        style={{ overflow: 'hidden', borderRadius: 16, touchAction: 'pan-y', cursor: cards.length > 1 ? 'grab' : 'default' }}
        onTouchStart={(e) => onPointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => onPointerMove(e.touches[0].clientX)}
        onTouchEnd={() => finishDrag()}
        onTouchCancel={() => finishDrag()}
        onMouseDown={(e) => {
          e.preventDefault()
          onPointerDown(e.clientX)
        }}
        onMouseMove={(e) => {
          if (!pointerActive.current) return
          onPointerMove(e.clientX)
        }}
        onMouseUp={() => finishDrag()}
        onMouseLeave={() => finishDrag()}
      >
        <div
          style={{
            display: 'flex',
            transform: trackTransform,
            transition: isDragging ? 'none' : SWIPE_TRANSITION,
            willChange: 'transform',
          }}
        >
          {cards.map((card) => (
            <div key={card.cycleId} style={{ flex: '0 0 100%', width: '100%', paddingRight: 0 }}>
              <BlutspiegelCard card={card} />
            </div>
          ))}
        </div>
      </div>

      {cards.length > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
            marginTop: 12,
          }}
          role="tablist"
          aria-label="Zyklus-Auswahl"
        >
          {cards.map((card, i) => {
            const active = i === activeIndex
            return (
              <button
                key={card.cycleId}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${card.peptideName}, Karte ${i + 1}`}
                onClick={() => setActiveIndex(i)}
                style={{
                  height: 6,
                  width: active ? 22 : 6,
                  borderRadius: 999,
                  border: 'none',
                  padding: 0,
                  background: active ? card.accent : 'rgba(255,255,255,0.18)',
                  transition: 'width 0.25s ease, background 0.25s ease',
                  cursor: 'pointer',
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
