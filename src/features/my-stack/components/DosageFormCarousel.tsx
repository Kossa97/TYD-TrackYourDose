import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SloshProvider, useSloshEngine } from '../../../components/SloshContext'
import { isStageRenderable, type DosageFormDefinition } from '../lib/dosageForms'
import type { DosageFormKey } from '../types'
import { buehnenSkala } from '../lib/buehnenSkala'
import type { StageLightHandle } from '../stage/useStageLight'
import { DosageFormIcon } from './DosageFormIcon'
import { DosageFormPreview } from './DosageFormPreview'

// Eine Wischreihe. Die Mechanik ist die des Vial-Karussells auf der
// Peptid-Seite (`Peptide.tsx`, `updateVialFocus` und die Zeiger-Handler
// daneben) — dieselbe Reihenfolge der Schritte, dieselben Schwellen, damit
// sich beide Karussells hier genauso anfuehlen wie das, was es schon gibt.
//
// Entscheidend fuer die Fluessigkeit: waehrend des Wischens rendert React
// nicht. Jede Buehnenform meldet einen imperativen Griff an (`StageLightHandle`),
// und der Mess-Frame schreibt Licht und Fokus direkt in den DOM. Ueber
// React-State waere jedes Bild eine Renderrunde durch alle Objekte der Reihe.
//
// Der Standplatz ist ABSOLUT breit, nicht in Prozent. Das ist kein Detail:
// `paddingInline` verkleinert die content-box, auf die sich eine
// Prozentbreite des Kindes bezoege — der Standplatz waere schmaler als
// angeschrieben und seine Mitte laege neben der sichtbaren Mitte (gemessen:
// 10 px). Mit einer absoluten Breite geht die Rechnung auf, und
// `scrollPaddingInline` setzt den Snap-Punkt auf dieselbe Mitte.
const STANDPLATZ_BREITE = 'min(12rem, 50vw)'
const RANDABSTAND = `calc((100% - ${STANDPLATZ_BREITE}) / 2)`

// Ab hier gilt ein Zeigerzug als Wischen und nicht mehr als Klick.
const ZIEH_SCHWELLE = 4
// Sperre nach einer Radumdrehung, damit ein Wisch am Trackpad nicht durch die
// halbe Reihe rauscht.
const RAD_SPERRE_MS = 280

// Falloff wie im Vial-Karussell: direkt neben der Mitte noch gut sichtbar,
// am Rand nie ganz schwarz — man soll die Nachbarn erkennen koennen.
const FOKUS_BODEN = 0.22
const FOKUS_ABFALL = 0.78

// Verstaerkung, mit der Wischbewegung in die Fluessigkeitsphysik geht —
// dieselben Werte wie im Vial-Karussell.
const SCHWAPP_AUS_SCROLL = 2.6
const SCHWAPP_AUS_ZUG = 2.4

function fokusAusAbstand(distanzAnteil: number): number {
  return Math.max(FOKUS_BODEN, 1 - Math.abs(distanzAnteil) * FOKUS_ABFALL)
}

export interface DosageFormCarouselProps {
  formen: readonly DosageFormDefinition[]
  /** Die gewaehlte Form — auch dann, wenn sie in der anderen Reihe steht. */
  value: DosageFormKey | null
  colorHex?: string | null
  /** Farbe fuer die gewaehlte Form, solange keine eigene gesetzt ist. */
  akzentfarbe: string
  labelId: string
  // Nur die vordere Reihe waehlt beim Start ihre erste Form vor. In der
  // Reihe „Weitere Darreichungsformen" waere das eine Behauptung: dort steht
  // nichts, was zu dieser Substanz passt.
  waehltBeimStart?: boolean
  onSelect: (dosageForm: DosageFormKey) => void
}

