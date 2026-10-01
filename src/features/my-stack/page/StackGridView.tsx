import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { SloshEngine } from '../../../components/sloshEngine'
import { SloshProvider } from '../../../components/SloshContext'
import { StageFit } from '../components/StageFit'
import { StackStage } from '../components/StackStage'
import { getDosageForm } from '../lib/dosageForms'
import { getStableStackItemColor } from '../lib/colors'
import { RASTER_ABSTAND, rasterAufteilung } from '../lib/rasterAufteilung'
import { LiquidBubblesContext } from '../stage/liquidBubbles'
import { type Peptide, getVialFillPct } from './model'

/**
 * Das Raster: alle Substanzen auf einmal, so gross wie der Bildschirm es
 * hergibt (siehe `rasterAufteilung`). Eine Kachel ist nur das Objekt, der
 * Name steht auf seinem Etikett. Antippen oeffnet das Vollbild.
 *
 * Dieselbe Reihenfolge wie im Karussell — wer umschaltet, findet alles dort,
 * wo er es erwartet.
 */
export function StackGridView({
  peptides,
  reiterLeiste,
  sloshEngine,
  animationEpoch,
  onOpen,
}: {
  peptides: Peptide[]
  reiterLeiste: ReactNode
  sloshEngine: SloshEngine
  animationEpoch: number
  onOpen: (peptide: Peptide, kachel: HTMLElement) => void
}) {
  const flaecheRef = useRef<HTMLDivElement>(null)
  const [mass, setMass] = useState<{ breite: number; hoehe: number } | null>(null)

  // Layoutmasse der Flaeche unter den Reitern. Vor der ersten Messung steht
  // nichts da — sonst kaeme ein Bild mit falscher Spaltenzahl und danach ein
  // Sprung.
  useLayoutEffect(() => {
    const flaeche = flaecheRef.current
    if (!flaeche) return
    const messen = () => {
      const breite = flaeche.clientWidth
      const hoehe = flaeche.clientHeight
      setMass(vorher => (vorher && vorher.breite === breite && vorher.hoehe === hoehe ? vorher : { breite, hoehe }))
    }
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(flaeche)
    return () => beobachter.disconnect()
  }, [])

  const raster = mass ? rasterAufteilung({ anzahl: peptides.length, ...mass }) : null

  return (
    <div data-my-stack-grid className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pt-1">{reiterLeiste}</div>
      <div
        ref={flaecheRef}
        data-my-stack-grid-area
        data-raster-passt={raster ? String(raster.passt) : undefined}
        // Passt alles, steht das Raster mittig und nichts rollt. Sonst rollt
        // nur diese Flaeche, nicht die Seite.
        // `mb-3` und kein Innenabstand: der zaehlte zur gemessenen Hoehe, und
        // die unterste Reihe laege wieder auf der Tableiste.
        className={`mb-3 min-h-0 flex-1 ${
          raster && !raster.passt
            ? 'touch-pan-y overflow-y-auto overscroll-contain'
            : 'flex flex-col justify-center overflow-hidden'
        }`}
      >
        {raster && (
          <SloshProvider engine={sloshEngine}>
            <LiquidBubblesContext.Provider value={false}>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${raster.spalten}, minmax(0, 1fr))`,
                  gridAutoRows: `${raster.kachelHoehe}px`,
                  gap: RASTER_ABSTAND,
                }}
              >
                {peptides.map((p, index) => (
                  <button
                    key={p.id}
                    type="button"
                    data-grid-index={index}
                    aria-label={p.name}
                    onClick={event => onOpen(p, event.currentTarget)}
                    className="min-w-0 rounded-2xl transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-95"
                  >
                    <StageFit
                      className="h-full w-full"
                      targetHeightRatio={getDosageForm(p.dosage_form).stageHeightRatio ?? 1}
                    >
                      <StackStage
                        key={animationEpoch}
                        item={{ ...p, color_hex: p.color_hex ?? getStableStackItemColor(p.id) }}
                        fillPct={Math.round(getVialFillPct(p) ?? 100)}
                        animateOnMount={true}
                        isActive={true}
                        size="large"
                      />
                    </StageFit>
                  </button>
                ))}
              </div>
            </LiquidBubblesContext.Provider>
          </SloshProvider>
        )}
      </div>
    </div>
  )
}
