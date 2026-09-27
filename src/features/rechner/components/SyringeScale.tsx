import { useTranslation } from 'react-i18next'
import { formatCalculatorNumber } from '../lib/units'
import './SyringeScale.css'

export function SyringeScale({ drawUnits, capacityUnits, capacityMl }: {
  drawUnits: number
  capacityUnits: number
  capacityMl: number
}) {
  const { t, i18n } = useTranslation()
  const format = (value: number) => formatCalculatorNumber(value, i18n.language)
  const target = `${format(drawUnits)} ${t('einh_kurz')}`
  const maximum = `${format(capacityUnits)} ${t('einh_kurz')}`
  const percent = drawUnits / capacityUnits * 100
  // Reference positions illustrate the ratio, not a physical syringe's graduations.
  const quarters = [0, 0.25, 0.5, 0.75, 1]
  const compact = quarters.some(fraction => format(capacityUnits * fraction).length > 6)
  const references = compact ? [0, 0.5, 1] : quarters

  return <div className="rechner-syringe-scale">
    <div className="rechner-syringe-target-label">
      <span>{t('rechner_scale_target')}</span><strong>{target}</strong>
    </div>
    <p className="rechner-syringe-capacity">{t('spritzengroesse')}: <span>{maximum} / {format(capacityMl)} mL</span></p>
    <div className="rechner-syringe-diagram" dir="ltr">
      <div className="rechner-syringe-barrel" role="meter" aria-label={t('rechner_syringe_fill')}
        aria-valuemin={0} aria-valuemax={capacityUnits} aria-valuenow={drawUnits}
        aria-valuetext={`${target} / ${maximum}`}>
        <div className="rechner-syringe-fill" style={{ width: `${percent}%` }} aria-hidden="true" />
        {references.map(fraction => <span key={fraction} className="rechner-syringe-reference"
          style={{ left: `${fraction * 100}%` }} aria-hidden="true" />)}
        <div className="rechner-syringe-target-line" style={{ left: `${percent}%` }} aria-hidden="true" />
      </div>
      <div className={`rechner-syringe-scale-labels${compact ? ' rechner-syringe-scale-labels-compact' : ''}`} aria-hidden="true">
        {references.map(fraction => <span key={fraction}>{format(capacityUnits * fraction)}</span>)}
      </div>
    </div>
    <p className="rechner-muted">{t('rechner_scale_schematic')}</p>
  </div>
}
