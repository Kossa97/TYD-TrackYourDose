import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, FlaskConical, BookHeart, Star, User, HelpCircle } from 'lucide-react'

const navItems = [
  { to: '/', icon: CalendarDays, label: 'Kalender' },
  { to: '/peptide', icon: FlaskConical, label: 'Peptide' },
  { to: '/tagebuch', icon: BookHeart, label: 'Tagebuch' },
  { to: '/bewertungen', icon: Star, label: 'Bewertungen' },
  { to: '/profil', icon: User, label: 'Profil' },
  { to: '/faq', icon: HelpCircle, label: 'FAQ' },
]

export function Layout() {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <main className="flex-1 pb-20 px-4 pt-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
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
              <Icon size={18} />
              <span className="text-[9px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
