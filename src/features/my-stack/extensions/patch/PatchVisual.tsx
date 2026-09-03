import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  PATCH_BODY,
  PATCH_BODY_PATH,
  PATCH_FLAP_PATH,
  PATCH_FLAP_SHADOW_SHIFT,
  PATCH_NAME_PCT,
  PATCH_SHEEN_SHIFT,
  PATCH_STRIPE,
} from './patchShape'

export interface PatchVisualProps {
  name?: string | null
  color: string
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0)
const clampOffset = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0)

// Das Pflaster liegt quer und bekommt deshalb eine eigene Sprosse: die Hoehe
// ist klein, die Breite folgt dem Verhaeltnis 208/132 = 1,576. Die Abstaende
// zwischen den Groessen sind dieselben wie bei den stehenden Formen.
const SIZE_CLASS: Record<NonNullable<PatchVisualProps['size']>, string> = {
  large: 'h-[236.9px] w-[373.3px]',
  carousel: 'h-[95.2px] w-[150px] sm:h-[121px] sm:w-[190.6px]',
  compact: 'h-[71.4px] w-[112.5px]',
  mini: 'h-[38.9px] w-[61.3px]',
}

const NAME_CLASS: Record<NonNullable<PatchVisualProps['size']>, string> = {
  large: 'text-lg leading-tight',
  carousel: 'text-[8px] sm:text-[10px] leading-tight',
  compact: 'text-[6px] leading-tight',
  mini: 'text-[3.5px] leading-tight',
}

export function PatchVisual({
  name,
  color,
  size = 'large',
  className = '',
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: PatchVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const patchName = name?.trim() || 'Pflaster'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const sheenRef = useRef<SVGRectElement | null>(null)
  const flapShadowRef = useRef<SVGPathElement | null>(null)
  const bodyRef = useRef<SVGPathElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-patch-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-patch-light-offset', o.toFixed(2))
    sheenRef.current?.setAttribute('transform', `translate(${(o * PATCH_SHEEN_SHIFT).toFixed(2)} 0)`)
    sheenRef.current?.setAttribute('opacity', (0.06 + f * 0.2).toFixed(3))
    flapShadowRef.current?.setAttribute(
      'transform',
      `translate(${(-o * PATCH_FLAP_SHADOW_SHIFT).toFixed(2)} 2)`,
    )
    bodyRef.current?.setAttribute('opacity', (0.74 + f * 0.26).toFixed(3))
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-patch-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-patch-focus={Number(visualFocus.toFixed(2))}
      data-patch-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={patchName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="6 6 208 132"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`${uid}-bodyClip`}>
            <path d={PATCH_BODY_PATH} />
          </clipPath>
          {/* Matte Klebeflaeche, kein Glas: ein weicher Verlauf statt Glanz. */}
          <linearGradient id={`${uid}-face`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#d8d1c2" />
            <stop offset="52%" stopColor="#c6bfaf" />
            <stop offset="100%" stopColor="#ada695" />
          </linearGradient>
          {/* Die Traegerfolie auf der Rueckseite der Lasche glaenzt dagegen. */}
          <linearGradient id={`${uid}-liner`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f2f5f8" />
            <stop offset="46%" stopColor="#b9c2cc" />
            <stop offset="100%" stopColor="#8d97a3" />
          </linearGradient>
          <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.75)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <path
          ref={bodyRef}
          data-patch-detail="body"
          d={PATCH_BODY_PATH}
          fill={`url(#${uid}-face)`}
          opacity={0.74 + visualFocus * 0.26}
        />

        <g clipPath={`url(#${uid}-bodyClip)`}>
          {/* Der Farbstreifen ist die einzige Stelle mit color_hex. */}
          <rect
            data-patch-detail="stripe"
            x={PATCH_BODY.x}
            y={PATCH_STRIPE.y}
            width={PATCH_BODY.width}
            height={PATCH_STRIPE.height}
            fill={color}
          />
          {/* Der Schimmer wandert mit dem Licht und ist deshalb beschnitten. */}
          <rect
            ref={sheenRef}
            data-patch-detail="sheen"
            x={PATCH_BODY.x + 30}
            y={PATCH_BODY.y}
            width="46"
            height={PATCH_BODY.height}
            fill={`url(#${uid}-sheen)`}
            opacity={0.06 + visualFocus * 0.2}
            transform={`translate(${(visualLightOffset * PATCH_SHEEN_SHIFT).toFixed(2)} 0)`}
          />
          {/* Der Schatten, den die abgehobene Ecke auf das Pflaster wirft. */}
          <path
            ref={flapShadowRef}
            data-patch-detail="flap-shadow"
            d={PATCH_FLAP_PATH}
            fill="rgba(0,0,0,0.42)"
            filter={`url(#${uid}-soft)`}
            transform={`translate(${(-visualLightOffset * PATCH_FLAP_SHADOW_SHIFT).toFixed(2)} 2)`}
          />
        </g>

        <path data-patch-detail="flap" d={PATCH_FLAP_PATH} fill={`url(#${uid}-liner)`} />
        <path
          data-patch-detail="fold"
          d={PATCH_FLAP_PATH}
          fill="none"
          stroke="rgba(0,0,0,0.28)"
          strokeWidth="0.8"
        />
      </svg>

      {/* Der Name steht waagerecht: das Querformat gibt ihm die Breite, und
          ungedrehter Text bekommt vom Browser die schaerfere
          Subpixel-Glaettung. */}
      <div
        data-patch-detail="name"
        className="pointer-events-none absolute flex items-center justify-center overflow-hidden text-center"
        style={{
          left: `${(PATCH_NAME_PCT.left * 100).toFixed(2)}%`,
          top: `${(PATCH_NAME_PCT.top * 100).toFixed(2)}%`,
          width: `${(PATCH_NAME_PCT.width * 100).toFixed(2)}%`,
          height: `${(PATCH_NAME_PCT.height * 100).toFixed(2)}%`,
        }}
      >
        <StageMarquee className={`w-full ${NAME_CLASS[size]} font-bold text-[#2c313a] tracking-normal`}>
          {patchName}
        </StageMarquee>
      </div>
    </div>
  )
}
