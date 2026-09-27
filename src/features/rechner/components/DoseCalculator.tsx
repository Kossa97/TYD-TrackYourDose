import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical, RotateCcw, Syringe } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { GlassPanel, SectionHeader } from '../../../components/ui/DesignSystem'
import { loadStackItems, type StackItemQueryClient } from '../../my-stack/services/stackItems'
import { calculateReconstitution } from '../../peptipedia/lib/reconstitution'
import { getCalculatorSources, type CalculatorSource } from '../lib/stackSources'
import { formatCalculatorNumber, parseDecimalInput } from '../lib/units'
import { SyringeFields } from './SyringeFields'
import { SyringeScale } from './SyringeScale'
import { CopyCalculation } from './CopyCalculation'

const initialValues = { vialAmountMg: '', diluentMl: '2', targetDose: '', syringeCapacityMl: '1', syringeUnits: '100' }

export function DoseCalculator() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [values, setValues] = useState(initialValues)
  const [unit, setUnit] = useState<'mcg' | 'mg'>('mcg')
  const [selected, setSelected] = useState('')
  const [reload, setReload] = useState(0)
  const [stack, setStack] = useState<{ owner: string; attempt: number; sources: CalculatorSource[]; error: boolean } | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    loadStackItems(supabase as unknown as StackItemQueryClient, false).then(items => {
      if (active) setStack({ owner: user.id, attempt: reload, sources: getCalculatorSources(items), error: false })
    }).catch(() => {
      if (active) setStack({ owner: user.id, attempt: reload, sources: [], error: true })
    })
    return () => { active = false }
  }, [user, reload])

  const currentStack = stack?.owner === user?.id && stack?.attempt === reload ? stack : null
  const format = (value: number) => formatCalculatorNumber(value, i18n.language)
  const labels = {
    vialAmountMg: t('rechner_amount'), diluentMl: t('rechner_liquid'), targetDose: t('rechner_target'),
    syringeCapacityMl: t('rechner_capacity'), syringeUnits: t('rechner_scale_max'),
  }
  const parsed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, parseDecimalInput(value)])) as Record<keyof typeof values, number | null>
  const solutionReady = parsed.vialAmountMg !== null && parsed.vialAmountMg > 0 && parsed.diluentMl !== null && parsed.diluentMl > 0
  const concentration = solutionReady ? parsed.vialAmountMg! / parsed.diluentMl! : null
  const concentrationValid = concentration !== null && Number.isFinite(concentration) && concentration > 0
  const invalidField = (Object.keys(values) as Array<keyof typeof values>).find(key => values[key].trim() !== '' && (parsed[key] === null || parsed[key]! <= 0))
  const missing = Object.values(values).some(value => value.trim() === '')
  let error = invalidField ? `${labels[invalidField]}: ${t('rechner_positive')}` : ''
  let result: ReturnType<typeof calculateReconstitution> | null = null
  if (!error && !missing) {
    try {
      result = calculateReconstitution({
        vialAmountMg: parsed.vialAmountMg!, diluentMl: parsed.diluentMl!, targetDose: parsed.targetDose!,
        targetUnit: unit, syringeCapacityMl: parsed.syringeCapacityMl!, syringeUnits: parsed.syringeUnits!,
      })
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : ''
      error = t(reason === 'target_exceeds_vial' ? 'rechner_exceeds_amount'
        : reason === 'target_exceeds_syringe_capacity' ? 'rechner_exceeds_syringe' : 'rechner_numeric_range')
    }
  }
  const fillPercent = result ? result.drawMl / parsed.syringeCapacityMl! * 100 : 0
  const reset = () => { setValues(initialValues); setUnit('mcg'); setSelected('') }
  const source = currentStack?.sources.find(item => item.id === selected)
  const summary = result ? [
    t('rechner_dose_tab'),
    ...(source ? [`${t('rechner_stack_source')}: ${source.label}`] : []),
    `${labels.vialAmountMg}: ${format(parsed.vialAmountMg!)}`,
    `${labels.diluentMl}: ${format(parsed.diluentMl!)}`,
    `${t('konzentration')}: ${format(result.concentrationMcgPerMl / 1000)} mg/mL`,
    `${labels.targetDose}: ${format(parsed.targetDose!)} ${unit === 'mcg' ? 'µg' : 'mg'}`,
    `${t('rechner_converter_syringe')}: ${format(parsed.syringeUnits!)} ${t('rechner_converter_scale_units')} = ${format(parsed.syringeCapacityMl!)} mL`,
    `${t('rechner_result')}: ${format(result.drawUnits)} ${t('rechner_converter_scale_units')} = ${format(result.drawMl)} mL`,
    `${t('rechner_portions')}: ${format(result.dosesPerVial)}`,
    t('rechner_precision_note'),
  ].join('\n') : ''

  return <div className="rechner-workspace">
    <GlassPanel padding="lg">
      <SectionHeader title={t('rechner_inputs')} icon={FlaskConical} action={
        <button type="button" className="rechner-button" onClick={reset} aria-label={t('rechner_reset')}>
          <RotateCcw size={16} aria-hidden="true" /><span>{t('rechner_reset')}</span>
        </button>
      } />
      <div className="rechner-form">
        <fieldset className="rechner-step">
          <legend><span className="rechner-step-number">1</span>{t('rechner_step_solution')}</legend>
          <div className="rechner-step-content">
            {user && <div className="rechner-stack">
              {!currentStack ? <p className="rechner-muted" role="status">{t('rechner_stack_loading')}</p>
                : currentStack.error ? <div>
                  <p className="rechner-error" role="alert">{t('rechner_stack_error')}</p>
                  <button className="rechner-button" type="button" onClick={() => setReload(v => v + 1)}>{t('inj_retry')}</button>
                </div>
                : currentStack.sources.length ? <>
                  <label className="rechner-field" htmlFor="dose-source">
                    <span>{t('rechner_stack_source')}</span>
                    <select id="dose-source" className="rechner-select" value={selected} onChange={event => {
                      const source = currentStack.sources.find(item => item.id === event.target.value)
                      setSelected(event.target.value)
                      setValues(current => ({ ...current, vialAmountMg: source ? String(source.vialAmountMg) : '', diluentMl: source?.diluentMl == null ? '' : String(source.diluentMl) }))
                    }}>
                      <option value="">{t('rechner_manual')}</option>
                      {currentStack.sources.map(source => <option key={source.id} value={source.id}>{source.label}</option>)}
                    </select>
                  </label>
                  <p className="rechner-muted">{t(selected ? 'rechner_source_note' : 'rechner_stack_hint')}</p>
                </> : <p className="rechner-muted">{t('rechner_stack_empty')}</p>}
            </div>}
            <div className="rechner-fields">
              {(['vialAmountMg', 'diluentMl'] as const).map(key => <label key={key} className="rechner-field" htmlFor={`dose-${key}`}>
                <span>{labels[key]}</span>
                <input id={`dose-${key}`} type="text" inputMode="decimal" autoComplete="off" className="rechner-input"
                  value={values[key]} placeholder={key === 'vialAmountMg' ? '5' : '2'} aria-invalid={invalidField === key}
                  aria-describedby={invalidField === key ? 'dose-error' : undefined}
                  onChange={event => { setValues({ ...values, [key]: event.target.value }); setSelected('') }} />
              </label>)}
            </div>
            <p className="rechner-muted">{t('rechner_amount_hint')}</p>
            <div className="rechner-concentration" role="status" aria-label={t('rechner_concentration_label')} aria-atomic="true">
              <span>{t('konzentration')}</span>
              {concentrationValid ? <strong>{format(concentration!)} <span>mg/mL</span></strong>
                : <p className={solutionReady ? 'rechner-error' : 'rechner-muted'}>
                  {t(solutionReady ? 'rechner_numeric_range' : 'rechner_concentration_empty')}
                </p>}
            </div>
          </div>
        </fieldset>
        <fieldset className="rechner-step">
          <legend><span className="rechner-step-number">2</span>{t('rechner_step_target')}</legend>
          <div className="rechner-step-content">
            <div className="rechner-fields">
              <label className="rechner-field" htmlFor="dose-target">
                <span>{labels.targetDose}</span>
                <input id="dose-target" type="text" inputMode="decimal" autoComplete="off" className="rechner-input"
                  value={values.targetDose} placeholder="250" aria-invalid={invalidField === 'targetDose'}
                  aria-describedby={invalidField === 'targetDose' ? 'dose-error' : undefined}
                  onChange={event => setValues({ ...values, targetDose: event.target.value })} />
              </label>
              <label className="rechner-field" htmlFor="dose-unit">
                <span>{t('rechner_target_unit')}</span>
                <select id="dose-unit" className="rechner-select" value={unit} onChange={event => setUnit(event.target.value as 'mg' | 'mcg')}>
                  <option value="mcg">µg (mcg)</option><option value="mg">mg</option>
                </select>
              </label>
            </div>
            <SyringeFields idPrefix="dose-syringe" capacityMl={values.syringeCapacityMl} capacityUnits={values.syringeUnits}
              onChange={(ml, units) => setValues({ ...values, syringeCapacityMl: ml, syringeUnits: units })} />
          </div>
        </fieldset>
      </div>
    </GlassPanel>

    <GlassPanel padding="lg" className="rechner-output" accent={error ? '#e58a30' : '#00ccf5'}>
      <SectionHeader title={`3. ${t('rechner_result')}`} icon={Syringe} />
      {error ? <p id="dose-error" className="rechner-error rechner-empty" role="alert">{error}</p>
        : result ? <div className="rechner-result" role="status" aria-label={t('rechner_result_label')} aria-live="polite" aria-atomic="true">
          <p className="rechner-muted">{t('einheiten_aufziehen')}</p>
          <p className="rechner-result-value">{format(result.drawUnits)} <span className="rechner-result-unit">{t('einh_kurz')}</span></p>
          <p className="rechner-volume">{format(result.drawMl)} mL</p>
          <SyringeScale drawUnits={result.drawUnits} capacityUnits={parsed.syringeUnits!} capacityMl={parsed.syringeCapacityMl!} />
          <dl className="rechner-summary">
            <div><dt>{t('konzentration')}</dt><dd>{format(result.concentrationMcgPerMl / 1000)} mg/mL</dd></div>
            <div><dt>{t('rechner_syringe_fill')}</dt><dd>{format(fillPercent)} %</dd></div>
            <div><dt>{t('rechner_portions')}</dt><dd>{format(result.dosesPerVial)}</dd></div>
          </dl>
          <p className="rechner-muted">{t('rechner_precision_note')}</p>
        </div> : <div className="rechner-empty"><Syringe size={28} aria-hidden="true" /><p>{t('rechner_empty')}</p></div>}
      {result && <CopyCalculation key={summary} text={summary} />}
    </GlassPanel>
  </div>
}
