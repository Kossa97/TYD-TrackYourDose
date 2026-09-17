import { CalendarDays, FlaskConical, Home, Plus, User, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { hapticTick } from '../../lib/haptics'
import { CENTER_ACTION_INDEX, TAB_ITEMS, resolveActiveTabId, type TabId } from './tabModel'
import { LiquidGlassTabBar, type GlassTabItem } from './LiquidGlassTabBar'

/**
 * Die Naht zwischen Navigation und Darstellung.
 *
 * Oben kommt herein, wo man ist und was die mittlere Schaltflaeche tun soll;
 * unten geht hinaus, was der Bildschirm zeigt. Dazwischen steht diese Datei —
 * und sie ist die EINZIGE Stelle, die geaendert werden muss, wenn im nativen
 * iOS-Bau Apples echte Tab-Bar an die Stelle der Web-Nachbildung tritt:
 * `LiquidGlassTabBar` austauschen, Modell und Router bleiben, wie sie sind.
 */

const ICONS: Record<TabId, typeof Home> = {
  home: Home,
  'my-stack': FlaskConical,
  kalender: CalendarDays,
  profil: User,
}

export interface BottomNavigationProps {
  pathname: string
  quickActionsOpen: boolean
  onToggleQuickActions: () => void
}

export function BottomNavigation({
  pathname,
  quickActionsOpen,
  onToggleQuickActions,
}: BottomNavigationProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const activeId = resolveActiveTabId(pathname)

  /**
   * Halten und schieben endet hier: der Reiter unter dem Finger wird beim
   * Loslassen geoeffnet. Ein einfacher Tipp laeuft nicht hierueber — den
   * erledigt die Verknuepfung selbst, samt allem, was ein Browser an einer
   * Verknuepfung kann (Mittelklick, Kontextmenue, Vorlesung).
   */
  const oeffne = (id: string) => {
    const ziel = TAB_ITEMS.find(tab => tab.id === id)
    if (ziel) navigate(ziel.route)
  }

  const items: GlassTabItem[] = TAB_ITEMS.map(tab => {
    const Icon = ICONS[tab.id]
    return {
      id: tab.id,
      label: tab.labelKey ? String(t(tab.labelKey, { defaultValue: tab.fallbackLabel })) : tab.fallbackLabel,
      icon: <Icon size={25} aria-hidden="true" />,
      render: ({ className, children, ...rest }) => (
        <NavLink
          to={tab.route}
          className={className}
          {...(tab.obKey ? { 'data-ob': tab.obKey } : {})}
          {...rest}
        >
          {children}
        </NavLink>
      ),
    }
  })

  return (
    <LiquidGlassTabBar
      items={items}
      activeId={activeId}
      centerIndex={CENTER_ACTION_INDEX}
      onSelect={oeffne}
      // Ein Klick je Reiter, den der Finger ueberstreicht — wie am Rad einer
      // Uhr, und dasselbe Gefuehl wie im My-Stack-Karussell.
      onPreviewChange={() => { void hapticTick() }}
      // „Navigation" heisst in beiden Startsprachen gleich. Ein eigener
      // Schluessel dafuer haette die Sprachdateien angefasst, und der Vertrag
      // in `my-stack/lib/i18n.test.ts` haelt die ausserhalb seines Bereichs
      // bewusst unveraendert.
      ariaLabel={String(t('nav_aria_label', { defaultValue: 'Navigation' }))}
      centerAction={(
        // Dieselbe Klasse und dieselbe Symbolgroesse wie ein Reiter: die Mitte
        // soll sich in die Reihe einfuegen, nicht als Knopf herausstechen.
        // Anders ist nur, was sie tut — sie fuehrt zu keiner Seite, traegt
        // keine Pille und zieht beim Wischen nicht mit. Dass sie offen ist,
        // sagt das Symbol (ein X statt eines Plus) und `aria-expanded`.
        <button
          type="button"
          aria-label="Quick Actions"
          aria-expanded={quickActionsOpen}
          onClick={onToggleQuickActions}
          className="tyd-tabbar-item"
          data-tyd-center
          style={{ color: quickActionsOpen ? 'var(--accent)' : undefined }}
        >
          {quickActionsOpen
            ? <X size={25} aria-hidden="true" />
            : <Plus size={25} aria-hidden="true" />}
        </button>
      )}
    />
  )
}
