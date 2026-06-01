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

const SWIPE_THRESHOLD_PX = 50
const SWIPE_TRANSITION = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'

const shellStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
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

const REFRESH_INTERVAL_MS = 5000

const TREND_DISPLAY: Record<BlutspiegelTrend, { label: string; color: string }> = {
  rising: { label: '↑ STEIGEND', color: '#10b981' },
  falling: { label: '↓ FALLEND', color: '#f43f5e' },
  stable: { label: '→ STABIL', color: '#94a3b8' },
}

function FlipChar({ char }: { char: string }) {
  const prevChar = useRef(char)
  const [rotateX, setRotateX] = useState(0)

  useEffect(() => {
    if (prevChar.current === char) return
    prevChar.current = char
    setRotateX(90)
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setRotateX(0))
    })
    return () => cancelAnimationFrame(frame)
  }, [char])

  return (
    <span
      style={{
        display: 'inline-block',
        perspective: 200,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          transform: `rotateX(${rotateX}deg)`,
          transformOrigin: 'center bottom',
          transition: rotateX === 0 ? 'transform 150ms ease' : 'none',
        }}
      >
        {char}
      </span>
    </span>
  )
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function LevelDisplay({
  value,
  accent,
  unit,
  trend,
  refreshFlashing,
}: {
  value: number
  accent: string
  unit: string
  trend: BlutspiegelTrend
  refreshFlashing: boolean
}) {
  const { label, color } = TREND_DISPLAY[trend]
  const decimals = 4
  const [displayValue, setDisplayValue] = useState(value)
  const [animatedValue, setAnimatedValue] = useState(value)
  const [opacity, setOpacity] = useState(1)
  const [glowing, setGlowing] = useState(false)
  const prevAnimatedRef = useRef(value)

  useEffect(() => {
    if (refreshFlashing) return
    setDisplayValue(value)
  }, [value, refreshFlashing])

  useEffect(() => {
    if (!refreshFlashing) return
    setOpacity(0)
    const t = setTimeout(() => setOpacity(1), 150)
    return () => clearTimeout(t)
  }, [refreshFlashing])

  useEffect(() => {
    if (refreshFlashing || opacity !== 1) return
    setDisplayValue(value)
  }, [value, refreshFlashing, opacity])

  useEffect(() => {
    if (!refreshFlashing) return
    setGlowing(true)
    const t = setTimeout(() => setGlowing(false), 600)
    return () => clearTimeout(t)
  }, [refreshFlashing])

  useEffect(() => {
    if (prevAnimatedRef.current === displayValue) return
    const start = prevAnimatedRef.current
    const end = displayValue
    const startTime = performance.now()
    const duration = 800

    let raf = 0
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = easeOutCubic(t)
      setAnimatedValue(start + (end - start) * eased)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setAnimatedValue(end)
        prevAnimatedRef.current = end
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [displayValue])

  const clamped = Math.min(100, Math.max(0, animatedValue))
  const valueStr = clamped.toFixed(decimals)

  return (
    <div>
      <p
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: glowing ? '#ffffff' : accent,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          margin: 0,
          opacity,
          transition: 'color 300ms ease, opacity 150ms ease',
        }}
      >
        {valueStr.split('').map((ch, i) => (
          <FlipChar key={i} char={ch} />
        ))}
        %{' '}
        <span style={{ fontSize: 28, fontWeight: 700 }}>{unit}</span>
      </p>
      <p
        style={{
          marginTop: 6,
          fontSize: '0.58rem',
          fontWeight: 700,
          fontFamily: 'monospace',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color,
        }}
        aria-label={label}
      >
        {label}
      </p>
      <p
        style={{
          marginTop: 6,
          fontSize: 11,
          lineHeight: 1.4,
          color: 'var(--text-dim)',
        }}
      >
        Geschätzter Wirkstoff in deinem Blut basierend auf deinen Einnahmen.
      </p>
    </div>
  )
}

