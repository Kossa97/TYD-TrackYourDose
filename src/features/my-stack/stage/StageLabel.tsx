import { useEffect, useRef } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode, RefObject } from 'react'
import { buildMarqueeMotion, MARQUEE_MIN_OVERFLOW } from './marquee'

// The scrolling name band. It only animates when the text really overflows —
// measured, never guessed from the name length — so short names stay still.
function StageLabelMarquee({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) {
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const innerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const inner = innerRef.current
    if (!wrap || !inner || typeof window === 'undefined') return

    let anim: Animation | null = null

    const setup = () => {
      anim?.cancel()
      inner.style.transform = 'translateX(0)'

      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

      const overflow = inner.scrollWidth - wrap.clientWidth
      if (overflow <= MARQUEE_MIN_OVERFLOW) return

      const motion = buildMarqueeMotion(overflow)
      anim = inner.animate(motion.keyframes, motion.options)
    }

    setup()

    if (typeof ResizeObserver === 'undefined') {
      return () => anim?.cancel()
    }

    const ro = new ResizeObserver(setup)
    ro.observe(wrap)
    ro.observe(inner)

    return () => {
      anim?.cancel()
      ro.disconnect()
    }
  }, [children])

  return (
    <span ref={wrapRef} className={`block overflow-hidden whitespace-nowrap ${className}`}>
      <span ref={innerRef} className="vial-label-marquee inline-block will-change-transform">
        {children}
      </span>
    </span>
  )
}

// Each form tags the band with its own debugging attributes, so the shared
// component must accept data-* alongside the regular div attributes.
type DivProps = HTMLAttributes<HTMLDivElement> & { [key: `data-${string}`]: string }

export interface StageLabelProps {
  name: string
  detail: string | null
  className: string
  nameClassName: string
  detailClassName: string
  wrapperProps?: DivProps
  innerProps?: DivProps
  sheenRef?: RefObject<HTMLDivElement | null>
  sheenStyle?: CSSProperties
}

// The glass band every liquid-holding container wears. Position and typography
// come from the form; the material is the same everywhere it belongs.
export function StageLabel({
  name,
  detail,
  className,
  nameClassName,
  detailClassName,
  wrapperProps,
  innerProps,
  sheenRef,
  sheenStyle,
}: StageLabelProps) {
  return (
    <div
      {...wrapperProps}
      className={`absolute ${className} overflow-hidden border-y border-white/40 bg-white/28 text-center shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-[2px]`}
    >
      <div {...innerProps} className="relative overflow-hidden">
        <StageLabelMarquee className={nameClassName}>{name}</StageLabelMarquee>
        {detail !== null && detail !== '' && <p className={detailClassName}>{detail}</p>}
      </div>
      {sheenRef && (
        <div
          ref={sheenRef}
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-white/10 to-black/10"
          style={sheenStyle}
        />
      )}
    </div>
  )
}
