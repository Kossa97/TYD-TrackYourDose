import { useState, useEffect } from 'react'
import { CalendarDays, FlaskConical, Archive, User, Home, HelpCircle, Bell, X } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Onboarding } from './Onboarding'
import { LanguageGate } from './LanguageGate'
import { useAuth } from '../context/AuthContext'
import { usePushNotifications } from '../lib/usePushNotifications'

const PUSH_DISMISSED_KEY = 'tyd_push_dismissed'

export function Layout() {
  const location = useLocation()
  const { pathname, search } = location
  const { t } = useTranslation()
  const { user } = useAuth()
  const { state: pushState, subscribe } = usePushNotifications(user)

  const [showPushBanner, setShowPushBanner] = useState(false)

  // Show push banner once if permission not yet decided
  useEffect(() => {
    if (!user) return
    if (pushState === 'unsupported' || pushState === 'denied' || pushState === 'subscribed') return
    if (localStorage.getItem(PUSH_DISMISSED_KEY) === 'true') return
    // Small delay so it doesn't flash on first render
    const timer = setTimeout(() => setShowPushBanner(true), 1200)
    return () => clearTimeout(timer)
  }, [user, pushState])

  const handlePushAccept = async () => {
    setShowPushBanner(false)
    await subscribe()
  }

  const handlePushDismiss = () => {
    setShowPushBanner(false)
    localStorage.setItem(PUSH_DISMISSED_KEY, 'true')
  }

  const isLager    = pathname === '/peptide' && search.includes('inventar')
  const isPeptide  = pathname === '/peptide' && !search.includes('inventar')
  const isHome     = pathname === '/'
  const isKalender = pathname === '/kalender'
  const isProfil   = pathname === '/profil'

  return (
    <div className="flex flex-col min-h-dvh w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>

      {/* ── Push permission banner ── */}
      {showPushBanner && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 50,
          background: 'linear-gradient(135deg, rgba(0,204,245,0.16), rgba(8,12,28,0.97))',
          borderBottom: '1px solid rgba(0,204,245,0.22)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
            background: 'rgba(0,204,245,0.15)', border: '1px solid rgba(0,204,245,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bell size={16} color="#00ccf5" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#eaeefc', lineHeight: 1.2 }}>
              {t('push_banner_title', { defaultValue: 'Einnahme-Erinnerungen' })}
            </p>
            <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.62)', marginTop: 2 }}>
              {t('push_banner_desc', { defaultValue: 'Zur eingestellten Zeit automatisch benachrichtigt werden.' })}
            </p>
          </div>
          <button
            onClick={handlePushAccept}
            style={{
              padding: '7px 14px', borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(0,204,245,0.25), rgba(0,204,245,0.12))',
              border: '1px solid rgba(0,204,245,0.35)',
              color: '#00ccf5', fontSize: '0.72rem', fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            {t('push_banner_allow', { defaultValue: 'Aktivieren' })}
          </button>
          <button
            onClick={handlePushDismiss}
            aria-label="Schließen"
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(154,170,191,0.55)',
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <main
        className="flex-1 w-full overflow-x-hidden px-3 pt-4"
        style={{
          paddingBottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))',
          paddingTop: showPushBanner ? 'calc(1rem + 68px + env(safe-area-inset-top))' : undefined,
        }}
      >
        <Outlet />
      </main>

      <LanguageGate />
      <Onboarding />

      {/* FAQ Floating Button */}
      <NavLink
        to="/faq"
        style={{
          position: 'fixed',
          bottom: `calc(var(--bottom-nav-height) + 4px + env(safe-area-inset-bottom))`,
          right: 16,
          zIndex: 39,
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'rgba(10,14,30,0.92)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
          transition: 'all 0.2s',
          color: pathname === '/faq' ? '#00ccf5' : 'rgba(154,170,191,0.55)',
        }}
      >
        <HelpCircle size={17} />
      </NavLink>

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
          style={{ maxWidth: 640, margin: '0 auto', padding: '6px 4px 10px' }}
        >
          {/* Lager */}
          <NavItem
            to="/peptide?tab=inventar"
            icon={<Archive size={20} />}
            label={t('nav_lager')}
            active={isLager}
            obKey="nav-lager"
          />

          {/* Peptide */}
          <NavItem
            to="/peptide"
            icon={<FlaskConical size={20} />}
            label={t('nav_peptide')}
            active={isPeptide}
            obKey="nav-peptide"
          />

          {/* Home — Mitte, hervorgehoben */}
          <NavLink
            to="/"
            data-ob="nav-home"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
          >
            <div
              style={{
                width: 56, height: 56,
                borderRadius: 20,
                background: isHome
                  ? 'linear-gradient(135deg, #00ccf5, #0088dd)'
                  : 'rgba(0,204,245,0.10)',
                border: isHome ? 'none' : '1px solid rgba(0,204,245,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: -18,
                boxShadow: isHome
                  ? '0 0 28px rgba(0,204,245,0.5), 0 6px 20px rgba(0,0,0,0.55)'
                  : '0 2px 12px rgba(0,0,0,0.4)',
                transition: 'all 0.2s',
              }}
            >
              <Home size={24} color={isHome ? '#07091a' : 'rgba(0,204,245,0.75)'} />
            </div>
            <span style={{
              fontSize: '9px', fontWeight: 700,
              color: isHome ? '#00ccf5' : 'rgba(154,170,191,0.45)',
              letterSpacing: '0.02em',
              transition: 'color 0.2s',
            }}>
              {t('nav_home')}
            </span>
          </NavLink>

          {/* Kalender */}
          <NavItem
            to="/kalender"
            icon={<CalendarDays size={20} />}
            label={t('nav_kalender')}
            active={isKalender}
            obKey="nav-kalender"
          />

          {/* Profil */}
          <NavItem
            to="/profil"
            icon={<User size={20} />}
            label={t('nav_profil')}
            active={isProfil}
          />
        </div>
      </nav>
    </div>
  )
}

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
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '2px 4px',
          borderRadius: 14,
        }}
      >
      <div style={{
        padding: '5px 12px', borderRadius: 12,
        color: active ? '#00ccf5' : 'rgba(100,115,135,0.85)',
        transition: 'color 0.2s',
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: '9px', fontWeight: 600,
        color: active ? '#00ccf5' : 'rgba(100,115,135,0.75)',
        letterSpacing: '0.02em',
        transition: 'color 0.2s',
        textAlign: 'center',
      }}>
        {label}
      </span>
      </div>
    </NavLink>
  )
}