export function DosageFormCarousel({
  formen,
  value,
  colorHex,
  akzentfarbe,
  labelId,
  waehltBeimStart = false,
  onSelect,
}: DosageFormCarouselProps) {
  const { t } = useTranslation()
  const reiheRef = useRef<HTMLDivElement | null>(null)
  const gewaehltRef = useRef<HTMLButtonElement | null>(null)
  const sloshEngine = useSloshEngine()

  // Die Groessen haengen am Platz und aendern sich nur, wenn er sich aendert —
  // das darf durch React. Licht und Fokus dagegen nicht: sie aendern sich mit
  // jedem Bild des Wischens.
  const [skalaJeForm, setSkalaJeForm] = useState<Partial<Record<DosageFormKey, number>>>({})
  // Waehrend des Ziehens wird das CSS-Snapping abgeschaltet. Sonst zieht der
  // Browser bei jedem gesetzten `scrollLeft` sofort zum naechsten Snap-Punkt
  // zurueck — die Reihe klebt fest und laesst sich nicht wischen. Beim
  // Loslassen faengt sie das Objekt in der Mitte wieder ein (siehe
  // `beendeZug`). Genauso macht es das Vial-Karussell.
  const [zieht, setZieht] = useState(false)

  // Die imperativen Griffe der Buehnenformen, einer je Form.
  const griffeRef = useRef(new Map<DosageFormKey, StageLightHandle>())
  const fokusFrameRef = useRef<number | null>(null)
  const auswahlFrameRef = useRef<number | null>(null)
  // Was zuletzt der Mitte am naechsten war. Ein Wechsel dagegen darf die
  // Auswahl aendern; der erste, geratene Wert beim Start nicht — sonst
  // waehlte sich das Formular beim Oeffnen selbst etwas aus.
  const letzterRef = useRef<DosageFormKey | null>(null)
  const ziehtRef = useRef(false)
  const startXRef = useRef(0)
  const startScrollRef = useRef(0)
  const letzteXRef = useRef(0)
  const letzteZeitRef = useRef(0)
  const letzterScrollRef = useRef(0)
  const letzteScrollZeitRef = useRef(0)
  const bewegtRef = useRef(false)
  const klickSperreRef = useRef(false)
  const radSperreRef = useRef<number | null>(null)

  function objektRahmen(reihe: HTMLDivElement, key: DosageFormKey): DOMRect | null {
    const el = reihe.querySelector<HTMLElement>(`[data-dosage-key="${key}"]`)
    return el ? el.getBoundingClientRect() : null
  }

  // Gemessen wird in Bildschirmkoordinaten, nicht ueber `offsetLeft`.
  // `offsetLeft` zaehlt vom offsetParent, und ob die Reihe selbst einer ist,
  // haengt an einer CSS-Regel — genau daran sass die Mitte schon einmal 29 px
  // daneben, und beim Wischen galt der Nachbar als zentriert.
  function naechstesZurMitte(reihe: HTMLDivElement): DosageFormKey | null {
    const rahmen = reihe.getBoundingClientRect()
    const mitte = rahmen.left + rahmen.width / 2
    let naechster: DosageFormKey | null = null
    let kuerzeste = Number.POSITIVE_INFINITY

    for (const form of formen) {
      const objekt = objektRahmen(reihe, form.key)
      if (!objekt) continue
      const abstand = Math.abs(objekt.left + objekt.width / 2 - mitte)
      if (abstand < kuerzeste) {
        kuerzeste = abstand
        naechster = form.key
      }
    }
    return naechster
  }

  // Erst alles messen, dann alles schreiben: ein Lesen zwischen zwei Schreiben
  // zwingt den Browser zu einem Zwischenlayout, und genau daran ruckelt es.
  function buehnenlichtMessen(): void {
    const reihe = reiheRef.current
    if (!reihe) return

    const rahmen = reihe.getBoundingClientRect()
    const mitte = rahmen.left + rahmen.width / 2
    const spanne = Math.max(1, rahmen.width * 0.48)

    const gemessen: Array<{ key: DosageFormKey; normiert: number; knopf: HTMLElement }> = []
    for (const form of formen) {
      const knopf = reihe.querySelector<HTMLElement>(`[data-dosage-key="${form.key}"]`)
      if (!knopf) continue
      const objekt = knopf.getBoundingClientRect()
      const abstand = (objekt.left + objekt.width / 2 - mitte) / spanne
      gemessen.push({ key: form.key, normiert: Math.max(-1, Math.min(1, abstand)), knopf })
    }

    for (const { key, normiert, knopf } of gemessen) {
      const fokus = fokusAusAbstand(normiert)
      // Das Licht wandert mit: steht das Objekt links der Mitte, faellt es von
      // rechts. Dieselbe Umkehrung wie im Vial-Karussell.
      griffeRef.current.get(key)?.setStageLight(fokus, -normiert)
      // Der Spot unter dem Objekt folgt derselben Zahl — auch er direkt im
      // DOM, sonst waere die halbe Ersparnis wieder weg.
      const spot = knopf.querySelector<HTMLElement>('[data-dosage-spot]')
      if (spot) spot.style.opacity = String(Math.max(0, (fokus - FOKUS_BODEN) / (1 - FOKUS_BODEN)))
    }
  }

  function buehnenlichtPlanen(): void {
    if (fokusFrameRef.current !== null) return
    fokusFrameRef.current = window.requestAnimationFrame(() => {
      fokusFrameRef.current = null
      buehnenlichtMessen()
    })
  }

  function schwappen(geschwindigkeit: number): void {
    sloshEngine.pushImpulse(geschwindigkeit)
  }

  function scrollZu(key: DosageFormKey, sanft: boolean): void {
    const reihe = reiheRef.current
    const el = reihe?.querySelector<HTMLElement>(`[data-dosage-key="${key}"]`)
    el?.scrollIntoView?.({
      behavior: sanft ? 'smooth' : 'auto',
      block: 'nearest',
      inline: 'center',
    })
    window.requestAnimationFrame(buehnenlichtMessen)
  }

  // Bringt die Objekte auf die Buehnenhoehe, die die Reihe gerade hat — und
  // lockert dabei den Maßstab untereinander (siehe `buehnenSkala`).
  // `offsetHeight`/`offsetWidth` statt `getBoundingClientRect`, weil sie die
  // transform-Skalierung ignorieren; sonst maesse die zweite Messung die
  // erste mit und die Objekte schaukelten sich auf.
  function skalenMessen(): void {
    const reihe = reiheRef.current
    if (!reihe) return
    const platzHoehe = reihe.clientHeight
    const ersterKnopf = reihe.querySelector<HTMLElement>('[data-dosage-key]')
    const platzBreite = ersterKnopf?.offsetWidth ?? 0
    if (!platzHoehe || !platzBreite) return

    const nativ = new Map<DosageFormKey, { hoehe: number; breite: number }>()
    for (const form of formen) {
      const el = reihe.querySelector<HTMLElement>(
        `[data-dosage-key="${form.key}"] [data-dosage-form-preview]`,
      )
      if (el && el.offsetHeight > 0 && el.offsetWidth > 0) {
        nativ.set(form.key, { hoehe: el.offsetHeight, breite: el.offsetWidth })
      }
    }
    if (nativ.size === 0) return

    const groessteHoehe = Math.max(...[...nativ.values()].map(masse => masse.hoehe))
    const skalen: Partial<Record<DosageFormKey, number>> = {}
    for (const [key, masse] of nativ) {
      skalen[key] = buehnenSkala({ ...masse, groessteHoehe, platzHoehe, platzBreite })
    }
    setSkalaJeForm(vorher => ({ ...vorher, ...skalen }))
  }

  // Erstes Bild: Licht setzen. Im naechsten Frame statt sofort — gemessen
  // werden kann erst, wenn der Browser die Reihe gelegt hat.
  //
  // Und die vordere Reihe waehlt dabei ihre erste Form vor. Die steht beim
  // Oeffnen ohnehin zentriert; sie unbeleuchtet und ungefaerbt dort stehen zu
  // lassen, hiesse dem Nutzer eine Mitte zu zeigen, die nichts bedeutet. Das
  // ist kein stilles Auswaehlen: man sieht sie hervorgehoben, und ihr Name
  // steht darunter.
  useEffect(() => {
    const erste = formen[0]
    if (waehltBeimStart && !value && erste) {
      letzterRef.current = erste.key
      onSelect(erste.key)
    }
    const frame = window.requestAnimationFrame(buehnenlichtMessen)
    return () => window.cancelAnimationFrame(frame)
    // Nur beim ersten Bild — welche Formen es gibt, aendert sich danach nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Die Buehnenhoehe haengt am verfuegbaren Platz, und der aendert sich: beim
  // Drehen, beim Aufziehen der Tastatur, beim Wechsel des Fensters. Das erste
  // Messen kommt vom Beobachter selbst — `observe` meldet die aktuelle
  // Groesse sofort.
  useEffect(() => {
    const reihe = reiheRef.current
    if (!reihe || typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(() => skalenMessen())
    beobachter.observe(reihe)
    return () => beobachter.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Eine Auswahl, die von aussen kommt, wird ins Bild geholt: beim Bearbeiten
  // eines bestehenden Eintrags kann die gewaehlte Form weit rechts liegen.
  //
  // Aber nur von aussen. Vorher lief das bei jedem `value`-Wechsel und ohne
  // `smooth` — also auch mitten im Wischen, sobald die Mitte auf die naechste
  // Form uebersprang: die Reihe wurde hart auf sie geschossen. Genau das war
  // das abrupte Springen nach einer gewissen Strecke. Kam der Wechsel aus
  // dieser Reihe selbst (`letzterRef`), rastet ohnehin das CSS-Snapping
  // sanft ein, und hier ist nichts zu tun.
  const ersterLaufRef = useRef(true)
  useEffect(() => {
    const warErsterLauf = ersterLaufRef.current
    ersterLaufRef.current = false
    if (!value || !formen.some(form => form.key === value)) return
    if (letzterRef.current === value) return

    letzterRef.current = value
    // Beim ersten Bild sofort — da soll es von Anfang an richtig stehen.
    // Danach gleitend, weil jemand zugesehen hat.
    scrollZu(value, !warErsterLauf)
    // `formen` steht fest, sobald der Katalogeintrag gewaehlt ist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => () => {
    if (fokusFrameRef.current !== null) window.cancelAnimationFrame(fokusFrameRef.current)
    if (auswahlFrameRef.current !== null) window.cancelAnimationFrame(auswahlFrameRef.current)
    if (radSperreRef.current !== null) window.clearTimeout(radSperreRef.current)
  }, [])

  function beiScroll(ereignis: React.UIEvent<HTMLDivElement>): void {
    const reihe = reiheRef.current
    if (!reihe) return

    // Die Wischgeschwindigkeit treibt die Fluessigkeit an — aus dem Scrollen
    // selbst, damit auch der Schwung nach dem Loslassen noch schwappt.
    const jetzt = ereignis.timeStamp
    if (letzteScrollZeitRef.current > 0) {
      const weg = reihe.scrollLeft - letzterScrollRef.current
      const dt = Math.max(16, jetzt - letzteScrollZeitRef.current)
      if (Math.abs(weg) > 0.5) schwappen((weg / dt) * SCHWAPP_AUS_SCROLL)
    }
    letzterScrollRef.current = reihe.scrollLeft
    letzteScrollZeitRef.current = jetzt

    buehnenlichtPlanen()

    // Die Auswahl haengt an einem eigenen Frame, der bei jedem weiteren
    // Scroll-Ereignis verworfen wird: gemeldet wird erst, wenn die Reihe zur
    // Ruhe kommt, nicht bei jedem Zwischenbild. Nur dieser Teil geht durch
    // React — einmal je Wechsel, nicht einmal je Bild.
    if (auswahlFrameRef.current !== null) window.cancelAnimationFrame(auswahlFrameRef.current)
    auswahlFrameRef.current = window.requestAnimationFrame(() => {
      auswahlFrameRef.current = null
      const naechster = naechstesZurMitte(reihe)
      if (naechster && naechster !== letzterRef.current) onSelect(naechster)
      if (naechster) letzterRef.current = naechster
    })
  }

  function beginneZug(ereignis: React.PointerEvent<HTMLDivElement>): void {
    // Nur die linke Maustaste: Finger und Stift scrollen nativ, ein zweiter
    // Antrieb daneben laeuft gegen den ersten.
    if (ereignis.pointerType !== 'mouse' || ereignis.button !== 0) return
    const reihe = reiheRef.current
    if (!reihe) return

    startXRef.current = ereignis.clientX
    letzteXRef.current = ereignis.clientX
    letzteZeitRef.current = ereignis.timeStamp
    startScrollRef.current = reihe.scrollLeft
    letzterScrollRef.current = reihe.scrollLeft
    letzteScrollZeitRef.current = ereignis.timeStamp
    ziehtRef.current = true
    bewegtRef.current = false
    setZieht(true)
  }

  function fuehreZug(ereignis: React.PointerEvent<HTMLDivElement>): void {
    if (!ziehtRef.current) return
    const reihe = reiheRef.current
    if (!reihe) return

    const weg = ereignis.clientX - startXRef.current
    const schritt = ereignis.clientX - letzteXRef.current
    const dt = Math.max(16, ereignis.timeStamp - letzteZeitRef.current)
    if (Math.abs(weg) > ZIEH_SCHWELLE) {
      bewegtRef.current = true
      if (!ereignis.currentTarget.hasPointerCapture(ereignis.pointerId)) {
        ereignis.currentTarget.setPointerCapture(ereignis.pointerId)
      }
    }
    if (Math.abs(schritt) > 0.5) schwappen((-schritt / dt) * SCHWAPP_AUS_ZUG)
    letzteXRef.current = ereignis.clientX
    letzteZeitRef.current = ereignis.timeStamp
    reihe.scrollLeft = startScrollRef.current - weg
    ereignis.preventDefault()
  }

  function beendeZug(ereignis: React.PointerEvent<HTMLDivElement>): void {
    if (!ziehtRef.current) return
    ziehtRef.current = false
    setZieht(false)
    if (ereignis.currentTarget.hasPointerCapture(ereignis.pointerId)) {
      ereignis.currentTarget.releasePointerCapture(ereignis.pointerId)
    }
    if (!bewegtRef.current) return

    // Wer gezogen hat, wollte wischen — nicht die Form waehlen, die beim
    // Loslassen zufaellig unter dem Zeiger lag.
    klickSperreRef.current = true
    window.setTimeout(() => { klickSperreRef.current = false }, 0)

    // Von Hand einfangen, was das abgeschaltete CSS-Snapping jetzt nicht tut.
    const reihe = reiheRef.current
    const naechster = reihe ? naechstesZurMitte(reihe) : null
    if (naechster) scrollZu(naechster, true)
  }

  // Am Schreibtisch gibt es kein Wischen: das Mausrad scrollt vertikal, und
  // ein `overflow-x-auto` nimmt davon nichts an. Eine Radumdrehung rueckt die
  // Reihe deshalb um ein Objekt weiter — wie im Vial-Karussell.
  function beiRad(ereignis: React.WheelEvent<HTMLDivElement>): void {
    if (formen.length <= 1) return
    if (Math.abs(ereignis.deltaY) <= Math.abs(ereignis.deltaX)) return
    const reihe = reiheRef.current
    if (!reihe) return

    ereignis.preventDefault()
    if (radSperreRef.current !== null) return

    const mitte = naechstesZurMitte(reihe)
    const index = formen.findIndex(form => form.key === mitte)
    if (index < 0) return
    const richtung = ereignis.deltaY > 0 ? 1 : -1
    const ziel = formen[Math.min(formen.length - 1, Math.max(0, index + richtung))]
    if (ziel && ziel.key !== mitte) {
      schwappen(richtung)
      scrollZu(ziel.key, true)
    }

    radSperreRef.current = window.setTimeout(() => { radSperreRef.current = null }, RAD_SPERRE_MS)
  }

  function beiKlick(key: DosageFormKey): void {
    if (klickSperreRef.current) return
    schwappen(1)
    onSelect(key)
  }

  const renderForm = (form: DosageFormDefinition) => {
    const selected = value === form.key
    // Der Startwert, bis der erste Mess-Frame laeuft. Danach kommt der Fokus
    // nur noch imperativ durch den Griff — React sieht davon nichts mehr.
    const startFokus = selected ? 1 : 0.55
    const skala = skalaJeForm[form.key] ?? 1

    return (
      <button
        key={form.key}
        ref={selected ? gewaehltRef : undefined}
        data-dosage-key={form.key}
        // Genau ein Objekt im ganzen Feld traegt diese Marke. Zwei Karussells
        // heissen zwei Mitten: in beiden Reihen steht gleichzeitig etwas
        // zentriert und hell, aber nur eines davon ist wirklich gewaehlt.
        data-dosage-active={selected || undefined}
        type="button"
        aria-pressed={selected}
        // Ohne Aufschrift unter dem Objekt braucht der Knopf seinen Namen hier.
        aria-label={String(t(form.labelKey))}
        onClick={() => beiKlick(form.key)}
        // min-h-11: die 44-px-Regel fuer Tippziele. Der Standplatz ist mit der
        // Reihe ohnehin hoeher, aber der Vertrag steht am Knopf, nicht am
        // Inhalt — sonst faellt er beim naechsten Umbau still weg.
        className={`flex h-full min-h-11 shrink-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
          zieht ? '' : 'snap-center'
        }`}
        style={{ width: STANDPLATZ_BREITE }}
      >
        <span className="relative flex h-full w-full items-end justify-center px-2" aria-hidden="true">
          {/* Das Licht liegt UNTER dem Objekt, wie ein Spot auf der Buehne,
              und es ist gewoehnliches Buehnenlicht — fuer jedes Objekt
              dasselbe. Es sagt nur, was in der Mitte steht. Was gewaehlt ist,
              sagt die Farbe im Objekt selbst. Die Deckkraft setzt der
              Mess-Frame direkt, nicht React. */}
          <span
            data-dosage-spot
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 rounded-full bg-[radial-gradient(62%_60%_at_50%_78%,rgba(255,255,255,0.16),transparent_70%)]"
            style={{ opacity: Math.max(0, (startFokus - FOKUS_BODEN) / (1 - FOKUS_BODEN)) }}
          />
          {isStageRenderable(form.key) ? (
            // Der Skalierrahmen sitzt um das Objekt, nicht um den ganzen
            // Standplatz: das Licht darunter gehoert der Buehne und wuerde
            // sonst mitwachsen. Vom Boden aus skaliert, damit alle Objekte auf
            // derselben Linie stehen bleiben. Die Skala haengt nur am Platz,
            // nicht an der Auswahl — ein Objekt, das beim Wischen groesser
            // wird, macht die Reihe unruhig.
            <span className="origin-bottom" style={{ transform: `scale(${skala})` }}>
              <DosageFormPreview
                dosageForm={form.key}
                // Gefaerbt ist nur die gewaehlte Form — das ist hier das
                // Zeichen fuer „gewaehlt", nicht das Licht. Steht noch keine
                // eigene Eintragsfarbe fest (sie kommt erst im Schritt
                // danach), traegt sie das Cyanblau der App.
                colorHex={selected ? (colorHex?.trim() || akzentfarbe) : null}
                size="carousel"
                showLabel={false}
                focus={startFokus}
                sloshEngine={sloshEngine}
                stageLightRef={griff => {
                  if (griff) griffeRef.current.set(form.key, griff)
                  else griffeRef.current.delete(form.key)
                }}
              />
            </span>
          ) : (
            <span className={`relative pb-8 ${selected ? 'text-sky-300' : 'text-slate-500'}`}>
              <DosageFormIcon form={form.key} size={40} />
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    // Die Physik gehoert der Reihe: Formen mit Inhalt (Tablette, Gel, Ampulle,
    // Tropfen, Sprays) haengen sich per Context daran und zeichnen aus ihr,
    // ohne dass React sie dafuer neu rendert.
    <SloshProvider engine={sloshEngine}>
      <div
        ref={reiheRef}
        role="group"
        aria-labelledby={labelId}
        onScroll={beiScroll}
        onPointerDown={beginneZug}
        onPointerMove={fuehreZug}
        onPointerUp={beendeZug}
        onPointerCancel={beendeZug}
        onWheel={beiRad}
        // Die Kanten laufen weich aus. Ohne Scrollbalken ist das der einzige
        // Hinweis, dass die Reihe weitergeht — ein hart abgeschnittenes Objekt
        // am Rand liest sich als Fehler, ein ausblendendes als Fortsetzung.
        className={`relative flex min-h-0 flex-1 select-none gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)] ${
          zieht ? 'cursor-grabbing snap-none' : 'cursor-grab snap-x snap-mandatory'
        }`}
        style={{ paddingInline: RANDABSTAND, scrollPaddingInline: RANDABSTAND }}
      >
        {formen.map(renderForm)}
      </div>
    </SloshProvider>
  )
}