function LiveStatusBar({
  remainingMs,
  refreshFlashing,
}: {
  remainingMs: number
  refreshFlashing: boolean
}) {
  const monoRed: CSSProperties = {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#ef4444',
    letterSpacing: '0.04em',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-live="polite">
      <span
        className="blutspiegel-live-dot"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#ef4444',
          flexShrink: 0,
        }}
      />
      <span style={{ ...monoRed, fontWeight: 700, textTransform: 'uppercase' }}>LIVE</span>
      {refreshFlashing ? (
        <span className="blutspiegel-refresh-spin" style={monoRed}>
          ↻
        </span>
      ) : (
        <span style={monoRed}>{(remainingMs / 1000).toFixed(2)}</span>
      )}
    </div>
  )
}

// ── Karte ───────────────────────────────────────────────────────────────────

function BlutspiegelCard({
  card,
  remainingMs,
  refreshFlashing,
}: {
  card: CarouselCard
  remainingMs: number
  refreshFlashing: boolean
}) {
  const navigate = useNavigate()
  const { accent, level, peptideName, pkProfileId } = card

  return (
    <div
      className="w-full sm:max-w-[800px] sm:mx-auto"
      style={{ ...shellStyle, padding: 12 }}
    >
      <style>{`
        @keyframes blutspiegel-live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes blutspiegel-refresh-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .blutspiegel-live-dot {
          animation: blutspiegel-live-pulse 1.5s ease-in-out infinite;
        }
        .blutspiegel-refresh-spin {
          display: inline-block;
          animation: blutspiegel-refresh-spin 0.8s linear infinite;
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

      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Name (left) + LIVE status (right) in one row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 850, color: 'var(--text)', lineHeight: 1.2, margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {peptideName}
          </p>
          <div style={{ flexShrink: 0 }}>
            <LiveStatusBar remainingMs={remainingMs} refreshFlashing={refreshFlashing} />
          </div>
        </div>

        {/* Value (left) + "mehr" button (right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <LevelDisplay
              value={level.currentLevel}
              accent={accent}
              unit={level.unit}
              trend={level.trend}
              refreshFlashing={refreshFlashing}
            />
          </div>
          <button
            type="button"
            onClick={() => navigate(`/simulation?pk=${pkProfileId}`)}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: `1px solid ${accent}40`,
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: 11,
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              color: accent,
              cursor: 'pointer',
            }}
          >
            mehr
          </button>
        </div>

        <p className="disclaimer" style={{ marginTop: 8, textAlign: 'center' }}>
          Die angezeigten Werte basieren auf pharmakokinetischen Modellen und sind Schätzungen. Kein medizinischer Rat.
        </p>
      </div>
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
  const [remainingMs, setRemainingMs] = useState(REFRESH_INTERVAL_MS)
  const [refreshFlashing, setRefreshFlashing] = useState(false)
  const flashTriggeredRef = useRef(false)
  const refreshInFlightRef = useRef(false)
  const nextRefreshAt = useRef(Date.now() + REFRESH_INTERVAL_MS)

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
    nextRefreshAt.current = Date.now() + REFRESH_INTERVAL_MS
    flashTriggeredRef.current = false
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadLevels(true)
  }, [loadLevels])

  useEffect(() => {
    if (!user || !cards.length) return

    const tickId = window.setInterval(() => {
      const remaining = Math.max(0, nextRefreshAt.current - Date.now())
      setRemainingMs(remaining)

      if (remaining > 0 || refreshInFlightRef.current) return

      refreshInFlightRef.current = true
      setRefreshFlashing(true)
      nextRefreshAt.current = Date.now() + REFRESH_INTERVAL_MS

      void loadLevels(false).finally(() => {
        window.setTimeout(() => {
          setRefreshFlashing(false)
          refreshInFlightRef.current = false
        }, 1000)
      })
    }, 50)

    return () => window.clearInterval(tickId)
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
        <Loader2 size={22} color="var(--accent)" className="animate-spin" />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
          Live-Spiegel wird berechnet…
        </span>
      </div>
    )
  }

  if (!cards.length) {
    return (
      <div style={{ ...shellStyle, padding: 20, textAlign: 'center' }}>
        <Activity size={28} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: '0.82rem', fontWeight: 750, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 14 }}>
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
            color: 'var(--accent)',
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
              <BlutspiegelCard
                card={card}
                remainingMs={remainingMs}
                refreshFlashing={refreshFlashing}
              />
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
                  background: active ? card.accent : 'var(--border)',
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
