import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Activity, Loader2, Minus, TrendingDown, TrendingUp } from 'lucide-react'
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
  peptideName: string
  profileName: string
  category: PkCategory
  accent: string
  dose: number
  unit: string
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

// ── SVG: Arc-Gauge ──────────────────────────────────────────────────────────

function ArcGauge({ level, accent }: { level: number; accent: string }) {
  const size = 132
  const stroke = 9
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, level))
  const offset = circumference * (1 - clamped / 100)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 8px ${accent}55)` }}
      />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fill="#f8fbff"
        fontSize="26"
        fontWeight="900"
        fontFamily="system-ui, sans-serif"
      >
        {Math.round(clamped)}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        fill="rgba(154,170,191,0.62)"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        %
      </text>
    </svg>
  )
}

// ── SVG: Sparkline ──────────────────────────────────────────────────────────

function Sparkline({ data, accent }: { data: number[]; accent: string }) {
  const w = 128
  const h = 36
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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
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

function TrendIndicator({ trend }: { trend: BlutspiegelTrend }) {
  if (trend === 'rising') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#10b981' }} aria-label="steigend">
        <TrendingUp size={18} strokeWidth={2.5} />
      </span>
    )
  }
  if (trend === 'falling') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#f43f5e' }} aria-label="fallend">
        <TrendingDown size={18} strokeWidth={2.5} />
      </span>
    )
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', color: '#94a3b8' }} aria-label="stabil">
      <Minus size={18} strokeWidth={2.5} />
    </span>
  )
}

// ── Karte ───────────────────────────────────────────────────────────────────

function BlutspiegelCard({ card }: { card: CarouselCard }) {
  const { accent, level, peptideName, profileName, category, dose, unit, halfLifeHours } = card

  return (
    <div style={{ ...shellStyle, padding: '16px 16px 14px', minHeight: 280 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 88% 8%, ${accent}22, transparent 38%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.95rem', fontWeight: 850, color: '#f8fbff', lineHeight: 1.2, marginBottom: 6 }}>
              {peptideName}
            </p>
            <span
              style={{
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
              }}
            >
              {CATEGORY_LABEL[category]}
            </span>
            <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.55)', marginTop: 6 }}>
              {profileName}
            </p>
          </div>
          <TrendIndicator trend={level.trend} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <ArcGauge level={level.currentLevel} accent={accent} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <p style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.52)' }}>
              Verlauf
            </p>
            <Sparkline data={level.sparkData} accent={accent} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              padding: '10px 10px',
              borderRadius: 14,
              background: 'rgba(2,6,18,0.55)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <p style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.52)', marginBottom: 4 }}>
              Nächste Dosis
            </p>
            <p style={{ fontSize: '1.05rem', fontWeight: 900, color: accent, letterSpacing: '-0.03em' }}>
              {level.nextDoseIn}
            </p>
            <p style={{ fontSize: '0.66rem', color: 'rgba(213,224,242,0.65)', marginTop: 3 }}>
              {dose} {unit}
            </p>
          </div>
          <div
            style={{
              padding: '10px 10px',
              borderRadius: 14,
              background: 'rgba(2,6,18,0.55)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <p style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(154,170,191,0.52)', marginBottom: 4 }}>
              Spiegel danach
            </p>
            <p style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f8fbff', letterSpacing: '-0.03em' }}>
              {Math.round(level.levelAfterNextDose)}%
            </p>
            <p style={{ fontSize: '0.66rem', color: 'rgba(213,224,242,0.65)', marginTop: 3 }}>
              T½ {halfLifeHours}h
            </p>
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
          peptideName: cycle.peptides!.name,
          profileName: pk.name,
          category,
          accent: CATEGORY_ACCENT[category],
          dose: Number(cycle.dose),
          unit: cycle.unit,
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
    }, 60_000)

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
