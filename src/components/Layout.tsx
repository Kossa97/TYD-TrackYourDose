import { CalendarDays, FlaskConical, Archive, User, LayoutGrid } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Onboarding } from './Onboarding'

export function Layout() {
  const location = useLocation()
  const { pathname, search } = location

  const isLager    = pathname === '/peptide' && search.includes('inventar')
  const isPeptide  = pathname === '/peptide' && !search.includes('inventar')
  const isHome     = pathname === '/'
  const isKalender = pathname === '/kalender'
  const isProfil   = pathname === '/profil'

  return (
    <div className="flex flex-col min-h-dvh w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <main
        className="flex-1 w-full overflow-x-hidden px-3 pt-4"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>

      <Onboarding />

      <nav
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: 'rgba(3, 4, 16, 0.92)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.55)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div
          className="flex items-end justify-around"
          style={{ maxWidth: 640, margin: '0 auto', padding: '8px 8px 10px' }}
        >
          {/* Lager */}
          <NavItem
            to="/peptide?tab=inventar"
            icon={<Archive size={16} />}
            label="Lager"
            active={isLager}
            obKey="nav-lager"
          />

          {/* Peptide */}
          <NavItem
            to="/peptide"
            icon={<FlaskConical size={16} />}
            label="Peptide"
            active={isPeptide}
            obKey="nav-peptide"
          />

          {/* Home — Mitte, hervorgehoben */}
          <NavLink to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div
              data-ob="nav-home"
              style={{
                width: 52, height: 52,
                borderRadius: 18,
                background: isHome
                  ? 'linear-gradient(135deg, #00ccf5, #0088dd)'
                  : 'rgba(0,204,245,0.10)',
                border: isHome ? 'none' : '1px solid rgba(0,204,245,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: -14,
                boxShadow: isHome
                  ? '0 0 24px rgba(0,204,245,0.45), 0 4px 16px rgba(0,0,0,0.5)'
                  : '0 2px 12px rgba(0,0,0,0.4)',
                transition: 'all 0.2s',
              }}
            >
              <LayoutGrid size={20} color={isHome ? '#07091a' : 'rgba(0,204,245,0.7)'} />
            </div>
            <span style={{
              fontSize: '7.5px', fontWeight: 700,
              color: isHome ? '#00ccf5' : 'rgba(154,170,191,0.45)',
              letterSpacing: '0.02em',
              transition: 'color 0.2s',
            }}>
              Home
            </span>
          </NavLink>

          {/* Kalender */}
          <NavItem
            to="/kalender"
            icon={<CalendarDays size={16} />}
            label="Kalender"
            active={isKalender}
            obKey="nav-kalender"
          />

          {/* Profil */}
          <NavItem
            to="/profil"
            icon={<User size={16} />}
            label="Profil"
            active={isProfil}
          />
        </div>
      </nav>
    </div>
  )
}

// ── Kleine Nav-Item Komponente ─────────────────────────────────────────────
function NavItem({
  to, icon, label, active, obKey,
}: {
  to: string
  icon: React.ReactNode
  label: string
  active: boolean
  obKey?: string
}) {
  return (
    <NavLink
      to={to}
      {...(obKey ? { 'data-ob': obKey } : {})}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: '1 1 0', minWidth: 0 }}
    >
      <div style={{
        padding: '5px 10px', borderRadius: 10,
        color: active ? '#00ccf5' : 'rgba(100,115,135,0.8)',
        transition: 'color 0.2s',
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: '7.5px', fontWeight: 600,
        color: active ? '#00ccf5' : 'rgba(100,115,135,0.7)',
        letterSpacing: '0.02em',
        transition: 'color 0.2s',
        textAlign: 'center',
      }}>
        {label}
      </span>
    </NavLink>
  )
}
