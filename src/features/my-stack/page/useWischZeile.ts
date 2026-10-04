import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Wischen nach links an einer Listenzeile — so, wie man es von iOS kennt
 * (Mail, Erinnerungen):
 *
 * - Die Zeile klebt am Finger, 1:1, ohne dass React dabei rendert: Lage und
 *   Aktionsbreite werden direkt am Element gesetzt (`translate3d`, eigene
 *   GPU-Ebene). Vorher renderte jede Fingerbewegung die ganze Zeile samt
 *   Objekt neu — das ruckelte.
 * - Richtung wird nach wenigen Pixeln festgelegt: waagerecht gehoert die
 *   Geste der Zeile (und die Seite scrollt nicht mit, `touchmove` wird
 *   abgefangen), senkrecht bleibt sie Scrollen.
 * - Nach rechts und ueber den Rand hinaus gibt die Zeile federnd nach
 *   (Gummiband), statt hart anzuschlagen.
 * - Beim Loslassen zaehlt der Schwung: ein kurzes Schnippen oeffnet oder
 *   schliesst, egal wie weit. Dann laeuft eine Feder mit genau dieser
 *   Geschwindigkeit weiter — kein Knick zwischen Finger und Animation.
 * - Weit durchgewischt (ueber `VOLL_ANTEIL` der Zeilenbreite) faellt
 *   „Loeschen" ueber die ganze Breite; Loslassen loest es aus (mit
 *   Rueckfrage, wie ueberall).
 *
 * Touch laeuft ueber Touch-Ereignisse (nur dort laesst sich das Scrollen
 * waehrend der Geste sicher unterbinden), Maus und Stift ueber Pointer-Ereignisse.
 */

/** So weit oeffnet die Zeile, um beide Aktionen zu zeigen. */
export const OFFEN_BREITE = 144
/** Ab diesem Anteil der Zeilenbreite gilt das Wischen als „ganz durch". */
export const VOLL_ANTEIL = 0.62
/** Erst ab dieser Strecke steht die Richtung fest — darunter ein Tipp. */
const RICHTUNG_AB = 8
/** Schnippen: ab dieser Geschwindigkeit (px/ms) entscheidet die Richtung. */
const SCHWUNG_AB = 0.3

/**
 * Gummiband wie in UIKit: je weiter ueber den Rand, desto zaeher, nie
 * weiter als `grenze`.
 */
export function gummiband(ueber: number, grenze: number): number {
  if (ueber <= 0) return 0
  return (1 - 1 / ((ueber * 0.55) / grenze + 1)) * grenze
}

/** Wohin die Zeile beim Loslassen geht: offen, zu oder ganz durch. */
export function zielBeimLoslassen(x: number, geschwindigkeit: number, breite: number): 'offen' | 'zu' | 'voll' {
  if (-x > breite * VOLL_ANTEIL) return 'voll'
  if (geschwindigkeit < -SCHWUNG_AB) return 'offen'
  if (geschwindigkeit > SCHWUNG_AB) return 'zu'
  return -x > OFFEN_BREITE / 2 ? 'offen' : 'zu'
}

/**
 * Geschwindigkeit beim Loslassen (px/ms) aus den letzten Proben. Hat der
 * Finger vor dem Abheben stillgehalten, ist sie null — sonst schnellte eine
 * Zeile, die man bewusst auf halber Strecke abgelegt hat, noch davon.
 */
export function loslassGeschwindigkeit(proben: readonly { x: number; t: number }[], jetzt: number): number {
  const letzte = proben[proben.length - 1]
  if (!letzte || jetzt - letzte.t > 80) return 0
  const erste = proben[0]
  return letzte.t > erste.t ? (letzte.x - erste.x) / (letzte.t - erste.t) : 0
}

/** Rohe Fingerstrecke → Lage der Zeile, mit Gummiband an beiden Enden. */
export function lageAusStrecke(roh: number, breite: number): number {
  if (roh > 0) return gummiband(roh, 48)
  const ganz = breite * 0.92
  if (-roh > ganz) return -(ganz + gummiband(-roh - ganz, 36))
  return roh
}

/**
 * Gedaempfte Feder, Schritt fuer Schritt (halbimplizites Euler). Leicht
 * unterkritisch: ein Hauch Nachschwingen, wie bei iOS.
 * `v` in px/s. Gibt die neue Lage und Geschwindigkeit zurueck.
 */
