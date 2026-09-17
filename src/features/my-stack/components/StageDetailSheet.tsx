import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Das Vollbild hinter einem Objekt der Buehne.
 *
 * Der Uebergang ist FLIP: das angetippte Objekt wird an seinem Platz im
 * Karussell GEMESSEN, im Vollbild an seiner Zielstelle gezeichnet, und die
 * Differenz zwischen beiden als `transform` abgespielt. Damit bewegt sich
 * nichts im Layout — nur eine Matrix —, und es laeuft in jeder WebView, ohne
 * dass wir erst Browserunterstuetzung fuer die View-Transitions-API pruefen
 * muessen.
 *
 * Die Objekte sind SVG mit `viewBox`, deshalb ist das Verkleinern verlustfrei
 * und braucht kein zweites Bild.
 */
export interface StageDetailSheetProps {
  /** Rechteck des angetippten Objekts im Karussell, in Bildschirmkoordinaten. */
  originRect: DOMRect
  /** Das Objekt selbst — dieselbe Buehne, nur kleiner. */
  stage: ReactNode
  title: string
  subtitle?: string | null
  children: ReactNode
  onClose: () => void
  /** Waehrend des Flugs still: schwappende Fluessigkeit im Flug wirkt falsch. */
  onFlightChange?: (imFlug: boolean) => void
}

const FLUGDAUER_MS = 340

function magBewegen(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function StageDetailSheet({
  originRect, stage, title, subtitle, children, onClose, onFlightChange,
}: StageDetailSheetProps) {
  const objektRef = useRef<HTMLDivElement>(null)
  const [gelandet, setGelandet] = useState(false)
  const bewegen = magBewegen()

  useLayoutEffect(() => {
    const objekt = objektRef.current
    if (!objekt || !bewegen) {
      setGelandet(true)
      return
    }

    // FIRST ist `originRect`, LAST ist die Stelle, an der das Objekt jetzt
    // steht. INVERT: die Differenz als Transform setzen, ohne Uebergang.
    const ziel = objekt.getBoundingClientRect()
    if (ziel.width === 0 || ziel.height === 0) {
      setGelandet(true)
      return
    }
    const skala = originRect.width / ziel.width
    const dx = originRect.left - ziel.left
    const dy = originRect.top - ziel.top

    onFlightChange?.(true)
    objekt.style.transition = 'none'
    objekt.style.transformOrigin = 'top left'
    objekt.style.transform = `translate(${dx}px, ${dy}px) scale(${skala})`

    // Lesen erzwingt den Umbruch, damit der Startzustand wirklich gilt —
    // ohne das fasst der Browser beide Schreibvorgaenge zusammen und es gibt
    // gar keine Bewegung.
    void objekt.getBoundingClientRect()

    const bild = requestAnimationFrame(() => {
      objekt.style.transition = `transform ${FLUGDAUER_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      objekt.style.transform = 'none'
    })
    const gelandetAb = window.setTimeout(() => {
      setGelandet(true)
      onFlightChange?.(false)
    }, FLUGDAUER_MS)

    return () => {
      cancelAnimationFrame(bild)
      window.clearTimeout(gelandetAb)
      onFlightChange?.(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zurueck mit der Escape-Taste, wie bei jedem anderen Vollbild auch.
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', beiTaste)
    return () => window.removeEventListener('keydown', beiTaste)
  }, [onClose])

  return (
    <div
      data-stage-detail
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-slate-950"
    >
      <div className="flex items-center justify-end p-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="grid min-h-11 min-w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col items-center px-4">
        <div ref={objektRef} data-stage-detail-object className="will-change-transform">
          {stage}
        </div>
        <h2 className="mt-3 text-center text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-center text-sm text-slate-400">{subtitle}</p>}
      </div>

      {/* Erst wenn das Objekt steht, kommen die Angaben — gestaffelt, damit
          man dem Blick folgt statt alles auf einmal hinzuwerfen. */}
      <div
        data-stage-detail-body
        className={`mt-4 flex-1 px-3 pb-8 transition-all duration-300 ${
          gelandet ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
