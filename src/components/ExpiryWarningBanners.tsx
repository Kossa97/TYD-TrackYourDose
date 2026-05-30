import { useMemo, useState } from 'react'
import { AlertTriangle, X, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { PeptideExpiryAlert } from '../lib/peptideExpiry'

const STYLES = {
  soon: {
    border: 'rgba(245,158,11,0.45)',
    background: 'linear-gradient(145deg, rgba(245,158,11,0.14), rgba(9,14,34,0.92))',
    color: '#fcd34d',
  },
  expired: {
    border: 'rgba(244,63,94,0.45)',
    background: 'linear-gradient(145deg, rgba(244,63,94,0.16), rgba(9,14,34,0.92))',
    color: '#fda4af',
  },
} as const

function alertMessage(alert: PeptideExpiryAlert, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (alert.status === 'expired') {
    return t('expiry_banner_expired', { name: alert.name, defaultValue: `${alert.name} ist abgelaufen – bitte neu rekonstitutieren` })
  }
  if (alert.daysLeft === 0) {
    return t('expiry_banner_today', { name: alert.name, defaultValue: `${alert.name} läuft heute ab – jetzt neu rekonstitutieren` })
  }
  return t('expiry_banner_soon', {
    name: alert.name,
    days: alert.daysLeft,
    defaultValue: `${alert.name} läuft in ${alert.daysLeft} Tagen ab – jetzt neu rekonstitutieren`,
  })
}

function AlertIcon({ status }: { status: PeptideExpiryAlert['status'] }) {
  if (status === 'expired') return <XCircle size={16} />
  return <AlertTriangle size={16} />
}

export function ExpiryWarningBanners({ alerts }: { alerts: PeptideExpiryAlert[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const visible = useMemo(
    () => alerts.filter(alert => !dismissed.has(alert.id)),
    [alerts, dismissed],
  )

  if (visible.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map(alert => {
        const style = STYLES[alert.status]
        return (
          <div
            key={alert.id}
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 20,
              border: `1px solid ${style.border}`,
              background: style.background,
              boxShadow: '0 10px 32px rgba(0,0,0,0.28)',
            }}
          >
            <span style={{ flexShrink: 0, color: style.color, display: 'flex', alignItems: 'center' }}>
              <AlertIcon status={alert.status} />
            </span>
            <button
              type="button"
              onClick={() => navigate('/peptide')}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                fontSize: '0.78rem',
                fontWeight: 750,
                lineHeight: 1.45,
                color: style.color,
              }}
            >
              {alertMessage(alert, t)}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(prev => new Set(prev).add(alert.id))}
              aria-label={String(t('close'))}
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--border)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
