import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { LiquidGraphic, type LiquidGraphicHandle } from '../../stage/LiquidGraphic'
import { StageLabel } from '../../stage/StageLabel'
import { usePrefersReducedMotion } from '../../stage/usePrefersReducedMotion'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  AMPOULE_FILL,
  AMPOULE_INNER_PATH,
  AMPOULE_LABEL,
  AMPOULE_OUTER_PATH,
  AMPOULE_SPEC,
} from './ampouleShape'

export interface AmpouleVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  color: string
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0)
const clampOffset = (value: number) => (Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0)

// No invented placeholder: without a known amount the line simply stays away.
function ampouleAmountLabel(amount?: string | number | null, unit?: string | null): string | null {
  if (amount === null || amount === undefined || amount === '') return null
  return unit ? `${amount} ${unit}` : String(amount)
}

// The total height matches the vial at every size — including the carousel's
// sm breakpoint, where the vial grows from 146.7 to 186.4 px. The width always
// follows from the ampoule's own aspect (72/274), so it is never squashed to
// fill a foreign box. Written as classes, because a breakpoint cannot live in
// an inline style.
const SIZE_CLASS: Record<NonNullable<AmpouleVisualProps['size']>, string> = {
  large: 'h-[365px] w-[96px]',
  carousel: 'h-[146.7px] w-[38.6px] sm:h-[186.4px] sm:w-[49px]',
  compact: 'h-[110px] w-[29px]',
  mini: 'h-[60px] w-[15.8px]',
}

