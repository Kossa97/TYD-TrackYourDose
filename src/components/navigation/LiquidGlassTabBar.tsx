import {
  useLayoutEffect, useRef, useState,
  type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react'

/**
 * Die Web-Fassung der Liquid-Glass-Tab-Bar.
 *
 * Hier steht AUSSCHLIESSLICH Darstellung: eine schwebende Glaskapsel, darin
 * eine Pille, die zum aktiven Reiter gleitet. Wohin ein Reiter fuehrt, welcher
 * gilt und was beim Tippen passiert, weiss diese Datei nicht — das kommt von
 * aussen herein. Genau deshalb laesst sie sich im nativen iOS-Bau gegen Apples
 * echte `UITabBar` tauschen, ohne dass die Navigation davon etwas merkt.
 *
 * Das Glas selbst liegt in `index.css` unter `.tyd-tabbar`; dort steht auch,
 * aus welchen vier Schichten der Eindruck entsteht und was passiert, wenn ein
 * Browser `backdrop-filter` oder Masken nicht kann.
 */

/** Attribut, an dem die Messung die Reiter im Streifen wiederfindet. */
export const TAB_ATTR = 'data-tyd-tab'

export interface GlassTabItem {
  id: string
  label: string
  icon: ReactNode
  /**
   * Was beim Tippen gerendert wird — eine Verknuepfung oder eine
   * Schaltflaeche. Die Darstellung reicht die Eigenschaften durch, die sie
   * braucht; woher das Element kommt, ist ihr gleich.
   */
  render: (props: {
    className: string
    children: ReactNode
    'aria-current': 'page' | undefined
    [TAB_ATTR]: string
  }) => ReactNode
}

export interface LiquidGlassTabBarProps {
  items: readonly GlassTabItem[]
  /** Der aktive Reiter, oder null auf einer Seite, die zu keinem gehoert. */
  activeId: string | null
  /** Nach wie vielen Reitern die mittlere Schaltflaeche eingeschoben wird. */
  centerIndex: number
  centerAction: ReactNode
  ariaLabel: string
  /**
   * Wird gerufen, wenn der Finger ueber der Leiste losgelassen wird und dabei
   * einen ANDEREN Reiter erreicht hat als den, auf dem er aufgesetzt ist. Ein
   * einfacher Tipp laeuft nicht hierueber, sondern ueber das Element selbst —
   * so bleibt eine Verknuepfung eine Verknuepfung.
   */
  onSelect?: (id: string) => void
  /** Ein Reiter ist unter dem Finger durchgeglitten. Fuer den Klick am Geraet. */
  onPreviewChange?: (id: string) => void
}

interface Einpassung {
  links: number
  breite: number
  kapselBreite: number
}

export function LiquidGlassTabBar({
  items,
  activeId,
  centerIndex,
  centerAction,
  ariaLabel,
  onSelect,
  onPreviewChange,
}: LiquidGlassTabBarProps) {
  const kapselRef = useRef<HTMLElement | null>(null)
  const [pille, setPille] = useState<Einpassung | null>(null)
  /**
   * Halten und schieben.
   *
   * Der Finger setzt auf einem Reiter auf, die Pille folgt ihm die Leiste
   * entlang, und beim Loslassen oeffnet sich, worueber er steht. `vorschau`
   * ist der Reiter unter dem Finger — solange sie gesetzt ist, zeigt die Pille
   * dorthin statt auf den tatsaechlich aktiven.
   */
  const [vorschau, setVorschau] = useState<string | null>(null)
  const vorschauRef = useRef<string | null>(null)
  const ziehtRef = useRef(false)
  const gewandertRef = useRef(false)
  const klickSchluckenRef = useRef(false)
  /** Mitte jedes Reiters im Streifen — fuer die Frage „worueber steht er?". */
  const mittenRef = useRef<{ id: string; mitte: number }[]>([])

  const setzeVorschau = (id: string | null) => {
    vorschauRef.current = id
    setVorschau(id)
  }

  /** Die Pille zeigt auf den Finger, solange er liegt — sonst auf die Seite. */
  const gezeigt = vorschau ?? activeId

  /**
   * Die Pille wird GEMESSEN, nicht gerechnet.
   *
   * Die Reiter sind unterschiedlich breit, sobald eine Beschriftung laenger
   * ist als die andere oder eine Sprache mehr Platz braucht — eine Formel aus
   * „Kapselbreite durch Anzahl" traefe dann daneben. Gemessen wird im
   * Layout-Effekt, also vor dem ersten Anzeigen: es gibt kein Bild mit falsch
   * sitzender Pille und keinen Sprung danach.
   *
   * Gesucht wird ueber das Attribut statt ueber eine Sammlung von Verweisen:
   * so bleibt der Aufbau der Reiter dem Aufrufer ueberlassen, und waehrend des
   * Renderns wird nichts gelesen, was erst danach existiert.
   */
  useLayoutEffect(() => {
    const kapsel = kapselRef.current
    if (!kapsel) return

    const reiter = () => [...kapsel.querySelectorAll<HTMLElement>(`[${TAB_ATTR}]`)]

    const messen = () => {
      const alle = reiter()
      mittenRef.current = alle.map(el => ({
        id: el.getAttribute(TAB_ATTR) ?? '',
        mitte: el.offsetLeft + el.offsetWidth / 2,
      }))

      // Gesucht wird ueber den Attributwert und nicht ueber einen Selektor mit
      // eingesetzter Kennung: das braucht kein `CSS.escape` (das jsdom gar
      // nicht hat) und kann an keiner Kennung zerbrechen.
      const ziel = gezeigt
        ? alle.find(el => el.getAttribute(TAB_ATTR) === gezeigt) ?? null
        : null
      const naechste: Einpassung | null = ziel && kapsel.offsetWidth
        ? { links: ziel.offsetLeft, breite: ziel.offsetWidth, kapselBreite: kapsel.offsetWidth }
        : null

      setPille(vorher => (gleich(vorher, naechste) ? vorher : naechste))
    }

    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(kapsel)
    for (const el of reiter()) beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [gezeigt, items])

  // Der Schimmer im Glas folgt der Pille — das ist der raeumliche Anteil.
  const schimmer = pille
    ? `${((pille.links + pille.breite / 2) / pille.kapselBreite) * 100}%`
    : '50%'

  /** Welcher Reiter liegt bei dieser Stelle im Streifen am naechsten? */
  const reiterBei = (clientX: number) => {
    const kapsel = kapselRef.current
    if (!kapsel || mittenRef.current.length === 0) return null
    const x = clientX - kapsel.getBoundingClientRect().left
    let naechster = mittenRef.current[0]
    for (const eintrag of mittenRef.current) {
      if (Math.abs(eintrag.mitte - x) < Math.abs(naechster.mitte - x)) naechster = eintrag
    }
    return naechster.id || null
  }

  const beiZeigerAb = (e: ReactPointerEvent<HTMLElement>) => {
    const auf = (e.target as HTMLElement).closest?.(`[${TAB_ATTR}]`)
    if (!auf) return          // die mittlere Schaltflaeche zieht nicht mit
    ziehtRef.current = true
    gewandertRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    setzeVorschau(auf.getAttribute(TAB_ATTR))
  }

  const beiZeigerBewegung = (e: ReactPointerEvent<HTMLElement>) => {
    if (!ziehtRef.current) return
    const naechster = reiterBei(e.clientX)
    if (!naechster || naechster === vorschauRef.current) return
    gewandertRef.current = true
    setzeVorschau(naechster)
    onPreviewChange?.(naechster)
  }

  const beiZeigerAuf = (e: ReactPointerEvent<HTMLElement>) => {
    if (!ziehtRef.current) return
    ziehtRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    const ziel = vorschauRef.current

    // Ein einfacher Tipp wird NICHT hier behandelt: dann liegt der Finger noch
    // auf demselben Reiter, und die Verknuepfung darunter macht ihre Arbeit
    // selbst — samt allem, was ein Browser an einer Verknuepfung kann.
    if (!gewandertRef.current || !ziel) { setzeVorschau(null); return }

    // Gewandert: der Klick gehoert zum Reiter, auf dem der Finger AUFGESETZT
    // hat, und fuehrt woandershin. Er wird geschluckt, und wir gehen selbst.
    klickSchluckenRef.current = true
    window.setTimeout(() => { klickSchluckenRef.current = false }, 0)
    onSelect?.(ziel)
    // Ein Bild spaeter aufloesen: bis dahin ist der Seitenwechsel durch, die
    // Pille steht also schon auf dem neuen Reiter und bleibt einfach stehen.
    // Ohne diese Verzoegerung schnellte sie fuer ein Bild zurueck.
    window.requestAnimationFrame(() => setzeVorschau(null))
  }

  const beiZeigerAbbruch = () => {
    ziehtRef.current = false
    setzeVorschau(null)
  }

  const beiKlick = (e: ReactMouseEvent<HTMLElement>) => {
    if (!klickSchluckenRef.current) return
    e.preventDefault()
    e.stopPropagation()
  }

  const reiter = (item: GlassTabItem) => item.render({
    className: 'tyd-tabbar-item',
    [TAB_ATTR]: item.id,
    // Immer der Reiter der GEZEIGTEN Seite, nie der unter dem Finger: was
    // vorgelesen wird, darf nicht von einer Geste abhaengen, die noch laeuft.
    'aria-current': item.id === activeId ? 'page' : undefined,
    children: (
      <>
        {item.icon}
        <span className="tyd-tabbar-label">{item.label}</span>
      </>
    ),
  })

  return (
    <nav
      ref={kapselRef}
      aria-label={ariaLabel}
      className="tyd-tabbar flex items-stretch"
      style={{ ['--tyd-glint' as string]: schimmer }}
      onPointerDown={beiZeigerAb}
      onPointerMove={beiZeigerBewegung}
      onPointerUp={beiZeigerAuf}
      onPointerCancel={beiZeigerAbbruch}
      onClickCapture={beiKlick}
    >
      <div
        className="tyd-tabbar-pill"
        data-tyd-pill
        data-gehalten={vorschau !== null ? 'true' : 'false'}
        data-ohne-ziel={pille ? 'false' : 'true'}
        aria-hidden="true"
        style={pille
          ? { width: pille.breite, transform: `translateX(${pille.links}px)` }
          : undefined}
      />
      {items.slice(0, centerIndex).map(item => (
        <TabTraeger key={item.id}>{reiter(item)}</TabTraeger>
      ))}
      {centerAction}
      {items.slice(centerIndex).map(item => (
        <TabTraeger key={item.id}>{reiter(item)}</TabTraeger>
      ))}
    </nav>
  )
}

function gleich(a: Einpassung | null, b: Einpassung | null) {
  if (a === null || b === null) return a === b
  return a.links === b.links && a.breite === b.breite && a.kapselBreite === b.kapselBreite
}

/** Nur ein Schluessel-Traeger: `render` liefert ein fertiges Element. */
function TabTraeger({ children }: { children: ReactNode }) {
  return <>{children}</>
}
