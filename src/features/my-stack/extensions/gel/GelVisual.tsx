import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  GEL_BODY_FILL_PATH,
  GEL_BODY_PATH,
  GEL_GROUND_SHIFT,
  GEL_INNER_PATH,
  GEL_LABEL_PATH,
  GEL_DOME,
  GEL_LID_CHAMFER,
  GEL_LID_PATH,
  GEL_LID_RIM,
  GEL_NAME_INSET_PCT,
  GEL_NAME_TOP_PCT,
  GEL_SHEEN_SHIFT,
  GEL_SURFACE,
} from './gelShape'

export interface GelVisualProps {
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

// Der Tiegel nimmt die Sprosse unter der Pulverdose: 90,9 -> 115,5 statt
// 115,5 -> 146,7. Der Schritt bleibt x1,2706. Ein flacher Tiegel ist niedriger
// als eine Dose — und wird trotz der tieferen Sprosse das breiteste stehende
// Objekt, weil er als einziger breiter als hoch ist.
const SIZE_CLASS: Record<NonNullable<GelVisualProps['size']>, string> = {
  large: 'h-[226.1px] w-[282.6px]',
  carousel: 'h-[90.9px] w-[113.6px] sm:h-[115.5px] sm:w-[144.4px]',
  compact: 'h-[68.2px] w-[85.2px]',
  mini: 'h-[37.1px] w-[46.4px]',
}

const NAME_CLASS: Record<NonNullable<GelVisualProps['size']>, string> = {
  large: 'text-base leading-tight',
  carousel: 'text-[7px] sm:text-[9px] leading-tight',
  compact: 'text-[5.5px] leading-tight',
  mini: 'text-[3px] leading-tight',
}

export function GelVisual({
  name,
  color,
  size = 'large',
  className = '',
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: GelVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const labelName = name?.trim() || 'Gel'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const sheenRef = useRef<SVGRectElement | null>(null)
  const bloomRef = useRef<SVGRectElement | null>(null)
  const gelGlossRef = useRef<SVGEllipseElement | null>(null)
  const crownRef = useRef<SVGEllipseElement | null>(null)
  const outlineRef = useRef<SVGPathElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-gel-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-gel-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (80 - o * GEL_GROUND_SHIFT).toFixed(2))
    shadowRef.current?.setAttribute('rx', (52 + f * 12).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    sheenRef.current?.setAttribute('transform', `translate(${(o * GEL_SHEEN_SHIFT).toFixed(2)} 0)`)
    sheenRef.current?.setAttribute('opacity', (0.12 + f * 0.3).toFixed(3))
    bloomRef.current?.setAttribute('transform', `translate(${(o * 12).toFixed(2)} 0)`)
    bloomRef.current?.setAttribute('opacity', (0.2 + f * 0.4).toFixed(3))
    gelGlossRef.current?.setAttribute('cx', (60 - o * 12).toFixed(2))
    gelGlossRef.current?.setAttribute('opacity', (0.18 + f * 0.3).toFixed(3))
    crownRef.current?.setAttribute('cx', (58 - o * 14).toFixed(2))
    crownRef.current?.setAttribute('opacity', (0.16 + f * 0.24).toFixed(3))
    outlineRef.current?.setAttribute('stroke-opacity', (0.3 + f * 0.26).toFixed(3))
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-gel-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-gel-focus={Number(visualFocus.toFixed(2))}
      data-gel-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={labelName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="5 4 150 120"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`${uid}-bodyClip`}>
            <path d={GEL_BODY_PATH} />
          </clipPath>
          <clipPath id={`${uid}-gelClip`}>
            <path d={GEL_BODY_FILL_PATH} />
          </clipPath>

          {/* Klarglas: dieselben Werte wie bei Vial, Ampulle, Nasenspray und
              Tropfen. Nur die Raender tragen die Glasdicke, die Mitte bleibt
              leer — sonst waere das Gel dahinter nicht zu sehen. */}
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(2,6,23,0.62)" />
            <stop offset="9%" stopColor="rgba(226,232,240,0.11)" />
            <stop offset="32%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="72%" stopColor="rgba(15,23,42,0.11)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.72)" />
          </linearGradient>
          <radialGradient id={`${uid}-glassBloom`} gradientUnits="userSpaceOnUse" cx="80" cy="80" r="86">
            <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Das Gel: durchscheinend, nach unten dichter. Kein Verlauf ins
              Schwarze wie bei der Fluessigkeit — eine Salbe wird satt, nicht
              dunkel. */}
          <linearGradient id={`${uid}-gelDepth`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="26%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.3)" />
          </linearGradient>
          <linearGradient id={`${uid}-gelSide`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(15,23,42,0.26)" />
            <stop offset="22%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="70%" stopColor="rgba(15,23,42,0.04)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.28)" />
          </linearGradient>

          {/* Der Deckel traegt die Eintragsfarbe; die Verlaeufe legen darueber
              nur Licht und Schatten. */}
          <linearGradient id={`${uid}-lidShade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.62)" />
            <stop offset="8%" stopColor="rgba(0,0,0,0.28)" />
            <stop offset="24%" stopColor="rgba(255,255,255,0.26)" />
            <stop offset="46%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="72%" stopColor="rgba(0,0,0,0.16)" />
            <stop offset="92%" stopColor="rgba(0,0,0,0.44)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.66)" />
          </linearGradient>
          <radialGradient id={`${uid}-crown`} cx="38%" cy="34%" r="72%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.07)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.26)" />
          </radialGradient>
          <linearGradient id={`${uid}-labelShade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(15,23,42,0.34)" />
            <stop offset="16%" stopColor="rgba(15,23,42,0.06)" />
            <stop offset="44%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="76%" stopColor="rgba(15,23,42,0.05)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.36)" />
          </linearGradient>
          <radialGradient id={`${uid}-groundShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <ellipse
          ref={shadowRef}
          data-gel-detail="ground-shadow"
          cx={80 - visualLightOffset * GEL_GROUND_SHIFT}
          cy="126"
          rx={52 + visualFocus * 12}
          ry="4.5"
          fill={`url(#${uid}-groundShadow)`}
          opacity={0.2 + visualFocus * 0.28}
        />

        <path data-gel-detail="glass" d={GEL_BODY_PATH} fill={`url(#${uid}-glass)`} />

        <g clipPath={`url(#${uid}-bodyClip)`}>
          <rect
            ref={bloomRef}
            data-gel-detail="bloom"
            x="-40"
            y="20"
            width="280"
            height="120"
            fill={`url(#${uid}-glassBloom)`}
            opacity={0.2 + visualFocus * 0.4}
            transform={`translate(${(visualLightOffset * 12).toFixed(2)} 0)`}
          />
          <rect
            ref={sheenRef}
            data-gel-detail="sheen"
            x="34"
            y="30"
            width="20"
            height="95"
            fill={`url(#${uid}-sheen)`}
            opacity={0.12 + visualFocus * 0.3}
            transform={`translate(${(visualLightOffset * GEL_SHEEN_SHIFT).toFixed(2)} 0)`}
          />
        </g>

        {/* Das Gel. Es steht still: kein Neigen beim Wischen, keine Blaeschen,
            kein Pegel. Nur der Glanz auf der Oberflaeche wandert mit. */}
        <g data-gel-detail="gel">
          <path d={GEL_BODY_FILL_PATH} fill={color} opacity="0.82" />
          <path d={GEL_BODY_FILL_PATH} fill={`url(#${uid}-gelDepth)`} />
          <path d={GEL_BODY_FILL_PATH} fill={`url(#${uid}-gelSide)`} />
          {/* Die Aufsicht auf die Masse: dieselbe Ellipse, heller, weil man
              von oben auf sie schaut. */}
          <ellipse
            data-gel-detail="gel-surface"
            cx={GEL_SURFACE.cx}
            cy={GEL_SURFACE.cy}
            rx={GEL_SURFACE.rx}
            ry={GEL_SURFACE.ry}
            fill={color}
          />
          <ellipse
            cx={GEL_SURFACE.cx}
            cy={GEL_SURFACE.cy}
            rx={GEL_SURFACE.rx}
            ry={GEL_SURFACE.ry}
            fill="rgba(255,255,255,0.22)"
          />
          {/* Die Woelbung. Gel nivelliert sich nicht — ohne sie waere die
              Oberflaeche ein Fluessigkeitsspiegel. */}
          <ellipse
            data-gel-detail="gel-dome"
            cx={GEL_DOME.cx}
            cy={GEL_DOME.cy}
            rx={GEL_DOME.rx}
            ry={GEL_DOME.ry}
            fill="rgba(255,255,255,0.16)"
          />
          <g clipPath={`url(#${uid}-gelClip)`}>
            <ellipse
              ref={gelGlossRef}
              data-gel-detail="gel-gloss"
              cx={60 - visualLightOffset * 12}
              cy={GEL_SURFACE.cy - 0.8}
              rx="20"
              ry="3"
              fill="rgba(255,255,255,0.5)"
              opacity={0.18 + visualFocus * 0.3}
            />
          </g>
          <ellipse
            cx={GEL_SURFACE.cx}
            cy={GEL_SURFACE.cy}
            rx={GEL_SURFACE.rx}
            ry={GEL_SURFACE.ry}
            fill="none"
            stroke="rgba(15,23,42,0.2)"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        {/* Die Wandstaerke, wie bei den anderen Glasformen. */}
        <path
          data-gel-detail="inner-contour"
          d={GEL_INNER_PATH}
          fill="none"
          stroke="rgba(226,232,240,0.34)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />

        {/* Die Glaskontur gehoert VOR den Deckel: ihr Pfad schliesst oben
            waagerecht, als letztes gezeichnet legte dieser Ringschluss einen
            geraden Strich quer ueber den Deckel — derselbe Fehler wie bei der
            Pulverdose. */}
        <path
          ref={outlineRef}
          data-gel-detail="outline"
          d={GEL_BODY_PATH}
          fill="none"
          stroke="rgba(203,213,225,0.56)"
          strokeOpacity={0.3 + visualFocus * 0.26}
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />

        <g data-gel-detail="label">
          <path d={GEL_LABEL_PATH} fill="#fbfcfe" />
          <path d={GEL_LABEL_PATH} fill={`url(#${uid}-labelShade)`} />
          <path
            d={GEL_LABEL_PATH}
            fill="none"
            stroke="rgba(15,23,42,0.18)"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        <path data-gel-detail="lid" d={GEL_LID_PATH} fill={color} />
        <path d={GEL_LID_PATH} fill={`url(#${uid}-lidShade)`} />

        {/* Die Deckflaeche mit ihrer Fase. Glatt, ohne Riffelung — das ist der
            Unterschied zur Pulverdose, die ihre Rillen hat. */}
        <g data-gel-detail="lid-crown">
          <ellipse
            cx={GEL_LID_RIM.cx}
            cy={GEL_LID_RIM.cy}
            rx={GEL_LID_RIM.rx}
            ry={GEL_LID_RIM.ry}
            fill={color}
          />
          <ellipse
            cx={GEL_LID_RIM.cx}
            cy={GEL_LID_RIM.cy}
            rx={GEL_LID_RIM.rx}
            ry={GEL_LID_RIM.ry}
            fill={`url(#${uid}-crown)`}
          />
          <ellipse
            data-gel-detail="crown-chamfer"
            cx={GEL_LID_RIM.cx}
            cy={GEL_LID_RIM.cy}
            rx={GEL_LID_CHAMFER.rx}
            ry={GEL_LID_CHAMFER.ry}
            fill="none"
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="0.7"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            ref={crownRef}
            data-gel-detail="crown-light"
            cx={58 - visualLightOffset * 14}
            cy={GEL_LID_RIM.cy - 1.8}
            rx="22"
            ry="2.6"
            fill="rgba(255,255,255,0.4)"
            opacity={0.16 + visualFocus * 0.24}
          />
          <ellipse
            cx={GEL_LID_RIM.cx}
            cy={GEL_LID_RIM.cy}
            rx={GEL_LID_RIM.rx}
            ry={GEL_LID_RIM.ry}
            fill="none"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>

      <div
        data-gel-detail="name"
        className="absolute -translate-y-1/2 text-center"
        style={{
          top: `${(GEL_NAME_TOP_PCT * 100).toFixed(2)}%`,
          left: `${(GEL_NAME_INSET_PCT * 100).toFixed(2)}%`,
          right: `${(GEL_NAME_INSET_PCT * 100).toFixed(2)}%`,
        }}
      >
        <StageMarquee className={`${NAME_CLASS[size]} font-black tracking-normal text-slate-900`}>
          {labelName}
        </StageMarquee>
      </div>
    </div>
  )
}
