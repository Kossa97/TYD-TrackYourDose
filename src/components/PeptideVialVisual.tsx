import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface PeptideVialVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  fillPct: number
  color: string
  animateOnMount?: boolean
  size?: 'large' | 'compact'
  className?: string
  isActive?: boolean
}

function clampFill(fillPct: number): number {
  if (!Number.isFinite(fillPct)) return 0
  return Math.max(0, Math.min(100, Math.round(fillPct)))
}

function vialAmountLabel(amount?: string | number | null, unit?: string | null): string {
  if (amount === null || amount === undefined || amount === '') return 'Wirkstoff / Vial'
  return `${amount} ${unit || 'mg'} / Vial`
}

function VialLabelMarquee({
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
      if (overflow <= 4) return

      const holdStart = 2200
      const holdEnd = 1200
      const moveOut = Math.max(1800, overflow * 35)
      const moveBack = Math.max(700, overflow * 14)
      const total = holdStart + moveOut + holdEnd + moveBack

      anim = inner.animate(
        [
          { transform: 'translateX(0)', offset: 0 },
          { transform: 'translateX(0)', offset: holdStart / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut) / total },
          { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut + holdEnd) / total },
          { transform: 'translateX(0)', offset: 1 },
        ],
        { duration: total, iterations: Infinity, easing: 'linear' },
      )
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

export function PeptideVialVisual({
  name,
  amount,
  unit,
  fillPct,
  color,
  animateOnMount = false,
  size = 'large',
  className = '',
  isActive = true,
}: PeptideVialVisualProps) {
  const clampedFill = clampFill(fillPct)
  // Scale to max 96 % so 100 % always shows a tiny air gap above the wave
  // surface, while every single percentage point still changes the fill level
  // proportionally (1 % ≈ 0.96 % visual).
  const visualFill = clampedFill === 0 ? 0 : clampedFill * 0.96
  const labelName = name?.trim() || 'Peptidname'
  const isLarge = size === 'large'
  const widthClass = isLarge ? 'w-28 sm:w-36' : 'w-16'
  const heightClass = isLarge ? 'h-44 sm:h-52' : 'h-24'
  const neckClass = isLarge ? 'h-3 w-24' : 'h-3 w-12'
  const bodyClass = isLarge ? 'h-36 rounded-[1.4rem]' : 'h-20 rounded-lg'
  const labelClass = isLarge
    ? 'left-0 right-0 top-[39%] rounded-none px-3 py-2'
    : 'left-0 right-0 top-[36%] rounded-none px-1 py-1'
  const nameClass = isLarge
    ? 'text-xl sm:text-2xl leading-tight'
    : 'text-[9px] leading-tight'
  const amountClass = isLarge
    ? 'text-xs sm:text-sm mt-1'
    : 'text-[7px] mt-0.5'
  const fillStyle = {
    height: `${visualFill}%`,
    background: `linear-gradient(180deg, ${color}9f 0%, ${color}ee 42%, ${color} 100%)`,
    boxShadow: `0 -10px 26px ${color}55, inset 0 1px 0 rgba(255,255,255,0.35), inset 18px 0 28px rgba(255,255,255,0.08), inset -18px 0 28px rgba(0,0,0,0.18)`,
  } as CSSProperties

  return (
    <div
      className={`relative mx-auto select-none ${widthClass} ${className}`}
      data-fill-pct={clampedFill}
      aria-label={`${labelName}, ${vialAmountLabel(amount, unit)}, ${clampedFill}%`}
    >
      <style>{`
        @keyframes vial-fill-rise {
          from { height: 0%; }
          to { height: var(--vial-fill-target); }
        }
        @keyframes vial-shimmer {
          0%, 100% { transform: translateX(0); opacity: .35; }
          50% { transform: translateX(14%); opacity: .7; }
        }
        @keyframes vial-wave-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes vial-wave-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
        .vial-fill-rise {
          animation: vial-fill-rise 850ms cubic-bezier(.22,1,.36,1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .vial-fill-rise, .vial-shimmer, .vial-wave-scroll, .vial-wave-breathe { animation: none !important; }
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        <div
          data-vial-detail="single-cap"
          className={`${neckClass} rounded-t-lg border border-slate-500/70 bg-gradient-to-b from-slate-500/80 via-slate-800/70 to-slate-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_4px_10px_rgba(15,23,42,0.35)]`}
        />

        <div
          data-vial-detail="glass-body"
          className={`relative w-full ${heightClass} ${bodyClass} overflow-hidden border border-slate-400/35 bg-slate-950/82 shadow-[inset_0_0_22px_rgba(255,255,255,0.1),inset_14px_0_28px_rgba(255,255,255,0.08),inset_-18px_0_28px_rgba(0,0,0,0.14),0_22px_60px_rgba(0,0,0,0.36)]`}
        >
          <div
            data-vial-detail="glass-shoulder"
            className="absolute left-4 right-4 top-0 h-10 rounded-b-[50%] border-b border-white/10 bg-gradient-to-b from-white/12 to-transparent"
          />
          <div
            className={`absolute bottom-0 left-0 right-0 ${animateOnMount ? 'vial-fill-rise' : ''}`}
            style={{
              ...fillStyle,
              '--vial-fill-target': `${visualFill}%`,
            } as CSSProperties}
          >
            <div
              data-vial-detail="list-style-wave-surface"
              className="absolute -top-3 left-0 right-0 h-7 overflow-hidden"
              style={{ animation: 'vial-wave-breathe 3s ease-in-out infinite' }}
            >
              <div
                className="vial-wave-scroll absolute left-0 top-0 h-6 w-[200%] text-current"
                style={{ color, animation: 'vial-wave-scroll 2.4s linear infinite' }}
              >
                <svg className="h-full w-full" viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true">
                  <path
                    d="M0 8 C13.8 3 36.2 3 50 8 C63.8 13 86.2 13 100 8 C113.8 3 136.2 3 150 8 C163.8 13 186.2 13 200 8 L200 24 L0 24 Z"
                    fill="currentColor"
                    fillOpacity="0.62"
                  />
                </svg>
              </div>
              <div className="absolute left-3 right-3 top-2 h-3 rounded-[50%] bg-white/10 blur-sm" />
            </div>
          </div>

          <div className="absolute inset-y-4 left-3 w-4 rounded-full bg-white/20 blur-[2px]" />
          <div className="absolute inset-y-6 right-3 w-2 rounded-full bg-white/10 blur-[1px]" />
          <div className="vial-shimmer absolute inset-y-8 left-8 w-10 rotate-6 rounded-full bg-white/10 blur-[6px]" />
          <div
            data-vial-detail="glass-base"
            className="absolute bottom-0 left-4 right-4 h-5 rounded-t-[50%] border-t border-white/16 bg-gradient-to-t from-white/12 to-transparent"
          />

          {!isActive && (
            <div data-vial-detail="inactive-overlay" className="absolute inset-0 bg-black/40 pointer-events-none" />
          )}

          <div
            data-vial-detail="full-width-label"
            className={`absolute ${labelClass} overflow-hidden border-y border-[var(--border-strong)] bg-slate-950/82 text-center shadow-[0_8px_22px_rgba(0,0,0,0.32)] backdrop-blur-sm`}
          >
            <VialLabelMarquee className={`${nameClass} font-black text-white tracking-normal`}>
              {labelName}
            </VialLabelMarquee>
            <p className={`${amountClass} font-bold uppercase tracking-wide text-white`}>
              {vialAmountLabel(amount, unit)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
