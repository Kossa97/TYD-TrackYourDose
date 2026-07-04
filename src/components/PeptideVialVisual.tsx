import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, Ref, RefObject } from 'react'
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

// Imperative stage-light channel: the carousel pushes focus/lightOffset per
// scroll frame through this handle so no React re-render happens while swiping.
export interface VialStageLightHandle {
  setStageLight: (focus: number, lightOffset: number) => void
}

interface PeptideVialVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  fillPct: number
  color: string
  animateOnMount?: boolean
  size?: 'large' | 'compact' | 'carousel'
  className?: string
  isActive?: boolean
  slosh?: number
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<VialStageLightHandle>
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

function fillMotionShiftPct(previousFill: number, nextFill: number): number {
  const previousY = liquidSurfaceY(previousFill)
  const nextY = liquidSurfaceY(nextFill)
  return Number((((previousY - nextY) / LIQUID_VB_H) * 100).toFixed(2))
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
// The sheen uses a pre-softened radial gradient instead of an SVG blur filter
// so shifting it per scroll frame never forces a filter re-raster.
function VialTop({
  focus,
  lightOffset,
  sheenRef,
  arcRef,
  marginClass,
}: {
  focus: number
  lightOffset: number
  sheenRef: RefObject<SVGEllipseElement | null>
  arcRef: RefObject<SVGPathElement | null>
  marginClass: string
}) {
  const uid = useId()
  const capSheenOpacity = 0.24 + focus * 0.4
  return (
    <svg className={`pointer-events-none relative z-20 ${marginClass} block h-auto w-full`} viewBox="0 0 120 58" aria-hidden="true">
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
        <radialGradient id={`${uid}-capSheen`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

            <g data-vial-detail="cap-collar">
        <rect data-vial-detail="single-cap" x="17" y="30" width="86" height="27" rx="3" fill={`url(#${uid}-capCollar)`} stroke="#64748b" strokeOpacity="0.5" strokeWidth="1" />
      </g>
      <path data-vial-detail="cap-top" d="M14 32 L14 20 C14 7 106 7 106 20 L106 32 Z" fill={`url(#${uid}-capSilver)`} stroke="#64748b" strokeOpacity="0.5" strokeWidth="1" />
      <line x1="21" y1="32" x2="99" y2="32" stroke="#475569" strokeOpacity="0.35" strokeWidth="1.3" />
      <ellipse
        ref={sheenRef}
        data-vial-detail="cap-light-sheen"
        cx={60 + lightOffset * 18}
        cy="22"
        rx="28"
        ry="7"
        fill={`url(#${uid}-capSheen)`}
        opacity={capSheenOpacity}
      />
      <path ref={arcRef} d="M27 20 C43 14 77 14 93 20" fill="none" stroke="#ffffff" strokeOpacity={0.36 + focus * 0.28} strokeWidth="1.8" />
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
  stageLightRef,
}: PeptideVialVisualProps) {
  const clampedFill = clampFill(fillPct)
  const tilt = clampSlosh(slosh)
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const subscribe = useSloshSubscribe()
  const fillFrac = Math.min(clampedFill / 100, 0.97)
  // focus/lightOffset props only seed the paint; afterwards the carousel
  // drives the stage light imperatively via setStageLight. A layout effect
  // below re-applies the imperative values after every re-render so an
  // active-vial change can't snap the light back to the prop defaults.
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampSlosh(lightOffset)
  const stageRef = useRef({ focus: visualFocus, lightOffset: visualLightOffset })
  const focusAttr = Number(visualFocus.toFixed(2))
  const lightOffsetAttr = Number(visualLightOffset.toFixed(2))
  const highlightShift = visualLightOffset * 10
  const shellGlowOpacity = 0.2 + visualFocus * 0.42
  const shellEdgeOpacity = 0.36 + visualFocus * 0.28
  const shadowOpacity = 0.2 + visualFocus * 0.28
  const previousFillRef = useRef(fillFrac)
  const [fillMotion, setFillMotion] = useState<{ epoch: number; shiftPct: number; mode: 'none' | 'reveal' | 'shift' }>(() => (
    animateOnMount && fillFrac > 0.001
      ? { epoch: 1, shiftPct: 0, mode: 'reveal' }
      : { epoch: 0, shiftPct: 0, mode: 'none' }
  ))
  // One graphic for the whole liquid. The air gap is baked into the geometry,
  // so a raised wall during slosh still stays clipped below the rim. This is the
  // resting first paint; once subscribed, the engine redraws it every frame.
  const geom = buildLiquid({ fill: fillFrac, tilt })

  const rootRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<SVGPathElement | null>(null)
  const surfaceRef = useRef<SVGPathElement | null>(null)
  const glowRef = useRef<SVGPathElement | null>(null)
  const rimRef = useRef<SVGPathElement | null>(null)
  const specHaloRef = useRef<SVGEllipseElement | null>(null)
  const specCoreRef = useRef<SVGEllipseElement | null>(null)
  const leftGlintRef = useRef<SVGEllipseElement | null>(null)
  const rightGlintRef = useRef<SVGEllipseElement | null>(null)
  const capSheenRef = useRef<SVGEllipseElement | null>(null)
  const capArcRef = useRef<SVGPathElement | null>(null)
  const stageShadowRef = useRef<SVGEllipseElement | null>(null)
  const shellOutlineRef = useRef<SVGUseElement | null>(null)
  const shellBloomRef = useRef<SVGRectElement | null>(null)
  const shellHighlightsRef = useRef<SVGGElement | null>(null)
  const refractLeftRef = useRef<SVGRectElement | null>(null)
  const refractRightRef = useRef<SVGRectElement | null>(null)
  const labelSheenRef = useRef<HTMLDivElement | null>(null)

  const draw = useCallback(
    (s: SloshState) => {
      const stage = stageRef.current
      const stageFocus = stage?.focus ?? 1
      const stageShift = (stage?.lightOffset ?? 0) * 10
      const g = buildLiquid({ fill: fillFrac, tilt: s.tilt, energy: s.energy, time: s.time })
      bodyRef.current?.setAttribute('d', g.body)
      surfaceRef.current?.setAttribute('d', g.surface)
      glowRef.current?.setAttribute('d', g.glow)
      rimRef.current?.setAttribute('d', g.rim)
      const sx = (g.highlightX + stageShift).toFixed(2)
      const sy = g.highlightY.toFixed(2)
      // the sheen stays faint at rest and flares as the surface agitates
      const halo = (0.12 + stageFocus * 0.12 + s.energy * 0.5).toFixed(2)
      const core = (0.08 + stageFocus * 0.16 + s.energy * 0.6).toFixed(2)
      specHaloRef.current?.setAttribute('cx', sx)
      specHaloRef.current?.setAttribute('cy', sy)
      specHaloRef.current?.setAttribute('opacity', halo)
      specCoreRef.current?.setAttribute('cx', sx)
      specCoreRef.current?.setAttribute('cy', sy)
      specCoreRef.current?.setAttribute('opacity', core)
      leftGlintRef.current?.setAttribute('cy', g.leftWallY.toFixed(2))
      rightGlintRef.current?.setAttribute('cy', g.rightWallY.toFixed(2))
    },
    [fillFrac],
  )

  useEffect(() => {
    if (!subscribe) return
    return subscribe(draw)
  }, [subscribe, draw])

  // Applies the stage light straight to the DOM — the hot path while the
  // carousel scrolls, so it must not schedule any React work.
  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-vial-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-vial-light-offset', o.toFixed(2))

    capSheenRef.current?.setAttribute('cx', (60 + o * 18).toFixed(2))
    capSheenRef.current?.setAttribute('opacity', (0.24 + f * 0.4).toFixed(3))
    capArcRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))

    stageShadowRef.current?.setAttribute('cx', (60 - o * 8).toFixed(2))
    stageShadowRef.current?.setAttribute('rx', (34 + f * 12).toFixed(2))
    stageShadowRef.current?.setAttribute('ry', (5 + f * 4).toFixed(2))
    stageShadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    shellOutlineRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))
    shellBloomRef.current?.setAttribute('transform', `translate(${(o * 21.6).toFixed(2)} 0)`)
    shellBloomRef.current?.setAttribute('opacity', (0.2 + f * 0.42).toFixed(3))
    shellHighlightsRef.current?.setAttribute('opacity', (0.42 + f * 0.58).toFixed(3))

    refractLeftRef.current?.setAttribute('x', (5 + o * 8).toFixed(2))
    refractLeftRef.current?.setAttribute('opacity', (0.46 + f * 0.22).toFixed(3))
    refractRightRef.current?.setAttribute('x', (99 + o * 5).toFixed(2))
    refractRightRef.current?.setAttribute('opacity', (0.14 + f * 0.16).toFixed(3))
    surfaceRef.current?.setAttribute('opacity', (0.4 + f * 0.14).toFixed(3))

    if (labelSheenRef.current) {
      labelSheenRef.current.style.transform = `translateX(${(o * 10).toFixed(2)}%)`
      labelSheenRef.current.style.opacity = (0.62 + f * 0.2).toFixed(3)
    }
  }, [])

  const setStageLight = useCallback((nextFocus: number, nextLightOffset: number) => {
    const f = clamp01(nextFocus)
    const o = clampSlosh(nextLightOffset)
    const stage = stageRef.current
    if (Math.abs(stage.focus - f) < 0.005 && Math.abs(stage.lightOffset - o) < 0.005) return
    stageRef.current = { focus: f, lightOffset: o }
    applyStageLight(f, o)
  }, [applyStageLight])

  useImperativeHandle(stageLightRef, () => ({ setStageLight }), [setStageLight])

  // React reconciliation may have just reset stage-lit attributes to the
  // prop-derived render values; put the imperative state back before paint.
  useLayoutEffect(() => {
    const stage = stageRef.current
    applyStageLight(stage.focus, stage.lightOffset)
  })

  useEffect(() => {
    const previousFill = previousFillRef.current
    if (Math.abs(previousFill - fillFrac) < 0.001) return

    const shiftPct = fillMotionShiftPct(previousFill, fillFrac)

    previousFillRef.current = fillFrac
    setFillMotion(current => ({
      epoch: current.epoch + 1,
      shiftPct,
      mode: 'shift',
    }))
  }, [fillFrac])

  const liquidMotionClass = fillMotion.mode === 'reveal'
    ? 'vial-liquid-fill-reveal'
    : fillMotion.mode === 'shift'
      ? 'vial-liquid-level-motion'
      : ''
  const fillIntroDurationMs = Math.round(900 + fillFrac * 800)
  const liquidMotionStyle = {
    color,
    '--vial-fill-motion-shift': `${fillMotion.shiftPct}%`,
    '--vial-fill-intro-duration': `${fillIntroDurationMs}ms`,
  } as CSSProperties
  const labelName = name?.trim() || 'Peptidname'
  // 'large' = detail views (edit form, previews); 'carousel' = the My Stack
  // carousel, sized so several vials can peek in side by side; 'compact' =
  // tiny inline previews.
  const widthClass = size === 'large' ? 'w-28 sm:w-36' : size === 'carousel' ? 'w-20 sm:w-24' : 'w-16'
  const shellClass = size === 'large' ? 'h-44 sm:h-52' : size === 'carousel' ? 'h-28 sm:h-36' : 'h-24'
  // the cap sits over the glass neck with a slight overlap; raised a bit from
  // the original so a sliver of neck stays visible below the cap, scaled down
  // with the vial's own width so smaller sizes keep the same proportions
  const capMarginClass = size === 'large' ? '-mb-2' : '-mb-1'
  const labelClass = size === 'large'
    ? 'left-[3.5%] right-[3.5%] top-1/2 -translate-y-1/2 rounded-sm px-1 py-2'
    : 'left-[3.5%] right-[3.5%] top-1/2 -translate-y-1/2 rounded-sm px-1 py-1'
  const nameClass = size === 'large'
    ? 'text-lg sm:text-xl leading-tight'
    : size === 'carousel'
      ? 'text-sm sm:text-base leading-tight'
      : 'text-[9px] leading-tight'
  const amountClass = size === 'large'
    ? 'text-xs sm:text-sm mt-1'
    : size === 'carousel'
      ? 'text-[10px] sm:text-xs mt-0.5'
      : 'text-[7px] mt-0.5'
  return (
    <div
      ref={rootRef}
      className={`relative mx-auto select-none ${widthClass} ${className}`}
      data-fill-pct={clampedFill}
      data-vial-focus={focusAttr}
      data-vial-light-offset={lightOffsetAttr}
      aria-label={`${labelName}, ${vialAmountLabel(amount, unit)}, ${clampedFill}%`}
    >
      <style>{`
        @keyframes vial-shimmer {
          0%, 100% { transform: translateX(0); opacity: .35; }
          50% { transform: translateX(14%); opacity: .7; }
        }
        @keyframes vial-liquid-level-motion {
          from { transform: translateY(var(--vial-fill-motion-shift, 0%)); }
          to { transform: translateY(0); }
        }
        .vial-liquid-level-motion {
          animation: vial-liquid-level-motion 760ms cubic-bezier(.22,1,.36,1) both;
          transform-box: fill-box;
          transform-origin: center bottom;
        }
        @media (prefers-reduced-motion: reduce) {
          .vial-shimmer, .vial-liquid-level-motion { animation: none !important; }
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        {VialTop({ focus: visualFocus, lightOffset: visualLightOffset, sheenRef: capSheenRef, arcRef: capArcRef, marginClass: capMarginClass })}

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
              <clipPath id={`${uid}-shellClip`}>
                <use href={`#${uid}-vialShellPath`} />
              </clipPath>
              <linearGradient id={`${uid}-glassDepth`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(2,6,23,0.72)" />
                <stop offset="13%" stopColor="rgba(226,232,240,0.26)" />
                <stop offset="34%" stopColor="rgba(255,255,255,0.10)" />
                <stop offset="63%" stopColor="rgba(15,23,42,0.22)" />
                <stop offset="100%" stopColor="rgba(2,6,23,0.78)" />
              </linearGradient>
              {/* static gradient — the light shift happens via a cheap transform
                  on the clipped bloom rect, never by rewriting gradient geometry */}
              <radialGradient id={`${uid}-glassBloom`} gradientUnits="userSpaceOnUse" cx="60" cy="98" r="76">
                <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
                <stop offset="48%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <radialGradient id={`${uid}-stageShadowSoft`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.78)" />
                <stop offset="62%" stopColor="rgba(0,0,0,0.5)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              <filter id={`${uid}-shellSoft`} x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
            </defs>

            <ellipse
              ref={stageShadowRef}
              data-vial-detail="glass-stage-shadow"
              cx={60 - visualLightOffset * 8}
              cy="292"
              rx={34 + visualFocus * 12}
              ry={5 + visualFocus * 4}
              fill={`url(#${uid}-stageShadowSoft)`}
              opacity={shadowOpacity}
            />
            <use
              ref={shellOutlineRef}
              data-vial-detail="unified-glass-outline"
              href={`#${uid}-vialShellPath`}
              fill={`url(#${uid}-glassDepth)`}
              stroke="rgba(203,213,225,0.56)"
              strokeOpacity={shellEdgeOpacity}
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
            <g clipPath={`url(#${uid}-shellClip)`}>
              <rect
                ref={shellBloomRef}
                x="-40"
                y="-20"
                width="200"
                height="334"
                fill={`url(#${uid}-glassBloom)`}
                opacity={shellGlowOpacity}
                transform={`translate(${visualLightOffset * 21.6} 0)`}
              />
            </g>
            {/* blurred strokes stay static so the filter result can be cached;
                the stage light only fades the whole group in and out */}
            <g ref={shellHighlightsRef} data-vial-detail="shell-highlights" opacity={0.42 + visualFocus * 0.58}>
              <path
                d="M12 58 C12 44 36 38 36 23 L36 8"
                fill="none"
                stroke="rgba(255,255,255,0.58)"
                strokeOpacity="0.54"
                strokeWidth="4.4"
                strokeLinecap="round"
                filter={`url(#${uid}-shellSoft)`}
              />
              <path
                d="M12 64 L12 242 C12 265 25 282 48 286"
                fill="none"
                stroke="rgba(255,255,255,0.52)"
                strokeOpacity="0.6"
                strokeWidth="5"
                strokeLinecap="round"
                filter={`url(#${uid}-shellSoft)`}
              />
              <path
                d="M108 64 L108 246 C108 268 96 282 73 286"
                fill="none"
                stroke="rgba(255,255,255,0.26)"
                strokeOpacity="0.38"
                strokeWidth="2.4"
                strokeLinecap="round"
                filter={`url(#${uid}-shellSoft)`}
              />
              <ellipse cx="60" cy="273" rx="42" ry="12" fill="rgba(255,255,255,0.16)" opacity="0.5" filter={`url(#${uid}-shellSoft)`} />
            </g>
            <ellipse cx="60" cy="278" rx="45" ry="9" fill="rgba(0,0,0,0.32)" opacity="0.55" />
          </svg>

          {/* Single-graphic liquid: body, tilting surface, meniscus rim and
              highlight all derive from one geometry so they move as one. */}
          <div
            data-vial-detail="liquid-motion-viewport"
            className="pointer-events-none absolute inset-0"
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
                  className={`overflow-visible ${liquidMotionClass}`}
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
              {fillMotion.mode === 'reveal' && (
                <clipPath id={`${uid}-introClip`} clipPathUnits="userSpaceOnUse">
                  <rect data-vial-detail="liquid-intro-reveal-clip" x="0" y={reducedMotion ? 0 : LIQUID_VB_H} width={LIQUID_VB_W} height={reducedMotion ? LIQUID_VB_H : 0}>
                    {!reducedMotion && (
                      <>
                        <animate attributeName="y" from={LIQUID_VB_H} to="0" dur={`${fillIntroDurationMs}ms`} begin="0s" fill="freeze" calcMode="spline" keySplines=".22 1 .36 1" />
                        <animate attributeName="height" from="0" to={LIQUID_VB_H} dur={`${fillIntroDurationMs}ms`} begin="0s" fill="freeze" calcMode="spline" keySplines=".22 1 .36 1" />
                      </>
                    )}
                  </rect>
                </clipPath>
              )}
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
                <stop offset="55%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
            </defs>

            <g clipPath={fillMotion.mode === 'reveal' ? `url(#${uid}-introClip)` : undefined}>
              <use data-vial-detail="liquid-body" href={`#${uid}-bodyPath`} fill="currentColor" fillOpacity="0.8" />
            <g clipPath={`url(#${uid}-clip)`}>
              <use href={`#${uid}-bodyPath`} fill={`url(#${uid}-depth)`} />
              <use href={`#${uid}-bodyPath`} fill={`url(#${uid}-side)`} />
              <rect x="0" y={LIQUID_VB_H - 34} width={LIQUID_VB_W} height="34" fill={`url(#${uid}-floor)`} />
              <ellipse cx={LIQUID_VB_W / 2} cy={LIQUID_VB_H - 13} rx="48" ry="15" fill={`url(#${uid}-caustic)`} />
              <rect ref={refractLeftRef} x={5 + visualLightOffset * 8} y="0" width="16" height={LIQUID_VB_H} fill={`url(#${uid}-refract)`} opacity={0.46 + visualFocus * 0.22} />
              <rect ref={refractRightRef} x={99 + visualLightOffset * 5} y="0" width="10" height={LIQUID_VB_H} fill={`url(#${uid}-refract)`} opacity={0.14 + visualFocus * 0.16} />
              <path ref={glowRef} data-vial-detail="liquid-glow" d={geom.glow} fill={`url(#${uid}-glow)`} />
              {!reducedMotion && LIQUID_BUBBLES.map((b, i) => (
                <circle key={i} data-vial-detail="liquid-bubble" cx={b.cx} cy="0" r={b.r} fill="rgba(255,255,255,0.55)">
                  <animateTransform attributeName="transform" type="translate" from="0 192" to="0 30" dur={`${b.dur}s`} begin={`${b.delay}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;0.5;0.5;0" keyTimes="0;0.18;0.72;1" dur={`${b.dur}s`} begin={`${b.delay}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>
            <path ref={surfaceRef} data-vial-detail="liquid-surface" d={geom.surface} fill={`url(#${uid}-surface)`} opacity={0.4 + visualFocus * 0.14} />
            <ellipse ref={leftGlintRef} cx="4" cy={geom.leftWallY} rx="4.5" ry="8" fill={`url(#${uid}-spec)`} opacity="0.5" />
            <ellipse ref={rightGlintRef} cx={LIQUID_VB_W - 4} cy={geom.rightWallY} rx="4.5" ry="8" fill={`url(#${uid}-spec)`} opacity="0.5" />
            <ellipse ref={specHaloRef} cx={geom.highlightX + highlightShift} cy={geom.highlightY} rx="24" ry="4.2" fill={`url(#${uid}-spec)`} opacity={0.14 + visualFocus * 0.14} />
            <ellipse ref={specCoreRef} cx={geom.highlightX + highlightShift} cy={geom.highlightY} rx="8" ry="2.8" fill={`url(#${uid}-spec)`} opacity={0.1 + visualFocus * 0.16} />
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
            </g>
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
              ref={labelSheenRef}
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-white/10 to-black/10"
              style={{ transform: `translateX(${visualLightOffset * 10}%)`, opacity: 0.62 + visualFocus * 0.2 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
