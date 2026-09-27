import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCalculatorNumber, parseDecimalInput } from '../lib/units'

const presets = [
  { ml: 1, units: 100 }, { ml: 0.5, units: 50 }, { ml: 0.3, units: 30 },
  { ml: 2, units: 200 }, { ml: 1, units: 40 },
]

export function SyringeFields({ idPrefix, capacityMl, capacityUnits, onChange }: {
  idPrefix: string
  capacityMl: string
  capacityUnits: string
  onChange: (ml: string, units: string) => void
}) {
  const { t, i18n } = useTranslation()
  const [custom, setCustom] = useState(false)
  const ml = parseDecimalInput(capacityMl)
  const units = parseDecimalInput(capacityUnits)
  const preset = presets.find(p => p.ml === ml && p.units === units)
  const selection = custom || !preset ? 'custom' : `${preset.ml}:${preset.units}`
  return (
    <div className="rechner-syringe">
      <label className="rechner-field" htmlFor={`${idPrefix}-preset`}>
        <span>{t('spritzengroesse')}</span>
        <select id={`${idPrefix}-preset`} className="rechner-select" value={selection} onChange={event => {
          if (event.target.value === 'custom') { setCustom(true); return }
          const [nextMl, nextUnits] = event.target.value.split(':')
          setCustom(false)
          onChange(nextMl, nextUnits)
        }}>
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
              onChange={event => field.change(event.target.value)} />
            {invalid && <span id={`${idPrefix}-${field.key}-error`} className="rechner-error">{t('rechner_positive')}</span>}
          </label>
        })}
      </div>}
      <p className="rechner-muted">{t('rechner_scale_note')}</p>
    </div>
  )
}
