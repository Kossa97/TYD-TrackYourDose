import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

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
}: LiquidGlassTabBarProps) {
  const kapselRef = useRef<HTMLElement | null>(null)
  const [pille, setPille] = useState<Einpassung | null>(null)

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
      // Gesucht wird ueber den Attributwert und nicht ueber einen Selektor mit
      // eingesetzter Kennung: das braucht kein `CSS.escape` (das jsdom gar
      // nicht hat) und kann an keiner Kennung zerbrechen.
      const ziel = activeId
        ? reiter().find(el => el.getAttribute(TAB_ATTR) === activeId) ?? null
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
  }, [activeId, items])

  // Der Schimmer im Glas folgt der Pille — das ist der raeumliche Anteil.
  const schimmer = pille
    ? `${((pille.links + pille.breite / 2) / pille.kapselBreite) * 100}%`
    : '50%'

  const reiter = (item: GlassTabItem) => item.render({
    className: 'tyd-tabbar-item',
    [TAB_ATTR]: item.id,
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
    >
      <div
        className="tyd-tabbar-pill"
        data-tyd-pill
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
