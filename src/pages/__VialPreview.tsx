import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, UIEvent, WheelEvent as ReactWheelEvent } from 'react'
import { PeptideVialVisual } from '../components/PeptideVialVisual'
import { AmpouleVisual } from '../features/my-stack/extensions/ampoule/AmpouleVisual'
import { CapsuleVisual } from '../features/my-stack/extensions/capsule/CapsuleVisual'
import { NasalSprayVisual } from '../features/my-stack/extensions/nasal-spray/NasalSprayVisual'
import { TabletVisual } from '../features/my-stack/extensions/tablet/TabletVisual'
import { TubeVisual } from '../features/my-stack/extensions/tube/TubeVisual'
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

const PREVIEW_CAPSULES = [
  { name: 'Vitamin D3', color: '#f0b357' },
  { name: 'Magnesiumcitrat', color: '#a3e635' },
  // bewusst zu lang: zeigt Schrumpfen und hartes Abschneiden
  { name: 'Omega 3 Fischoel Konzentrat hochdosiert', color: '#38bdf8' },
]

const PREVIEW_TABLETS = [
  { name: 'Ibuprofen', color: '#d9c39a' },
  { name: 'Aspirin', color: '#e2e8f0' },
  // bewusst zu lang: zeigt den Durchlauf auf engem Raum
  { name: 'Acetylsalicylsäure 500', color: '#fca5a5' },
]

const PREVIEW_SPRAYS = [
  { name: 'Oxytocin', amount: 24 as number | null, unit: 'IU / spray' as string | null, color: '#7dd3fc' },
  { name: 'Melanotan II', amount: 300 as number | null, unit: 'mcg / spray' as string | null, color: '#f0b357' },
  // bewusst ohne Menge: zeigt das Etikett ohne Detailzeile
  { name: 'Selank', amount: null as number | null, unit: null as string | null, color: '#a3e635' },
]

const PREVIEW_TUBES = [
  { name: 'Diclofenac' },
  { name: 'Testogel' },
  // bewusst zu lang: zeigt den Durchlauf auf dem verjuengten Koerper
  { name: 'Hydrocortison Acetat 1%' },
]

// Mixed forms in one row, the way My Stack will show them.
type MixedEntry = {
  kind: 'ampoule' | 'vial' | 'capsule' | 'tablet' | 'nasal_spray' | 'tube'
  name: string
  amount: number | null
  unit: string | null
  color: string
  fillPct?: number
}

const MIXED_CAROUSEL: MixedEntry[] = [
  { kind: 'ampoule', name: 'Testosteron E', amount: 250, unit: 'mg / ml', color: '#e0a23f' },
  { kind: 'vial', name: 'BPC-157', amount: 5, unit: 'mg', color: '#06b6d4', fillPct: 72 },
  { kind: 'ampoule', name: 'Nandrolon D', amount: 200, unit: 'mg / ml', color: '#38bdf8' },
  { kind: 'ampoule', name: 'Vitamin B12', amount: 1000, unit: 'mcg / ml', color: '#f43f5e' },
  { kind: 'vial', name: 'TB-500', amount: 10, unit: 'mg', color: '#a855f7', fillPct: 40 },
  { kind: 'ampoule', name: 'Testosteron P', amount: 100, unit: 'mg / ml', color: '#fbbf24' },
  { kind: 'ampoule', name: 'Ohne Menge', amount: null, unit: null, color: '#a3e635' },
  { kind: 'vial', name: 'Ipamorelin', amount: 2, unit: 'mg', color: '#ec4899', fillPct: 95 },
  { kind: 'ampoule', name: 'Boldenon U', amount: 300, unit: 'mg / ml', color: '#34d399' },
  { kind: 'capsule', name: 'Vitamin D3', amount: 5000, unit: 'IU', color: '#f0b357' },
  { kind: 'capsule', name: 'Magnesiumcitrat', amount: 400, unit: 'mg', color: '#a3e635' },
  { kind: 'capsule', name: 'Omega 3 Fischoel Konzentrat', amount: 1000, unit: 'mg', color: '#38bdf8' },
  { kind: 'tablet', name: 'Ibuprofen', amount: 400, unit: 'mg', color: '#d9c39a' },
  { kind: 'tablet', name: 'Aspirin', amount: 500, unit: 'mg', color: '#e2e8f0' },
  { kind: 'tablet', name: 'Acetylsalicylsäure 500', amount: 500, unit: 'mg', color: '#fca5a5' },
  { kind: 'nasal_spray', name: 'Oxytocin', amount: 24, unit: 'IU / spray', color: '#7dd3fc' },
  { kind: 'nasal_spray', name: 'Melanotan II', amount: 300, unit: 'mcg / spray', color: '#f0b357' },
  { kind: 'nasal_spray', name: 'Selank', amount: null, unit: null, color: '#a3e635' },
  { kind: 'tube', name: 'Diclofenac', amount: null, unit: null, color: '#f97316' },
  { kind: 'tube', name: 'Testogel', amount: null, unit: null, color: '#a3e635' },
  { kind: 'tube', name: 'Hydrocortison Acetat 1%', amount: null, unit: null, color: '#38bdf8' },
]

