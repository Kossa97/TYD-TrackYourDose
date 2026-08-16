// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  DosageFormKey,
  IntakePlanDraft,
  SubstanceCatalogEntry,
  TrackingLevel,
} from '../types'
import { IntakePlanEditor } from './IntakePlanEditor'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

const vitaminD3: SubstanceCatalogEntry = {
  id: 'vitamin-d3',
  canonical_name: 'Vitamin D3',
  aliases: ['Cholecalciferol'],
  default_category: 'vitamin',
  suggested_units: ['IU', 'mcg'],
  suggested_dosage_forms: ['tablet', 'capsule', 'drops'],
  pk_profile_id: null,
  active: true,
}

const plan: IntakePlanDraft = {
  name: 'Vitamin D3',
  dose: null,
  unit: null,
  method: '',
  frequency: 'Täglich',
  xDaysInterval: null,
  scheduleDays: [],
  startDate: '2026-08-16',
  endDate: null,
  routineGroup: 'morning',
  time: null,
  reminders: [],
}

function PlanHarness({
  trackingLevel,
  dosageForm,
  initialPlan = plan,
}: {
  trackingLevel: TrackingLevel
  dosageForm: DosageFormKey
  initialPlan?: IntakePlanDraft
}) {
  const [value, setValue] = useState(initialPlan)
  return (
    <IntakePlanEditor
      trackingLevel={trackingLevel}
      plan={value}
      dosageForm={dosageForm}
      catalogEntry={vitaminD3}
      onChange={changes => setValue(current => ({ ...current, ...changes }))}
    />
  )
}

afterEach(cleanup)

describe('IntakePlanEditor', () => {
  it('shows a required method and editable start/effective date without inferring a route', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="capsule" />)

    const method = screen.getByLabelText('Methode') as HTMLSelectElement
    const startDate = screen.getByLabelText('Start / gültig ab') as HTMLInputElement
    expect(method.required).toBe(true)
    expect(method.value).toBe('')
    expect(Array.from(method.options).map(option => option.value)).toEqual(expect.arrayContaining([
      'Subkutan', 'Intramuskulär', 'Nasal', 'Oral', 'Transdermal', 'Intravenös', 'Andere',
    ]))
    expect(startDate.required).toBe(true)
    expect(startDate.value).toBe('2026-08-16')
  })

  it('omits planned quantity for intake-only tracking', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="tablet" />)

    expect(screen.queryByLabelText('Geplante Menge pro Einnahme')).toBeNull()
    expect(screen.queryByLabelText('Einheit der geplanten Menge')).toBeNull()
    expect(screen.getByLabelText('Frequenz')).toBeTruthy()
  })

  it.each(['with_amount', 'complete'] as const)('shows quantity and unit for %s', trackingLevel => {
    render(<PlanHarness trackingLevel={trackingLevel} dosageForm="tablet" />)

    expect(screen.getByLabelText('Geplante Menge pro Einnahme')).toBeTruthy()
    expect(screen.getByLabelText('Einheit der geplanten Menge')).toBeTruthy()
    if (trackingLevel === 'complete') expect(screen.queryByLabelText('Stärke')).toBeNull()
  })

  it('requires a routine group while keeping exact time optional', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="capsule" />)

    expect((screen.getByRole('radio', { name: 'Morgens' }) as HTMLInputElement).required).toBe(true)
    expect((screen.getByLabelText('Genaue Uhrzeit (optional)') as HTMLInputElement).required).toBe(false)
    expect(screen.getByText(/Erinnerungen sind optional/)).toBeTruthy()
  })

  it('sets tablet fractions and never suggests splitting capsules', () => {
    const { rerender } = render(<PlanHarness trackingLevel="with_amount" dosageForm="tablet" />)
    const quantity = screen.getByLabelText('Geplante Menge pro Einnahme') as HTMLInputElement

    fireEvent.click(screen.getByRole('button', { name: '1/2 Tablette' }))
    expect(quantity.value).toBe('0.5')
    fireEvent.click(screen.getByRole('button', { name: '1/3 Tablette' }))
    expect(quantity.value).toBe('0.333333')
    fireEvent.click(screen.getByRole('button', { name: '1/4 Tablette' }))
    expect(quantity.value).toBe('0.25')

    rerender(<PlanHarness trackingLevel="with_amount" dosageForm="capsule" />)
    const capsuleQuantity = screen.getByLabelText('Geplante Menge pro Einnahme') as HTMLInputElement
    fireEvent.change(capsuleQuantity, { target: { value: '0.75' } })
    expect(capsuleQuantity.value).toBe('0.75')
    expect(screen.queryByRole('button', { name: /Kapsel/ })).toBeNull()
  })

  it('offers catalog units for Vitamin D3 tablets and capsules', () => {
    const { container, rerender } = render(
      <PlanHarness trackingLevel="with_amount" dosageForm="tablet" />,
    )

    expect(Array.from(container.querySelectorAll('datalist option')).map(option => option.getAttribute('value')))
      .toEqual(expect.arrayContaining(['IU', 'mcg', 'tablet']))

    rerender(<PlanHarness trackingLevel="with_amount" dosageForm="capsule" />)
    expect(Array.from(container.querySelectorAll('datalist option')).map(option => option.getAttribute('value')))
      .toEqual(expect.arrayContaining(['IU', 'mcg', 'capsule']))
  })

  it('does not reinsert an incompatible stale capsule unit for a liquid plan', () => {
    const staleCapsulePlan = { ...plan, unit: 'capsule' }
    const { container } = render(
      <PlanHarness
        trackingLevel="with_amount"
        dosageForm="liquid"
        initialPlan={staleCapsulePlan}
      />,
    )

    const suggestions = Array.from(container.querySelectorAll('datalist option'))
      .map(option => option.getAttribute('value'))
    expect(suggestions).toContain('ml')
    expect(suggestions).not.toContain('capsule')
  })

  it('adapts quantity labels and controls to liquids and injectables', () => {
    const { rerender } = render(<PlanHarness trackingLevel="with_amount" dosageForm="liquid" />)

    expect(screen.getByLabelText('Flüssigkeitsmenge pro Einnahme')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tablette/ })).toBeNull()

    rerender(<PlanHarness trackingLevel="with_amount" dosageForm="vial" />)
    expect(screen.getByLabelText('Injektionsmenge pro Einnahme')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tablette/ })).toBeNull()
  })

  it('shows weekday and interval controls only for their frequencies', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="capsule" />)
    const frequency = screen.getByLabelText('Frequenz')

    fireEvent.change(frequency, { target: { value: 'Wochentage wählen' } })
    expect(screen.getByRole('group', { name: 'Wochentage' })).toBeTruthy()

    fireEvent.change(frequency, { target: { value: 'Alle X Tage' } })
    expect(screen.getByLabelText('Intervall in Tagen')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Wochentage' })).toBeNull()
  })
})
