import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
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

/**
 * Eine Fluessigkeit, die stillsteht: fuer das vorbereitete, unsichtbare
 * Raster. Es haengt schon fertig gezeichnet im Hintergrund, kostet aber
 * kein einziges Bild, bis es aufgeht.
 */
const RUHENDE_ENGINE: SloshEngine = {
  pushImpulse: () => {},
  subscribe: callback => {
    callback({ tilt: 0, energy: 0, time: 0 })
    return () => {}
  },
  setEnabled: () => {},
  destroy: () => {},
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

/**
 * Das Objekt in einer Kachel. Gemerkt (`memo`): die Seite darueber rendert
 * beim Oeffnen neu, und jede Zeichnung neu aufzubauen kostete genau in dem
 * Moment, in dem die Animation beginnt, ein spuerbares Stocken.
 */
const KachelInhalt = memo(function KachelInhalt({ peptide, eingepasst = false }: {
  peptide: Peptide
  /**
   * Der Kasten hat schon die Masse des Objekts (der Flieger, gemessen am
   * eingepassten Objekt im Karussell): dann fuellt es ihn ganz. Sonst
   * schrumpfte es ein zweites Mal um den Groessenanteil seiner Form — eine
   * Tablette flog halb so gross und sprang am Ziel.
   */
  eingepasst?: boolean
}) {
  return (
    <StageFit
      className="h-full w-full"
      targetHeightRatio={eingepasst ? 1 : getDosageForm(peptide.dosage_form).stageHeightRatio ?? 1}
    >
      <StackStage
        item={{ ...peptide, color_hex: peptide.color_hex ?? getStableStackItemColor(peptide.id) }}
        fillPct={Math.round(getVialFillPct(peptide) ?? 100)}
        isActive={true}
        size="large"
      />
    </StageFit>
  )
})

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
  offen,
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
  /**
   * Das Raster haengt vorbereitet und unsichtbar bereit, damit beim Oeffnen
   * nur noch die Animation laeuft — nicht erst der Aufbau von zwanzig
   * Zeichnungen, der das erste Bild um eine halbe Sekunde verzoegerte.
   */
  offen: boolean
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
  const [schwellen, setSchwellen] = useState(() => erscheinSchwellen(peptides.length))

  const zoom = ZOOM_STUFEN[stufe]
  const aufteilung = useMemo(
    () => (mass ? seitenAufteilung(sichtbar.length, ZOOM_STUFEN[stufe], mass) : null),
    [mass, sichtbar.length, stufe],
  )
  const seiten = useMemo(() => (aufteilung ? seitenVon(sichtbar, aufteilung.proSeite) : []), [aufteilung, sichtbar])
  const fliegend = useMemo(() => peptides.find(p => p.id === aktiveId) ?? null, [aktiveId, peptides])

  const fortschritt = useRef(0)
  const feder = useRef<Feder>({ wert: 0, tempo: 0 })
  const bild = useRef<number | null>(null)
  /**
   * Der Flug: von wo nach wo, und ob der Flieger schon in seiner grossen
   * Groesse eingepasst ist (`bereit`) — bis dahin bleibt die Substanz an
   * ihrem Platz im Karussell sichtbar.
   */
  const flugBahn = useRef<{ id: string; von: Kasten; nach: Kasten; bereit: boolean } | null>(null)
  const fliegerRef = useRef<HTMLDivElement>(null)
  const quelleElement = useRef<HTMLElement | null>(null)
  /** Haben die Kacheln gerade eigene Grafikebenen (siehe `ebenen`)? */
  const ebenenAn = useRef(false)

  // ── Ein Bild aus `p` ──────────────────────────────────────────────────────
  const zeichne = useCallback((p: number) => {
    fortschritt.current = p
    const q = clamp01(p)
    // Der Rest loest sich zuerst auf (bis p = 0,45), die Substanzen folgen.
    if (hintergrundRef.current) {
      const h = clamp01(q / 0.45)
      // Weich an beiden Enden: kein hartes Einsetzen, kein Anschlag.
      hintergrundRef.current.style.opacity = String(h * h * (3 - 2 * h))
    }
    const bedienung = String(clamp01((q - 0.45) / 0.4))
    if (kopfRef.current) kopfRef.current.style.opacity = bedienung
    if (fussRef.current) fussRef.current.style.opacity = bedienung
    // Der Flieger: unterwegs sichtbar, am Ziel uebernimmt die Kachel.
    const bahn = flugBahn.current
    const unterwegs = bahn !== null && q < 0.9995
    const flieger = fliegerRef.current
    if (flieger) {
      if (bahn?.bereit && unterwegs) {
        const { dx, dy, skala } = flug(bahn.von, bahn.nach, q)
        flieger.style.visibility = 'visible'
        flieger.style.transform = `translate(${bahn.von.x + dx}px, ${bahn.von.y + dy}px) scale(${skala})`
      } else {
        flieger.style.visibility = 'hidden'
      }
    }
    peptides.forEach((peptide, index) => {
      const kachel = kachelnRef.current.get(peptide.id)
      if (!kachel) return
      if (bahn?.id === peptide.id) {
        kachel.style.opacity = unterwegs ? '0' : '1'
        kachel.style.transform = ''
        return
      }
      const k = kachelFortschritt(q, schwellen[index] ?? 0.3)
      if (k > 0 && ebenenAn.current && kachel.style.willChange !== 'transform, opacity') {
        kachel.style.willChange = 'transform, opacity'
      }
      kachel.style.opacity = String(k)
      kachel.style.transform = k >= 1 ? '' : `translateY(${(1 - k) * 14}px) scale(${0.9 + 0.1 * k})`
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
  /**
   * Misst Start und Ziel und bringt den Flieger in seine grosse Ausgangsgroesse.
   * `danach` laeuft, sobald er dort eingepasst ist (StageFit braucht dafuer
   * ein, zwei Bilder) — erst dann verschwindet die Substanz im Karussell und
   * der Flieger uebernimmt, ohne Luecke und ohne Sprung.
   */
  const vermessen = useCallback((danach?: () => void) => {
    flugBahn.current = null
    if (quelleElement.current) quelleElement.current.style.visibility = ''
    quelleElement.current = null
    const kachel = aktiveId ? kachelnRef.current.get(aktiveId) : null
    const herkunft = quelle()
    const vonKasten = herkunft?.querySelector('[data-stage-fit-box]')
    const nachKasten = kachel?.querySelector('[data-stage-fit-box]')
    const flieger = fliegerRef.current
    if (!kachel || !herkunft || !vonKasten || !nachKasten || !flieger) {
      danach?.()
      return
    }
    // Ohne Versatz messen, und auf ihrer Seite: sie fliegt dorthin, wo man
    // hinschaut.
    kachel.style.transform = ''
    const seiteDerKachel = Number(kachel.closest<HTMLElement>('[data-zoom-seite]')?.dataset.zoomSeite ?? 0)
    if (seiteDerKachel !== seite) zeigeSeite(seiteDerKachel)
    const von = kastenVon(vonKasten)
    const bahn = { id: kachel.dataset.zoomId ?? '', von, nach: kastenVon(nachKasten), bereit: false }
    flugBahn.current = bahn
    flieger.style.width = `${von.breite}px`
    flieger.style.height = `${von.hoehe}px`
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (flugBahn.current !== bahn) return
      bahn.bereit = true
      herkunft.style.visibility = 'hidden'
      quelleElement.current = herkunft
      zeichne(fortschritt.current)
      danach?.()
    }))
  }, [aktiveId, quelle, seite, zeichne, zeigeSeite])

  /**
   * Jede Kachel auf eine eigene Grafikebene, solange das Raster offen ist —
   * dann bewegt die Grafikkarte sie, und nichts muss neu gemalt werden.
   * Nicht pro Kachel an- und abschalten: jedes Abschalten malt die Kachel
   * neu, und am Ende der Animation fielen so alle auf einmal an (gemessen:
   * ein Stillstand von gut 400 ms bei gedrosselter Leistung).
   *
   * Angelegt wird jede Ebene erst, wenn ihre Kachel zu erscheinen beginnt
   * (in `zeichne`): alle auf einmal kosteten am Start gut 300 ms, so
   * verteilt es sich ueber die zufaellige Reihenfolge.
   */
  const ebenen = useCallback((an: boolean) => {
    if (ebenenAn.current === an) return
    ebenenAn.current = an
    if (!an) kachelnRef.current.forEach(kachel => { kachel.style.willChange = 'auto' })
  }, [])

  // ── Die Feder ─────────────────────────────────────────────────────────────
  const halteAn = () => {
    if (bild.current !== null) cancelAnimationFrame(bild.current)
    bild.current = null
  }

  const fertig = useCallback((ziel: 0 | 1) => {
    // Offen bleibt die Fluessigkeit still: im Raster steht sie (siehe
    // RUHENDE_ENGINE), und das Karussell darunter ist zugedeckt — jedes
    // Bild dafuer waere verschwendet. Erst zurueck im Karussell bewegt sie
    // sich wieder.
    sloshEngine.setEnabled(ziel === 0 && !bewegungAus() && !document.hidden)
    if (ziel === 0) {
      if (quelleElement.current) quelleElement.current.style.visibility = ''
      quelleElement.current = null
      flugBahn.current = null
      if (fliegerRef.current) fliegerRef.current.style.visibility = 'hidden'
      ebenen(false)
      // Beim naechsten Oeffnen: wieder „Alle", erste Stufe, eine neue Reihenfolge.
      setReiter('all')
      setStufe(0)
      setSchwellen(erscheinSchwellen(peptides.length))
      onGeschlossen()
    }
  }, [ebenen, onGeschlossen, peptides.length, sloshEngine])

  const laufeZu = useCallback((ziel: 0 | 1, startTempo = 0) => {
    halteAn()
    ebenen(true)
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
  }, [ebenen, fertig, sloshEngine, zeichne])

  const setzeFortschritt = useCallback((p: number) => {
    halteAn()
    ebenen(true)
    sloshEngine.setEnabled(false)
    zeichne(p)
  }, [ebenen, sloshEngine, zeichne])

  useImperativeHandle(handleRef, () => ({ setzeFortschritt, laufeZu }), [laufeZu, setzeFortschritt])

  const schliessen = useCallback(() => {
    halteAn()
    // Zurueck an den Platz, den das Karussell JETZT hat — es kann sich
    // inzwischen bewegt haben (Antippen einer anderen Substanz).
    requestAnimationFrame(() => {
      const p = fortschritt.current
      vermessen(() => laufeZu(0))
      zeichne(p)
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
  const aktuell = useRef({ offen, autoStart, stufe, wechsleStufe, setzeFortschritt, laufeZu, vermessen, zeichne, onZurueckZu, peptides })
  useLayoutEffect(() => {
    aktuell.current = { offen, autoStart, stufe, wechsleStufe, setzeFortschritt, laufeZu, vermessen, zeichne, onZurueckZu, peptides }
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
      if (e.touches.length !== 2 || !aktuell.current.offen) return
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

  // Oeffnen: ein Bild abwarten (StageFit misst in seinem eigenen
  // Layout-Effekt), dann vermessen und — vom Menue — die Feder starten. Die
  // Geste fuehrt `p` dagegen selbst.
  //
  // Erst im Bild selbst als gestartet merken: rendert die Seite darunter
  // vorher neu, wird dieses Bild abgebrochen und das naechste geplant.
  // Vorher gemerkt, fiel der Start dann ganz aus — das Raster blieb
  // unsichtbar.
  const gestartet = useRef(false)
  useEffect(() => {
    if (!offen) {
      gestartet.current = false
      return
    }
    if (!mass || gestartet.current) return
    const id = requestAnimationFrame(() => {
      gestartet.current = true
      const a = aktuell.current
      const autoStart = a.autoStart
      a.vermessen(() => { if (autoStart) aktuell.current.laufeZu(1) })
      a.zeichne(fortschritt.current)
    })
    return () => cancelAnimationFrame(id)
  }, [mass, offen])

  // Escape schliesst, wie bei jedem anderen Vollbild — aber nur, wenn
  // nichts darueber liegt. Sonst schloesse dieselbe Taste das Vollbild einer
  // Substanz UND das Raster darunter, und man landete im Karussell.
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !aktuell.current.offen) return
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
      data-zoom-raster={offen ? '' : undefined}
      data-zoom-raster-bereit
      data-zoom-stufe={stufe}
      data-app-modal={offen ? '' : undefined}
      role={offen ? 'dialog' : undefined}
      aria-modal={offen ? 'true' : undefined}
      aria-label={offen ? String(t('my_stack_view_grid')) : undefined}
      aria-hidden={offen ? undefined : true}
      className="fixed inset-0 z-[44]"
      // Vorbereitet: fertig aufgebaut, aber weder sichtbar noch antippbar.
      style={offen ? undefined : { visibility: 'hidden', pointerEvents: 'none' }}
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
          <SloshProvider engine={RUHENDE_ENGINE}>
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
                        style={{ opacity: 0 }}
                      >
                        <KachelInhalt peptide={p} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </LiquidBubblesContext.Provider>
          </SloshProvider>
        )}
      </div>

      {/* Der Flieger: die Substanz aus dem Karussell, in ihrer grossen
          Groesse gemalt, die nur noch schrumpft (siehe `flug`). Eine eigene
          Ebene — die Grafikkarte verkleinert sie, gemalt wird nichts. */}
      <div
        ref={fliegerRef}
        data-zoom-flieger
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-20"
        style={{ visibility: 'hidden', transformOrigin: '0 0', willChange: 'transform' }}
      >
        {fliegend && (
          <SloshProvider engine={RUHENDE_ENGINE}>
            <LiquidBubblesContext.Provider value={false}>
              <KachelInhalt peptide={fliegend} eingepasst />
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
