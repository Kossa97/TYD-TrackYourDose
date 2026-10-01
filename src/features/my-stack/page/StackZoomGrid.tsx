import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
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
  STUFE_DICHTER_AB,
  STUFE_WEITER_AB,
  ZOOM_STUFEN,
  clamp01,
  erscheinSchwellen,
  federRuht,
  federSchritt,
  fingerSkala,
  flug,
  fortschrittHinaus,
  kachelFortschritt,
  seitenAufteilung,
  zielBeimLoslassen,
  type Feder,
  type Kasten,
} from '../lib/rasterZoom'
import { LiquidBubblesContext } from '../stage/liquidBubbles'
import { filterByTab, tabCounts, type StackTabKey } from '../lib/stackTabs'
import { StackTabBar } from './StackTabBar'
import { type Peptide, getVialFillPct } from './model'

/** Von aussen steuerbar — fuer die Zoom-Geste im Karussell, die `p` mit den Fingern fuehrt. */
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

function fingerAbstand(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function fingerMitte(touches: TouchList): { x: number; y: number } {
  const [a, b] = [touches[0], touches[1]]
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
}

/** In Seiten zu je `proSeite` aufteilen. */
function seitenVon<T>(liste: T[], proSeite: number): T[][] {
  const seiten: T[][] = []
  for (let i = 0; i < liste.length; i += proSeite) seiten.push(liste.slice(i, i + proSeite))
  return seiten
}

/**
 * Das Raster im Vollbild: alle Substanzen, nur ein X, unten die Reiter.
 *
 * Der Uebergang aus dem Karussell haengt an einem Fortschritt `p`:
 * - der Hintergrund deckt alles andere zu (Kopf, Reiter, Tableiste) — es
 *   loest sich auf, statt wegzuspringen;
 * - die Substanz, die im Karussell stand, schrumpft und fliegt an ihren Platz;
 * - die uebrigen tauchen an ihren Plaetzen auf, in zufaelliger Reihenfolge.
 * Jedes Bild wird direkt in die Stile geschrieben, ohne React: waehrend des
 * Uebergangs rendert nichts neu, bewegt werden nur Verschiebung, Groesse und
 * Deckkraft. Die Fluessigkeit steht in der Zeit still.
 *
 * Die Aufteilung richtet sich nach der Anzahl (im gewaehlten Reiter) und dem
 * Bildschirm (`seitenAufteilung`); was nicht auf eine Seite passt, kommt auf
 * die naechste — gewischt, nicht gerollt. Zwei Finger: zusammen = dichter,
 * auseinander = weiter, und in der naechsten Stufe auseinander zurueck ins
 * Karussell, zu der Substanz unter den Fingern.
 */
export function StackZoomGrid({
  peptides,
  aktiveId,
  quelle,
  sloshEngine,
  onOpen,
  onGeschlossen,
  onZurueckZu,
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
  /** Die Geste fuehrt zurueck ins Karussell — zu dieser Substanz. */
  onZurueckZu?: (peptide: Peptide) => void
  autoStart?: boolean
  handleRef?: Ref<ZoomRasterHandle>
}) {
  const { t } = useTranslation()
  const wurzelRef = useRef<HTMLDivElement>(null)
  const flaecheRef = useRef<HTMLDivElement>(null)
  const hintergrundRef = useRef<HTMLDivElement>(null)
  const kopfRef = useRef<HTMLDivElement>(null)
  const fussRef = useRef<HTMLDivElement>(null)
  const kachelnRef = useRef(new Map<string, HTMLButtonElement>())
  const [mass, setMass] = useState<{ breite: number; hoehe: number } | null>(null)
  const [stufe, setStufe] = useState(0)
  const [seite, setSeite] = useState(0)
  // Die Reiter unten filtern das Raster; es oeffnet immer mit „Alle".
  const [reiter, setReiter] = useState<StackTabKey>('all')
  const reiterZaehler = useMemo(() => tabCounts(peptides), [peptides])
  const sichtbar = useMemo(() => (reiter === 'all' ? peptides : filterByTab(peptides, reiter)), [peptides, reiter])
  // Je Oeffnen neu gewuerfelt: jedes Mal eine andere Reihenfolge.
  const [schwellen] = useState(() => erscheinSchwellen(peptides.length))

  const zoom = ZOOM_STUFEN[stufe]
  const aufteilung = useMemo(
    () => (mass ? seitenAufteilung(sichtbar.length, ZOOM_STUFEN[stufe], mass) : null),
    [mass, sichtbar.length, stufe],
  )
  const seiten = useMemo(() => (aufteilung ? seitenVon(sichtbar, aufteilung.proSeite) : []), [aufteilung, sichtbar])

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
    const bedienung = String(clamp01((q - 0.45) / 0.4))
    if (kopfRef.current) kopfRef.current.style.opacity = bedienung
    if (fussRef.current) fussRef.current.style.opacity = bedienung
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

  /** Zur Seite blaettern, ohne Animation — fuer alles, was gleich gemessen wird. */
  const zeigeSeite = useCallback((index: number) => {
    const flaeche = flaecheRef.current
    if (!flaeche) return
    flaeche.scrollLeft = index * flaeche.clientWidth
    setSeite(index)
  }, [])

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
    // ihrem eigenen Ergebnis. Und auf ihrer Seite: sie fliegt dorthin, wo
    // man hinschaut.
    kachel.style.transform = ''
    const seiteDerKachel = Number(kachel.closest<HTMLElement>('[data-zoom-seite]')?.dataset.zoomSeite ?? 0)
    if (seiteDerKachel !== seite) zeigeSeite(seiteDerKachel)
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
  }, [aktiveId, quelle, seite, zeigeSeite])

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

  // ── Zoomstufe wechseln, mit den Kacheln an ihre neuen Plaetze gleitend ────
  const vorherigeKaesten = useRef<Map<string, DOMRect> | null>(null)
  const ersteSichtbare = useRef<string | null>(null)
  const wechsleStufe = (neu: number) => {
    if (neu < 0 || neu >= ZOOM_STUFEN.length || neu === stufe) return
    const kaesten = new Map<string, DOMRect>()
    kachelnRef.current.forEach((kachel, id) => kaesten.set(id, kachel.getBoundingClientRect()))
    vorherigeKaesten.current = kaesten
    // Wer gerade oben links auf der Seite steht, bleibt im Blick.
    const aufSeite = aufteilung ? sichtbar[seite * aufteilung.proSeite] : undefined
    ersteSichtbare.current = aufSeite?.id ?? null
    setStufe(neu)
  }

  useLayoutEffect(() => {
    const vorher = vorherigeKaesten.current
    if (!vorher || !aufteilung) return
    vorherigeKaesten.current = null
    const fokus = ersteSichtbare.current
    const fokusIndex = fokus ? sichtbar.findIndex(p => p.id === fokus) : 0
    zeigeSeite(Math.max(0, Math.floor(Math.max(0, fokusIndex) / aufteilung.proSeite)))
    if (bewegungAus()) return
    kachelnRef.current.forEach((kachel, id) => {
      const alt = vorher.get(id)
      if (!alt) return
      const neu = kachel.getBoundingClientRect()
      if (!neu.width) return
      const dx = alt.left + alt.width / 2 - (neu.left + neu.width / 2)
      const dy = alt.top + alt.height / 2 - (neu.top + neu.height / 2)
      const s = alt.width / neu.width
      kachel.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }],
        { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    })
  }, [stufe, aufteilung, sichtbar, zeigeSeite])

  // ── Zwei Finger im Raster ─────────────────────────────────────────────────
  // Die Griffe als Refs, damit die Lauscher nicht bei jedem Rendern neu
  // angehaengt werden muessen — und mitten in der Geste nicht verloren gehen.
  const aktuell = useRef({ stufe, wechsleStufe, setzeFortschritt, laufeZu, vermessen, zeichne, onZurueckZu, peptides })
  useLayoutEffect(() => {
    aktuell.current = { stufe, wechsleStufe, setzeFortschritt, laufeZu, vermessen, zeichne, onZurueckZu, peptides }
  })

  useEffect(() => {
    const wurzel = wurzelRef.current
    if (!wurzel) return
    let geste: {
      start: number
      modus: 'stufe' | 'zurueck'
      verlauf: Array<{ zeit: number; p: number }>
    } | null = null

    const beiStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      geste = { start: fingerAbstand(e.touches), modus: 'stufe', verlauf: [] }
    }
    const beiBewegung = (e: TouchEvent) => {
      if (!geste || e.touches.length !== 2) return
      e.preventDefault()
      const a = aktuell.current
      const abstand = fingerAbstand(e.touches)
      const skala = fingerSkala(geste.start, abstand)
      if (geste.modus === 'stufe') {
        if (skala < STUFE_DICHTER_AB && a.stufe < ZOOM_STUFEN.length - 1) {
          a.wechsleStufe(a.stufe + 1)
          geste.start = abstand
        } else if (skala > STUFE_WEITER_AB) {
          if (a.stufe > 0) {
            a.wechsleStufe(a.stufe - 1)
            geste.start = abstand
          } else {
            // Naechste Stufe ist das Karussell: zu der Substanz unter den Fingern.
            const mitte = fingerMitte(e.touches)
            const unter = document.elementFromPoint(mitte.x, mitte.y)?.closest<HTMLElement>('[data-zoom-id]')
            const ziel = a.peptides.find(p => p.id === unter?.dataset.zoomId)
            if (ziel) a.onZurueckZu?.(ziel)
            geste.start = abstand
            geste.modus = 'zurueck'
            // Erst nach dem Rendern messen: das Karussell hat sich darunter
            // auf die neue Substanz eingestellt.
            requestAnimationFrame(() => requestAnimationFrame(() => {
              aktuell.current.vermessen()
              aktuell.current.zeichne(fortschritt.current)
            }))
          }
        }
        return
      }
      const p = fortschrittHinaus(skala)
      geste.verlauf.push({ zeit: performance.now(), p })
      if (geste.verlauf.length > 5) geste.verlauf.shift()
      a.setzeFortschritt(p)
    }
    const beiEnde = (e: TouchEvent) => {
      if (!geste || e.touches.length >= 2) return
      const ende = geste
      geste = null
      if (ende.modus !== 'zurueck') return
      const erster = ende.verlauf[0]
      const letzter = ende.verlauf[ende.verlauf.length - 1]
      const tempo = erster && letzter && letzter.zeit > erster.zeit
        // Lagen die Finger zuletzt still, gibt es keinen Schwung mehr.
        && performance.now() - letzter.zeit < 100
        ? ((letzter.p - erster.p) / (letzter.zeit - erster.zeit)) * 1000
        : 0
      aktuell.current.laufeZu(zielBeimLoslassen(fortschritt.current, tempo), tempo)
    }
    // Safari zoomt sonst die ganze Seite mit (eigene Gesten-Ereignisse).
    const keinSeitenZoom = (e: Event) => e.preventDefault()
    wurzel.addEventListener('touchstart', beiStart, { passive: false })
    wurzel.addEventListener('touchmove', beiBewegung, { passive: false })
    wurzel.addEventListener('touchend', beiEnde)
    wurzel.addEventListener('touchcancel', beiEnde)
    wurzel.addEventListener('gesturestart', keinSeitenZoom)
    wurzel.addEventListener('gesturechange', keinSeitenZoom)
    return () => {
      wurzel.removeEventListener('touchstart', beiStart)
      wurzel.removeEventListener('touchmove', beiBewegung)
      wurzel.removeEventListener('touchend', beiEnde)
      wurzel.removeEventListener('touchcancel', beiEnde)
      wurzel.removeEventListener('gesturestart', keinSeitenZoom)
      wurzel.removeEventListener('gesturechange', keinSeitenZoom)
    }
  }, [])

  // ── Flaeche messen ────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const flaeche = flaecheRef.current
    if (!flaeche) return
    const messen = () => {
      // Jede Seite hat links und rechts 12 px Rand.
      const breite = flaeche.clientWidth - 24
      const hoehe = flaeche.clientHeight
      setMass(vorher => (vorher && vorher.breite === breite && vorher.hoehe === hoehe ? vorher : { breite, hoehe }))
    }
    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(flaeche)
    return () => beobachter.disconnect()
  }, [])

  // Jedes neue Rendern (die Seite darunter aktualisiert sich, die Flaeche
  // aendert ihre Groesse, ein anderer Reiter, eine andere Stufe) zeichnet den
  // AKTUELLEN Stand neu — anfangs 0: alles unsichtbar.
  useLayoutEffect(() => { zeichne(fortschritt.current) }, [zeichne, mass, reiter, stufe])

  // Ein anderer Reiter beginnt auf der ersten Seite.
  useLayoutEffect(() => { zeigeSeite(0) }, [reiter, zeigeSeite])

  // Oeffnen, sobald die Kacheln eingepasst sind (StageFit misst in seinem
  // eigenen Layout-Effekt — also ein Bild abwarten).
  const gestartet = useRef(false)
  useEffect(() => {
    if (!mass || gestartet.current) return
    // Erst im Bild selbst als gestartet merken: rendert die Seite darunter
    // vorher neu (andere Rueckruffunktionen), wird dieses Bild abgebrochen
    // und das naechste geplant. Vorher gemerkt, fiel der Start dann ganz
    // aus — das Raster blieb unsichtbar.
    const id = requestAnimationFrame(() => {
      gestartet.current = true
      vermessen()
      zeichne(fortschritt.current)
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

  return createPortal(
    <div
      ref={wurzelRef}
      data-zoom-raster
      data-zoom-stufe={stufe}
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

      {/* Die Seiten liegen nebeneinander und rasten beim Wischen ein. */}
      <div
        ref={flaecheRef}
        data-zoom-raster-flaeche
        onScroll={event => {
          const flaeche = event.currentTarget
          const index = Math.round(flaeche.scrollLeft / Math.max(1, flaeche.clientWidth))
          if (index !== seite) setSeite(index)
        }}
        className="no-scrollbar absolute inset-x-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-contain"
        style={{ top: 'calc(4.25rem + env(safe-area-inset-top))', bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        {aufteilung && (
          <SloshProvider engine={sloshEngine}>
            <LiquidBubblesContext.Provider value={false}>
              {seiten.map((inhalt, seitenIndex) => (
                <div
                  key={seitenIndex}
                  data-zoom-seite={seitenIndex}
                  className="flex h-full w-full shrink-0 snap-start snap-always items-center justify-center px-3"
                >
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${aufteilung.spalten}, ${aufteilung.kachelBreite}px)`,
                      gridTemplateRows: `repeat(${aufteilung.zeilen}, ${aufteilung.kachelHoehe}px)`,
                      gap: zoom.abstand,
                    }}
                  >
                    {inhalt.map(p => (
                      <button
                        key={p.id}
                        ref={element => {
                          if (element) kachelnRef.current.set(p.id, element)
                          else kachelnRef.current.delete(p.id)
                        }}
                        type="button"
                        data-zoom-index={peptides.indexOf(p)}
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
              ))}
            </LiquidBubblesContext.Provider>
          </SloshProvider>
        )}
      </div>

      {/* Unten: Seitenpunkte und Reiter — dort ist Platz, und der Daumen
          kommt hin. Sie erscheinen mit dem X. */}
      <div
        ref={fussRef}
        className="absolute inset-x-0 bottom-0 px-3 pb-[calc(0.25rem+env(safe-area-inset-bottom))]"
        style={{ opacity: 0 }}
      >
        <div data-zoom-seiten className="mb-2 flex h-3 items-center justify-center gap-1.5" aria-hidden={seiten.length < 2}>
          {seiten.length > 1 && seiten.map((_, index) => (
            <span
              key={index}
              data-zoom-seitenpunkt={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${index === seite ? 'w-4 bg-cyan-300' : 'w-1.5 bg-slate-600'}`}
            />
          ))}
        </div>
        <StackTabBar counts={reiterZaehler} openTab={reiter} onSelect={setReiter} />
      </div>
    </div>,
    document.body,
  )
}
