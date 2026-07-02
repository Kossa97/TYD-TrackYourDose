import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { buildLiquid, LIQUID_VB_H, LIQUID_VB_W, liquidSurfaceY } from './liquidGeometry'
import { useSloshSubscribe } from './SloshContext'
import type { SloshState } from './sloshEngine'

// A few rising bubbles give the liquid life. Positions are in viewBox units and
// the body clip-path makes them pop out of existence at the waterline.
const LIQUID_BUBBLES = [
  { cx: 24, r: 1.5, dur: 5.4, delay: 0 },
  { cx: 46, r: 1.0, dur: 6.6, delay: 1.4 },
  { cx: 63, r: 1.9, dur: 5.0, delay: 2.6 },
  { cx: 82, r: 1.1, dur: 7.2, delay: 0.7 },
  { cx: 98, r: 1.4, dur: 5.9, delay: 3.2 },
]

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return reduced
}

interface PeptideVialVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  fillPct: number
  color: string
  animateOnMount?: boolean
  size?: 'large' | 'compact'
  className?: string
  isActive?: boolean
  slosh?: number
  focus?: number
  lightOffset?: number
}

function clampFill(fillPct: number): number {
  if (!Number.isFinite(fillPct)) return 0
  return Math.max(0, Math.min(100, Math.round(fillPct)))
}

function clampSlosh(slosh: number): number {
  if (!Number.isFinite(slosh)) return 0
  return Math.max(-1, Math.min(1, slosh))
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function vialAmountLabel(amount?: string | number | null, unit?: string | null): string {
  if (amount === null || amount === undefined || amount === '') return 'Wirkstoff / Vial'
  return `${amount} ${unit || 'mg'} / Vial`
}

function VialLabelMarquee({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) {
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const innerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const inner = innerRef.current
    if (!wrap || !inner || typeof window === 'undefined') return

    let anim: Animation | null = null

    const setup = () => {
      anim?.cancel()
      inner.style.transform = 'translateX(0)'

      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

      const overflow = inner.scrollWidth - wrap.clientWidth
      if (overflow <= 4) return

      const holdStart = 2200
      const holdEnd = 1200
      const moveOut = Math.max(1800, overflow * 35)
      const moveBack = Math.max(700, overflow * 14)
      const total = holdStart + moveOut + holdEnd + moveBack

      anim = inner.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: holdStart / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut) / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut + holdEnd) / total },
          { transform: 'translateX(0)', offset: 1 },
        ],
        { duration: total, iterations: Infinity, easing: 'linear' },
      )
    }

    setup()

    if (typeof ResizeObserver === 'undefined') {
      return () => anim?.cancel()
    }

    const ro = new ResizeObserver(setup)
    ro.observe(wrap)
    ro.observe(inner)

    return () => {
      anim?.cancel()
      ro.disconnect()
    }
  }, [children])

  return (
    <span ref={wrapRef} className={`block overflow-hidden whitespace-nowrap ${className}`}>
      <span ref={innerRef} className="vial-label-marquee inline-block will-change-transform">
        {children}
      </span>
    </span>
  )
}