export function AmpouleVisual({
  name,
  amount,
  unit,
  color,
  size = 'large',
  className = '',
  showLabel = true,
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: AmpouleVisualProps) {
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const chamber = AMPOULE_SPEC.chamber!

  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const labelName = name?.trim() || 'Ampulle'
  const detail = ampouleAmountLabel(amount, unit)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const bloomRef = useRef<SVGRectElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const hiLeftRef = useRef<SVGGElement | null>(null)
  const hiRightRef = useRef<SVGGElement | null>(null)
  const outlineRef = useRef<SVGUseElement | null>(null)
  const liquidRef = useRef<LiquidGraphicHandle | null>(null)
  const labelSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-ampoule-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-ampoule-light-offset', o.toFixed(2))

    shadowRef.current?.setAttribute('cx', (60 - o * 6).toFixed(2))
    shadowRef.current?.setAttribute('rx', (24 + f * 9).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    outlineRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))
    bloomRef.current?.setAttribute('transform', `translate(${(o * 14).toFixed(2)} 0)`)
    bloomRef.current?.setAttribute('opacity', (0.2 + f * 0.42).toFixed(3))
    sweepRef.current?.setAttribute('transform', `translate(${(o * 22).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.14 + f * 0.34).toFixed(3))
    // the edge facing the fixed light brightens, the far edge dims
    hiLeftRef.current?.setAttribute('opacity', Math.max(0.08, Math.min(1, 0.6 - o * 0.6)).toFixed(3))
    hiRightRef.current?.setAttribute('opacity', Math.max(0.08, Math.min(1, 0.5 + o * 0.6)).toFixed(3))

    liquidRef.current?.applyStageLight(f, o)

    if (labelSheenRef.current) {
      labelSheenRef.current.style.transform = `translateX(${(o * 10).toFixed(2)}%)`
      labelSheenRef.current.style.opacity = (0.62 + f * 0.2).toFixed(3)
    }
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  const nameClass = size === 'large'
    ? 'text-base sm:text-lg leading-tight font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
    : size === 'carousel'
      ? 'text-[8.5px] sm:text-[10px] leading-tight font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
      : 'text-[7px] leading-tight font-black text-white'
  const detailClass = size === 'large'
    ? 'text-[10px] sm:text-xs mt-0.5 font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'
    : 'text-[6px] mt-0.5 font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'

  return (
    <div
      ref={rootRef}
      data-ampoule-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-ampoule-focus={Number(visualFocus.toFixed(2))}
      data-ampoule-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={detail ? `${labelName}, ${detail}` : labelName}
    >
      <svg
        data-ampoule-detail="glass"
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="24 5 72 274"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <path id={`${uid}-outer`} d={AMPOULE_OUTER_PATH} />
          <path id={`${uid}-inner`} d={AMPOULE_INNER_PATH} />
          <clipPath id={`${uid}-outerClip`}>
            <use href={`#${uid}-outer`} />
          </clipPath>
          <clipPath id={`${uid}-innerClip`}>
            <use href={`#${uid}-inner`} />
          </clipPath>
          {/* clear glass: only the edges carry glass-thickness tint */}
          <linearGradient id={`${uid}-glassDepth`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(2,6,23,0.62)" />
            <stop offset="9%" stopColor="rgba(226,232,240,0.11)" />
            <stop offset="32%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="72%" stopColor="rgba(15,23,42,0.11)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.72)" />
          </linearGradient>
          <radialGradient id={`${uid}-glassBloom`} gradientUnits="userSpaceOnUse" cx="60" cy="150" r="88">
            <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id={`${uid}-glassSweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id={`${uid}-stageShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.78)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.5)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.1" />
          </filter>
          <filter id={`${uid}-glint`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        </defs>

        <ellipse
          ref={shadowRef}
          data-ampoule-detail="stage-shadow"
          cx={60 - visualLightOffset * 6}
          cy="286"
          rx={24 + visualFocus * 9}
          ry="5"
          fill={`url(#${uid}-stageShadow)`}
          opacity={0.2 + visualFocus * 0.28}
        />

        <use
          ref={outlineRef}
          data-ampoule-detail="outer-contour"
          href={`#${uid}-outer`}
          fill={`url(#${uid}-glassDepth)`}
          stroke="rgba(203,213,225,0.56)"
          strokeOpacity={0.36 + visualFocus * 0.28}
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />

        <g clipPath={`url(#${uid}-outerClip)`}>
          <rect
            ref={bloomRef}
            x="-40"
            y="-20"
            width="200"
            height="334"
            fill={`url(#${uid}-glassBloom)`}
            opacity={0.2 + visualFocus * 0.42}
            transform={`translate(${visualLightOffset * 14} 0)`}
          />
          <rect
            ref={sweepRef}
            data-ampoule-detail="glass-sweep"
            x="42"
            y="0"
            width="36"
            height="294"
            fill={`url(#${uid}-glassSweep)`}
            opacity={0.14 + visualFocus * 0.34}
            transform={`translate(${visualLightOffset * 22} 0)`}
          />
        </g>

        {/* The liquid is clipped by the INNER contour, never the outer one, so
            a glass floor stays under it and it rounds into the inner radius. */}
        <g data-ampoule-detail="liquid-window" clipPath={`url(#${uid}-innerClip)`}>
          <LiquidGraphic
            uid={`${uid}-liquid`}
            fill={AMPOULE_FILL}
            chamberAspect={chamber.aspect}
            x={chamber.x}
            y={chamber.y}
            width={chamber.width}
            height={chamber.height}
            color={color}
            bubbles={size === 'large'}
            reducedMotion={reducedMotion}
            seedFocus={visualFocus}
            seedLightOffset={visualLightOffset}
            handleRef={liquidRef}
          />
        </g>

        {/* Punt and base sheen sit in the glass floor, seen through the liquid */}
        <g clipPath={`url(#${uid}-outerClip)`}>
          <ellipse cx="60" cy="274.5" rx="26" ry="4" fill="rgba(255,255,255,0.13)" filter={`url(#${uid}-glint)`} />
          <ellipse data-ampoule-detail="punt" cx="60" cy="272.5" rx="15" ry="3.6" fill="rgba(2,6,23,0.4)" />
          <path d="M45 272.6 C 49 268.8, 71 268.8, 75 272.6" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="0.9" />
        </g>

        {/* The wall thickness. Non-scaling so it survives the carousel width. */}
        <use
          data-ampoule-detail="inner-contour"
          href={`#${uid}-inner`}
          fill="none"
          stroke="rgba(226,232,240,0.34)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />

        {/* Edge lights follow the contour and bend into the base radius */}
        <g data-ampoule-detail="edge-lights">
          <g ref={hiLeftRef} opacity={Math.max(0.08, Math.min(1, 0.6 - visualLightOffset * 0.6))}>
            <path
              d="M32.5 158 L32.5 250 C32.5 262 36.5 268.5 45 272"
              fill="none"
              stroke="rgba(255,255,255,0.52)"
              strokeOpacity="0.6"
              strokeWidth="4.8"
              strokeLinecap="round"
              filter={`url(#${uid}-soft)`}
            />
            <path
              d="M46.5 104 C 44.2 94, 45.4 76, 48.6 60 C 50.8 48, 53.6 33, 54.8 21"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeOpacity="0.55"
              strokeWidth="3.4"
              strokeLinecap="round"
              filter={`url(#${uid}-soft)`}
            />
          </g>
          <g ref={hiRightRef} opacity={Math.max(0.08, Math.min(1, 0.5 + visualLightOffset * 0.6))}>
            <path
              d="M87.5 172 L87.5 250 C87.5 260 84.5 266 79 269.5"
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeOpacity="0.42"
              strokeWidth="2.6"
              strokeLinecap="round"
              filter={`url(#${uid}-soft)`}
            />
            <path
              d="M73.5 108 C 76 100, 75.5 88, 74.2 78"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeOpacity="0.3"
              strokeWidth="2"
              strokeLinecap="round"
              filter={`url(#${uid}-soft)`}
            />
          </g>
          {/* real glass bundles the light where the neck pinches in */}
          <ellipse cx="49.5" cy="95" rx="2.6" ry="5.5" fill="rgba(255,255,255,0.7)" filter={`url(#${uid}-glint)`} />
          <ellipse cx="70.5" cy="95" rx="1.6" ry="4" fill="rgba(255,255,255,0.4)" filter={`url(#${uid}-glint)`} />
          <ellipse cx="58" cy="16" rx="2" ry="5" fill="rgba(255,255,255,0.7)" filter={`url(#${uid}-glint)`} />
        </g>
      </svg>

      {!isActive && (
        <svg
          data-ampoule-detail="inactive-overlay"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="24 5 72 274"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <path d={AMPOULE_OUTER_PATH} fill="rgba(0,0,0,0.34)" />
        </svg>
      )}

      {showLabel && (
        <StageLabel
          name={labelName}
          detail={detail}
          className="left-[4%] right-[4%] rounded-sm"
          nameClassName={nameClass}
          detailClassName={detailClass}
          wrapperProps={{
            'data-ampoule-detail': 'label',
            style: {
              top: `${(AMPOULE_LABEL.topPct * 100).toFixed(1)}%`,
              height: `${(AMPOULE_LABEL.heightPct * 100).toFixed(1)}%`,
            },
          }}
          innerProps={{ 'data-ampoule-detail': 'label-inner' }}
          sheenRef={labelSheenRef}
          sheenStyle={{
            transform: `translateX(${visualLightOffset * 10}%)`,
            opacity: 0.62 + visualFocus * 0.2,
          }}
        />
      )}
    </div>
  )
}
