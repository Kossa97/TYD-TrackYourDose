import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  CAPSULE_CAP_INNER_PATH, CAPSULE_CAP_PATH,
  CAPSULE_SHELL_INNER_PATH, CAPSULE_SHELL_PATH,
} from './capsuleShape'
import { StageMarquee } from '../../stage/StageLabel'

export interface CapsuleVisualProps {
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

// Liegend begrenzt die Slot-Breite, nicht die Höhe. Die Kapsel wächst am
// sm-Breakpoint deshalb nicht mit — sie füllt den Slot bereits. Die Höhe folgt
// immer dem Seitenverhältnis, nie einer festen Zahl.
const SIZE_CLASS: Record<NonNullable<CapsuleVisualProps['size']>, string> = {
  large: 'w-[240px] aspect-[240/84]',
  // Feste Breite, aber nie breiter als der Slot: w-full allein waere in
  // einem inhaltsbestimmten Flex-Container null Pixel breit.
  carousel: 'w-[92px] max-w-full aspect-[240/84]',
  compact: 'w-[140px] aspect-[240/84]',
  mini: 'w-[60px] aspect-[240/84]',
}

// Eine Stufe kleiner als beim Vial, weil die Kapsel flach liegt.
const NAME_CLASS: Record<NonNullable<CapsuleVisualProps['size']>, string> = {
  large: 'text-lg leading-tight',
  carousel: 'text-[9px] leading-tight',
  compact: 'text-[11px] leading-tight',
  mini: 'text-[6px] leading-tight',
}

export function CapsuleVisual({
  name,
  color,
  size = 'large',
  className = '',
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: CapsuleVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const engravedName = name?.trim() || 'Kapsel'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const glossRef = useRef<SVGPathElement | null>(null)
  const shellRef = useRef<SVGUseElement | null>(null)
  const nameSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-capsule-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-capsule-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (120 - o * 10).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.28 + f * 0.3).toFixed(3))
    sweepRef.current?.setAttribute('transform', `translate(${(o * 46).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.12 + f * 0.32).toFixed(3))
    glossRef.current?.setAttribute('stroke-opacity', (0.3 + f * 0.3).toFixed(3))
    shellRef.current?.setAttribute('stroke-opacity', (0.3 + f * 0.26).toFixed(3))

    if (nameSheenRef.current) {
      nameSheenRef.current.style.transform = `translateX(${(o * 10).toFixed(2)}%)`
      nameSheenRef.current.style.opacity = (0.62 + f * 0.2).toFixed(3)
    }
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)



  return (
    <div
      ref={rootRef}
      data-capsule-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-capsule-focus={Number(visualFocus.toFixed(2))}
      data-capsule-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={engravedName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 240 84"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <path id={`${uid}-shell`} d={CAPSULE_SHELL_PATH} />
          <path id={`${uid}-cap`} d={CAPSULE_CAP_PATH} />
          <clipPath id={`${uid}-shellClip`}>
            <use href={`#${uid}-shell`} />
          </clipPath>
          {/* Kappe und Körper sind unterschiedlich hoch. Ein objektbezogener
              Verlauf würde dieselben Stopps auf verschiedene absolute Höhen
              legen und an der Naht sichtbar springen. */}
          <linearGradient id={`${uid}-tint`} gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="80">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="45%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id={`${uid}-depth`} gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="80">
            <stop offset="0%" stopColor="rgba(2,6,23,0.5)" />
            <stop offset="14%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="82%" stopColor="rgba(15,23,42,0.2)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.62)" />
          </linearGradient>
          <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id={`${uid}-shadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-30%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        <ellipse
          ref={shadowRef}
          data-capsule-detail="shadow"
          cx={120 - visualLightOffset * 10}
          cy="82"
          rx="96"
          ry="5"
          fill={`url(#${uid}-shadow)`}
          opacity={0.28 + visualFocus * 0.3}
        />

        <use href={`#${uid}-shell`} fill={`url(#${uid}-tint)`} />
        <use
          ref={shellRef}
          data-capsule-detail="shell"
          href={`#${uid}-shell`}
          fill={`url(#${uid}-depth)`}
          stroke="rgba(203,213,225,0.5)"
          strokeOpacity={0.3 + visualFocus * 0.26}
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />

        <use href={`#${uid}-cap`} fill={`url(#${uid}-tint)`} opacity="0.55" />
        <use
          data-capsule-detail="cap"
          href={`#${uid}-cap`}
          fill={`url(#${uid}-depth)`}
          stroke="rgba(203,213,225,0.5)"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />

        <g clipPath={`url(#${uid}-shellClip)`}>
          <rect
            ref={sweepRef}
            data-capsule-detail="sweep"
            x="90"
            y="0"
            width="60"
            height="84"
            fill={`url(#${uid}-sweep)`}
            opacity={0.12 + visualFocus * 0.32}
            transform={`translate(${visualLightOffset * 46} 0)`}
          />
        </g>

        <path
          data-capsule-detail="shell-inner"
          d={CAPSULE_SHELL_INNER_PATH}
          fill="none"
          stroke="rgba(226,232,240,0.26)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />
        <path
          data-capsule-detail="cap-inner"
          d={CAPSULE_CAP_INNER_PATH}
          fill="none"
          stroke="rgba(226,232,240,0.28)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />

        <path
          ref={glossRef}
          data-capsule-detail="gloss"
          d="M30 22 C 80 14, 170 14, 220 23"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeOpacity={0.3 + visualFocus * 0.3}
          strokeWidth="5"
          strokeLinecap="round"
          filter={`url(#${uid}-soft)`}
        />
        <path
          d="M42 67 C 92 73, 158 73, 212 65"
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="3"
          strokeLinecap="round"
          filter={`url(#${uid}-soft)`}
        />

        {/* Konturgravur: nur die beiden Rillenkanten, kein Füllton. Das
            Buchstabeninnere zeigt die Hülle selbst. Das Sichtfenster begrenzt
            den Schriftzug; alles darüber läuft durch. */}
      </svg>

      {/* Beschriftet wie Vial und Ampulle: HTML statt SVG-Text, damit Hinting
          und Subpixel-Glättung greifen, dieselben Klassen, derselbe Durchlauf.
          Nur das Band fehlt — eine Kapsel ist kein Behälter. */}
      <div
        data-capsule-detail="name"
        className="pointer-events-none absolute inset-x-[6%] top-1/2 -translate-y-1/2 overflow-hidden text-center"
      >
        <StageMarquee className={`${NAME_CLASS[size]} font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]`}>
          {engravedName}
        </StageMarquee>
        <div
          ref={nameSheenRef}
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-white/10 to-black/10"
          style={{ transform: `translateX(${visualLightOffset * 10}%)`, opacity: 0.62 + visualFocus * 0.2 }}
        />
      </div>
    </div>
  )
}
