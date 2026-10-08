/**
 * Ablesen im Verlauf eines Blutwerts — wie in der Aktien-App: senkrechte
 * Linie am naechsten Messpunkt, darueber ein Schild mit Datum und Wert.
 *
 * Eigene Zeigerereignisse statt Recharts-Tooltip: dessen onMouseMove kommt
 * beim Fingerziehen nicht an. Maus folgt sofort; Finger nach waagerechtem
 * Ziehen oder kurzem Halten (senkrecht bleibt Scrollen der Seite).
 * Tastatur: Pfeile springen von Punkt zu Punkt, Escape beendet.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { hapticTick } from '../../../lib/haptics'

export interface ScrubPoint { t: number; value: number }

interface Props {
  points: ScrubPoint[]
  /** Zeitachse [Start, Ende] in ms — dieselbe wie die X-Achse des Graphen. */
  domain: [number, number]
  /** Abstand der Zeichenflaeche links/rechts/oben (px). */
  plotLeft: number
  plotRight: number
  plotTop: number
  /** Hoehe der Zeichenflaeche ohne X-Achse (px). */
  plotBottom: number
  color: string
  renderLabel: (point: ScrubPoint) => ReactNode
  describe: (point: ScrubPoint) => string
  ariaLabel: string
  children: ReactNode
}

const HOLD_MS = 180
const DRAG_PX = 6

export function ScrubOverlay({
  points, domain, plotLeft, plotRight, plotTop, plotBottom, color, renderLabel, describe, ariaLabel, children,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState<number | null>(null)
  const [breite, setBreite] = useState(0)
  const geste = useRef<{ id: number; x: number; y: number; aktiv: boolean; hold: number | null } | null>(null)

  // Liegt der Index nach einem Datenwechsel ausserhalb, gilt er nicht mehr.
  const punkt = index != null && index < points.length ? points[index] : null

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const messen = () => setBreite(el.clientWidth)
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(messen)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const xOf = (t: number) =>
    plotLeft + ((t - domain[0]) / Math.max(1, domain[1] - domain[0])) * (breite - plotLeft - plotRight)

  const naechster = (clientX: number): number | null => {
    const el = wrapRef.current
    if (!el || !points.length) return null
    const x = clientX - el.getBoundingClientRect().left
    let best = 0
    let bestDist = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(xOf(p.t) - x)
      if (d < bestDist) { bestDist = d; best = i }
    })
    return best
  }

  const setze = (i: number | null) => {
    setIndex(prev => {
      if (prev !== i && i != null && prev != null) void hapticTick()
      return i
    })
  }

  const ende = () => {
    const g = geste.current
    if (g?.hold != null) window.clearTimeout(g.hold)
    geste.current = null
    setIndex(null)
  }

  // Schild mittig ueber der Linie, aber am Rand angeschlagen — gemessen, nicht geschaetzt.
  useLayoutEffect(() => {
    const label = labelRef.current
    if (!label || !punkt) return
    const half = label.offsetWidth / 2
    const x = Math.min(Math.max(xOf(punkt.t), half), breite - half)
    label.style.left = `${x}px`
  })

  const linieX = punkt ? xOf(punkt.t) : null

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', outline: 'none' }}
      onPointerDown={e => {
        if (e.pointerType === 'mouse') { setze(naechster(e.clientX)); return }
        const x = e.clientX
        geste.current = { id: e.pointerId, x, y: e.clientY, aktiv: false, hold: null }
        geste.current.hold = window.setTimeout(() => {
          const g = geste.current
          if (!g || g.aktiv) return
          g.aktiv = true
          setze(naechster(x))
        }, HOLD_MS)
      }}
      onPointerMove={e => {
        if (e.pointerType === 'mouse') { setze(naechster(e.clientX)); return }
        const g = geste.current
        if (!g || g.id !== e.pointerId) return
        if (!g.aktiv) {
          const dx = Math.abs(e.clientX - g.x)
          const dy = Math.abs(e.clientY - g.y)
          if (dy > DRAG_PX && dy > dx) { ende(); return }
          if (dx < DRAG_PX) return
          g.aktiv = true
          if (g.hold != null) window.clearTimeout(g.hold)
          try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
        }
        setze(naechster(e.clientX))
      }}
      onPointerUp={e => { if (e.pointerType !== 'mouse') ende() }}
      onPointerCancel={ende}
      onPointerLeave={e => { if (e.pointerType === 'mouse') ende() }}
      onBlur={ende}
      onKeyDown={e => {
        if (!points.length) return
        if (e.key === 'Escape') { ende(); return }
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
        e.preventDefault()
        const start = index ?? (e.key === 'ArrowLeft' ? points.length : -1)
        setze(Math.min(points.length - 1, Math.max(0, start + (e.key === 'ArrowLeft' ? -1 : 1))))
      }}
      onContextMenu={e => e.preventDefault()}
    >
      {children}
      {punkt && linieX != null && (
        <>
          <div
            aria-hidden="true"
            style={{ position: 'absolute', left: linieX, top: plotTop - 6, height: plotBottom - plotTop + 6, width: 1, background: color, pointerEvents: 'none' }}
          />
          <div
            ref={labelRef}
            aria-hidden="true"
            data-bw-scrub-label
            style={{ position: 'absolute', top: 0, left: linieX, transform: 'translateX(-50%)', textAlign: 'center', whiteSpace: 'nowrap', pointerEvents: 'none' }}
          >
            {renderLabel(punkt)}
          </div>
        </>
      )}
      {/* Immer da, damit Screenreader den Wechsel ansagen. */}
      <p className="sr-only" aria-live="polite">{punkt ? describe(punkt) : ''}</p>
    </div>
  )
}
