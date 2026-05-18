import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, FlaskConical, BookHeart, Star, User, HelpCircle, Calculator } from 'lucide-react'
import { Onboarding } from './Onboarding'

const navItems = [
  { to: '/',            icon: CalendarDays, label: 'Kalender',   newKey: null,                       obKey: 'nav-kalender' },
  { to: '/peptide',     icon: FlaskConical, label: 'Peptide',    newKey: '_new_nav_peptide',          obKey: 'nav-peptide' },
  { to: '/rechner',     icon: Calculator,   label: 'Rechner',    newKey: '_new_nav_rechner',          obKey: null },
  { to: '/tagebuch',    icon: BookHeart,    label: 'Tagebuch',   newKey: '_new_nav_tagebuch',         obKey: null },
  { to: '/bewertungen', icon: Star,         label: 'Bewertungen',newKey: '_new_nav_bewertungen',      obKey: null },
  { to: '/profil',      icon: User,         label: 'Profil',     newKey: '_new_nav_profil',           obKey: null },
  { to: '/faq',         icon: HelpCircle,   label: 'FAQ',        newKey: '_new_nav_faq',              obKey: null },
]

export function Layout() {
  const location = useLocation()

  // Track which nav items are still "new" (never visited)
  const [newPaths, setNewPaths] = useState<Set<string>>(() => {
    const s = new Set<string>()
    for (const item of navItems) {
      if (item.newKey && !localStorage.getItem(item.newKey)) {
        s.add(item.to)
      }
    }
    return s
  })

  // Mark current route as seen
  useEffect(() => {
    const matched = navItems.find(
      item => item.newKey && (
        location.pathname === item.to ||
        (item.to !== '/' && location.pathname.startsWith(item.to))
      )
    )
    if (matched?.newKey && newPaths.has(matched.to)) {
      localStorage.setItem(matched.newKey, '1')
      setNewPaths(prev => { const s = new Set(prev); s.delete(matched.to); return s })
    }
  }, [location.pathname])

  return (
    <div className="flex flex-col min-h-dvh w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <main className="flex-1 w-full overflow-x-hidden px-3 pt-4" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      <Onboarding />

      <nav className="fixed bottom-0 left-0 right-0 z-40" style={{
        background: 'rgba(3, 4, 16, 0.88)',
        borderTop: '1px solid rgba(255,255,255,0.055)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div className="flex items-center justify-around py-1.5 px-1" style={{ maxWidth: '640px', margin: '0 auto' }}>
          {navItems.map(({ to, icon: Icon, label, newKey, obKey }) => {
            const isNew = newKey ? newPaths.has(to) : false
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                {...(obKey ? { 'data-ob': obKey } : {})}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'text-sky-400 nav-item-active'
                      : 'text-slate-600 hover:text-slate-400 nav-item-inactive'
                  }`
                }
                style={{ minWidth: 0, flex: '1 1 0' }}
              >
                <div className="relative">
                  <Icon size={15} />
                  {isNew && (
                    <>
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping opacity-75 pointer-events-none" />
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-400 pointer-events-none" />
                    </>
                  )}
                </div>
                <span className="text-[7.5px] font-medium text-center leading-tight w-full truncate px-0.5">{label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
