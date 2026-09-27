import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight } from 'lucide-react'
import { GlassPanel, SectionHeader } from '../../../components/ui/DesignSystem'
import { SyringeFields } from './SyringeFields'
import { convertMass, convertSyringe, convertVolume, formatCalculatorNumber, parseDecimalInput } from '../lib/units'
import type { MassUnit, VolumeUnit } from '../lib/units'

type Category = 'mass' | 'volume' | 'syringe'
const categories: Category[] = ['mass', 'volume', 'syringe']
const categoryUnits = { mass: ['g', 'mg', 'mcg'], volume: ['ml', 'ul'], syringe: ['ml', 'units'] }

export function UnitConverter() {
  const { t, i18n } = useTranslation()
  const [category, setCategory] = useState<Category>('mass')
  const [amount, setAmount] = useState('')
  const [pairs, setPairs] = useState<Record<Category, [string, string]>>({
    mass: ['mg', 'mcg'], volume: ['ml', 'ul'], syringe: ['ml', 'units'],
  })
  const [capacityMl, setCapacityMl] = useState('1')
  const [capacityUnits, setCapacityUnits] = useState('100')
  const [from, to] = pairs[category]
  const value = parseDecimalInput(amount)
  const ml = parseDecimalInput(capacityMl)
  const units = parseDecimalInput(capacityUnits)
  const blank = amount.trim() === ''
  const invalid = !blank && (value === null || value < 0)
  const invalidSyringe = category === 'syringe' && (ml === null || ml <= 0 || units === null || units <= 0)
  let result: number | null = null
  let overCapacity = false
  let resultInvalid = false
  if (!blank && !invalid && !invalidSyringe && value !== null) {
    try {
      if (category === 'mass') result = convertMass(value, from as MassUnit, to as MassUnit)
      else if (category === 'volume') result = convertVolume(value, from as VolumeUnit, to as VolumeUnit)
      else if (ml !== null && units !== null) {
        result = from === to ? value : convertSyringe(value, from === 'ml' ? 'ml-to-units' : 'units-to-ml', ml, units)
        const volume = from === 'ml' ? value : convertSyringe(value, 'units-to-ml', ml, units)
        overCapacity = volume > ml
      }
    } catch {
      resultInvalid = true
    }
  }
  const unitLabel = (unit: string) => unit === 'units' ? t('rechner_converter_scale_units') : unit === 'ul' ? 'µl' : unit
  const updatePair = (index: 0 | 1, unit: string) => {
    const next: [string, string] = [...pairs[category]]
    next[index] = unit
    setPairs({ ...pairs, [category]: next })
  }

  return (
    <GlassPanel padding="lg">
      <SectionHeader title={t('rechner_converter_title')} subtitle={t('rechner_converter_subtitle')} />
      <div className="rechner-form">
        <label className="rechner-field" htmlFor="converter-category">
          <span>{t('rechner_converter_category')}</span>
          <select id="converter-category" className="rechner-select" value={category}
            onChange={event => setCategory(event.target.value as Category)}>
            {categories.map(item => <option key={item} value={item}>{t(`rechner_converter_${item}`)}</option>)}
          </select>
        </label>
        <label className="rechner-field" htmlFor="converter-amount">
          <span>{t('rechner_converter_amount')}</span>
          <input id="converter-amount" className="rechner-input" type="text" inputMode="decimal" autoComplete="off"
            value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={invalid || resultInvalid}
            aria-describedby={invalid || resultInvalid ? 'converter-input-error' : undefined} />
        </label>
        <div className="rechner-fields">
          {([from, to] as const).map((unit, index) => (
            <label className="rechner-field" key={index} htmlFor={`converter-${index === 0 ? 'from' : 'to'}`}>
              <span>{t(index === 0 ? 'rechner_converter_from' : 'rechner_converter_to')}</span>
              <select id={`converter-${index === 0 ? 'from' : 'to'}`} className="rechner-select" value={unit}
                onChange={event => updatePair(index as 0 | 1, event.target.value)}>
                {categoryUnits[category].map(item => <option key={item} value={item}>{unitLabel(item)}</option>)}
              </select>
            </label>
          ))}
        </div>
        <button type="button" className="rechner-button" onClick={() => setPairs({ ...pairs, [category]: [to, from] })}>
          <ArrowLeftRight size={16} aria-hidden="true" /> {t('rechner_converter_swap')}
        </button>
        {category === 'syringe' && <SyringeFields idPrefix="converter-syringe" capacityMl={capacityMl}
          capacityUnits={capacityUnits} onChange={(nextMl, nextUnits) => { setCapacityMl(nextMl); setCapacityUnits(nextUnits) }} />}
      </div>
      <div className="rechner-result" role="status" aria-live="polite" aria-atomic="true">
        {blank ? <p className="rechner-muted">{t('rechner_converter_empty')}</p>
          : invalid || resultInvalid ? <p id="converter-input-error" className="rechner-error">{t('rechner_converter_invalid')}</p>
            : invalidSyringe ? <p className="rechner-error">{t('rechner_converter_invalid_syringe')}</p>
              : result !== null && <>
                <p className="rechner-muted">{t('rechner_converter_result')}</p>
                <p className="rechner-result-value">{formatCalculatorNumber(result, i18n.language)} <span className="rechner-result-unit">{unitLabel(to)}</span></p>
                {overCapacity && <p className="rechner-error">{t('rechner_converter_over_capacity')}</p>}
              </>}
      </div>
      <div className="rechner-summary">
        <p className="rechner-muted">{t('rechner_converter_mass_volume_note')}</p>
        <p className="rechner-muted">{t('rechner_converter_iu_note')}</p>
      </div>
    </GlassPanel>
  )
}
