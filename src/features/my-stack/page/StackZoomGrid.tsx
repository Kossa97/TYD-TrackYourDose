import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { SloshEngine } from '../../../components/sloshEngine'
import { SloshProvider } from '../../../components/SloshContext'
import { StageFit } from '../components/StageFit'
import { StackStage } from '../components/StackStage'
import { getDosageForm } from '../lib/dosageForms'
import { getStableStackItemColor } from '../lib/colors'
import {
  ZOOM_STUFEN,
  clamp01,
  erscheinSchwellen,
  federRuht,
  federSchritt,
  flug,
  kachelFortschritt,
  kachelMass,
  type Feder,
  type Kasten,
} from '../lib/rasterZoom'
import { LiquidBubblesContext } from '../stage/liquidBubbles'
import { type Peptide, getVialFillPct } from './model'

/** Von aussen steuerbar — fuer die Zoom-Geste, die `p` mit den Fingern fuehrt. */
export interface ZoomRasterHandle {
  /** `p` direkt setzen, ohne Feder (die Finger bewegen). */
  setzeFortschritt: (p: number) => void
  /** Mit der Feder nach 0 (zurueck ins Karussell) oder 1 (Raster) laufen. */
  laufeZu: (ziel: 0 | 1, startTempo?: number) => void
}

function bewegungAus(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
}

function kastenVon(element: Element): Kasten {
  const r = element.getBoundingClientRect()
  return { x: r.left, y: r.top, breite: r.width, hoehe: r.height }
}

/**
 * Das Raster im Vollbild: alle Substanzen, nur ein X.
 *
 * Der Uebergang aus dem Karussell haengt an einem Fortschritt `p`:
 * - der Hintergrund deckt alles andere zu (Kopf, Reiter, Tableiste) — es
 *   loest sich auf, statt wegzuspringen;
 * - die Substanz, die im Karussell stand, schrumpft und fliegt an ihren Platz;
 * - die uebrigen tauchen an ihren Plaetzen auf, in zufaelliger Reihenfolge.
 *
 * Jedes Bild wird direkt in die Stile geschrieben, ohne React: waehrend des
 * Uebergangs rendert nichts neu, und bewegt werden nur Verschiebung, Groesse
 * und Deckkraft — das rechnet die Grafikkarte. Die Fluessigkeit steht in der
 * Zeit still, wie beim Flug ins Vollbild.
 */
