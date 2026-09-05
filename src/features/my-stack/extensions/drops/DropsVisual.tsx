import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { LiquidGraphic, type LiquidGraphicHandle } from '../../stage/LiquidGraphic'
import { StageLabel } from '../../stage/StageLabel'
import { usePrefersReducedMotion } from '../../stage/usePrefersReducedMotion'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  DROPS_CAP,
  DROPS_CAP_RIB_XS,
  DROPS_TEAT_PATH,
  DROPS_FILL,
  DROPS_GROUND_SHIFT,
  DROPS_INNER_PATH,
  DROPS_LABEL,
  DROPS_OUTER_PATH,
  DROPS_PIPETTE_PATH,
  DROPS_SHEEN_SHIFT,
  DROPS_SPEC,
} from './dropsShape'

export interface DropsVisualProps {
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

// Kein erfundener Platzhalter: ohne bekannte Menge bleibt die Zeile weg.
function dropsAmountLabel(amount?: string | number | null, unit?: string | null): string | null {
  if (amount === null || amount === undefined || amount === '') return null
  return unit ? `${amount} ${unit}` : String(amount)
}

// Die Tropfflasche nimmt dieselbe Sprosse wie die Ampulle: 146,7 -> 186,4.
// Die Breite folgt dem eigenen Verhaeltnis 72/272 = 0,265 — fast genau das
// der Ampulle, weshalb beide nebeneinander wie eine Familie wirken.
const SIZE_CLASS: Record<NonNullable<DropsVisualProps['size']>, string> = {
  large: 'h-[365px] w-[96.6px]',
  carousel: 'h-[146.7px] w-[38.8px] sm:h-[186.4px] sm:w-[49.3px]',
  compact: 'h-[110px] w-[29.1px]',
  mini: 'h-[60px] w-[15.9px]',
}

// Weiss, fett, mit Schattenkante — wie bei Vial, Ampulle und Nasenspray. Auf
// dem Braunglas ist der Kontrast sonst zu gering.
const NAME_SHARED = 'leading-tight font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
const DETAIL_SHARED = 'mt-0.5 font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'

const NAME_CLASS: Record<NonNullable<DropsVisualProps['size']>, string> = {
  large: `text-sm sm:text-base ${NAME_SHARED}`,
  carousel: `text-[7px] sm:text-[8.5px] ${NAME_SHARED}`,
  compact: `text-[5.5px] ${NAME_SHARED}`,
  mini: `text-[3px] ${NAME_SHARED}`,
}

const DETAIL_CLASS: Record<NonNullable<DropsVisualProps['size']>, string> = {
  large: `text-[10px] sm:text-xs ${DETAIL_SHARED}`,
  carousel: `text-[5px] sm:text-[6px] ${DETAIL_SHARED}`,
  compact: `text-[4px] ${DETAIL_SHARED}`,
  mini: `text-[2.5px] ${DETAIL_SHARED}`,
}

export function DropsVisual({
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
}: DropsVisualProps) {
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const labelName = name?.trim() || 'Tropfen'
  const detail = dropsAmountLabel(amount, unit)
  const chamber = DROPS_SPEC.chamber!

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const bulbLightRef = useRef<SVGEllipseElement | null>(null)
  const outlineRef = useRef<SVGUseElement | null>(null)
  const liquidRef = useRef<LiquidGraphicHandle | null>(null)
  const labelSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-drops-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-drops-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (50 - o * DROPS_GROUND_SHIFT).toFixed(2))
    shadowRef.current?.setAttribute('rx', (26 + f * 7).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    sweepRef.current?.setAttribute('transform', `translate(${(o * DROPS_SHEEN_SHIFT).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.1 + f * 0.26).toFixed(3))
    bulbLightRef.current?.setAttribute('cx', (39 - o * 4).toFixed(2))
    bulbLightRef.current?.setAttribute('opacity', (0.18 + f * 0.3).toFixed(3))
    outlineRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))
    liquidRef.current?.applyStageLight?.(f, o)
    if (labelSheenRef.current) {
      labelSheenRef.current.style.transform = `translateX(${(o * 12).toFixed(2)}%)`
      labelSheenRef.current.style.opacity = (0.6 + f * 0.22).toFixed(3)
    }
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-drops-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-drops-focus={Number(visualFocus.toFixed(2))}
      data-drops-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={labelName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="14 16 72 272"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <path id={`${uid}-outer`} d={DROPS_OUTER_PATH} />
          <path id={`${uid}-inner`} d={DROPS_INNER_PATH} />
          <clipPath id={`${uid}-outerClip`}>
            <use href={`#${uid}-outer`} />
          </clipPath>
          <clipPath id={`${uid}-innerClip`}>
            <use href={`#${uid}-inner`} />
          </clipPath>
          <clipPath id={`${uid}-capClip`}>
            <rect x={DROPS_CAP.x} y={DROPS_CAP.y} width={DROPS_CAP.width} height={DROPS_CAP.height} rx={DROPS_CAP.rx} />
          </clipPath>

          {/* Braunglas. Es daempft die Fluessigkeitsfarbe dahinter — deshalb
              traegt der Ballon die Eintragsfarbe noch einmal deutlich. */}
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3a1f0c" />
            <stop offset="18%" stopColor="#8a4f1e" />
            <stop offset="46%" stopColor="#5c3212" />
            <stop offset="78%" stopColor="#7a4419" />
            <stop offset="100%" stopColor="#2c1708" />
          </linearGradient>
          <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,236,205,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Macht aus der Kappenfarbe einen Zylinder. */}
          <linearGradient id={`${uid}-capShade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="78%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
          </linearGradient>
          <linearGradient id={`${uid}-collar`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#20242b" />
            <stop offset="22%" stopColor="#5b626d" />
            <stop offset="54%" stopColor="#383d45" />
            <stop offset="82%" stopColor="#4d535d" />
            <stop offset="100%" stopColor="#1b1f25" />
          </linearGradient>
          <radialGradient id={`${uid}-groundShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <ellipse
          ref={shadowRef}
          data-drops-detail="ground-shadow"
          cx={50 - visualLightOffset * DROPS_GROUND_SHIFT}
          cy="292"
          rx={26 + visualFocus * 7}
          ry="4.5"
          fill={`url(#${uid}-groundShadow)`}
          opacity={0.2 + visualFocus * 0.28}
        />

        {/* Der Gummisauger. Er bleibt dunkles Gummi — in der Vorlage traegt
            die Kappe die Farbe, nicht der Sauger. */}
        <path data-drops-detail="teat" d={DROPS_TEAT_PATH} fill="#2a2622" />
        <path
          d={DROPS_TEAT_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />

        {/* Die Schraubkappe ist die groesste nichtglaeserne Flaeche und traegt
            deshalb color_hex. Der Verlauf darueber macht aus der Farbe einen
            Zylinder statt eines flachen Rechtecks. */}
        <rect
          data-drops-detail="cap"
          x={DROPS_CAP.x}
          y={DROPS_CAP.y}
          width={DROPS_CAP.width}
          height={DROPS_CAP.height}
          rx={DROPS_CAP.rx}
          fill={color}
        />
        <rect
          x={DROPS_CAP.x}
          y={DROPS_CAP.y}
          width={DROPS_CAP.width}
          height={DROPS_CAP.height}
          rx={DROPS_CAP.rx}
          fill={`url(#${uid}-capShade)`}
        />
        <g clipPath={`url(#${uid}-capClip)`}>
          <g data-drops-detail="cap-ribs" fill="none" strokeWidth="0.7">
            {DROPS_CAP_RIB_XS.map(x => (
              <path
                key={x}
                d={`M${x} ${DROPS_CAP.y + 3} L${x} ${DROPS_CAP.y + DROPS_CAP.height - 3}`}
                stroke="rgba(0,0,0,0.22)"
              />
            ))}
          </g>
          <ellipse
            ref={bulbLightRef}
            data-drops-detail="cap-light"
            cx={39 - visualLightOffset * 4}
            cy={DROPS_CAP.y + 14}
            rx="6"
            ry="16"
            fill="rgba(255,255,255,0.4)"
            opacity={0.18 + visualFocus * 0.3}
          />
        </g>

        <use data-drops-detail="glass" href={`#${uid}-outer`} fill={`url(#${uid}-glass)`} />

        {/* Die Fluessigkeit wird von der INNEN-Kontur beschnitten, nie von der
            aeusseren: sonst fehlt der Glasboden und sie klebt an der Aussenwand. */}
        <g data-drops-detail="liquid-window" clipPath={`url(#${uid}-innerClip)`}>
          <LiquidGraphic
            uid={`${uid}-liquid`}
            fill={DROPS_FILL}
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

        {/* Die Glaspipette steht vor der Fluessigkeit und ist selbst leer:
            was dahinter liegt, scheint durch. */}
        <path
          data-drops-detail="pipette"
          d={DROPS_PIPETTE_PATH}
          fill="rgba(226,232,240,0.16)"
          stroke="rgba(226,232,240,0.42)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />

        {/* Die Wandstaerke. Non-scaling, damit sie die Karussellbreite ueberlebt. */}
        <use
          data-drops-detail="inner-contour"
          href={`#${uid}-inner`}
          fill="none"
          stroke="rgba(255,224,180,0.3)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        <g clipPath={`url(#${uid}-outerClip)`}>
          {/* Das wandernde Glanzband — beschnitten, sonst malt es neben das Glas. */}
          <rect
            ref={sweepRef}
            data-drops-detail="sweep"
            x="22"
            y="112"
            width="15"
            height="180"
            fill={`url(#${uid}-sweep)`}
            opacity={0.1 + visualFocus * 0.26}
            transform={`translate(${(visualLightOffset * DROPS_SHEEN_SHIFT).toFixed(2)} 0)`}
          />
        </g>

        <use
          ref={outlineRef}
          data-drops-detail="outer-contour"
          href={`#${uid}-outer`}
          fill="none"
          stroke="rgba(20,10,4,0.75)"
          strokeOpacity={0.36 + visualFocus * 0.28}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {showLabel && (
        <StageLabel
          name={labelName}
          detail={detail}
          className="left-0 right-0 rounded-sm"
          nameClassName={NAME_CLASS[size]}
          detailClassName={DETAIL_CLASS[size]}
          wrapperProps={{
            'data-drops-detail': 'label',
            style: {
              top: `${(DROPS_LABEL.topPct * 100).toFixed(1)}%`,
              height: `${(DROPS_LABEL.heightPct * 100).toFixed(1)}%`,
            },
          }}
          innerProps={{ className: 'flex h-full flex-col justify-center px-1' }}
          sheenRef={labelSheenRef}
          sheenStyle={{
            transform: `translateX(${visualLightOffset * 12}%)`,
            opacity: 0.6 + visualFocus * 0.22,
          }}
        />
      )}
    </div>
  )
}
