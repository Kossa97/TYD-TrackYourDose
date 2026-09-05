import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  POWDER_BODY,
  POWDER_BODY_PATH,
  POWDER_GROUND_SHIFT,
  POWDER_LID,
  POWDER_LID_PATH,
  POWDER_LID_RIB_XS,
  POWDER_LID_RIB_YS,
  POWDER_LID_TOP_BAND,
  POWDER_NAME_INSET_PCT,
  POWDER_NAME_TOP_PCT,
  POWDER_SHEEN_SHIFT,
  POWDER_WIDTHS,
} from './powderShape'

export interface PowderVisualProps {
  name?: string | null
  color: string
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0)
const clampOffset = (value: number) => (Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0)

// Die Dose nimmt als erste stehende Form eine Sprosse NACH UNTEN: 115,7 ->
// 146,7 statt 146,7 -> 186,4. Sie ist die einzige stehende Form, die breiter
// als hoch wirkt; eine Sprosse hoeher waere sie doppelt so breit wie die
// breiteste bisherige Form. Der Schritt bleibt x1,2706, die Leiter also
// intakt — 146,7 ist genau die Hoehe von Vial, Ampulle und Tropfflasche.
const SIZE_CLASS: Record<NonNullable<PowderVisualProps['size']>, string> = {
  large: 'h-[287.3px] w-[191.5px]',
  carousel: 'h-[115.5px] w-[77px] sm:h-[146.7px] sm:w-[97.8px]',
  compact: 'h-[86.6px] w-[57.7px]',
  mini: 'h-[47.2px] w-[31.5px]',
}

// Die Dose ist die breiteste stehende Form: uebliche Namen passen hier ohne
// Durchlauf hinein, wo Vial und Ampulle laengst wandern.
const NAME_CLASS: Record<NonNullable<PowderVisualProps['size']>, string> = {
  large: 'text-lg leading-tight',
  carousel: 'text-[8px] sm:text-[10px] leading-tight',
  compact: 'text-[6px] leading-tight',
  mini: 'text-[3.5px] leading-tight',
}

