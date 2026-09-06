import { useCallback, useEffect, useId, useRef } from 'react'
import type { Ref } from 'react'
import { useSloshSubscribe } from '../../../../components/SloshContext'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  PATCH_BEND_MAX,
  PATCH_BODY,
  PATCH_DOTS_BEND,
  PATCH_DOT_R,
  PATCH_FLUTTER,
  PATCH_FLUTTER_RUHE,
  PATCH_GROUND,
  PATCH_GROUND_SHIFT,
  PATCH_HOLE_OFFSET,
  PATCH_NAME_PCT,
  PATCH_OUTLINE,
  PATCH_OUTLINE_INNER,
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

// Setzt den Umriss aus seinen Punkten zusammen und verschiebt jeden davon
// senkrecht um seinen Anteil an der Biegung. Weil ALLE Teile — Flaeche,
// Koernung, beide Konturen, Beschnitt — denselben Pfad benutzen, kann darin
// keine Naht entstehen.
type Punkt = { x: number; y: number; gL: number; gR: number }
const zeichne = (punkte: readonly Punkt[], aL: number, aR: number) => {
  let d = ''
  for (let i = 0; i < punkte.length; i += 1) {
    const p = punkte[i]
    const y = p.y + p.gL * aL + p.gR * aR
    d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${y.toFixed(2)}`
  }
  return `${d}Z`
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
  const bodyRef = useRef<SVGUseElement | null>(null)
  const groundRef = useRef<SVGEllipseElement | null>(null)
  const outlineRef = useRef<SVGPathElement | null>(null)
  const innerRef = useRef<SVGPathElement | null>(null)
  const dotsRef = useRef<SVGGElement | null>(null)

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
      { vorzeichen: -1, feder: PATCH_FLUTTER.left, weg: 0, tempo: 0 },
      { vorzeichen: 1, feder: PATCH_FLUTTER.right, weg: 0, tempo: 0 },
    ]

    let raf = 0
    let zuletzt = 0

    const ruht = () =>
      Math.abs(tiltRef.current) < 0.001 &&
      enden.every(
        e =>
          Math.abs(e.weg) < PATCH_FLUTTER_RUHE.winkel &&
          Math.abs(e.tempo) < PATCH_FLUTTER_RUHE.tempo,
      )

    const schritt = (jetzt: number) => {
      // Grosse Spruenge (Tab im Hintergrund) wuerden die Feder sprengen.
      const dt = Math.min((jetzt - zuletzt) / 1000, 1 / 30)
      zuletzt = jetzt

      for (const e of enden) {
        const ziel = e.vorzeichen * tiltRef.current * PATCH_BEND_MAX
        e.tempo += ((ziel - e.weg) * e.feder.steifigkeit - e.tempo * e.feder.daempfung) * dt
        e.weg += e.tempo * dt
      }
      const links = enden[0].weg
      const rechts = enden[1].weg

      outlineRef.current?.setAttribute('d', zeichne(PATCH_OUTLINE, links, rechts))
      innerRef.current?.setAttribute('d', zeichne(PATCH_OUTLINE_INNER, links, rechts))

      // Die Loecher wandern mit der Stelle, an der sie sitzen. Blieben sie
      // liegen, waere die Biegung sofort als Trick zu erkennen.
      const loecher = dotsRef.current?.children
      if (loecher) {
        for (let i = 0; i < loecher.length; i += 1) {
          const g = PATCH_DOTS_BEND[i]
          const dy = g.gL * links + g.gR * rechts
          loecher[i].setAttribute('transform', `translate(0 ${dy.toFixed(2)})`)
        }
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

  const ruheAussen = zeichne(PATCH_OUTLINE, 0, 0)
  const ruheInnen = zeichne(PATCH_OUTLINE_INNER, 0, 0)

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
          {/* Der eine Umriss. Flaeche, Koernung, Kontur und Beschnitt greifen
              alle darauf zu — deshalb bewegt sich beim Biegen zwangslaeufig
              alles gemeinsam, und es kann keine Naht geben. */}
          <path id={`${uid}-outline`} ref={outlineRef} d={ruheAussen} />
          <path id={`${uid}-outlineInner`} ref={innerRef} d={ruheInnen} />
          <clipPath id={`${uid}-bodyClip`}>
            <use href={`#${uid}-outline`} />
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

        <use
          ref={bodyRef}
          data-patch-detail="body"
          href={`#${uid}-outline`}
          fill={`url(#${uid}-fabric)`}
          opacity={0.74 + visualFocus * 0.26}
        />
        <use href={`#${uid}-outline`} fill={`url(#${uid}-grain)`} />

        {/* Echte Loecher: unter jedem hellen Kreis liegt ein dunkler, nach
            unten rechts versetzt — der Schatten in der Lochwand. */}
        <g data-patch-detail="dots" ref={dotsRef}>
          {PATCH_DOTS_BEND.map(punkt => (
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

        <g clipPath={`url(#${uid}-bodyClip)`}>
          {/* Der Schimmer wandert mit dem Licht und ist deshalb beschnitten. */}
          <rect
            ref={sheenRef}
            data-patch-detail="sheen"
            x={PATCH_BODY.x + 40}
            y={PATCH_BODY.y - 20}
            width="54"
            height={PATCH_BODY.height + 40}
            fill={`url(#${uid}-sheen)`}
            opacity={0.05 + visualFocus * 0.16}
            transform={`translate(${(visualLightOffset * PATCH_SHEEN_SHIFT).toFixed(2)} 0)`}
          />
        </g>

        {/* Die doppelte Kontur, die auch Ampulle und Nasenspray tragen. */}
        <use
          data-patch-detail="contour"
          href={`#${uid}-outline`}
          fill="none"
          stroke="rgba(92,56,24,0.5)"
          strokeWidth="1.4"
        />
        <use
          href={`#${uid}-outlineInner`}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.9"
        />

        {/* Das Kissen sitzt im Gewebe: erst sein Schlagschatten, dann die
            Flaeche, darauf die Webstruktur, zuletzt eine helle Oberkante und
            eine dunkle Unterkante als Fase. Es bleibt ungebogen — ein Kissen
            ist steif, und in der Mitte ist die Biegung ohnehin null. */}
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
