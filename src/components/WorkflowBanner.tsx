import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, Beaker, CalendarDays, Gauge, X, type LucideIcon } from 'lucide-react'

const STOCK_STEP_KEY = 'home_flow_stock'

const WORKFLOW_STEPS: { icon: LucideIcon; labelKey: string; label: string; descKey: string; desc: string }[] = [
  { icon: Archive, labelKey: STOCK_STEP_KEY, label: 'Einlagern', descKey: 'home_flow_stock_desc', desc: 'Vials & Batch sichern' },
  { icon: Beaker, labelKey: 'home_flow_mix', label: 'Anmischen', descKey: 'home_flow_mix_desc', desc: 'Rekonstitution dokumentieren' },
  { icon: CalendarDays, labelKey: 'home_flow_cycle', label: 'Zyklus', descKey: 'home_flow_cycle_desc', desc: 'Frequenz & Reminder planen' },
  { icon: Gauge, labelKey: 'home_flow_track', label: 'Tracken', descKey: 'home_flow_track_desc', desc: 'Dosen, Effekte, Reports' },
]

const panelStyle: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  border: '1px solid var(--border)',
  boxShadow: '0 18px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: 14,
  position: 'relative',
  width: '100%',
  textAlign: 'left',
}

const labelStyle: CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 800,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const iconBoxBase: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--accent-weak)',
  border: '1px solid var(--accent-border)',
  color: 'var(--accent)',
}

function storageKey(userId: string) {
  return `tyd_workflow_hidden_${userId}`
}

function stopNav(e: MouseEvent) {
  e.stopPropagation()
}

export function WorkflowBanner({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [sessionDismissed, setSessionDismissed] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [permanentlyHidden, setPermanentlyHidden] = useState(false)

  useEffect(() => {
    if (!userId) return
    setPermanentlyHidden(localStorage.getItem(storageKey(userId)) === 'true')
  }, [userId])

  if (!userId || permanentlyHidden || sessionDismissed) return null

  const dismiss = () => {
    if (dontShowAgain && userId) {
      localStorage.setItem(storageKey(userId), 'true')
      setPermanentlyHidden(true)
    }
    setSessionDismissed(true)
  }

  return (
    <>
      <style>{`
        @keyframes tyd-stock-step-glow {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(0,204,245,0.4), 0 0 14px rgba(0,204,245,0.25);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(0,204,245,0.95), 0 0 26px rgba(0,204,245,0.55);
          }
        }
      `}</style>

      <section>
        <div style={panelStyle}>
          <div
            style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}
            onClick={stopNav}
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label={String(t('close'))}
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
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
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.58rem',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                userSelect: 'none',
                maxWidth: 120,
                lineHeight: 1.3,
                textAlign: 'right',
              }}
            >
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={e => setDontShowAgain(e.target.checked)}
                style={{ width: 13, height: 13, accentColor: 'var(--accent)', flexShrink: 0 }}
              />
              {t('home_workflow_hide', { defaultValue: 'Nicht mehr anzeigen' })}
            </label>
          </div>

          <div style={{ marginBottom: 12, paddingRight: 36 }}>
            <p style={labelStyle}>{t('home_workflow', { defaultValue: 'Workflow' })}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text)', marginTop: 2 }}>
              {t('home_workflow_title', { defaultValue: 'Vom Vial zum Report' })}
            </h2>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {WORKFLOW_STEPS.map((step, index) => {
              const isStockStep = step.labelKey === STOCK_STEP_KEY
              const Icon = step.icon

              return (
                <div key={step.labelKey} style={{ position: 'relative' }}>
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <div style={{ position: 'absolute', top: 18, left: '58%', right: '-42%', height: 1, background: 'linear-gradient(90deg, var(--accent-border), transparent)' }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, textAlign: 'center', position: 'relative' }}>
                    {isStockStep ? (
                      <button
                        type="button"
                        onClick={() => navigate('/peptide?tab=inventar')}
                        aria-label={String(t('home_flow_stock', { defaultValue: 'Einlagern' }))}
                        style={{
                          ...iconBoxBase,
                          cursor: 'pointer',
                          animation: 'tyd-stock-step-glow 2.2s ease-in-out infinite',
                          background: 'var(--accent-weak)',
                          border: '1px solid rgba(0,204,245,0.55)',
                        }}
                      >
                        <Icon size={16} />
                      </button>
                    ) : (
                      <div style={iconBoxBase}>
                        <Icon size={16} />
                      </div>
                    )}
                    <div>
                      <p style={{
                        fontSize: '0.68rem',
                        color: isStockStep ? 'var(--accent)' : 'var(--text)',
                        fontWeight: 800,
                        lineHeight: 1.2,
                      }}>
                        {t(step.labelKey, { defaultValue: step.label })}
                      </p>
                      <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', lineHeight: 1.25, marginTop: 2 }}>
                        {t(step.descKey, { defaultValue: step.desc })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
