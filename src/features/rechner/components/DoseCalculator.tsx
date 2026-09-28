import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FlaskConical, RotateCcw, Syringe } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { loadStackItems, type StackItemQueryClient } from '../../my-stack/services/stackItems'
import { getCalculatorSources, type CalculatorSource } from '../lib/stackSources'
import { calculateLiquid, convertLiquidValue, type LiquidValues, type LiquidUnit, type TargetUnit } from '../lib/liquidCalculation'
import { getSyringeGraduation } from '../lib/syringeGraduation'
import { formatCalculatorNumber, parseDecimalInput } from '../lib/units'
import { SyringeFields } from './SyringeFields'
import { SyringeScale } from './SyringeScale'
import { CopyCalculation } from './CopyCalculation'

const initialValues: LiquidValues = {
  mode: 'amount', amount: '', volume: '2', concentration: '', container: '', target: '',
  sourceUnit: 'mg', targetUnit: 'mcg', capacityMl: '0.5', capacityUnits: '50',
}
const sourceUnits: LiquidUnit[] = ['mg', 'mcg', 'g', 'iu']
type NumericField = 'amount' | 'volume' | 'concentration' | 'container' | 'target'
const inputNumber = (value: number | null) => value !== null && Number.isFinite(value) && value > 0 ? String(value) : ''