// Metallic flip-off cap. The glass vial itself is drawn below as one unified
// shell so the neck, shoulder and body share one continuous material.
function VialTop({ focus, lightOffset }: { focus: number; lightOffset: number }) {
  const uid = useId()
  const capSheenOpacity = 0.24 + focus * 0.4
  return (
    <svg className="pointer-events-none relative z-20 -mb-4 block h-auto w-full" viewBox="0 0 120 58" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-capSilver`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f9fc" />
          <stop offset="1" stopColor="#c3ccd8" />
        </linearGradient>
        <linearGradient id={`${uid}-capCollar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f99a7" />
          <stop offset="0.25" stopColor="#dfe6ee" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="0.75" stopColor="#ccd4de" />
          <stop offset="1" stopColor="#8f99a7" />
        </linearGradient>
        <filter id={`${uid}-capSoft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

            <g data-vial-detail="cap-collar">
        <rect data-vial-detail="single-cap" x="17" y="30" width="86" height="27" rx="3" fill={`url(#${uid}-capCollar)`} stroke="#64748b" strokeOpacity="0.5" strokeWidth="1" />
      </g>
      <path data-vial-detail="cap-top" d="M14 32 L14 20 C14 7 106 7 106 20 L106 32 Z" fill={`url(#${uid}-capSilver)`} stroke="#64748b" strokeOpacity="0.5" strokeWidth="1" />
      <line x1="21" y1="32" x2="99" y2="32" stroke="#475569" strokeOpacity="0.35" strokeWidth="1.3" />
      <ellipse
        data-vial-detail="cap-light-sheen"
        cx={60 + lightOffset * 18}
        cy="22"
        rx="28"
        ry="7"
        fill="rgba(255,255,255,0.72)"
        opacity={capSheenOpacity}
        filter={`url(#${uid}-capSoft)`}
      />
      <path d="M27 20 C43 14 77 14 93 20" fill="none" stroke="#ffffff" strokeOpacity={0.36 + focus * 0.28} strokeWidth="1.8" />
    </svg>
  )
}


export function PeptideVialVisual({
  name,
  amount,
  unit,
  fillPct,
  color,
  animateOnMount = false,
  size = 'large',
  className = '',
  isActive = true,
  slosh = 0,
  focus,
  lightOffset = 0,
}: PeptideVialVisualProps) {
  const clampedFill = clampFill(fillPct)
  const tilt = clampSlosh(slosh)
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const subscribe = useSloshSubscribe()
  const fillFrac = Math.min(clampedFill / 100, 0.97)
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampSlosh(lightOffset)
  const focusAttr = Number(visualFocus.toFixed(2))
  const lightOffsetAttr = Number(visualLightOffset.toFixed(2))
  const highlightShift = visualLightOffset * 10
  const shellGlowOpacity = 0.2 + visualFocus * 0.42
  const shellEdgeOpacity = 0.36 + visualFocus * 0.28
  const shadowOpacity = 0.2 + visualFocus * 0.28
  const liquidHaloBase = 0.12 + visualFocus * 0.12
  const liquidCoreBase = 0.08 + visualFocus * 0.16
  const previousFillRef = useRef(fillFrac)
  const [fillMotion, setFillMotion] = useState({ epoch: 0, shiftPct: 0 })
  // One graphic for the whole liquid. The air gap is baked into the geometry,
  // so a raised wall during slosh still stays clipped below the rim. This is the
  // resting first paint; once subscribed, the engine redraws it every frame.
  const geom = buildLiquid({ fill: fillFrac, tilt })

  const bodyRef = useRef<SVGPathElement | null>(null)
  const surfaceRef = useRef<SVGPathElement | null>(null)
  const glowRef = useRef<SVGPathElement | null>(null)
  const rimRef = useRef<SVGPathElement | null>(null)
  const specHaloRef = useRef<SVGEllipseElement | null>(null)
  const specCoreRef = useRef<SVGEllipseElement | null>(null)
  const leftGlintRef = useRef<SVGEllipseElement | null>(null)
  const rightGlintRef = useRef<SVGEllipseElement | null>(null)

  const draw = useCallback(
    (s: SloshState) => {
      const g = buildLiquid({ fill: fillFrac, tilt: s.tilt, energy: s.energy, time: s.time })
      bodyRef.current?.setAttribute('d', g.body)
      surfaceRef.current?.setAttribute('d', g.surface)
      glowRef.current?.setAttribute('d', g.glow)
      rimRef.current?.setAttribute('d', g.rim)
      const sx = (g.highlightX + highlightShift).toFixed(2)
      const sy = g.highlightY.toFixed(2)
      // the sheen stays faint at rest and flares as the surface agitates
      const halo = (liquidHaloBase + s.energy * 0.5).toFixed(2)
      const core = (liquidCoreBase + s.energy * 0.6).toFixed(2)
      specHaloRef.current?.setAttribute('cx', sx)
      specHaloRef.current?.setAttribute('cy', sy)
      specHaloRef.current?.setAttribute('opacity', halo)
      specCoreRef.current?.setAttribute('cx', sx)
      specCoreRef.current?.setAttribute('cy', sy)
      specCoreRef.current?.setAttribute('opacity', core)
      leftGlintRef.current?.setAttribute('cy', g.leftWallY.toFixed(2))
      rightGlintRef.current?.setAttribute('cy', g.rightWallY.toFixed(2))
    },
    [fillFrac, highlightShift, liquidHaloBase, liquidCoreBase],
  )

  useEffect(() => {
    if (!subscribe) return
    return subscribe(draw)
  }, [subscribe, draw])

  useEffect(() => {
    const previousFill = previousFillRef.current
    if (Math.abs(previousFill - fillFrac) < 0.001) return

    const previousY = liquidSurfaceY(previousFill)
    const nextY = liquidSurfaceY(fillFrac)
    const shiftPct = ((previousY - nextY) / LIQUID_VB_H) * 100

    previousFillRef.current = fillFrac
    setFillMotion(current => ({
      epoch: current.epoch + 1,
      shiftPct: Number(shiftPct.toFixed(2)),
    }))
  }, [fillFrac])

  const liquidMotionStyle = {
    color,
    '--vial-fill-motion-shift': `${fillMotion.shiftPct}%`,
  } as CSSProperties

  const labelName = name?.trim() || 'Peptidname'
  const isLarge = size === 'large'
  const widthClass = isLarge ? 'w-28 sm:w-36' : 'w-16'
  const shellClass = isLarge ? 'h-44 sm:h-52' : 'h-24'
  const labelClass = isLarge
    ? 'left-[3.5%] right-[3.5%] top-1/2 -translate-y-1/2 rounded-sm px-1 py-2'
    : 'left-[3.5%] right-[3.5%] top-1/2 -translate-y-1/2 rounded-sm px-1 py-1'
  const nameClass = isLarge
    ? 'text-lg sm:text-xl leading-tight'
    : 'text-[9px] leading-tight'
  const amountClass = isLarge
    ? 'text-xs sm:text-sm mt-1'
    : 'text-[7px] mt-0.5'
  return (
    <div
      className={`relative mx-auto select-none ${widthClass} ${className}`}
      data-fill-pct={clampedFill}
      data-vial-focus={focusAttr}
      data-vial-light-offset={lightOffsetAttr}
      aria-label={`${labelName}, ${vialAmountLabel(amount, unit)}, ${clampedFill}%`}
    >
      <style>{`
        @keyframes vial-liquid-rise {
          from { transform: translateY(38%); opacity: .25; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes vial-shimmer {
          0%, 100% { transform: translateX(0); opacity: .35; }
          50% { transform: translateX(14%); opacity: .7; }
        }
        @keyframes vial-liquid-level-motion {
          from { transform: translateY(var(--vial-fill-motion-shift, 0%)); }
          to { transform: translateY(0); }
        }
        .vial-liquid-rise {
          animation: vial-liquid-rise 820ms cubic-bezier(.22,1,.36,1) both;
        }
        .vial-liquid-level-motion {
          animation: vial-liquid-level-motion 760ms cubic-bezier(.22,1,.36,1) both;
          transform-box: fill-box;
          transform-origin: center bottom;
        }
        @media (prefers-reduced-motion: reduce) {
          .vial-liquid-rise, .vial-shimmer, .vial-liquid-level-motion { animation: none !important; }
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        {VialTop({ focus: visualFocus, lightOffset: visualLightOffset })}

        <div className={`relative z-0 w-full ${shellClass} overflow-visible`}>
          <svg
            data-vial-detail="unified-glass-shell"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 120 294"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <path
                id={`${uid}-vialShellPath`}
                d="M28 0 L92 0 L92 24 C92 35 116 41 116 56 L116 252 C116 274 102 286 76 286 L44 286 C18 286 4 274 4 252 L4 56 C4 41 28 35 28 24 Z"
              />
              <linearGradient id={`${uid}-glassDepth`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(2,6,23,0.72)" />
                <stop offset="13%" stopColor="rgba(226,232,240,0.26)" />
                <stop offset="34%" stopColor="rgba(255,255,255,0.10)" />
                <stop offset="63%" stopColor="rgba(15,23,42,0.22)" />
                <stop offset="100%" stopColor="rgba(2,6,23,0.78)" />
              </linearGradient>
              <radialGradient id={`${uid}-glassBloom`} cx={`${50 + visualLightOffset * 18}%`} cy="34%" r="62%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
                <stop offset="48%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <filter id={`${uid}-shellSoft`} x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
            </defs>

            <ellipse
              data-vial-detail="glass-stage-shadow"
              cx={60 - visualLightOffset * 8}
              cy="292"
              rx={34 + visualFocus * 12}
              ry={5 + visualFocus * 4}
              fill="rgba(0,0,0,0.78)"
              opacity={shadowOpacity}
              filter={`url(#${uid}-shellSoft)`}
            />
            <use
              data-vial-detail="unified-glass-outline"
              href={`#${uid}-vialShellPath`}
              fill={`url(#${uid}-glassDepth)`}
              stroke="rgba(203,213,225,0.56)"
              strokeOpacity={shellEdgeOpacity}
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
            <use href={`#${uid}-vialShellPath`} fill={`url(#${uid}-glassBloom)`} opacity={shellGlowOpacity} />
            <path
              d="M12 58 C12 44 36 38 36 23 L36 8"
              fill="none"
              stroke="rgba(255,255,255,0.58)"
              strokeOpacity={0.2 + visualFocus * 0.34}
              strokeWidth="4.4"
              strokeLinecap="round"
              filter={`url(#${uid}-shellSoft)`}
            />
            <path
              d="M12 64 L12 242 C12 265 25 282 48 286"
              fill="none"
              stroke="rgba(255,255,255,0.52)"
              strokeOpacity={0.2 + visualFocus * 0.4}
              strokeWidth="5"
              strokeLinecap="round"
              filter={`url(#${uid}-shellSoft)`}
            />
            <path
              d="M108 64 L108 246 C108 268 96 282 73 286"
              fill="none"
              stroke="rgba(255,255,255,0.26)"
              strokeOpacity={0.16 + visualFocus * 0.22}
              strokeWidth="2.4"
              strokeLinecap="round"
              filter={`url(#${uid}-shellSoft)`}
            />
            <ellipse cx="60" cy="273" rx="42" ry="12" fill="rgba(255,255,255,0.16)" opacity={0.22 + visualFocus * 0.28} filter={`url(#${uid}-shellSoft)`} />
            <ellipse cx="60" cy="278" rx="45" ry="9" fill="rgba(0,0,0,0.32)" opacity="0.55" />
          </svg>

          {/* Single-graphic liquid: body, tilting surface, meniscus rim and
              highlight all derive from one geometry so they move as one. */}
          <div
            data-vial-detail="liquid-motion-viewport"
            className={`pointer-events-none absolute inset-0 ${animateOnMount ? 'vial-liquid-rise' : ''}`}
          >
            <svg
              data-vial-detail="liquid-vial-chamber"
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 120 294"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <clipPath id={`${uid}-liquidChamberClip`}>
                  <path d="M28 0 L92 0 L92 24 C92 35 116 41 116 56 L116 252 C116 274 102 286 76 286 L44 286 C18 286 4 274 4 252 L4 56 C4 41 28 35 28 24 Z" />
                </clipPath>
              </defs>
              <g data-vial-detail="liquid-glass-window" clipPath={`url(#${uid}-liquidChamberClip)`}>
                <svg
                  key={fillMotion.epoch}
                  data-vial-detail="liquid-graphic"
                  x="4"
                  y="36"
                  width="112"
                  height="247"
                  className={`overflow-visible ${fillMotion.epoch > 0 ? 'vial-liquid-level-motion' : ''}`}
                  viewBox={`0 0 ${LIQUID_VB_W} ${LIQUID_VB_H}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  style={liquidMotionStyle}
                >
            <defs>
              {/* one template path drives the body fills and the clip together */}
              <path id={`${uid}-bodyPath`} ref={bodyRef} d={geom.body} />
              <clipPath id={`${uid}-clip`}>
                <use href={`#${uid}-bodyPath`} />
              </clipPath>
              <linearGradient id={`${uid}-depth`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.26)" />
                <stop offset="18%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.58)" />
              </linearGradient>
              <linearGradient id={`${uid}-side`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                <stop offset="30%" stopColor="rgba(255,255,255,0)" />
                <stop offset="72%" stopColor="rgba(0,0,0,0.05)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
              </linearGradient>
              <linearGradient id={`${uid}-glow`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.58)" />
                <stop offset="55%" stopColor="rgba(255,255,255,0.14)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <linearGradient id={`${uid}-refract`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <linearGradient id={`${uid}-surface`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.58)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
              </linearGradient>
              <radialGradient id={`${uid}-caustic`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.58)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <radialGradient id={`${uid}-floor`} cx="50%" cy="100%" r="70%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.4)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <radialGradient id={`${uid}-spec`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.4" />
              </filter>
            </defs>

            <use data-vial-detail="liquid-body" href={`#${uid}-bodyPath`} fill="currentColor" fillOpacity="0.8" />
            <g clipPath={`url(#${uid}-clip)`}>
              <use href={`#${uid}-bodyPath`} fill={`url(#${uid}-depth)`} />
              <use href={`#${uid}-bodyPath`} fill={`url(#${uid}-side)`} />
              <rect x="0" y={LIQUID_VB_H - 34} width={LIQUID_VB_W} height="34" fill={`url(#${uid}-floor)`} />
              <ellipse cx={LIQUID_VB_W / 2} cy={LIQUID_VB_H - 13} rx="48" ry="15" fill={`url(#${uid}-caustic)`} />
              <rect x={5 + visualLightOffset * 8} y="0" width="16" height={LIQUID_VB_H} fill={`url(#${uid}-refract)`} opacity={0.46 + visualFocus * 0.22} filter={`url(#${uid}-soft)`} />
              <rect x={99 + visualLightOffset * 5} y="0" width="10" height={LIQUID_VB_H} fill={`url(#${uid}-refract)`} opacity={0.14 + visualFocus * 0.16} filter={`url(#${uid}-soft)`} />
              <path ref={glowRef} data-vial-detail="liquid-glow" d={geom.glow} fill={`url(#${uid}-glow)`} filter={`url(#${uid}-soft)`} />
              {!reducedMotion && LIQUID_BUBBLES.map((b, i) => (
                <circle key={i} data-vial-detail="liquid-bubble" cx={b.cx} cy="0" r={b.r} fill="rgba(255,255,255,0.55)">
                  <animateTransform attributeName="transform" type="translate" from="0 192" to="0 30" dur={`${b.dur}s`} begin={`${b.delay}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;0.5;0.5;0" keyTimes="0;0.18;0.72;1" dur={`${b.dur}s`} begin={`${b.delay}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
            <path ref={surfaceRef} data-vial-detail="liquid-surface" d={geom.surface} fill={`url(#${uid}-surface)`} opacity={0.4 + visualFocus * 0.14} />
            <ellipse ref={leftGlintRef} cx="4" cy={geom.leftWallY} rx="3" ry="5.5" fill="rgba(255,255,255,0.4)" filter={`url(#${uid}-soft)`} />
            <ellipse ref={rightGlintRef} cx={LIQUID_VB_W - 4} cy={geom.rightWallY} rx="3" ry="5.5" fill="rgba(255,255,255,0.4)" filter={`url(#${uid}-soft)`} />
            <ellipse ref={specHaloRef} cx={geom.highlightX + highlightShift} cy={geom.highlightY} rx="22" ry="3.6" fill={`url(#${uid}-spec)`} opacity={0.14 + visualFocus * 0.14} filter={`url(#${uid}-soft)`} />
            <ellipse ref={specCoreRef} cx={geom.highlightX + highlightShift} cy={geom.highlightY} rx="7" ry="2.4" fill={`url(#${uid}-spec)`} opacity={0.1 + visualFocus * 0.16} filter={`url(#${uid}-soft)`} />
            <path
              ref={rimRef}
              data-vial-detail="liquid-rim"
              d={geom.rim}
              fill="none"
              stroke="rgba(255,255,255,0.66)"
              strokeWidth="1.4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
                </svg>
              </g>
            </svg>
          </div>

          <div className="vial-shimmer pointer-events-none absolute inset-y-[24%] left-[24%] w-[32%] rotate-6 rounded-full bg-white/10 blur-[6px]" />
          {!isActive && (
            <svg
              data-vial-detail="inactive-vial-overlay"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 120 294"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <clipPath id={`${uid}-inactiveOverlayClip`}>
                  <path d="M28 0 L92 0 L92 24 C92 35 116 41 116 56 L116 252 C116 274 102 286 76 286 L44 286 C18 286 4 274 4 252 L4 56 C4 41 28 35 28 24 Z" />
                </clipPath>
              </defs>
              <g clipPath={`url(#${uid}-inactiveOverlayClip)`}>
                <path d="M28 0 L92 0 L92 24 C92 35 116 41 116 56 L116 252 C116 274 102 286 76 286 L44 286 C18 286 4 274 4 252 L4 56 C4 41 28 35 28 24 Z" fill="rgba(0,0,0,0.34)" />
              </g>
            </svg>
          )}

          <div
            data-vial-detail="label-glass-wrap"
            className={`absolute ${labelClass} overflow-hidden border-y border-white/40 bg-white/28 text-center shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-[2px]`}
          >
            <div data-vial-detail="full-width-label" className="relative overflow-hidden">
              <VialLabelMarquee className={`${nameClass} font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]`}>
                {labelName}
              </VialLabelMarquee>
              <p className={`${amountClass} font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}>
                {vialAmountLabel(amount, unit)}
              </p>
            </div>
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-white/10 to-black/10"
              style={{ transform: `translateX(${visualLightOffset * 10}%)`, opacity: 0.62 + visualFocus * 0.2 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
