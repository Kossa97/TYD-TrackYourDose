import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  TABLET_BODY, TABLET_BODY_NORMALIZED, TABLET_NAME_INSET_PCT, TABLET_NAME_TOP_PCT,
  TABLET_SCORE,
} from './tabletShape'

export interface TabletVisualProps {
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

// Rund bei jeder Stufe. Bewusst groesser als massstaeblich richtig — eine echte
// Tablette waere rund 40 px, aber dann bliebe fuer den Namen nichts uebrig.
const SIZE_CLASS: Record<NonNullable<TabletVisualProps['size']>, string> = {
  large: 'w-[160px] max-w-full aspect-square',
  carousel: 'w-[62px] max-w-full aspect-square',
  compact: 'w-[96px] max-w-full aspect-square',
  mini: 'w-[40px] max-w-full aspect-square',
}

const NAME_CLASS: Record<NonNullable<TabletVisualProps['size']>, string> = {
  large: 'text-base leading-tight',
  carousel: 'text-[7px] leading-tight',
  compact: 'text-[10px] leading-tight',
  mini: 'text-[5px] leading-tight',
}

export function TabletVisual({
  name,
  color,
  size = 'large',
  className = '',
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: TabletVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const tabletName = name?.trim() || 'Tablette'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const glintRef = useRef<SVGEllipseElement | null>(null)
  const nameSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-tablet-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-tablet-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (50 - o * 5).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.28 + f * 0.3).toFixed(3))
    // Der Lichtfleck wandert ueber die gewoelbte Oberflaeche, statt dass ein
    // Sweep durch den Koerper zieht — undurchsichtiges Material laesst nichts
    // hindurch.
    glintRef.current?.setAttribute('cx', (34 + o * 22).toFixed(2))
    glintRef.current?.setAttribute('opacity', (0.16 + f * 0.24).toFixed(3))

    if (nameSheenRef.current) {
      nameSheenRef.current.style.transform = `translateX(${(o * 10).toFixed(2)}%)`
      nameSheenRef.current.style.opacity = (0.62 + f * 0.2).toFixed(3)
    }
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-tablet-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-tablet-focus={Number(visualFocus.toFixed(2))}
      data-tablet-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={tabletName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          {/* Gepresstes Pulver: Lichtquelle oben links, zur lichtabgewandten
              Seite hin dunkler. Der Verlauf moduliert nur die Helligkeit —
              die Farbe ist das Material selbst. */}
          <radialGradient id={`${uid}-press`} cx="36%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="52%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
          </radialGradient>
          <radialGradient id={`${uid}-shadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          {/* Der Kreis in objektbezogenen Einheiten beschneidet die
              HTML-Beschriftung, damit sie an der Rundung endet. */}
          <clipPath id={`${uid}-nameClip`} clipPathUnits="objectBoundingBox">
            <circle
              cx={TABLET_BODY_NORMALIZED.cx}
              cy={TABLET_BODY_NORMALIZED.cy}
              r={TABLET_BODY_NORMALIZED.r}
            />
          </clipPath>
        </defs>

        <ellipse
          ref={shadowRef}
          data-tablet-detail="shadow"
          cx={50 - visualLightOffset * 5}
          cy="102"
          rx="40"
          ry="5"
          fill={`url(#${uid}-shadow)`}
          opacity={0.28 + visualFocus * 0.3}
        />

        <circle
          data-tablet-detail="body"
          cx={TABLET_BODY.cx}
          cy={TABLET_BODY.cy}
          r={TABLET_BODY.r}
          fill={color}
        />
        <circle
          cx={TABLET_BODY.cx}
          cy={TABLET_BODY.cy}
          r={TABLET_BODY.r}
          fill={`url(#${uid}-press)`}
        />
        <circle
          cx={TABLET_BODY.cx}
          cy={TABLET_BODY.cy}
          r={TABLET_BODY.r}
          fill="none"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {/* Bruchrille als Vertiefung: dunkle Linie mit heller Oberkante. */}
        <line
          data-tablet-detail="score"
          x1={TABLET_SCORE.x1}
          y1={TABLET_SCORE.y}
          x2={TABLET_SCORE.x2}
          y2={TABLET_SCORE.y}
          stroke="rgba(0,0,0,0.42)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <line
          x1={TABLET_SCORE.x1}
          y1={TABLET_SCORE.y - 1.4}
          x2={TABLET_SCORE.x2}
          y2={TABLET_SCORE.y - 1.4}
          stroke="rgba(255,255,255,0.36)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />

        <ellipse
          ref={glintRef}
          data-tablet-detail="glint"
          cx={34 + visualLightOffset * 22}
          cy="30"
          rx="20"
          ry="12"
          fill="rgba(255,255,255,0.9)"
          opacity={0.16 + visualFocus * 0.24}
          filter={`url(#${uid}-soft)`}
        />
      </svg>

      {/* Beschriftet wie alle anderen Formen: HTML, dieselben Klassen, derselbe
          Durchlauf. Kein Band — die Tablette ist kein Behälter. */}
      <div
        data-tablet-detail="name"
        className="pointer-events-none absolute inset-0"
        style={{ clipPath: `url(#${uid}-nameClip)` }}
      >
        <div
          className="absolute -translate-y-1/2 overflow-hidden text-center"
          style={{
            top: `${TABLET_NAME_TOP_PCT * 100}%`,
            left: `${(TABLET_NAME_INSET_PCT * 100).toFixed(2)}%`,
            right: `${(TABLET_NAME_INSET_PCT * 100).toFixed(2)}%`,
          }}
        >
          <StageMarquee className={`${NAME_CLASS[size]} font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]`}>
            {tabletName}
          </StageMarquee>
        </div>
        <div
          ref={nameSheenRef}
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-white/10 to-black/10"
          style={{ transform: `translateX(${visualLightOffset * 10}%)`, opacity: 0.62 + visualFocus * 0.2 }}
        />
      </div>
    </div>
  )
}
