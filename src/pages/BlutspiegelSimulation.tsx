import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MedicalNotice } from '../features/compliance/components/MedicalNotice'
import { BlutspiegelView } from '../features/blutspiegel/BlutspiegelView'
import { ManualSimulation } from '../features/blutspiegel/ManualSimulation'

/**
 * Blutspiegel — Aufbau nach dem Vorbild der Aktien-App: keine Karten, der
 * Graph so breit und hoch wie moeglich. Live-Verlauf oben, manuelle
 * Simulation darunter.
 */
export function BlutspiegelSimulation() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 8 }}>
      <header>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.1 }}>
          {t('pk_sim_title')}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>{t('pk_sim_subtitle')}</p>
        <p className="disclaimer" style={{ marginTop: 6 }}>{t('pk_sim_disclaimer')}</p>
      </header>
      <MedicalNotice />

      <BlutspiegelView variant="full" initialKey={searchParams.get('entry')} />

      <ManualSimulation preselectProfileId={searchParams.get('pk')} />

      <p className="disclaimer" style={{ textAlign: 'center', padding: '4px 8px 12px' }}>{t('pk_consult')}</p>
    </div>
  )
}
