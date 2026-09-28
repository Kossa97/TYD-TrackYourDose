import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCalculatorNumber, parseDecimalInput } from '../lib/units'

const presets = [
  { ml: 1, units: 100, step: '2' }, { ml: 0.5, units: 50, step: '1' }, { ml: 0.3, units: 30, step: '1' },
  { ml: 2, units: 200 }, { ml: 1, units: 40 },
]

export function SyringeFields({ idPrefix, capacityMl, capacityUnits, onChange, onGraduationChange }: {
  idPrefix: string
  capacityMl: string
  capacityUnits: string
  onChange: (ml: string, units: string) => void
  onGraduationChange?: (step: string) => void
}) {
  const { t, i18n } = useTranslation()
  const [custom, setCustom] = useState(false)
  const ml = parseDecimalInput(capacityMl)
  const units = parseDecimalInput(capacityUnits)
  const preset = presets.find(p => p.ml === ml && p.units === units)
  const selection = custom || !preset ? 'custom' : `${preset.ml}:${preset.units}`
  const choosePreset = (value: string) => {
    if (value === 'custom') {
      setCustom(true)
      onGraduationChange?.('')
      return
    }
    const [nextMl, nextUnits] = value.split(':')
    const nextPreset = presets.find(item => item.ml === Number(nextMl) && item.units === Number(nextUnits))
    setCustom(false)
    onChange(nextMl, nextUnits)
    onGraduationChange?.(nextPreset?.step ?? '')
  }
  return (
    <div className="rechner-syringe">
      {onGraduationChange && <div className="rechner-syringe-presets" role="group" aria-label={`${t('spritzengroesse')} U-100`}>
        {presets.filter(item => item.step).sort((a, b) => a.units - b.units).map(item => <button key={item.units}
          type="button" className="rechner-syringe-preset" aria-pressed={selection === `${item.ml}:${item.units}`}
          aria-label={`${item.units} ${t('einh_kurz')} ${formatCalculatorNumber(item.ml, i18n.language)} mL · U-100`}
          onClick={() => choosePreset(`${item.ml}:${item.units}`)}>
          <strong>{item.units}</strong><span>{formatCalculatorNumber(item.ml, i18n.language)} mL</span>
        </button>)}
      </div>}
      <label className="rechner-field" htmlFor={`${idPrefix}-preset`}>
        <span>{t('spritzengroesse')}</span>
        <select id={`${idPrefix}-preset`} className="rechner-select" value={selection} onChange={event => choosePreset(event.target.value)}>
          {presets.map(p => <option key={`${p.ml}:${p.units}`} value={`${p.ml}:${p.units}`}>
            {formatCalculatorNumber(p.ml, i18n.language)} mL · {p.units} {t('einh_kurz')} (U-{p.units / p.ml})
          </option>)}
          <option value="custom">{t('eigene_werte')}</option>
        </select>
      </label>
      {selection === 'custom' && <div className="rechner-fields">
        {[
          { key: 'ml', label: t('rechner_capacity'), value: capacityMl, parsed: ml, change: (v: string) => onChange(v, capacityUnits) },
          { key: 'units', label: t('rechner_scale_max'), value: capacityUnits, parsed: units, change: (v: string) => onChange(capacityMl, v) },
        ].map(field => {
          const invalid = field.value.trim() !== '' && (field.parsed === null || field.parsed <= 0)
          return <label className="rechner-field" key={field.key} htmlFor={`${idPrefix}-${field.key}`}>
            <span>{field.label}</span>
            <input id={`${idPrefix}-${field.key}`} className="rechner-input" type="text" inputMode="decimal"
              autoComplete="off" value={field.value} aria-invalid={invalid}
              aria-describedby={invalid ? `${idPrefix}-${field.key}-error` : undefined}
              onChange={event => { setCustom(true); field.change(event.target.value); onGraduationChange?.('') }} />
            {invalid && <span id={`${idPrefix}-${field.key}-error`} className="rechner-error">{t('rechner_positive')}</span>}
          </label>
        })}
      </div>}
      <p className="rechner-muted">{t('rechner_scale_note')}</p>
    </div>
  )
}