export function federSchritt(x: number, v: number, ziel: number, dt: number): [number, number] {
  const steifigkeit = 520
  const daempfung = 42
  const a = -steifigkeit * (x - ziel) - daempfung * v
  const vNeu = v + a * dt
  return [x + vNeu * dt, vNeu]
}

interface Geste {
  startX: number
  startY: number
  basis: number
  richtung: 'h' | 'v' | null
  proben: { x: number; t: number }[]
}

export function useWischZeile({ offen, onOffen, onVoll }: {
  offen: boolean
  onOffen: (offen: boolean) => void
  /** Ganz durchgewischt und losgelassen. */
  onVoll: () => void
}) {
  const zeileRef = useRef<HTMLLIElement | null>(null)
  const vorneRef = useRef<HTMLButtonElement | null>(null)
  const aktionenRef = useRef<HTMLDivElement | null>(null)
  const lage = useRef(offen ? -OFFEN_BREITE : 0)
  const ziel = useRef(offen ? -OFFEN_BREITE : 0)
  const animation = useRef<number | null>(null)
  const geste = useRef<Geste | null>(null)
  const voll = useRef(false)
  const gewischt = useRef(false)
  // Die Rueckrufe aendern sich bei jedem Rendern; die Ereignisse lesen sie frisch.
  const rueckrufe = useRef({ onOffen, onVoll })
  useLayoutEffect(() => {
    rueckrufe.current = { onOffen, onVoll }
  })

  const breite = () => vorneRef.current?.getBoundingClientRect().width || 360

  const setzen = (x: number) => {
    lage.current = x
    const vorne = vorneRef.current
    const aktionen = aktionenRef.current
    // In Ruhe: keine eigene Grafikebene und die Aktionen ganz weg. Safari
    // schneidet Ebenen nicht sauber an den runden Ecken der Zeile ab — dort
    // blitzte sonst rechts ein roter Rand vom Loeschen-Knopf durch.
    if (vorne) vorne.style.transform = Math.abs(x) < 0.5 ? '' : `translate3d(${x}px,0,0)`
    if (aktionen) {
      const zu = x > -0.5
      aktionen.style.visibility = zu ? 'hidden' : 'visible'
      aktionen.style.width = zu ? '0px' : `${-x}px`
      aktionen.style.setProperty('--wisch-fortschritt', String(Math.min(1, Math.max(0, -x / OFFEN_BREITE))))
      const istVoll = geste.current?.richtung === 'h' && -x > breite() * VOLL_ANTEIL
      if (istVoll !== voll.current) {
        voll.current = istVoll
        if (istVoll) aktionen.dataset.voll = 'true'
        else delete aktionen.dataset.voll
        if (istVoll) navigator.vibrate?.(8)
      }
    }
  }

  const anhalten = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current)
    animation.current = null
  }

  /** Feder zur Ziellage, Anfangsgeschwindigkeit `v` in px/s. */
  const fahren = (nach: number, v = 0, danach?: () => void) => {
    anhalten()
    ziel.current = nach
    const vorne = vorneRef.current
    if (!vorne || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setzen(nach)
      danach?.()
      return
    }
    vorne.style.willChange = 'transform'
    let x = lage.current
    let geschw = v
    let vorher = performance.now()
    const schritt = (jetzt: number) => {
      let dt = Math.min(0.064, (jetzt - vorher) / 1000)
      vorher = jetzt
      while (dt > 0) {
        const h = Math.min(dt, 1 / 240)
        ;[x, geschw] = federSchritt(x, geschw, nach, h)
        dt -= h
      }
      if (Math.abs(x - nach) < 0.4 && Math.abs(geschw) < 12) {
        setzen(nach)
        vorne.style.willChange = ''
        animation.current = null
        danach?.()
        return
      }
      setzen(x)
      animation.current = requestAnimationFrame(schritt)
    }
    animation.current = requestAnimationFrame(schritt)
  }

  // Von aussen geoeffnet oder geschlossen (Tipp daneben, andere Zeile).
  useEffect(() => {
    if (geste.current?.richtung === 'h') return
    const nach = offen ? -OFFEN_BREITE : 0
    if (ziel.current !== nach) fahren(nach)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen])

  useLayoutEffect(() => {
    setzen(lage.current)
    return anhalten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gefasst wird die ganze Zeile — auch an den freigelegten Aktionen laesst
  // sie sich zurueckschieben, wie bei iOS.
  useEffect(() => {
    const zeile = zeileRef.current
    const vorne = vorneRef.current
    if (!zeile || !vorne) return

    const beginnen = (x: number, y: number) => {
      anhalten()
      geste.current = { startX: x, startY: y, basis: lage.current, richtung: null, proben: [] }
      gewischt.current = false
    }
    /** true, solange die Geste der Zeile gehoert. */
    const bewegen = (x: number, y: number, zeit: number): boolean => {
      const g = geste.current
      if (!g) return false
      if (g.richtung === null) {
        const dx = x - g.startX
        const dy = y - g.startY
        if (Math.hypot(dx, dy) < RICHTUNG_AB) return false
        g.richtung = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
        if (g.richtung === 'v') {
          geste.current = null
          return false
        }
        // Ab hier gerechnet: kein Sprung um die Schwelle.
        g.startX = x
        gewischt.current = true
        vorne.style.willChange = 'transform'
      }
      // Zeitstempel des Ereignisses, nicht „jetzt": so zaehlt, wann der
      // Finger dort war, nicht wann das Programm dazu kam.
      g.proben.push({ x, t: zeit })
      while (g.proben.length > 2 && zeit - g.proben[0].t > 90) g.proben.shift()
      setzen(lageAusStrecke(g.basis + (x - g.startX), breite()))
      return true
    }
    const beenden = (zeit: number) => {
      const g = geste.current
      geste.current = null
      if (!g || g.richtung !== 'h') return
      const geschw = loslassGeschwindigkeit(g.proben, zeit)
      const wohin = zielBeimLoslassen(lage.current, geschw, breite())
      if (wohin === 'voll') {
        // Loeschen fragt nach; die Zeile kehrt dabei an ihren Platz zurueck.
        voll.current = false
        delete aktionenRef.current?.dataset.voll
        rueckrufe.current.onOffen(false)
        fahren(0, geschw * 1000)
        rueckrufe.current.onVoll()
        return
      }
      rueckrufe.current.onOffen(wohin === 'offen')
      fahren(wohin === 'offen' ? -OFFEN_BREITE : 0, geschw * 1000)
    }

    const touchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      beginnen(e.touches[0].clientX, e.touches[0].clientY)
    }
    const touchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t && bewegen(t.clientX, t.clientY, e.timeStamp) && e.cancelable) e.preventDefault()
    }
    const touchEnde = (e: TouchEvent) => beenden(e.timeStamp)
    const mausBewegen = (e: PointerEvent) => {
      if (e.buttons === 0) return mausEnde(e)
      bewegen(e.clientX, e.clientY, e.timeStamp)
    }
    const mausLoesen = () => {
      window.removeEventListener('pointermove', mausBewegen)
      window.removeEventListener('pointerup', mausEnde)
      window.removeEventListener('pointercancel', mausEnde)
    }
    const mausEnde = (e: PointerEvent) => {
      mausLoesen()
      beenden(e.timeStamp)
    }
    const pointerDown = (e: PointerEvent) => {
      // Touch laeuft ueber die Touch-Ereignisse; Maus und Stift hier.
      if (e.pointerType === 'touch' || e.button !== 0) return
      beginnen(e.clientX, e.clientY)
      window.addEventListener('pointermove', mausBewegen)
      window.addEventListener('pointerup', mausEnde)
      window.addEventListener('pointercancel', mausEnde)
    }

    zeile.addEventListener('touchstart', touchStart, { passive: true })
    zeile.addEventListener('touchmove', touchMove, { passive: false })
    zeile.addEventListener('touchend', touchEnde)
    zeile.addEventListener('touchcancel', touchEnde)
    zeile.addEventListener('pointerdown', pointerDown)
    return () => {
      zeile.removeEventListener('touchstart', touchStart)
      zeile.removeEventListener('touchmove', touchMove)
      zeile.removeEventListener('touchend', touchEnde)
      zeile.removeEventListener('touchcancel', touchEnde)
      zeile.removeEventListener('pointerdown', pointerDown)
      // Verschwindet die Zeile mitten im Ziehen, endet die Geste still —
      // kein Loslassen, also auch kein Loeschen.
      mausLoesen()
      geste.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    zeileRef,
    vorneRef,
    aktionenRef,
    /** Nach einem Wischen kommt noch ein Klick — der oeffnet nichts. */
    klickVerschlucken: () => {
      const war = gewischt.current
      gewischt.current = false
      return war
    },
  }
}
