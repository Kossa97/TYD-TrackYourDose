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
  PATCH_FLUTTER,
  PATCH_FLUTTER_RUHE,
  PATCH_GROUND,
  PATCH_GROUND_SHIFT,
  PATCH_HOLE_OFFSET,
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

// Ein Abschnitt des Streifens: Gewebe, Koernung und die doppelte Kontur, die
// auch Ampulle und Nasenspray tragen — aussen dunkel, innen hell.
function Gewebe({
  uid,
  focus,
  bodyRef,
  marker,
}: {
  uid: string
  focus: number
  bodyRef?: Ref<SVGRectElement>
  marker?: string
}) {
  const masse = {
    x: PATCH_BODY.x,
    y: PATCH_BODY.y,
    width: PATCH_BODY.width,
    height: PATCH_BODY.height,
    rx: PATCH_BODY.rx,
  }
  return (
    <>
      <rect
        ref={bodyRef}
        data-patch-detail={marker}
        {...masse}
        fill={`url(#${uid}-fabric)`}
        opacity={0.74 + focus * 0.26}
      />
      <rect {...masse} fill={`url(#${uid}-grain)`} />
      <rect {...masse} fill="none" stroke="rgba(92,56,24,0.5)" strokeWidth="1.4" />
      <rect
        x={masse.x + 1.2}
        y={masse.y + 1.2}
        width={masse.width - 2.4}
        height={masse.height - 2.4}
        rx={masse.rx - 1.2}
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.9"
      />
    </>
  )
}

