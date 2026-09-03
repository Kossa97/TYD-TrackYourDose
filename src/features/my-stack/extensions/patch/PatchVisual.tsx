import { useCallback, useEffect, useId, useRef } from 'react'
import type { Ref } from 'react'
import { useSloshSubscribe } from '../../../../components/SloshContext'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  PATCH_BODY,
  PATCH_DOTS_LEFT,
  PATCH_DOTS_RIGHT,
  PATCH_DOT_R,
  PATCH_FLEX_CLIPS,
  PATCH_FLEX_CUT,
  PATCH_FLEX_MAX_DEG,
  PATCH_PIVOT_Y,
  PATCH_NAME_PCT,
  PATCH_PAD,
  PATCH_SHEEN_SHIFT,
} from './patchShape'

export interface PatchVisualProps {
  name?: string | null
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0)
const clampOffset = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0)

// Der Streifen liegt quer und bekommt eine eigene Sprosse: die Hoehe ist
// klein, die Breite folgt dem Verhaeltnis 300/88 = 3,41. Die Abstaende
// zwischen den Groessen sind dieselben wie bei den stehenden Formen.
const SIZE_CLASS: Record<NonNullable<PatchVisualProps['size']>, string> = {
  large: 'h-[109.5px] w-[373.3px]',
  carousel: 'h-[44px] w-[150px] sm:h-[55.9px] sm:w-[190.6px]',
  compact: 'h-[33px] w-[112.5px]',
  mini: 'h-[18px] w-[61.3px]',
}

const NAME_CLASS: Record<NonNullable<PatchVisualProps['size']>, string> = {
  large: 'text-base leading-tight',
  carousel: 'text-[6.5px] sm:text-[8px] leading-tight',
  compact: 'text-[5px] leading-tight',
  mini: 'text-[3px] leading-tight',
}

