import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  PEN_BODY,
  PEN_CAP_PATH,
  PEN_CLIP_PATH,
  PEN_DOSE_TEXT,
  PEN_DOSE_WINDOW,
  PEN_DOSE_WINDOW_PCT,
  PEN_BODY_SHOULDER_X,
  PEN_KNOB_PATH,
  PEN_KNOB_RIB_XS,
  PEN_KNOB_RIB_YS,
  PEN_KNOB_SHOULDER,
  PEN_NAME_BAND_PCT,
  PEN_NAME_RUN_PCT,
  PEN_NAME_TOP_PCT,
  PEN_RING,
  PEN_SCREEN,
  PEN_SCREEN_GLINT_SHIFT,
  PEN_SWEEP_SHIFT,
} from './penShape'

export interface PenVisualProps {
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

// Der Pen nimmt die naechste Sprosse der Leiter, die die stehenden Formen
// steigen: 236,8 ist die Hoehe, die Ampulle und Nasenspray am sm-Breakpoint
// erreichen. Die Breite folgt dem eigenen Verhaeltnis 39/300 = 0,130.
const SIZE_CLASS: Record<NonNullable<PenVisualProps['size']>, string> = {
  large: 'h-[589.2px] w-[76.6px]',
  carousel: 'h-[236.8px] w-[30.8px] sm:h-[300.9px] sm:w-[39.1px]',
  compact: 'h-[177.6px] w-[23.1px]',
  mini: 'h-[96.9px] w-[12.6px]',
}

const NAME_CLASS: Record<NonNullable<PenVisualProps['size']>, string> = {
  large: 'text-sm leading-tight',
  carousel: 'text-[6px] sm:text-[7.5px] leading-tight',
  compact: 'text-[5px] leading-tight',
  mini: 'text-[3.5px] leading-tight',
}

const DOSE_CLASS: Record<NonNullable<PenVisualProps['size']>, string> = {
  large: 'text-[15px]',
  carousel: 'text-[7px] sm:text-[9px]',
  compact: 'text-[5px]',
  mini: 'text-[3px]',
}

export function PenVisual({
  name,
  color,
  size = 'large',
  className = '',
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: PenVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const penName = name?.trim() || 'Pen'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const bodyRef = useRef<SVGRectElement | null>(null)
  const screenGlintRef = useRef<SVGRectElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-pen-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-pen-light-offset', o.toFixed(2))
    sweepRef.current?.setAttribute('transform', `translate(${(o * PEN_SWEEP_SHIFT).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.10 + f * 0.30).toFixed(3))
    shadowRef.current?.setAttribute('cx', (20 - o * 4).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.3).toFixed(3))
    bodyRef.current?.setAttribute('opacity', (0.72 + f * 0.28).toFixed(3))
    screenGlintRef.current?.setAttribute(
      'transform',
      `translate(${(o * PEN_SCREEN_GLINT_SHIFT).toFixed(2)} 0)`,
    )
    screenGlintRef.current?.setAttribute('opacity', (0.05 + f * 0.16).toFixed(3))
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-pen-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-pen-focus={Number(visualFocus.toFixed(2))}
      data-pen-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={penName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0.5 6 39 300"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`${uid}-bodyClip`}>
            <rect x={PEN_BODY.x} y={PEN_BODY.y} width={PEN_BODY.width} height={PEN_BODY.height} />
          </clipPath>
          <linearGradient id={`${uid}-cap`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#23272e" />
            <stop offset="18%" stopColor="#6f7683" />
            <stop offset="46%" stopColor="#454b55" />
            <stop offset="76%" stopColor="#5e646f" />
            <stop offset="100%" stopColor="#1d2127" />
          </linearGradient>
          <linearGradient id={`${uid}-knob`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#20242b" />
            <stop offset="20%" stopColor="#5b626d" />
            <stop offset="52%" stopColor="#383d45" />
            <stop offset="80%" stopColor="#4d535d" />
            <stop offset="100%" stopColor="#1b1f25" />
          </linearGradient>
          {/* Zylinderschattierung des Gehaeuses, unabhaengig vom Buehnenlicht. */}
          <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.30)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="78%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.60)" />
          </linearGradient>
          <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.65)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Oben faellt der Schatten des Koerpers auf den Knopf, unten setzt
              ihn die Standflaeche ab. */}
          <clipPath id={`${uid}-screenClip`}>
            <rect
              x={PEN_SCREEN.x}
              y={PEN_SCREEN.y}
              width={PEN_SCREEN.width}
              height={PEN_SCREEN.height}
              rx={PEN_SCREEN.rx}
            />
          </clipPath>
          {/* Ruhender Glasschimmer auf dem Bildschirm. */}
          <linearGradient id={`${uid}-screenGlass`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.20)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-knobAo`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
            <stop offset="26%" stopColor="rgba(0,0,0,0)" />
            <stop offset="86%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
          </linearGradient>
          <radialGradient id={`${uid}-groundShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <ellipse
          ref={shadowRef}
          data-pen-detail="ground-shadow"
          cx={20 - visualLightOffset * 4}
          cy="308"
          rx="15"
          ry="3.5"
          fill={`url(#${uid}-groundShadow)`}
          opacity={0.2 + visualFocus * 0.3}
        />

        <path data-pen-detail="cap" d={PEN_CAP_PATH} fill={`url(#${uid}-cap)`} />
        <path data-pen-detail="clip" d={PEN_CLIP_PATH} fill="rgba(200,208,218,0.55)" />

        <rect
          ref={bodyRef}
          data-pen-detail="body"
          x={PEN_BODY.x}
          y={PEN_BODY.y}
          width={PEN_BODY.width}
          height={PEN_BODY.height}
          fill="#6a717c"
          opacity={0.72 + visualFocus * 0.28}
        />
        {/* Die einzige Stelle, an der color_hex sichtbar wird. */}
        <rect
          data-pen-detail="ring"
          x={PEN_RING.x}
          y={PEN_RING.y}
          width={PEN_RING.width}
          height={PEN_RING.height}
          fill={color}
        />
        <rect
          x={PEN_BODY.x}
          y={PEN_BODY.y}
          width={PEN_BODY.width}
          height={PEN_BODY.height}
          fill={`url(#${uid}-shade)`}
        />

        {/* Das wandernde Glanzband — beschnitten, weil der Pen die schmalste
            Form ist und es sonst neben das Gehaeuse malte. */}
        <g clipPath={`url(#${uid}-bodyClip)`}>
          <rect
            ref={sweepRef}
            data-pen-detail="sweep"
            x="10"
            y={PEN_BODY.y}
            width="12"
            height={PEN_BODY.height}
            fill={`url(#${uid}-sweep)`}
            opacity={0.10 + visualFocus * 0.30}
            transform={`translate(${(visualLightOffset * PEN_SWEEP_SHIFT).toFixed(2)} 0)`}
          />
        </g>

        {/* Der Name steht auf einem Bildschirm, nicht als Aufdruck auf dem
            Gehaeuse. Er kommt nach dem Glanzband, damit das Band ihn nicht
            ueberstrahlt — Glas faengt sein eigenes Licht. */}
        <rect
          data-pen-detail="screen-bezel"
          x={PEN_SCREEN.x - 1}
          y={PEN_SCREEN.y - 1}
          width={PEN_SCREEN.width + 2}
          height={PEN_SCREEN.height + 2}
          rx={PEN_SCREEN.rx + 1}
          fill="rgba(0,0,0,0.45)"
        />
        <rect
          data-pen-detail="screen"
          x={PEN_SCREEN.x}
          y={PEN_SCREEN.y}
          width={PEN_SCREEN.width}
          height={PEN_SCREEN.height}
          rx={PEN_SCREEN.rx}
          fill="#0b1017"
        />

        <rect
          data-pen-detail="dose-window"
          x={PEN_DOSE_WINDOW.x}
          y={PEN_DOSE_WINDOW.y}
          width={PEN_DOSE_WINDOW.width}
          height={PEN_DOSE_WINDOW.height}
          rx={PEN_DOSE_WINDOW.rx}
          fill="#0a0f18"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />

        {/* Der Knopf weitet sich konisch von der Koerperbreite auf seine
            volle Breite: eine Schulter statt einer Stufe. */}
        <path data-pen-detail="knob" d={PEN_KNOB_PATH} fill={`url(#${uid}-knob)`} />
        <path d={PEN_KNOB_PATH} fill={`url(#${uid}-knobAo)`} />

        {/* Die Schulter faengt das Licht von oben; darueber sitzt die dunkle
            Kante, an der der Koerper in sie uebergeht. */}
        <g data-pen-detail="knob-shoulder" fill="none" strokeLinecap="round">
          <path
            d={`M${PEN_BODY_SHOULDER_X.left} ${PEN_KNOB_SHOULDER.y + 0.8} L${PEN_BODY_SHOULDER_X.right} ${PEN_KNOB_SHOULDER.y + 0.8}`}
            stroke="rgba(255,255,255,0.30)"
            strokeWidth="0.9"
          />
          <path
            d={`M${PEN_BODY_SHOULDER_X.left} ${PEN_KNOB_SHOULDER.y} L${PEN_BODY_SHOULDER_X.right} ${PEN_KNOB_SHOULDER.y}`}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="1.6"
          />
        </g>

        <g
          data-pen-detail="knob-ribs"
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="0.9"
        >
          {PEN_KNOB_RIB_XS.map(x => (
            <path key={x} d={`M${x} ${PEN_KNOB_RIB_YS.top} L${x} ${PEN_KNOB_RIB_YS.bottom}`} />
          ))}
        </g>
        {/* Der wandernde Glanz liegt auf dem Glas und ist deshalb auf den
            Bildschirm beschnitten. */}
        <g clipPath={`url(#${uid}-screenClip)`}>
          <rect
            x={PEN_SCREEN.x}
            y={PEN_SCREEN.y}
            width={PEN_SCREEN.width}
            height={PEN_SCREEN.height}
            fill={`url(#${uid}-screenGlass)`}
          />
          <rect
            ref={screenGlintRef}
            data-pen-detail="screen-glint"
            x={PEN_SCREEN.x + 2}
            y={PEN_SCREEN.y}
            width="8"
            height={PEN_SCREEN.height}
            fill={`url(#${uid}-sweep)`}
            opacity={0.05 + visualFocus * 0.16}
            transform={`translate(${(visualLightOffset * PEN_SCREEN_GLINT_SHIFT).toFixed(2)} 0)`}
          />
        </g>
      </svg>

      {/* Die 0 als HTML: bei Karussellgroesse misst sie rund 8 px, und
          SVG-Text bekommt weder Hinting noch Subpixel-Glaettung. */}
      <div
        data-pen-detail="dose-value"
        className={`pointer-events-none absolute flex items-center justify-center font-black text-slate-100 ${DOSE_CLASS[size]}`}
        style={{
          left: `${(PEN_DOSE_WINDOW_PCT.left * 100).toFixed(2)}%`,
          top: `${(PEN_DOSE_WINDOW_PCT.top * 100).toFixed(2)}%`,
          width: `${(PEN_DOSE_WINDOW_PCT.width * 100).toFixed(2)}%`,
          height: `${(PEN_DOSE_WINDOW_PCT.height * 100).toFixed(2)}%`,
        }}
      >
        {PEN_DOSE_TEXT}
      </div>

      {/* Der Name laeuft laengs. items-center zentriert die Textzeile senkrecht
          in der Huelle — ohne das saesse sie am oberen Rand, und nach der
          90-Grad-Drehung heisst "oben in der Huelle" links am Pen.
          Die Huelle ist um 90 Grad gedreht, darin
          arbeitet der bestehende waagerechte StageMarquee unveraendert weiter —
          so bleibt der geteilte Baustein fuer die sechs anderen Formen
          unangetastet. */}
      <div
        data-pen-detail="name"
        className="pointer-events-none absolute flex items-center overflow-hidden text-center"
        style={{
          left: '50%',
          top: `${(PEN_NAME_TOP_PCT * 100).toFixed(2)}%`,
          width: `${(PEN_NAME_RUN_PCT * 100).toFixed(2)}%`,
          height: `${(PEN_NAME_BAND_PCT * 100).toFixed(2)}%`,
          transform: 'translate(-50%, -50%) rotate(-90deg)',
        }}
      >
        <StageMarquee className={`w-full ${NAME_CLASS[size]} font-black text-[#bfe6ff] tracking-normal drop-shadow-[0_0_2px_rgba(140,205,255,0.45)]`}>
          {penName}
        </StageMarquee>
      </div>
    </div>
  )
}
