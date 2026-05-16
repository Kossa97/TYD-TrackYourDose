import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, FlaskConical, BookHeart, Star, User, HelpCircle, Calculator } from 'lucide-react'

const navItems = [
  { to: '/',            icon: CalendarDays, label: 'Kalender',   newKey: null },
  { to: '/peptide',     icon: FlaskConical, label: 'Peptide',    newKey: '_new_nav_peptide' },
  { to: '/rechner',     icon: Calculator,   label: 'Rechner',    newKey: '_new_nav_rechner' },
  { to: '/tagebuch',    icon: BookHeart,    label: 'Tagebuch',   newKey: '_new_nav_tagebuch' },
  { to: '/bewertungen', icon: Star,         label: 'Bewertungen',newKey: '_new_nav_bewertungen' },
  { to: '/profil',      icon: User,         label: 'Profil',     newKey: '_new_nav_profil' },
  { to: '/faq',         icon: HelpCircle,   label: 'FAQ',        newKey: '_new_nav_faq' },
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
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <main className="flex-1 pb-20 px-4 pt-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          {navItems.map(({ to, icon: Icon, label, newKey }) => {
            const isNew = newKey ? newPaths.has(to) : false
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                    isActive ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
                  }`
                }
              >
                <div className="relative">
                  <Icon size={16} />
                  {isNew && (
                    <>
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping opacity-75 pointer-events-none" />
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-400 pointer-events-none" />
                    </>
                  )}
                </div>
                <span className="text-[8px] font-medium">{label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
