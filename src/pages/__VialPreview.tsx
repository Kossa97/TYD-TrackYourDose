import { useRef, useState } from 'react'
import type { UIEvent } from 'react'
import { PeptideVialVisual } from '../components/PeptideVialVisual'
import { AmpouleVisual } from '../features/my-stack/extensions/ampoule/AmpouleVisual'
import { SloshProvider, useSloshEngine } from '../components/SloshContext'

const PREVIEW_VIALS = [
  { name: 'BPC-157', amount: '5', unit: 'mg', fillPct: 72, color: '#06b6d4', size: 'large' as const },
  { name: 'TB-500', amount: '10', unit: 'mg', fillPct: 40, color: '#a855f7', size: 'large' as const },
  { name: 'Ipamorelin', amount: '2', unit: 'mg', fillPct: 95, color: '#ec4899', size: 'large' as const },
  { name: 'Semax', amount: '10', unit: 'mg', fillPct: 60, color: '#f59e0b', size: 'compact' as const },
  { name: 'GHK-Cu', amount: '50', unit: 'mg', fillPct: 20, color: '#22c55e', size: 'compact' as const },
]

const PREVIEW_AMPOULES = [
  { name: 'Testosteron Enantat', amount: 250, unit: 'mg / ml', color: '#e0a23f', size: 'large' as const },
  { name: 'Nandrolon D', amount: 200, unit: 'mg / ml', color: '#38bdf8', size: 'large' as const },
  { name: 'Vitamin B12', amount: 1000, unit: 'mcg / ml', color: '#f43f5e', size: 'large' as const },
  { name: 'Ohne Menge', amount: null, unit: null, color: '#a3e635', size: 'large' as const },
]

export function VialPreview() {
  const sloshEngine = useSloshEngine()
  const lastScrollLeftRef = useRef(0)
  const lastScrollTimeRef = useRef(0)
  const [fillOffset, setFillOffset] = useState(0)

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const scroller = event.currentTarget
    const now = event.timeStamp

    if (lastScrollTimeRef.current > 0) {
      const delta = scroller.scrollLeft - lastScrollLeftRef.current
      const dt = Math.max(16, now - lastScrollTimeRef.current)
      if (Math.abs(delta) > 0.5) sloshEngine.pushImpulse((delta / dt) * 2.6)
    }

    lastScrollLeftRef.current = scroller.scrollLeft
    lastScrollTimeRef.current = now
  }

  const previewFill = (fillPct: number, index: number) => {
    if (index !== 0) return fillPct
    return Math.max(5, Math.min(100, fillPct + fillOffset))
  }

  return (
    <div className="min-h-screen bg-slate-950 p-10 text-slate-200">
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 pb-8 text-xs font-bold uppercase tracking-wide text-slate-400">
        <button className="rounded-md border border-slate-700 px-3 py-2 hover:border-cyan-400 hover:text-cyan-200" onClick={() => setFillOffset(v => Math.max(v - 18, -60))}>Einnahme</button>
        <button className="rounded-md border border-slate-700 px-3 py-2 hover:border-cyan-400 hover:text-cyan-200" onClick={() => setFillOffset(v => Math.min(v + 18, 28))}>Auffuellen</button>
      </div>

      <SloshProvider engine={sloshEngine}>
        <div
          className="mx-auto flex max-w-4xl snap-x snap-mandatory items-end gap-10 overflow-x-auto pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={handleScroll}
        >
          {PREVIEW_VIALS.map((vial, index) => {
            const fillPct = previewFill(vial.fillPct, index)
            return (
              <div key={vial.name} className="snap-center shrink-0 px-4">
                <PeptideVialVisual
                  name={vial.name}
                  amount={vial.amount}
                  unit={vial.unit}
                  fillPct={fillPct}
                  color={vial.color}
                  size={vial.size}
                  animateOnMount
                  focus={index === 1 ? 0.72 : 1}
                  lightOffset={index === 1 ? -0.35 : 0}
                />
              </div>
            )
          })}
        </div>
      </SloshProvider>

      {/* Ampoule next to the vial: same stage, same ground line, same slosh
          engine — the comparison the shape has to survive. */}
      <SloshProvider engine={sloshEngine}>
        <div
          className="mx-auto flex max-w-4xl snap-x snap-mandatory items-end gap-10 overflow-x-auto border-t border-slate-800 pt-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={handleScroll}
        >
          {PREVIEW_AMPOULES.map((ampoule, index) => (
            <div key={ampoule.name} className="snap-center shrink-0 px-4">
              <AmpouleVisual
                name={ampoule.name}
                amount={ampoule.amount}
                unit={ampoule.unit}
                color={ampoule.color}
                size={ampoule.size}
                focus={index === 1 ? 0.72 : 1}
                lightOffset={index === 1 ? -0.35 : 0}
              />
            </div>
          ))}
          <div className="snap-center shrink-0 px-4">
            <PeptideVialVisual
              name="Vial zum Vergleich"
              amount="5"
              unit="mg"
              fillPct={72}
              color="#06b6d4"
              size="carousel"
            />
          </div>
          <div className="snap-center shrink-0 px-4">
            <AmpouleVisual
              name="Testosteron E"
              amount={250}
              unit="mg / ml"
              color="#e0a23f"
              size="carousel"
            />
          </div>
        </div>
      </SloshProvider>
    </div>
  )
}