export function PatchVisual({
  name,
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
  const bodyRef = useRef<SVGRectElement | null>(null)
  const leftRef = useRef<SVGGElement | null>(null)
  const rightRef = useRef<SVGGElement | null>(null)

  // Dieselbe Quelle, aus der die Tablette ihr Rollen bezieht.
  const subscribe = useSloshSubscribe()
  useEffect(() => {
    if (!subscribe) return
    return subscribe(({ tilt }: { tilt: number }) => {
      const grad = tilt * PATCH_FLEX_MAX_DEG
      leftRef.current?.setAttribute(
        'transform',
        `rotate(${(-grad).toFixed(3)} ${PATCH_FLEX_CUT.left} ${PATCH_PIVOT_Y})`,
      )
      rightRef.current?.setAttribute(
        'transform',
        `rotate(${grad.toFixed(3)} ${PATCH_FLEX_CUT.right} ${PATCH_PIVOT_Y})`,
      )
    })
  }, [subscribe])

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-patch-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-patch-light-offset', o.toFixed(2))
    sheenRef.current?.setAttribute('transform', `translate(${(o * PATCH_SHEEN_SHIFT).toFixed(2)} 0)`)
    sheenRef.current?.setAttribute('opacity', (0.05 + f * 0.16).toFixed(3))
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
        viewBox="0 0 300 88"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`${uid}-bodyClip`}>
            <rect
              x={PATCH_BODY.x}
              y={PATCH_BODY.y}
              width={PATCH_BODY.width}
              height={PATCH_BODY.height}
              rx={PATCH_BODY.rx}
            />
          </clipPath>
          <clipPath id={`${uid}-leftClip`}>
            <rect x={PATCH_FLEX_CLIPS.left.x} y="-30" width={PATCH_FLEX_CLIPS.left.width} height="148" />
          </clipPath>
          <clipPath id={`${uid}-rightClip`}>
            <rect x={PATCH_FLEX_CLIPS.right.x} y="-30" width={PATCH_FLEX_CLIPS.right.width} height="148" />
          </clipPath>
          <clipPath id={`${uid}-midClip`}>
            <rect x={PATCH_FLEX_CLIPS.middle.x} y="-30" width={PATCH_FLEX_CLIPS.middle.width} height="148" />
          </clipPath>
          {/* Hautfarbenes Gewebe, matt: ein weicher Verlauf statt Glanz. */}
          <linearGradient id={`${uid}-fabric`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2c9a3" />
            <stop offset="46%" stopColor="#e5b48a" />
            <stop offset="100%" stopColor="#c9955f" />
          </linearGradient>
          {/* Das Wundkissen ist heller und leicht kuehler als das Gewebe. */}
          <linearGradient id={`${uid}-pad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbfaf6" />
            <stop offset="100%" stopColor="#e6e3da" />
          </linearGradient>
          <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Die beiden Enden biegen sich, das Mittelstueck deckt zuletzt
            die Schnittkanten ab. */}
        <g ref={leftRef} clipPath={`url(#${uid}-leftClip)`}>
          <rect
            ref={bodyRef}
            data-patch-detail="body"
            x={PATCH_BODY.x}
            y={PATCH_BODY.y}
            width={PATCH_BODY.width}
            height={PATCH_BODY.height}
            rx={PATCH_BODY.rx}
            fill={`url(#${uid}-fabric)`}
            opacity={0.74 + visualFocus * 0.26}
          />
          <g data-patch-detail="dots" fill="rgba(255,255,255,0.82)">
            {PATCH_DOTS_LEFT.map(punkt => (
              <circle key={`${punkt.x}-${punkt.y}`} cx={punkt.x} cy={punkt.y} r={PATCH_DOT_R} />
            ))}
          </g>
        </g>

        <g ref={rightRef} clipPath={`url(#${uid}-rightClip)`}>
          <rect
            x={PATCH_BODY.x}
            y={PATCH_BODY.y}
            width={PATCH_BODY.width}
            height={PATCH_BODY.height}
            rx={PATCH_BODY.rx}
            fill={`url(#${uid}-fabric)`}
            opacity={0.74 + visualFocus * 0.26}
          />
          <g fill="rgba(255,255,255,0.82)">
            {PATCH_DOTS_RIGHT.map(punkt => (
              <circle key={`${punkt.x}-${punkt.y}`} cx={punkt.x} cy={punkt.y} r={PATCH_DOT_R} />
            ))}
          </g>
        </g>

        <g clipPath={`url(#${uid}-midClip)`}>
          <rect
            x={PATCH_BODY.x}
            y={PATCH_BODY.y}
            width={PATCH_BODY.width}
            height={PATCH_BODY.height}
            rx={PATCH_BODY.rx}
            fill={`url(#${uid}-fabric)`}
            opacity={0.74 + visualFocus * 0.26}
          />
        </g>

        <g clipPath={`url(#${uid}-bodyClip)`}>
          {/* Der Schimmer wandert mit dem Licht und ist deshalb beschnitten. */}
          <rect
            ref={sheenRef}
            data-patch-detail="sheen"
            x={PATCH_BODY.x + 40}
            y={PATCH_BODY.y}
            width="54"
            height={PATCH_BODY.height}
            fill={`url(#${uid}-sheen)`}
            opacity={0.05 + visualFocus * 0.16}
            transform={`translate(${(visualLightOffset * PATCH_SHEEN_SHIFT).toFixed(2)} 0)`}
          />
        </g>

        {/* Schatten unter dem Kissen, damit es aufliegt statt aufgemalt zu sein. */}
        <rect
          x={PATCH_PAD.x}
          y={PATCH_PAD.y + 1.5}
          width={PATCH_PAD.width}
          height={PATCH_PAD.height}
          rx={PATCH_PAD.rx}
          fill="rgba(120,80,40,0.35)"
        />
        <rect
          data-patch-detail="pad"
          x={PATCH_PAD.x}
          y={PATCH_PAD.y}
          width={PATCH_PAD.width}
          height={PATCH_PAD.height}
          rx={PATCH_PAD.rx}
          fill={`url(#${uid}-pad)`}
        />

      </svg>

      {/* Der Name steht waagerecht auf dem Kissen: die Streifenform gibt ihm
          die Breite, und ungedrehter Text bekommt vom Browser die schaerfere
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
        <StageMarquee className={`w-full ${NAME_CLASS[size]} font-bold text-[#3a3a34] tracking-normal`}>
          {patchName}
        </StageMarquee>
      </div>
    </div>
  )
}
