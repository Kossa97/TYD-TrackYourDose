import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  TUBE_BODY_PATH,
  TUBE_CAP,
  TUBE_CAP_PATH,
  TUBE_CAP_RECESS,
  TUBE_CAP_SEAM_LIP_Y,
  TUBE_CAP_SEAM_Y,
  TUBE_CRIMP,
  TUBE_CRIMP_RIB_XS,
  TUBE_EDGE_LIGHT_PATH,
  TUBE_EDGE_SHADOW_PATH,
  TUBE_LIGHT_CORE_SHIFT,
  TUBE_LIGHT_MAX_DEG,
  TUBE_NAME_INSET_PCT,
  TUBE_NAME_TOP_PCT,
  TUBE_SEAM_LEFT_PATH,
  TUBE_SEAM_RIGHT_PATH,
} from './tubeShape'

export interface TubeVisualProps {
  name?: string | null
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  // Ohne Namen: die Auswahlkachel im Formular zeigt das nackte Objekt,
  // ihre eigene Beschriftung steht darunter.
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0)
const clampOffset = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0)

// Dieselbe Sprosse wie das Nasenspray. Die Breite folgt dem eigenen
// Verhaeltnis 78/279, damit die Form nie in einen fremden Kasten gequetscht
// wird. Als Klassen, weil ein Breakpoint nicht in einem Inline-Style lebt.
const SIZE_CLASS: Record<NonNullable<TubeVisualProps['size']>, string> = {
  large: 'h-[464px] w-[129.7px]',
  carousel: 'h-[186.4px] w-[52.1px] sm:h-[236.8px] sm:w-[66.2px]',
  compact: 'h-[140px] w-[39.1px]',
  mini: 'h-[76px] w-[21.2px]',
}

const NAME_CLASS: Record<NonNullable<TubeVisualProps['size']>, string> = {
  large: 'text-base leading-tight',
  carousel: 'text-[7.5px] sm:text-[9px] leading-tight',
  compact: 'text-[6px] leading-tight',
  mini: 'text-[4px] leading-tight',
}

// Positiver Versatz heisst: die Lampe steht rechts von der Form. Der
// Glanzkern laeuft also nach rechts, der Bodenschatten nach links — und die
// Drehung des Oberlichts kippt die helle Seite mit ihm.
const lightAngle = (o: number) => o * TUBE_LIGHT_MAX_DEG
const coreX = (o: number) => 60 + o * TUBE_LIGHT_CORE_SHIFT

