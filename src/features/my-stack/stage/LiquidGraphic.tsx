import { useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { CSSProperties, Ref } from 'react'
import { buildLiquid, LIQUID_VB_H, LIQUID_VB_W } from './liquidGeometry'
import { useSloshSubscribe } from '../../../components/SloshContext'
import type { SloshState } from '../../../components/sloshEngine'

// A few rising bubbles give the liquid life. Positions are in viewBox units and
// the body clip-path makes them pop out of existence at the waterline.
const LIQUID_BUBBLES = [
  { cx: 24, r: 1.5, dur: 5.4, delay: 0 },
  { cx: 46, r: 1.0, dur: 6.6, delay: 1.4 },
  { cx: 63, r: 1.9, dur: 5.0, delay: 2.6 },
  { cx: 82, r: 1.1, dur: 7.2, delay: 0.7 },
  { cx: 98, r: 1.4, dur: 5.9, delay: 3.2 },
]

// The liquid's own share of the stage light. The surrounding form calls this
// from its applyStageLight so both move in the same frame.
export interface LiquidGraphicHandle {
  applyStageLight: (focus: number, lightOffset: number) => void
}

export interface LiquidGraphicProps {
  uid: string
  fill: number // 0..1
  tilt?: number
  chamberAspect?: number
  // Where the chamber sits inside the surrounding form's viewBox.
  x: number
  y: number
  width: number
  height: number
  color: string
  bubbles?: boolean
  reducedMotion?: boolean
  seedFocus?: number
  seedLightOffset?: number
  motionKey?: number
  motionClass?: string
  motionStyle?: CSSProperties
  introReveal?: boolean
  introDurationMs?: number
  handleRef?: Ref<LiquidGraphicHandle>
}

// One graphic for the whole liquid: body, tilting surface, sub-surface glow,
// meniscus rim and specular all derive from the same sampled geometry, so they
// move as one. Subscribes to the slosh engine and redraws itself imperatively —
// no React render happens while the surface moves.
export function LiquidGraphic({
  uid,
  fill,
  tilt = 0,
  chamberAspect,
  x,
  y,
  width,
  height,
  color,
  bubbles = true,
  reducedMotion = false,
  seedFocus = 1,
  seedLightOffset = 0,
  motionKey,
  motionClass = '',
  motionStyle,
  introReveal = false,
  introDurationMs = 900,
  handleRef,
}: LiquidGraphicProps) {
  const subscribe = useSloshSubscribe()
  const stageRef = useRef({ focus: seedFocus, lightOffset: seedLightOffset })
  const highlightShift = seedLightOffset * 10
  const geom = buildLiquid({ fill, tilt, chamberAspect })

  const bodyRef = useRef<SVGPathElement | null>(null)
  const surfaceRef = useRef<SVGPathElement | null>(null)
  const glowRef = useRef<SVGPathElement | null>(null)
  const rimRef = useRef<SVGPathElement | null>(null)
  const specHaloRef = useRef<SVGEllipseElement | null>(null)
  const specCoreRef = useRef<SVGEllipseElement | null>(null)
  const leftGlintRef = useRef<SVGEllipseElement | null>(null)
  const rightGlintRef = useRef<SVGEllipseElement | null>(null)
  const refractLeftRef = useRef<SVGRectElement | null>(null)
  const refractRightRef = useRef<SVGRectElement | null>(null)

  const draw = useCallback(
    (s: SloshState) => {
      const stage = stageRef.current
      const stageFocus = stage.focus
      const stageShift = stage.lightOffset * 10
      const g = buildLiquid({ fill, tilt: s.tilt, energy: s.energy, time: s.time, chamberAspect })
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
    [fill, chamberAspect],
  )

  useEffect(() => {
    if (!subscribe) return
    return subscribe(draw)
  }, [subscribe, draw])

  const applyStageLight = useCallback((focus: number, lightOffset: number) => {
    stageRef.current = { focus, lightOffset }
    refractLeftRef.current?.setAttribute('x', (5 + lightOffset * 8).toFixed(2))
    refractLeftRef.current?.setAttribute('opacity', (0.46 + focus * 0.22).toFixed(3))
    refractRightRef.current?.setAttribute('x', (99 + lightOffset * 5).toFixed(2))
    refractRightRef.current?.setAttribute('opacity', (0.14 + focus * 0.16).toFixed(3))
    surfaceRef.current?.setAttribute('opacity', (0.4 + focus * 0.14).toFixed(3))
  }, [])

  useImperativeHandle(handleRef, () => ({ applyStageLight }), [applyStageLight])

  return (
    <svg
      key={motionKey}
      data-vial-detail="liquid-graphic"
      x={x}
      y={y}
      width={width}
      height={height}
      className={`overflow-visible ${motionClass}`}
      viewBox={`0 0 ${LIQUID_VB_W} ${LIQUID_VB_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ color, ...motionStyle }}
    >
    <defs>
    {/* one template path drives the body fills and the clip together */}
    <path id={`${uid}-bodyPath`} ref={bodyRef} d={geom.body} />
    <clipPath id={`${uid}-clip`}>
    <use href={`#${uid}-bodyPath`} />
    </clipPath>
    {introReveal && (
    <clipPath id={`${uid}-introClip`} clipPathUnits="userSpaceOnUse">
      <rect data-vial-detail="liquid-intro-reveal-clip" x="0" y={reducedMotion ? 0 : LIQUID_VB_H} width={LIQUID_VB_W} height={reducedMotion ? LIQUID_VB_H : 0}>
        {!reducedMotion && (
          <>
            <animate attributeName="y" from={LIQUID_VB_H} to="0" dur={`${introDurationMs}ms`} begin="0s" fill="freeze" calcMode="spline" keySplines=".22 1 .36 1" />
            <animate attributeName="height" from="0" to={LIQUID_VB_H} dur={`${introDurationMs}ms`} begin="0s" fill="freeze" calcMode="spline" keySplines=".22 1 .36 1" />
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

    <g clipPath={introReveal ? `url(#${uid}-introClip)` : undefined}>
    <use data-vial-detail="liquid-body" href={`#${uid}-bodyPath`} fill="currentColor" fillOpacity="0.8" />
    <g clipPath={`url(#${uid}-clip)`}>
    <use href={`#${uid}-bodyPath`} fill={`url(#${uid}-depth)`} />
    <use href={`#${uid}-bodyPath`} fill={`url(#${uid}-side)`} />
    <rect x="0" y={LIQUID_VB_H - 34} width={LIQUID_VB_W} height="34" fill={`url(#${uid}-floor)`} />
    <ellipse cx={LIQUID_VB_W / 2} cy={LIQUID_VB_H - 13} rx="48" ry="15" fill={`url(#${uid}-caustic)`} />
    <rect ref={refractLeftRef} x={5 + seedLightOffset * 8} y="0" width="16" height={LIQUID_VB_H} fill={`url(#${uid}-refract)`} opacity={0.46 + seedFocus * 0.22} />
    <rect ref={refractRightRef} x={99 + seedLightOffset * 5} y="0" width="10" height={LIQUID_VB_H} fill={`url(#${uid}-refract)`} opacity={0.14 + seedFocus * 0.16} />
    <path ref={glowRef} data-vial-detail="liquid-glow" d={geom.glow} fill={`url(#${uid}-glow)`} />
    {bubbles && !reducedMotion && LIQUID_BUBBLES.map((b, i) => (
    <circle key={i} data-vial-detail="liquid-bubble" cx={b.cx} cy="0" r={b.r} fill="rgba(255,255,255,0.55)">
      <animateTransform attributeName="transform" type="translate" from="0 192" to="0 30" dur={`${b.dur}s`} begin={`${b.delay}s`} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.5;0.5;0" keyTimes="0;0.18;0.72;1" dur={`${b.dur}s`} begin={`${b.delay}s`} repeatCount="indefinite" />
    </circle>
    ))}
    </g>
    <path ref={surfaceRef} data-vial-detail="liquid-surface" d={geom.surface} fill={`url(#${uid}-surface)`} opacity={0.4 + seedFocus * 0.14} />
    <ellipse ref={leftGlintRef} cx="4" cy={geom.leftWallY} rx="4.5" ry="8" fill={`url(#${uid}-spec)`} opacity="0.5" />
    <ellipse ref={rightGlintRef} cx={LIQUID_VB_W - 4} cy={geom.rightWallY} rx="4.5" ry="8" fill={`url(#${uid}-spec)`} opacity="0.5" />
    <ellipse ref={specHaloRef} cx={geom.highlightX + highlightShift} cy={geom.highlightY} rx="24" ry="4.2" fill={`url(#${uid}-spec)`} opacity={0.14 + seedFocus * 0.14} />
    <ellipse ref={specCoreRef} cx={geom.highlightX + highlightShift} cy={geom.highlightY} rx="8" ry="2.8" fill={`url(#${uid}-spec)`} opacity={0.1 + seedFocus * 0.16} />
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
  )
}