// Echte Loecher statt weisser Punkte: unter jedem hellen Kreis liegt ein
// dunkler, nach unten rechts versetzt — der Schatten in der Lochwand.
function Lochung({
  punkte,
  marker,
}: {
  punkte: readonly { x: number; y: number }[]
  marker?: string
}) {
  return (
    <g data-patch-detail={marker}>
      {punkte.map(punkt => (
        <g key={`${punkt.x}-${punkt.y}`}>
          <circle
            cx={punkt.x + PATCH_HOLE_OFFSET.x}
            cy={punkt.y + PATCH_HOLE_OFFSET.y}
            r={PATCH_DOT_R}
            fill="rgba(112,68,28,0.5)"
          />
          <circle cx={punkt.x} cy={punkt.y} r={PATCH_DOT_R} fill="rgba(255,255,255,0.9)" />
        </g>
      ))}
    </g>
  )
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
  const groundRef = useRef<SVGEllipseElement | null>(null)

  // Dieselbe Quelle, aus der die Tablette ihr Rollen bezieht. Der Kippwinkel
  // ist hier aber nur das Ziel, nicht die Stellung: jedes Ende haengt an einer
  // eigenen Feder und schwingt nach. Deshalb laeuft eine eigene Schleife —
  // die Slosh-Quelle meldet sich nicht mehr, sobald sie zur Ruhe kommt, die
  // Enden zappeln aber noch.
  const subscribe = useSloshSubscribe()
  const tiltRef = useRef(0)
  useEffect(() => {
    if (!subscribe) return undefined
    if (typeof window === 'undefined') return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined

    const enden = [
      { ref: leftRef, pivot: PATCH_FLEX_CUT.left, vorzeichen: -1, feder: PATCH_FLUTTER.left, winkel: 0, tempo: 0 },
      { ref: rightRef, pivot: PATCH_FLEX_CUT.right, vorzeichen: 1, feder: PATCH_FLUTTER.right, winkel: 0, tempo: 0 },
    ]

    let raf = 0
    let zuletzt = 0

    const ruht = () =>
      Math.abs(tiltRef.current) < 0.001 &&
      enden.every(
        e =>
          Math.abs(e.winkel) < PATCH_FLUTTER_RUHE.winkel &&
          Math.abs(e.tempo) < PATCH_FLUTTER_RUHE.tempo,
      )

    const schritt = (jetzt: number) => {
      // Grosse Spruenge (Tab im Hintergrund) wuerden die Feder sprengen.
      const dt = Math.min((jetzt - zuletzt) / 1000, 1 / 30)
      zuletzt = jetzt

      for (const e of enden) {
        const ziel = e.vorzeichen * tiltRef.current * PATCH_FLEX_MAX_DEG
        e.tempo += ((ziel - e.winkel) * e.feder.steifigkeit - e.tempo * e.feder.daempfung) * dt
        e.winkel += e.tempo * dt
        e.ref.current?.setAttribute(
          'transform',
          `rotate(${e.winkel.toFixed(3)} ${e.pivot} ${PATCH_PIVOT_Y})`,
        )
      }

      if (ruht() || document.hidden) {
        raf = 0
        return
      }
      raf = requestAnimationFrame(schritt)
    }

    const anstossen = () => {
      if (raf || document.hidden) return
      zuletzt = performance.now()
      raf = requestAnimationFrame(schritt)
    }

    const abmelden = subscribe(({ tilt }: { tilt: number }) => {
      tiltRef.current = tilt
      anstossen()
    })

    // Im verborgenen Tab liefert der Browser keine Bilder, die Schleife haelt
    // an — und nur die Slosh-Quelle wuerde sie wieder anstossen. Kommt die
    // nicht mehr, blieben die Enden ausgelenkt stehen. Deshalb hier selbst
    // wieder aufnehmen, sobald der Tab zurueck ist.
    const beiSichtbarkeit = () => {
      if (!document.hidden) anstossen()
    }
    document.addEventListener('visibilitychange', beiSichtbarkeit)

    return () => {
      abmelden?.()
      document.removeEventListener('visibilitychange', beiSichtbarkeit)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [subscribe])

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-patch-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-patch-light-offset', o.toFixed(2))
    sheenRef.current?.setAttribute('transform', `translate(${(o * PATCH_SHEEN_SHIFT).toFixed(2)} 0)`)
    sheenRef.current?.setAttribute('opacity', (0.05 + f * 0.16).toFixed(3))
    bodyRef.current?.setAttribute('opacity', (0.74 + f * 0.26).toFixed(3))
    groundRef.current?.setAttribute('cx', (PATCH_GROUND.cx - o * PATCH_GROUND_SHIFT).toFixed(2))
    groundRef.current?.setAttribute('opacity', (0.2 + f * 0.32).toFixed(3))
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
          {/* Gewebekoernung: feine Faeden statt einer glatten Flaeche. */}
          <pattern
            id={`${uid}-grain`}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <line x1="2" y1="0" x2="2" y2="4" stroke="rgba(92,56,24,0.08)" strokeWidth="1" />
          </pattern>
          {/* Das Kissen ist gewebt, nicht glatt — im Foto deutlich zu sehen. */}
          <pattern
            id={`${uid}-weave`}
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="3" stroke="rgba(120,112,96,0.18)" strokeWidth="0.7" />
            <line x1="0" y1="0" x2="3" y2="0" stroke="rgba(120,112,96,0.11)" strokeWidth="0.7" />
          </pattern>
          <radialGradient id={`${uid}-ground`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="64%" stopColor="rgba(0,0,0,0.28)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Der Streifen liegt auf der Buehne statt zu schweben. */}
        <ellipse
          ref={groundRef}
          data-patch-detail="ground-shadow"
          cx={PATCH_GROUND.cx - visualLightOffset * PATCH_GROUND_SHIFT}
          cy={PATCH_GROUND.cy}
          rx={PATCH_GROUND.rx}
          ry={PATCH_GROUND.ry}
          fill={`url(#${uid}-ground)`}
          opacity={0.2 + visualFocus * 0.32}
        />

        {/* Die beiden Enden biegen sich, das Mittelstueck deckt zuletzt
            die Schnittkanten ab. Jeder Abschnitt traegt sein eigenes Gewebe
            samt Koernung, Kontur und Lochung — sonst bliebe beim Flattern
            eines davon stehen. */}
        <g ref={leftRef} clipPath={`url(#${uid}-leftClip)`}>
          <Gewebe uid={uid} focus={visualFocus} bodyRef={bodyRef} marker="body" />
          <Lochung punkte={PATCH_DOTS_LEFT} marker="dots" />
        </g>

        <g ref={rightRef} clipPath={`url(#${uid}-rightClip)`}>
          <Gewebe uid={uid} focus={visualFocus} />
          <Lochung punkte={PATCH_DOTS_RIGHT} />
        </g>

        <g clipPath={`url(#${uid}-midClip)`}>
          <Gewebe uid={uid} focus={visualFocus} />
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

        {/* Das Kissen sitzt im Gewebe: erst sein Schlagschatten, dann die
            Flaeche, darauf die Webstruktur, zuletzt eine helle Oberkante und
            eine dunkle Unterkante als Fase. */}
        <rect
          x={PATCH_PAD.x - 0.6}
          y={PATCH_PAD.y + 1.6}
          width={PATCH_PAD.width + 1.2}
          height={PATCH_PAD.height}
          rx={PATCH_PAD.rx + 1}
          fill="rgba(96,58,26,0.42)"
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
        <rect
          x={PATCH_PAD.x}
          y={PATCH_PAD.y}
          width={PATCH_PAD.width}
          height={PATCH_PAD.height}
          rx={PATCH_PAD.rx}
          fill={`url(#${uid}-weave)`}
        />
        <rect
          data-patch-detail="pad-bevel"
          x={PATCH_PAD.x + 0.5}
          y={PATCH_PAD.y + 0.5}
          width={PATCH_PAD.width - 1}
          height={PATCH_PAD.height - 1}
          rx={PATCH_PAD.rx - 0.5}
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="0.9"
        />
        <path
          d={`M${PATCH_PAD.x + PATCH_PAD.rx} ${PATCH_PAD.y + PATCH_PAD.height - 0.5} L${PATCH_PAD.x + PATCH_PAD.width - PATCH_PAD.rx} ${PATCH_PAD.y + PATCH_PAD.height - 0.5}`}
          stroke="rgba(120,96,64,0.45)"
          strokeWidth="0.9"
          fill="none"
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