export function DoseCalculator() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [values, setValues] = useState(initialValues)
  const [graduation, setGraduation] = useState('1')
  const [resetVersion, setResetVersion] = useState(0)
  const [unitNotice, setUnitNotice] = useState('')
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
  const source = currentStack?.sources.find(item => item.id === selected)
  const result = calculateLiquid(values)
  const format = (value: number) => formatCalculatorNumber(value, i18n.language)
  const unitLabel = (unit: TargetUnit) => unit === 'iu' ? t('rechner_active_iu') : unit === 'mcg' ? 'µg' : unit === 'ml' ? 'mL' : unit
  const baseUnit = values.sourceUnit === 'iu' ? 'iu' : 'mg'
  const amountLabel = (value: number | null) => {
    if (value === null || !Number.isFinite(value) || value <= 0) return '—'
    return values.sourceUnit === 'iu' ? `${format(value)} ${unitLabel('iu')}`
      : value < 1 ? `${format(value * 1000)} µg` : `${format(value)} mg`
  }
  const capacityMl = parseDecimalInput(values.capacityMl) ?? 0
  const capacityUnits = parseDecimalInput(values.capacityUnits) ?? 0
  const scale = getSyringeGraduation(capacityUnits, parseDecimalInput(graduation))
  const perUnit = result.concentration !== null && capacityMl > 0 && capacityUnits > 0
    ? result.concentration * (capacityMl / capacityUnits) : null
  const labels: Record<NumericField, string> = {
    amount: t('rechner_solution_amount'), volume: t('rechner_solution_volume'),
    concentration: t('rechner_known_concentration'), container: t('rechner_container_volume'),
    target: t('rechner_target'),
  }
  const valid = result.drawMl !== null && result.drawUnits !== null
  const error = result.error ? t({
    positive: 'rechner_positive', numeric_range: 'rechner_numeric_range', incompatible_units: 'rechner_family_note',
    exceeds_container: 'rechner_exceeds_container', exceeds_syringe: 'rechner_exceeds_syringe',
  }[result.error]) : ''
  let tickNote = t('rechner_scale_unknown')
  if (result.drawUnits !== null && scale.minorStep !== null) {
    const tick = result.drawUnits / scale.minorStep
    tickNote = Math.abs(tick - Math.round(tick)) < 1e-9
      ? t('rechner_on_tick', { value: format(result.drawUnits) })
      : t('rechner_between_ticks', {
        lower: format(Math.floor(tick) * scale.minorStep), upper: format(Math.ceil(tick) * scale.minorStep),
        value: format(result.drawUnits),
      })
  }
  const reset = () => {
    setValues(initialValues); setGraduation('1'); setSelected(''); setUnitNotice(''); setResetVersion(v => v + 1)
  }
  const edit = (field: NumericField, value: string) => {
    setValues(current => ({ ...current, [field]: value }))
    if (field !== 'target') setSelected('')
  }
  const changeSourceUnit = (next: LiquidUnit) => {
    const familyChanged = (values.sourceUnit === 'iu') !== (next === 'iu')
    const convert = (value: string) => {
      const parsed = parseDecimalInput(value)
      return parsed === null ? '' : inputNumber(convertLiquidValue(parsed, values.sourceUnit, next, null))
    }
    setValues({ ...values, sourceUnit: next,
      amount: familyChanged ? '' : convert(values.amount), concentration: familyChanged ? '' : convert(values.concentration),
      targetUnit: familyChanged && values.targetUnit !== 'ml' ? next === 'iu' ? 'iu' : 'mcg' : values.targetUnit,
      target: familyChanged && values.targetUnit !== 'ml' ? '' : values.target,
    })
    setSelected('')
    setUnitNotice(familyChanged ? 'rechner_family_changed' : '')
  }
  const changeTargetUnit = (next: TargetUnit) => {
    const parsed = parseDecimalInput(values.target)
    const converted = parsed === null ? null : convertLiquidValue(parsed, values.targetUnit, next, result.concentration)
    setValues({ ...values, targetUnit: next, target: inputNumber(converted) })
    setUnitNotice(parsed !== null && converted === null ? 'rechner_conversion_missing' : '')
  }
  const changeMode = (mode: LiquidValues['mode']) => {
    if (mode === values.mode) return
    const concentration = result.concentration === null ? null
      : convertLiquidValue(result.concentration, baseUnit, values.sourceUnit, null)
    const container = parseDecimalInput(values.container)
    setValues({ ...values, mode, ...(mode === 'concentration'
      ? { concentration: inputNumber(concentration), container: concentration === null ? '' : values.volume }
      : { amount: inputNumber(concentration !== null && container !== null ? concentration * container : null), volume: values.container }) })
    setSelected(''); setUnitNotice('')
  }
  const input = (field: NumericField, suffix?: ReactNode) => <div className="rechner-field">
    <label htmlFor={`dose-${field}`}>{labels[field]}</label>
    <div className={`rechner-input-group${suffix && typeof suffix !== 'string' ? ' rechner-input-with-unit' : ''}`}>
      <input id={`dose-${field}`} type="text" inputMode="decimal" autoComplete="off" className="rechner-input"
        value={values[field]} aria-invalid={Boolean(result.fieldErrors[field])}
        aria-describedby={result.fieldErrors[field] ? `dose-${field}-error` : undefined}
        onChange={event => edit(field, event.target.value)} />
      {typeof suffix === 'string' ? <span className="rechner-input-suffix" aria-hidden="true">{suffix}</span> : suffix}
    </div>
    {result.fieldErrors[field] && <span className="rechner-error" id={`dose-${field}-error`}>
      {t(result.fieldErrors[field] === 'numeric_range' ? 'rechner_numeric_range' : 'rechner_positive')}
    </span>}
  </div>
  const sourceUnitSelect = <select id="dose-source-unit" className="rechner-select" value={values.sourceUnit}
    aria-label={t('rechner_source_unit')} onChange={event => changeSourceUnit(event.target.value as LiquidUnit)}>
    {sourceUnits.map(unit => <option key={unit} value={unit}>{unitLabel(unit)}{values.mode === 'concentration' ? '/mL' : ''}</option>)}
  </select>
  const targetUnitSelect = <select id="dose-unit" className="rechner-select" value={values.targetUnit}
    aria-label={t('rechner_target_unit')} onChange={event => changeTargetUnit(event.target.value as TargetUnit)}>
    {(values.sourceUnit === 'iu' ? ['iu', 'ml'] as const : ['mcg', 'mg', 'g', 'ml'] as const)
      .map(unit => <option key={unit} value={unit}>{unitLabel(unit)}</option>)}
  </select>
  const summary = valid ? [
    t('rechner_dose_tab'), ...(source ? [`${t('rechner_stack_source')}: ${source.label}`] : []),
    ...(values.mode === 'amount' && result.concentration !== null ? [
      `${labels.amount}: ${values.amount} ${unitLabel(values.sourceUnit)}`,
      `${labels.volume}: ${values.volume} mL`,
    ] : []),
    ...(result.concentration === null ? [] : [`${t('konzentration')}: ${amountLabel(result.concentration)}/mL`]),
    `${labels.target}: ${format(parseDecimalInput(values.target)!)} ${unitLabel(values.targetUnit)}`,
    `${t('rechner_converter_syringe')}: ${format(capacityUnits)} ${t('rechner_converter_scale_units')} = ${format(capacityMl)} mL`,
    `${t('rechner_result')}: ${format(result.drawUnits!)} ${t('rechner_converter_scale_units')} = ${format(result.drawMl!)} mL`,
    ...(scale.minorStep === null ? [] : [`${t('rechner_graduation_label')}: ${format(scale.minorStep)}`]),
    tickNote,
    ...(result.fullWithdrawals === null ? [] : [`${t('rechner_full_withdrawals')}: ${format(result.fullWithdrawals)}`]),
    t('rechner_precision_note'),
  ].join('\n') : ''

  return <div className="rechner-workspace">
    <aside className="rechner-syringe-rail" aria-label={t('rechner_syringe_preview')}>
      <SyringeScale drawUnits={result.drawUnits} capacityMl={capacityMl} capacityUnits={capacityUnits}
        minorStep={scale.minorStep} majorStep={scale.majorStep} />
    </aside>
    <form className="rechner-scroll-form" aria-label={t('rechner_inputs')} onSubmit={event => event.preventDefault()}>
      <div className="rechner-form-toolbar">
        <p className="rechner-muted">{t('rechner_live_hint')}</p>
        <button type="button" className="rechner-button" onClick={reset} aria-label={t('rechner_reset')}>
          <RotateCcw size={16} aria-hidden="true" /><span>{t('rechner_reset')}</span>
        </button>
      </div>
      <section className="rechner-card" aria-labelledby="dose-solution-title">
        <h2 id="dose-solution-title"><span className="rechner-step-number">1</span><FlaskConical size={18} aria-hidden="true" />{t('rechner_step_solution')}</h2>
        <div className="rechner-step-content">
          <div className="rechner-source-modes" role="group" aria-label={t('rechner_solution_mode')}>
            {(['amount', 'concentration'] as const).map(mode => <button key={mode} type="button"
              aria-pressed={mode === values.mode} onClick={() => changeMode(mode)}>{t(`rechner_mode_${mode}`)}</button>)}
          </div>
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
                    const next = currentStack.sources.find(item => item.id === event.target.value)
                    setSelected(event.target.value)
                    setValues(current => ({ ...current, mode: next?.isReference ? 'concentration' : 'amount', sourceUnit: 'mg',
                      amount: next ? String(next.vialAmountMg) : '', volume: next?.diluentMl == null ? '' : String(next.diluentMl),
                      concentration: next?.isReference && next.diluentMl ? inputNumber(next.vialAmountMg / next.diluentMl) : '',
                      container: '',
                      targetUnit: current.targetUnit === 'iu' ? 'mcg' : current.targetUnit,
                      target: current.targetUnit === 'iu' ? '' : current.target,
                    }))
                    setUnitNotice('')
                  }}>
                    <option value="">{t('rechner_manual')}</option>
                    {currentStack.sources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <p className="rechner-muted">{t(selected ? 'rechner_source_note' : 'rechner_stack_hint')}</p>
              </> : <p className="rechner-muted">{t('rechner_stack_empty')}</p>}
          </div>}
          {input(values.mode === 'amount' ? 'amount' : 'concentration', sourceUnitSelect)}
          {values.mode === 'amount' ? <>
            {input('volume', 'mL')}
            <div className="rechner-volume-presets" role="group" aria-label={t('rechner_volume_presets')}>
              {[1, 2, 3, 5].map(ml => <button type="button" key={ml} aria-pressed={parseDecimalInput(values.volume) === ml}
                onClick={() => edit('volume', String(ml))}>{ml} mL</button>)}
            </div>
            <p className="rechner-muted">{t('rechner_final_volume_hint')}</p>
          </> : input('container', 'mL')}
          {values.sourceUnit === 'iu' && <p className="rechner-muted">{t('rechner_family_note')}</p>}
          <div className="rechner-concentration" role="status" aria-label={t('rechner_concentration_label')} aria-atomic="true">
            <div><span>{t('konzentration')}</span><strong>{result.concentration !== null ? `${amountLabel(result.concentration)}/mL` : '—'}</strong></div>
            {result.concentrationError && <p className="rechner-error">{t(
              Object.values(result.fieldErrors).includes('positive') ? 'rechner_positive' : 'rechner_numeric_range',
            )}</p>}
            {result.concentration !== null && <>
              <div><span>{t('rechner_per_scale', { count: 1 })}</span><b>{amountLabel(perUnit)}</b></div>
              <div><span>{t('rechner_per_scale', { count: 10 })}</span><b>{amountLabel(perUnit === null ? null : perUnit * 10)}</b></div>
            </>}
          </div>
        </div>
      </section>
      <section className="rechner-card" aria-labelledby="dose-target-title">
        <h2 id="dose-target-title"><span className="rechner-step-number">2</span><Syringe size={18} aria-hidden="true" />{t('rechner_withdrawal')}</h2>
        <div className="rechner-step-content">
          {input('target', targetUnitSelect)}
          {unitNotice && <p className="rechner-muted" role="status">{t(unitNotice)}</p>}
          {error && <p className="rechner-error" role="alert">{error}</p>}
          <SyringeFields key={resetVersion} idPrefix="dose-syringe" capacityMl={values.capacityMl} capacityUnits={values.capacityUnits}
            onChange={(ml, units) => setValues(current => ({ ...current, capacityMl: ml, capacityUnits: units }))}
            onGraduationChange={setGraduation} />
        </div>
      </section>
      <section className="rechner-card rechner-result-card" aria-labelledby="dose-result-title">
        <h2 id="dose-result-title"><span className="rechner-step-number">3</span>{t('rechner_result')}</h2>
        {error ? <p className="rechner-error">{error}</p>
          : valid ? <div className="rechner-result" role="status" aria-label={t('rechner_result_label')} aria-live="polite" aria-atomic="true">
            <p className="rechner-muted">{t('einheiten_aufziehen')}</p>
            <p className="rechner-result-value">{format(result.drawUnits!)} <span className="rechner-result-unit">{t('rechner_converter_scale_units')}</span></p>
            <dl className="rechner-result-grid">
              <div><dt>{t('rechner_converter_volume')}</dt><dd>{format(result.drawMl!)} mL</dd></div>
              <div><dt>{t('rechner_full_withdrawals')}</dt><dd>{result.fullWithdrawals === null ? '—' : format(result.fullWithdrawals)}</dd></div>
            </dl>
            <p className="rechner-tick-note">{tickNote}</p>
          </div> : <p className="rechner-muted">{t('rechner_liquid_empty')}</p>}
        {valid && <><p className="rechner-muted">{t('rechner_precision_note')}</p><CopyCalculation key={summary} text={summary} /></>}
      </section>
      <p className="rechner-muted rechner-disclaimer">{t('info_disclaimer')}</p>
    </form>
  </div>
}