export function VialPreview() {
  const sloshEngine = useSloshEngine()
  const lastScrollLeftRef = useRef(0)
  const lastScrollTimeRef = useRef(0)
  const [fillOffset, setFillOffset] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Drag-to-scroll, mirroring the real My Stack carousel: with the scrollbar
  // hidden there is otherwise no way to swipe this row using a mouse.
  const railRef = useRef<HTMLDivElement | null>(null)
  const dragStartXRef = useRef(0)
  const dragLastXRef = useRef(0)
  const dragLastTimeRef = useRef(0)
  const dragStartScrollRef = useRef(0)
  const draggingRef = useRef(false)

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const rail = railRef.current
    if (!rail) return
    dragStartXRef.current = e.clientX
    dragLastXRef.current = e.clientX
    dragLastTimeRef.current = e.timeStamp
    dragStartScrollRef.current = rail.scrollLeft
    draggingRef.current = true
    setIsDragging(true)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const rail = railRef.current
    if (!rail) return
    const delta = e.clientX - dragStartXRef.current
    const stepDelta = e.clientX - dragLastXRef.current
    const dt = Math.max(16, e.timeStamp - dragLastTimeRef.current)
    if (Math.abs(delta) > 4 && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (Math.abs(stepDelta) > 0.5) sloshEngine.pushImpulse((-stepDelta / dt) * 2.4)
    dragLastXRef.current = e.clientX
    dragLastTimeRef.current = e.timeStamp
    rail.scrollLeft = dragStartScrollRef.current - delta
    e.preventDefault()
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  // A mouse wheel scrolls vertically; map it onto the rail so the row can be
  // moved without dragging at all.
  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const rail = railRef.current
    if (!rail || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    e.preventDefault()
    rail.scrollLeft += e.deltaY
    sloshEngine.pushImpulse((e.deltaY / 120) * 0.5)
  }

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
        </div>
      </SloshProvider>

      <p className="mx-auto max-w-4xl pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Kapseln — Gravur in Detailgröße
      </p>
      <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-center gap-8 pb-2">
        {PREVIEW_CAPSULES.map(c => (
          <CapsuleVisual key={c.name} name={c.name} color={c.color} size="large" />
        ))}
      </div>

      <p className="mx-auto max-w-4xl pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Tabletten — Bruchrille in Detailgröße
      </p>
      <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-center gap-10 pb-2">
        {PREVIEW_TABLETS.map(t => (
          <TabletVisual key={t.name} name={t.name} color={t.color} size="large" />
        ))}
      </div>

      <p className="mx-auto max-w-4xl pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Nasensprays — Kopf in Detailgröße
      </p>
      {/* Anders als Kapsel und Tablette hält das Nasenspray Flüssigkeit: ohne
          Provider stünde sie in der Detailreihe still. */}
      <SloshProvider engine={sloshEngine}>
        <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-center gap-10 pb-2">
          {PREVIEW_SPRAYS.map(s => (
            <NasalSprayVisual key={s.name} name={s.name} amount={s.amount} unit={s.unit} color={s.color} size="large" />
          ))}
        </div>
      </SloshProvider>

      <p className="mx-auto max-w-4xl pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Tuben — Oberlicht in Detailgröße
      </p>
      <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-center gap-10 pb-2">
        {PREVIEW_TUBES.map((t, i) => (
          <TubeVisual key={t.name} name={t.name} size="large" lightOffset={i - 1} />
        ))}
      </div>

      {/* The real thing: a mixed carousel narrow enough to actually swipe.
          Ampoules and vials share one ground line and one slosh engine. */}
      <p className="mx-auto max-w-sm pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Karussell — hier durchwischen
      </p>
      <SloshProvider engine={sloshEngine}>
        <div
          ref={railRef}
          className={`mx-auto flex max-w-sm items-end gap-6 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-6 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            isDragging ? 'cursor-grabbing snap-none' : 'cursor-grab snap-x snap-mandatory'
          }`}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          {MIXED_CAROUSEL.map((entry, index) => (
            <div key={`${entry.kind}-${entry.name}`} className={`shrink-0 ${isDragging ? '' : 'snap-center'}`}>
              {entry.kind === 'tube' ? (
                <TubeVisual
                  name={entry.name}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              ) : entry.kind === 'nasal_spray' ? (
                <NasalSprayVisual
                  name={entry.name}
                  amount={entry.amount}
                  unit={entry.unit}
                  color={entry.color}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              ) : entry.kind === 'tablet' ? (
                <TabletVisual
                  name={entry.name}
                  color={entry.color}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              ) : entry.kind === 'capsule' ? (
                <CapsuleVisual
                  name={entry.name}
                  color={entry.color}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              ) : entry.kind === 'ampoule' ? (
                <AmpouleVisual
                  name={entry.name}
                  amount={entry.amount}
                  unit={entry.unit}
                  color={entry.color}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              ) : (
                <PeptideVialVisual
                  name={entry.name}
                  amount={String(entry.amount)}
                  unit={entry.unit ?? 'mg'}
                  fillPct={entry.fillPct ?? 70}
                  color={entry.color}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              )}
            </div>
          ))}
        </div>
      </SloshProvider>
      <div className="mx-auto flex max-w-sm items-center justify-center gap-2 pt-3 text-xs text-slate-500">
        <button
          className="rounded-md border border-slate-700 px-3 py-1.5 hover:border-cyan-400 hover:text-cyan-200"
          onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
        >
          ← aktiv
        </button>
        <span className="tabular-nums">{activeIndex + 1} / {MIXED_CAROUSEL.length}</span>
        <button
          className="rounded-md border border-slate-700 px-3 py-1.5 hover:border-cyan-400 hover:text-cyan-200"
          onClick={() => setActiveIndex(i => Math.min(MIXED_CAROUSEL.length - 1, i + 1))}
        >
          aktiv →
        </button>
      </div>
    </div>
  )
}