export function TubeVisual({
  name,
  size = 'large',
  className = '',
  showLabel = true,
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: TubeVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const tubeName = name?.trim() || 'Tube'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const lightRef = useRef<SVGLinearGradientElement | null>(null)
  const coreRef = useRef<SVGEllipseElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-tube-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-tube-light-offset', o.toFixed(2))
    // Die Lampe steht ueber der Buehne: steht die Tube links davon, faellt das
    // Licht von rechts oben ein, und umgekehrt.
    lightRef.current?.setAttribute('gradientTransform', `rotate(${lightAngle(o).toFixed(1)} 0.5 0.5)`)
    coreRef.current?.setAttribute('cx', coreX(o).toFixed(0))
    coreRef.current?.setAttribute('opacity', (0.18 + f * 0.5).toFixed(3))
    shadowRef.current?.setAttribute('cx', (60 - o * 5).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.3).toFixed(3))
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-tube-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-tube-focus={Number(visualFocus.toFixed(2))}
      data-tube-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={tubeName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="21 6 78 279"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`${uid}-bodyClip`}>
            <path d={TUBE_BODY_PATH} />
          </clipPath>
          {/* Grundton des Aluminiums, ohne Beleuchtung. */}
          <linearGradient id={`${uid}-alu`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b4149" />
            <stop offset="12%" stopColor="#7e858e" />
            <stop offset="50%" stopColor="#8f959e" />
            <stop offset="88%" stopColor="#7a818a" />
            <stop offset="100%" stopColor="#353b42" />
          </linearGradient>
          {/* Oberlicht: hell an der Schulter, Abfall zum Deckel. Der
              gradientTransform kippt die Richtung mit der Lage. */}
          <linearGradient
            ref={lightRef}
            id={`${uid}-light`}
            x1="0.5" y1="0" x2="0.5" y2="1"
            gradientTransform={`rotate(${lightAngle(visualLightOffset).toFixed(1)} 0.5 0.5)`}
          >
            <stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
            <stop offset="9%" stopColor="rgba(255,255,255,0.52)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="34%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="48%" stopColor="rgba(0,0,0,0.10)" />
            <stop offset="63%" stopColor="rgba(255,255,255,0.07)" />
            <stop offset="78%" stopColor="rgba(0,0,0,0.22)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.40)" />
          </linearGradient>
          <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id={`${uid}-seamL`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-seamR`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.44)" />
          </linearGradient>
          <linearGradient id={`${uid}-throat`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="52%" stopColor="rgba(0,0,0,0.18)" />
            <stop offset="86%" stopColor="rgba(0,0,0,0.40)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.54)" />
          </linearGradient>
          <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="62%" stopColor="rgba(255,255,255,0.60)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-capBody`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a0d12" />
            <stop offset="20%" stopColor="#333944" />
            <stop offset="46%" stopColor="#20252d" />
            <stop offset="72%" stopColor="#2c323b" />
            <stop offset="100%" stopColor="#080a0e" />
          </linearGradient>
          <linearGradient id={`${uid}-capTop`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-recess`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.72)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.34)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.16)" />
          </linearGradient>
          <radialGradient id={`${uid}-groundShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={`${uid}-soft`}><feGaussianBlur stdDeviation="0.55" /></filter>
          <filter id={`${uid}-seamSoft`}><feGaussianBlur stdDeviation="0.9" /></filter>
          <filter id={`${uid}-coreSoft`}><feGaussianBlur stdDeviation="3.4" /></filter>
        </defs>

        <ellipse
          ref={shadowRef}
          data-tube-detail="ground-shadow"
          cx={60 - visualLightOffset * 5}
          cy="288"
          rx="30"
          ry="4.5"
          fill={`url(#${uid}-groundShadow)`}
          opacity={0.2 + visualFocus * 0.3}
        />

        <path data-tube-detail="body" d={TUBE_BODY_PATH} fill={`url(#${uid}-alu)`} />
        <path data-tube-detail="light" d={TUBE_BODY_PATH} fill={`url(#${uid}-light)`} />

        <g clipPath={`url(#${uid}-bodyClip)`}>
          <ellipse
            ref={coreRef}
            data-tube-detail="core"
            cx={Number(coreX(visualLightOffset).toFixed(0))}
            cy="64"
            rx="21"
            ry="46"
            fill={`url(#${uid}-core)`}
            opacity={0.18 + visualFocus * 0.5}
            filter={`url(#${uid}-coreSoft)`}
          />
        </g>

        {/* Die Saeume gehoeren zur Silhouette, nicht zur Beleuchtung: sie
            bleiben beim Wischen stehen und folgen als einzige der Verjuengung. */}
        <g data-tube-detail="seams" clipPath={`url(#${uid}-bodyClip)`}>
          <path d={TUBE_SEAM_LEFT_PATH} fill={`url(#${uid}-seamL)`} filter={`url(#${uid}-seamSoft)`} />
          <path d={TUBE_SEAM_RIGHT_PATH} fill={`url(#${uid}-seamR)`} filter={`url(#${uid}-seamSoft)`} />
        </g>

        {/* Riffelung der Naht. Linien — deshalb fill="none". */}
        <g
          data-tube-detail="crimp-ribs"
          fill="none"
          stroke="rgba(70,76,85,0.42)"
          strokeWidth="0.7"
        >
          {TUBE_CRIMP_RIB_XS.map(x => (
            <path key={x} d={`M${x} ${TUBE_CRIMP.y + 1.5} L${x} ${TUBE_CRIMP.y + TUBE_CRIMP.height - 1}`} />
          ))}
        </g>
        <path
          data-tube-detail="crimp"
          d={`M${TUBE_CRIMP.x} ${TUBE_CRIMP.y + TUBE_CRIMP.height} L${TUBE_CRIMP.x + TUBE_CRIMP.width} ${TUBE_CRIMP.y + TUBE_CRIMP.height}`}
          fill="none"
          stroke="rgba(60,66,74,0.5)"
          strokeWidth="0.8"
        />

        {/* Kehlschatten, dann Kantenlicht mit dunklem Bogen darunter. */}
        <g clipPath={`url(#${uid}-bodyClip)`}>
          <rect x="20" y="220" width="80" height="36" fill={`url(#${uid}-throat)`} />
          <path
            data-tube-detail="edge-light"
            d={TUBE_EDGE_LIGHT_PATH}
            fill="none"
            stroke={`url(#${uid}-edge)`}
            strokeWidth="1.7"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
          <path
            d={TUBE_EDGE_SHADOW_PATH}
            fill="none"
            stroke="rgba(0,0,0,0.42)"
            strokeWidth="1.3"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
        </g>

        <path
          data-tube-detail="cap"
          d={TUBE_CAP_PATH}
          fill={`url(#${uid}-capBody)`}
          stroke="rgba(120,130,145,0.22)"
          strokeWidth="0.8"
        />
        <ellipse
          data-tube-detail="recess"
          cx={TUBE_CAP_RECESS.cx}
          cy={TUBE_CAP_RECESS.cy}
          rx={TUBE_CAP_RECESS.rx}
          ry={TUBE_CAP_RECESS.ry}
          fill={`url(#${uid}-recess)`}
        />
        <ellipse
          cx={TUBE_CAP_RECESS.cx}
          cy={TUBE_CAP_RECESS.cy}
          rx={TUBE_CAP_RECESS.rx}
          ry={TUBE_CAP_RECESS.ry}
          fill="none"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth="0.7"
        />
        {/* Die Fuge laeuft quer durch die Mulde: sie ist die Oeffnung, die
            Mulde der Angriffspunkt. */}
        <path
          data-tube-detail="cap-seam"
          d={`M${TUBE_CAP.x + 0.4} ${TUBE_CAP_SEAM_Y} L${TUBE_CAP.x + TUBE_CAP.width - 0.4} ${TUBE_CAP_SEAM_Y}`}
          fill="none"
          stroke="rgba(150,160,175,0.38)"
          strokeWidth="0.6"
        />
        <path
          d={`M${TUBE_CAP.x + 0.4} ${TUBE_CAP_SEAM_LIP_Y} L${TUBE_CAP.x + TUBE_CAP.width - 0.4} ${TUBE_CAP_SEAM_LIP_Y}`}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="0.5"
        />
        {/* Kontaktschatten: ohne ihn floessen Deckel und Tubenende ineinander. */}
        <path
          d={`M${TUBE_CAP.x} ${TUBE_CAP.y} L${TUBE_CAP.x + TUBE_CAP.width} ${TUBE_CAP.y} L${TUBE_CAP.x + TUBE_CAP.width} ${TUBE_CAP.y + 9} L${TUBE_CAP.x} ${TUBE_CAP.y + 9} Z`}
          fill={`url(#${uid}-capTop)`}
        />
      </svg>

      {/* Weiss aufgedruckt. Der Einzug folgt der Verjuengung — hier ist der
          Koerper auf Namenshoehe schmaler als die viewBox. */}
{showLabel && (
        <div
          data-tube-detail="name"
          className="pointer-events-none absolute -translate-y-1/2 overflow-hidden text-center"
          style={{
            top: `${TUBE_NAME_TOP_PCT * 100}%`,
            left: `${(TUBE_NAME_INSET_PCT * 100).toFixed(2)}%`,
            right: `${(TUBE_NAME_INSET_PCT * 100).toFixed(2)}%`,
          }}
        >
          <StageMarquee className={`${NAME_CLASS[size]} font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]`}>
            {tubeName}
          </StageMarquee>
        </div>
      )}
    </div>
  )
}
