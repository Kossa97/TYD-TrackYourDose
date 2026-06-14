import type { CSSProperties } from 'react'

interface PeptideVialVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  fillPct: number
  color: string
  animateOnMount?: boolean
  size?: 'large' | 'compact'
  className?: string
}

function clampFill(fillPct: number): number {
  if (!Number.isFinite(fillPct)) return 0
  return Math.max(0, Math.min(100, Math.round(fillPct)))
}

function vialAmountLabel(amount?: string | number | null, unit?: string | null): string {
  if (amount === null || amount === undefined || amount === '') return 'Wirkstoff / Vial'
  return `${amount} ${unit || 'mg'} / Vial`
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
}: PeptideVialVisualProps) {
  const clampedFill = clampFill(fillPct)
  const labelName = name?.trim() || 'Peptidname'
  const isLarge = size === 'large'
  const widthClass = isLarge ? 'w-44 sm:w-52' : 'w-16'
  const heightClass = isLarge ? 'h-64 sm:h-72' : 'h-24'
  const capClass = isLarge ? 'h-7 w-24' : 'h-4 w-10'
  const neckClass = isLarge ? 'h-5 w-32' : 'h-3 w-12'
  const bodyClass = isLarge ? 'h-56 rounded-[1.4rem]' : 'h-20 rounded-lg'
  const labelClass = isLarge
    ? 'left-5 right-5 top-[38%] rounded-xl px-3 py-2'
    : 'left-1.5 right-1.5 top-[36%] rounded-md px-1.5 py-1'
  const nameClass = isLarge
    ? 'text-xl sm:text-2xl leading-tight'
    : 'text-[9px] leading-tight'
  const amountClass = isLarge
    ? 'text-xs sm:text-sm mt-1'
    : 'text-[7px] mt-0.5'
  const fillStyle = {
    height: `${clampedFill}%`,
    background: `linear-gradient(180deg, ${color}88 0%, ${color} 100%)`,
    boxShadow: `0 -10px 26px ${color}55, inset 0 1px 0 rgba(255,255,255,0.35)`,
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
        @media (prefers-reduced-motion: reduce) {
          .vial-fill-rise, .vial-shimmer { animation: none !important; }
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        <div className={`${capClass} rounded-t-lg border border-slate-500/70 bg-gradient-to-b from-slate-400 to-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]`} />
        <div className={`${neckClass} rounded-t-md border-x border-slate-600/80 bg-gradient-to-b from-slate-600 to-slate-800`} />

        <div
          className={`relative w-full ${heightClass} ${bodyClass} overflow-hidden border border-slate-500/45 bg-slate-950/80 shadow-[inset_0_0_22px_rgba(255,255,255,0.08),0_22px_60px_rgba(0,0,0,0.36)]`}
        >
          <div
            className={`absolute bottom-0 left-0 right-0 ${animateOnMount ? 'vial-fill-rise' : ''}`}
            style={{
              ...fillStyle,
              '--vial-fill-target': `${clampedFill}%`,
              animationDuration: '850ms',
              animationTimingFunction: 'cubic-bezier(.22,1,.36,1)',
              animationFillMode: 'both',
            } as CSSProperties}
          >
            <div className="absolute -top-2 left-0 right-0 h-4 rounded-[50%] bg-white/20 blur-[1px]" />
          </div>

          <div className="absolute inset-y-4 left-3 w-4 rounded-full bg-white/18 blur-[2px]" />
          <div className="absolute inset-y-6 right-3 w-2 rounded-full bg-white/10 blur-[1px]" />
          <div className="vial-shimmer absolute inset-y-8 left-8 w-10 rotate-6 rounded-full bg-white/10 blur-[6px]" />

          <div className={`absolute ${labelClass} border border-white/15 bg-slate-950/82 text-center shadow-[0_8px_22px_rgba(0,0,0,0.32)] backdrop-blur-sm`}>
            <p className={`${nameClass} font-black text-white tracking-normal break-words`}>
              {labelName}
            </p>
            <p className={`${amountClass} font-bold uppercase tracking-wide text-slate-300`}>
              {vialAmountLabel(amount, unit)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