export function StackZoomGrid({
  peptides,
  aktiveId,
  quelle,
  sloshEngine,
  onOpen,
  onGeschlossen,
  autoStart = true,
  handleRef,
}: {
  peptides: Peptide[]
  /** Die Substanz, die gerade im Karussell steht — sie fliegt. */
  aktiveId: string | null
  /** Ihr Platz im Karussell (der Eintrag, nicht der Kasten); `null` ohne Karussell. */
  quelle: () => HTMLElement | null
  sloshEngine: SloshEngine
  onOpen: (peptide: Peptide, kachel: HTMLElement) => void
  onGeschlossen: () => void
  autoStart?: boolean
  handleRef?: Ref<ZoomRasterHandle>
}) {
  const { t } = useTranslation()
  const wurzelRef = useRef<HTMLDivElement>(null)
  const flaecheRef = useRef<HTMLDivElement>(null)
  const hintergrundRef = useRef<HTMLDivElement>(null)
  const kopfRef = useRef<HTMLDivElement>(null)
  const kachelnRef = useRef(new Map<string, HTMLButtonElement>())
  const [mass, setMass] = useState<{ breite: number; hoehe: number } | null>(null)
  const [stufe] = useState(0)
  // Je Oeffnen neu gewuerfelt: jedes Mal eine andere Reihenfolge.
  const [schwellen] = useState(() => erscheinSchwellen(peptides.length))

  const fortschritt = useRef(0)
  const feder = useRef<Feder>({ wert: 0, tempo: 0 })
  const bild = useRef<number | null>(null)
  const flugBahn = useRef<{ id: string; von: Kasten; nach: Kasten; ursprung: { x: number; y: number } } | null>(null)
  const quelleElement = useRef<HTMLElement | null>(null)

  // ── Ein Bild aus `p` ──────────────────────────────────────────────────────
  const zeichne = useCallback((p: number) => {
    fortschritt.current = p
    const q = clamp01(p)
    // Der Rest loest sich zuerst auf (bis p = 0,45), die Substanzen folgen.
    if (hintergrundRef.current) hintergrundRef.current.style.opacity = String(clamp01(q / 0.45))
    if (kopfRef.current) kopfRef.current.style.opacity = String(clamp01((q - 0.45) / 0.4))
    peptides.forEach((peptide, index) => {
      const kachel = kachelnRef.current.get(peptide.id)
      if (!kachel) return
      const bahn = flugBahn.current?.id === peptide.id ? flugBahn.current : null
      if (bahn) {
        // Die fliegende Substanz darf ueber 1 hinausschwingen: die Feder
        // laesst sie einen Hauch kleiner werden und zuruecksetzen.
        const { dx, dy, skala } = flug(bahn.von, bahn.nach, p)
        kachel.style.opacity = '1'
        kachel.style.transformOrigin = `${bahn.ursprung.x}px ${bahn.ursprung.y}px`
        kachel.style.transform = Math.abs(p - 1) < 0.0005 ? '' : `translate(${dx}px, ${dy}px) scale(${skala})`
        return
      }
      const k = kachelFortschritt(q, schwellen[index] ?? 0.3)
      kachel.style.opacity = String(k)
      kachel.style.transformOrigin = ''
      kachel.style.transform = k >= 1 ? '' : `translateY(${(1 - k) * 10}px) scale(${0.86 + 0.14 * k})`
    })
  }, [peptides, schwellen])

  // ── Wo die Substanz herkommt und hinfliegt ────────────────────────────────
  const vermessen = useCallback(() => {
    flugBahn.current = null
    if (quelleElement.current) quelleElement.current.style.visibility = ''
    quelleElement.current = null
    const kachel = aktiveId ? kachelnRef.current.get(aktiveId) : null
    const herkunft = quelle()
    const vonKasten = herkunft?.querySelector('[data-stage-fit-box]')
    const nachKasten = kachel?.querySelector('[data-stage-fit-box]')
    if (!kachel || !herkunft || !vonKasten || !nachKasten) return
    // Ohne den eigenen Versatz messen, sonst misst sich die Rechnung an
    // ihrem eigenen Ergebnis.
    kachel.style.transform = ''
    const flaeche = flaecheRef.current
    const k = kachel.getBoundingClientRect()
    if (flaeche) {
      const f = flaeche.getBoundingClientRect()
      if (k.top < f.top || k.bottom > f.bottom) kachel.scrollIntoView({ block: 'center' })
    }
    const nach = kastenVon(nachKasten)
    const kachelJetzt = kachel.getBoundingClientRect()
    flugBahn.current = {
      id: kachel.dataset.zoomId ?? '',
      von: kastenVon(vonKasten),
      nach,
      ursprung: { x: nach.x - kachelJetzt.left, y: nach.y - kachelJetzt.top },
    }
    herkunft.style.visibility = 'hidden'
    quelleElement.current = herkunft
  }, [aktiveId, quelle])

  // ── Die Feder ─────────────────────────────────────────────────────────────
  const halteAn = () => {
    if (bild.current !== null) cancelAnimationFrame(bild.current)
    bild.current = null
  }

  const fertig = useCallback((ziel: 0 | 1) => {
    sloshEngine.setEnabled(!bewegungAus() && !document.hidden)
    if (ziel === 0) {
      if (quelleElement.current) quelleElement.current.style.visibility = ''
      quelleElement.current = null
      onGeschlossen()
    }
  }, [onGeschlossen, sloshEngine])

  const laufeZu = useCallback((ziel: 0 | 1, startTempo = 0) => {
    halteAn()
    sloshEngine.setEnabled(false)
    if (bewegungAus()) {
      zeichne(ziel)
      fertig(ziel)
      return
    }
    feder.current = { wert: fortschritt.current, tempo: startTempo }
    let zuletzt = performance.now()
    const schritt = (jetzt: number) => {
      const dt = (jetzt - zuletzt) / 1000
      zuletzt = jetzt
      feder.current = federSchritt(feder.current, ziel, dt)
      if (federRuht(feder.current, ziel)) {
        bild.current = null
        zeichne(ziel)
        fertig(ziel)
        return
      }
      zeichne(feder.current.wert)
      bild.current = requestAnimationFrame(schritt)
    }
    bild.current = requestAnimationFrame(schritt)
  }, [fertig, sloshEngine, zeichne])

  const setzeFortschritt = useCallback((p: number) => {
    halteAn()
    sloshEngine.setEnabled(false)
    zeichne(p)
  }, [sloshEngine, zeichne])

  useImperativeHandle(handleRef, () => ({ setzeFortschritt, laufeZu }), [laufeZu, setzeFortschritt])

  const schliessen = useCallback(() => {
    halteAn()
    // Zurueck an den Platz, den das Karussell JETZT hat — es kann sich
    // inzwischen bewegt haben (Antippen einer anderen Substanz).
    requestAnimationFrame(() => {
      const p = fortschritt.current
      vermessen()
      zeichne(p)
      laufeZu(0)
    })
  }, [laufeZu, vermessen, zeichne])

  // ── Flaeche messen ────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const flaeche = flaecheRef.current
    if (!flaeche) return
    const messen = () => {
      const stil = getComputedStyle(flaeche)
      const breite = flaeche.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight)
      const hoehe = flaeche.clientHeight - parseFloat(stil.paddingTop) - parseFloat(stil.paddingBottom)
      setMass(vorher => (vorher && vorher.breite === breite && vorher.hoehe === hoehe ? vorher : { breite, hoehe }))
    }
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(flaeche)
    return () => beobachter.disconnect()
  }, [])

  // Jedes neue Rendern (die Seite darunter aktualisiert sich, die Flaeche
  // aendert ihre Groesse) zeichnet den AKTUELLEN Stand neu — anfangs 0:
  // alles unsichtbar, das Karussell steht noch unveraendert da.
  useLayoutEffect(() => { zeichne(fortschritt.current) }, [zeichne, mass])

  // Oeffnen, sobald die Kacheln eingepasst sind (StageFit misst in seinem
  // eigenen Layout-Effekt — also ein Bild abwarten).
  const gestartet = useRef(false)
  useEffect(() => {
    if (!mass || gestartet.current) return
    gestartet.current = true
    const id = requestAnimationFrame(() => {
      vermessen()
      zeichne(0)
      if (autoStart) laufeZu(1)
    })
    return () => cancelAnimationFrame(id)
  }, [autoStart, laufeZu, mass, vermessen, zeichne])

  // Escape schliesst, wie bei jedem anderen Vollbild — aber nur, wenn
  // nichts darueber liegt. Sonst schloesse dieselbe Taste das Vollbild einer
  // Substanz UND das Raster darunter, und man landete im Karussell.
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const wurzel = wurzelRef.current
      const darueber = [...document.querySelectorAll('[data-app-modal], [role="dialog"][aria-modal="true"]')]
        .some(element => element !== wurzel && !wurzel?.contains(element))
      if (!darueber) schliessen()
    }
    window.addEventListener('keydown', beiTaste)
    return () => window.removeEventListener('keydown', beiTaste)
  }, [schliessen])

  // Aufraeumen: nichts darf versteckt oder angehalten zurueckbleiben.
  useEffect(() => () => {
    if (bild.current !== null) cancelAnimationFrame(bild.current)
    if (quelleElement.current) quelleElement.current.style.visibility = ''
    sloshEngine.setEnabled(!bewegungAus() && !document.hidden)
  }, [sloshEngine])

  const zoom = ZOOM_STUFEN[stufe]
  const kachel = mass ? kachelMass(zoom, mass) : null

  return createPortal(
    <div
      ref={wurzelRef}
      data-zoom-raster
      data-app-modal
      role="dialog"
      aria-modal="true"
      aria-label={String(t('my_stack_view_grid'))}
      className="fixed inset-0 z-[44]"
    >
      {/* Deckt alles andere zu: Kopf, Reiter, Tableiste loesen sich darin auf. */}
      <div ref={hintergrundRef} className="absolute inset-0" style={{ opacity: 0, background: 'var(--c-bg)' }} />

      <div
        ref={kopfRef}
        className="absolute inset-x-0 top-0 z-10 flex justify-end pl-[calc(0.75rem+env(safe-area-inset-left))] pr-[calc(0.75rem+env(safe-area-inset-right))] pt-[calc(0.75rem+env(safe-area-inset-top))]"
        style={{ opacity: 0 }}
      >
        <button
          type="button"
          onClick={schliessen}
          data-app-back-close
          aria-label={String(t('close'))}
          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200 backdrop-blur transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div
        ref={flaecheRef}
        data-zoom-raster-flaeche
        className="absolute inset-x-0 bottom-0 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-1"
        style={{ top: 'calc(4.25rem + env(safe-area-inset-top))' }}
      >
        {kachel && (
          <SloshProvider engine={sloshEngine}>
            <LiquidBubblesContext.Provider value={false}>
              <div className="flex min-h-full flex-col justify-center">
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${zoom.spalten}, minmax(0, 1fr))`,
                    gridAutoRows: `${kachel.hoehe}px`,
                    gap: zoom.abstand,
                  }}
                >
                  {peptides.map((p, index) => (
                    <button
                      key={p.id}
                      ref={element => {
                        if (element) kachelnRef.current.set(p.id, element)
                        else kachelnRef.current.delete(p.id)
                      }}
                      type="button"
                      data-zoom-index={index}
                      data-zoom-id={p.id}
                      aria-label={p.name}
                      onClick={event => onOpen(p, event.currentTarget)}
                      className="min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      // Unsichtbar bis zum ersten Bild — kein Aufblitzen.
                      style={{ opacity: 0, willChange: 'transform, opacity' }}
                    >
                      <StageFit
                        className="h-full w-full"
                        targetHeightRatio={getDosageForm(p.dosage_form).stageHeightRatio ?? 1}
                      >
                        <StackStage
                          item={{ ...p, color_hex: p.color_hex ?? getStableStackItemColor(p.id) }}
                          fillPct={Math.round(getVialFillPct(p) ?? 100)}
                          isActive={true}
                          size="large"
                        />
                      </StageFit>
                    </button>
                  ))}
                </div>
              </div>
            </LiquidBubblesContext.Provider>
          </SloshProvider>
        )}
      </div>
    </div>,
    document.body,
  )
}
