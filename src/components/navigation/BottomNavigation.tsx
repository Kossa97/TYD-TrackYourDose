import { CalendarDays, FlaskConical, Home, Plus, User, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const activeId = resolveActiveTabId(pathname)

  const items: GlassTabItem[] = TAB_ITEMS.map(tab => {
    const Icon = ICONS[tab.id]
    return {
      id: tab.id,
      label: tab.labelKey ? String(t(tab.labelKey, { defaultValue: tab.fallbackLabel })) : tab.fallbackLabel,
      icon: <Icon size={21} aria-hidden="true" />,
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
      // „Navigation" heisst in beiden Startsprachen gleich. Ein eigener
      // Schluessel dafuer haette die Sprachdateien angefasst, und der Vertrag
      // in `my-stack/lib/i18n.test.ts` haelt die ausserhalb seines Bereichs
      // bewusst unveraendert.
      ariaLabel={String(t('nav_aria_label', { defaultValue: 'Navigation' }))}
      centerAction={(
        <button
          type="button"
          aria-label="Quick Actions"
          aria-expanded={quickActionsOpen}
          onClick={onToggleQuickActions}
          className="tyd-tabbar-center"
          style={{
            background: quickActionsOpen
              ? 'var(--surface-raised)'
              : 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #003a6e))',
            border: quickActionsOpen ? '1px solid var(--border-strong)' : 'none',
            boxShadow: quickActionsOpen ? 'none' : '0 2px 10px rgba(0,0,0,0.30)',
          }}
        >
          {quickActionsOpen
            ? <X size={23} color="var(--text)" />
            : <Plus size={25} color="var(--accent-contrast)" />}
        </button>
      )}
    />
  )
}