export function PowderVisual({
  name,
  color,
  size = 'large',
  className = '',
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: PowderVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const labelName = name?.trim() || 'Pulver'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const sheenRef = useRef<SVGRectElement | null>(null)
  const lidLightRef = useRef<SVGEllipseElement | null>(null)
  const outlineRef = useRef<SVGPathElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-powder-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-powder-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (60 - o * POWDER_GROUND_SHIFT).toFixed(2))
    shadowRef.current?.setAttribute('rx', (36 + f * 9).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    sheenRef.current?.setAttribute('transform', `translate(${(o * POWDER_SHEEN_SHIFT).toFixed(2)} 0)`)
    sheenRef.current?.setAttribute('opacity', (0.12 + f * 0.3).toFixed(3))
    lidLightRef.current?.setAttribute('cx', (36 - o * 6).toFixed(2))
    lidLightRef.current?.setAttribute('opacity', (0.14 + f * 0.24).toFixed(3))
    outlineRef.current?.setAttribute('stroke-opacity', (0.3 + f * 0.26).toFixed(3))
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-powder-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-powder-focus={Number(visualFocus.toFixed(2))}
      data-powder-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={labelName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="10 6 100 150"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`${uid}-bodyClip`}>
            <path d={POWDER_BODY_PATH} />
          </clipPath>
          <clipPath id={`${uid}-lidClip`}>
            <path d={POWDER_LID_PATH} />
          </clipPath>

          {/* Mattes HDPE, kein Glas und kein Blech: ein breiter weicher Kern
              statt einer harten Glanzkante. Genau das unterscheidet die Dose
              von der Tube, die daneben stehen kann. */}
          <linearGradient id={`${uid}-bodyShade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8b97a8" />
            <stop offset="14%" stopColor="#cbd5e1" />
            <stop offset="42%" stopColor="#eef2f7" />
            <stop offset="72%" stopColor="#cdd6e2" />
            <stop offset="100%" stopColor="#7d8899" />
          </linearGradient>
          {/* Der Deckel traegt die Eintragsfarbe; der Verlauf legt darueber
              nur Licht und Schatten, damit aus der flachen Farbe ein Zylinder
              wird — dieselbe Technik wie bei der Kappe der Tropfflasche. */}
          <linearGradient id={`${uid}-lidShade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="16%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="44%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="74%" stopColor="rgba(0,0,0,0.14)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
          </linearGradient>
          <linearGradient id={`${uid}-lidTop`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Die Schulter: der Schatten, den der Deckelrand auf den Korpus
              wirft. Ohne ihn schwebt der Deckel auf der Dose. */}
          <linearGradient id={`${uid}-shoulder`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(15,23,42,0.32)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </linearGradient>
          <radialGradient id={`${uid}-groundShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <ellipse
          ref={shadowRef}
          data-powder-detail="ground-shadow"
          cx={60 - visualLightOffset * POWDER_GROUND_SHIFT}
          cy="159"
          rx={36 + visualFocus * 9}
          ry="4.5"
          fill={`url(#${uid}-groundShadow)`}
          opacity={0.2 + visualFocus * 0.28}
        />

        {/* Der Korpus zuerst, der Deckel danach: sein Rand deckt die
            Korpusoberkante ab, dort kann keine Fuge aufgehen. */}
        <path data-powder-detail="body" d={POWDER_BODY_PATH} fill={`url(#${uid}-bodyShade)`} />

        <g clipPath={`url(#${uid}-bodyClip)`}>
          <rect
            data-powder-detail="shoulder"
            x={POWDER_BODY.x}
            y={POWDER_BODY.y}
            width={POWDER_WIDTHS.body}
            height="10"
            fill={`url(#${uid}-shoulder)`}
          />
          {/* Der wandernde Glanzkern. Beschnitten, sonst malt er neben die
              Dose — derselbe Fehler wie beim Tabletten-Glanz. */}
          <rect
            ref={sheenRef}
            data-powder-detail="sheen"
            x="30"
            y={POWDER_BODY.y}
            width="22"
            height="120"
            fill={`url(#${uid}-sheen)`}
            opacity={0.12 + visualFocus * 0.3}
            transform={`translate(${(visualLightOffset * POWDER_SHEEN_SHIFT).toFixed(2)} 0)`}
          />
        </g>

        <path data-powder-detail="lid" d={POWDER_LID_PATH} fill={color} />
        <path d={POWDER_LID_PATH} fill={`url(#${uid}-lidShade)`} />
        <g clipPath={`url(#${uid}-lidClip)`}>
          <rect
            data-powder-detail="lid-top"
            x={POWDER_LID.x}
            y={POWDER_LID.y}
            width={POWDER_LID.width}
            height={POWDER_LID_TOP_BAND}
            fill={`url(#${uid}-lidTop)`}
          />
          {/* Jede Rille ist eine dunkle Kerbe mit einer hellen Kante daneben.
              Eine einzelne Linie liest sich als aufgemalt. */}
          <g data-powder-detail="lid-ribs" fill="none" strokeWidth="1">
            {POWDER_LID_RIB_XS.map(x => (
              <g key={x}>
                <path
                  d={`M${x} ${POWDER_LID_RIB_YS.top} L${x} ${POWDER_LID_RIB_YS.bottom}`}
                  stroke="rgba(0,0,0,0.26)"
                />
                <path
                  d={`M${x + 1.2} ${POWDER_LID_RIB_YS.top} L${x + 1.2} ${POWDER_LID_RIB_YS.bottom}`}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.7"
                />
              </g>
            ))}
          </g>
          <ellipse
            ref={lidLightRef}
            data-powder-detail="lid-light"
            cx={36 - visualLightOffset * 6}
            cy={POWDER_LID.y + POWDER_LID.height / 2 + 2}
            rx="7"
            ry="10"
            fill="rgba(255,255,255,0.32)"
            opacity={0.14 + visualFocus * 0.24}
          />
        </g>

        <path
          ref={outlineRef}
          data-powder-detail="outline"
          d={POWDER_BODY_PATH}
          fill="none"
          stroke="rgba(51,65,85,0.5)"
          strokeOpacity={0.3 + visualFocus * 0.26}
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Der Name steht direkt auf dem Korpus, wie bei der Tube: ohne Kammer
          gibt es kein Etikettband, und die Regel dafuer wird nicht angefasst. */}
      <div
        data-powder-detail="name"
        className="absolute -translate-y-1/2 text-center"
        style={{
          top: `${POWDER_NAME_TOP_PCT * 100}%`,
          left: `${(POWDER_NAME_INSET_PCT * 100).toFixed(2)}%`,
          right: `${(POWDER_NAME_INSET_PCT * 100).toFixed(2)}%`,
        }}
      >
        <StageMarquee className={`${NAME_CLASS[size]} font-black tracking-normal text-slate-900`}>
          {labelName}
        </StageMarquee>
      </div>
    </div>
  )
}
