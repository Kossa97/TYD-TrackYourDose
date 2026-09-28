import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, Calculator, Syringe } from 'lucide-react'
import { PageHero, PageShell } from '../components/ui/DesignSystem'
import { useAuth } from '../context/AuthContext'
import { DoseCalculator } from '../features/rechner/components/DoseCalculator'
import { UnitConverter } from '../features/rechner/components/UnitConverter'
import '../features/rechner/rechner.css'

export function Rechner() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [mode, setMode] = useState<'dose' | 'units'>('dose')
  return <PageShell className="rechner-page" style={{ gap: 12 }}>
    <div className="rechner-hero"><PageHero title={t('rechner_title')} icon={Calculator} /></div>
    <div className="rechner-segments" role="group" aria-label={t('rechner_mode')}>
      {([
        { id: 'dose', label: t('rechner_dose_tab'), icon: Syringe },
        { id: 'units', label: t('rechner_units_tab'), icon: ArrowLeftRight },
      ] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button"
        aria-pressed={mode === id} aria-controls={`rechner-${id}`} onClick={() => setMode(id)}>
        <Icon size={18} aria-hidden="true" />{label}
      </button>)}
    </div>
    <div id="rechner-dose" className="rechner-dose-pane" hidden={mode !== 'dose'}><DoseCalculator key={user?.id ?? 'anonymous'} /></div>
    <div id="rechner-units" className="rechner-units-pane" hidden={mode !== 'units'}><UnitConverter />
      <p className="rechner-muted rechner-disclaimer">{t('info_disclaimer')}</p>
    </div>
  </PageShell>
}
