// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import { loadStackItems, type LoadedStackItem } from './services/stackItems'
import type { StackItemWizardProps } from './components/StackItemWizard'
import { MyStackPage } from './MyStackPage'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDosageForm } from './lib/dosageForms'

const qaName = 'Codex QA Stack Lifecycle 2026-07-24'
const visibilityMocks = vi.hoisted(() => ({
  escalations: [] as Array<Record<string, unknown>>,
}))

type LoadedLegacyStackItem = LoadedStackItem & { default_method?: string }
const loadedItems: LoadedLegacyStackItem[] = [
  {
    id: 'tablet-1',
    user_id: 'user-1',
    display_name: qaName,
    category: 'supplement',
    dosage_form: 'tablet',
    brand: 'Codex QA Brand A',
    color_hex: '#f97316',
    notes: null,
    configuration_status: 'complete',
    tracking_level: 'complete',
    pk_profile_method: null,
    archived: false,
    archived_at: null,
    created_at: '2026-07-24T00:19:53.509875Z',
    updated_at: '2026-07-24T00:19:53.509875Z',
    default_method: 'Subkutan',
    ingredients: [{
      id: 'ingredient-1',
      stack_item_id: 'tablet-1',
      catalog_substance_id: null,
      custom_name: 'Magnesium',
      amount_value: 100,
      amount_unit: 'mg',
      basis_value: 1,
      basis_unit: 'tablet',
      position: 0,
      substance_catalog: null,
    }, {
      id: 'ingredient-1b',
      stack_item_id: 'tablet-1',
      catalog_substance_id: 'vitamin-d3',
      custom_name: '',
      amount_value: 5_000,
      amount_unit: 'IU',
      basis_value: 1,
      basis_unit: 'tablet',
      position: 1,
      substance_catalog: {
        id: 'vitamin-d3',
        canonical_name: 'Vitamin D3',
        aliases: [],
        default_category: 'vitamin',
        suggested_units: ['IU'],
        suggested_dosage_forms: ['tablet'],
        pk_profile_id: 'pk-vitamin-d3',
        active: true,
      },
    }],
  },
  {
    id: 'vial-1',
    user_id: 'user-1',
    display_name: 'Existing Premium Vial',
    category: 'peptide',
    dosage_form: 'vial',
    brand: null,
    color_hex: '#06b6d4',
    notes: null,
    configuration_status: 'complete',
    tracking_level: 'complete',
    pk_profile_method: null,
    archived: false,
    archived_at: null,
    created_at: '2026-07-21T10:00:00.000Z',
    updated_at: '2026-07-21T10:00:00.000Z',
    ingredients: [{
      id: 'ingredient-2',
      stack_item_id: 'vial-1',
      catalog_substance_id: null,
      custom_name: 'Existing Premium Vial',
      amount_value: 5,
      amount_unit: 'mg',
      basis_value: 1,
      basis_unit: 'vial',
      position: 0,
      substance_catalog: null,
    }],
  },
]

const activeCycle = {
  id: 'cycle-active-1',
  user_id: 'user-1',
  stack_item_id: 'tablet-1',
  name: 'Abendplan',
  dose: 100,
  unit: 'mg',
  method: 'Oral',
  frequency: 'daily',
  x_days_interval: null,
  schedule_days: [],
  start_date: '2026-07-24',
  end_date: null,
  active: true,
  intake_time: 'abends',
  intake_time_custom: '20:30',
  schedule_history: null,
  reminder: '10m',
  created_at: '2026-07-24T00:30:00.000Z',
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('../../lib/supabase', () => {
  return { supabase: { from: (table: string) => {
    const builder: Record<string, unknown> = {}
    builder.select = () => builder
    builder.eq = () => builder
    builder.order = () => builder
    builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({
      data: table === 'dose_escalations' ? visibilityMocks.escalations : [],
      error: null,
    }).then(resolve)
    return builder
  } } }
})

vi.mock('../../lib/useNew', () => ({
  useNew: () => [false, vi.fn()],
}))

vi.mock('../../components/SloshContext', () => ({
  SloshProvider: ({ children }: { children: React.ReactNode }) => children,
  useSloshEngine: () => ({ pushImpulse: vi.fn() }),
}))

vi.mock('../../components/LabLoader', () => ({
  LabLoader: () => null,
}))

vi.mock('./components/StackStage', () => ({
  StackStage: ({ item }: { item: LoadedStackItem }) => (
    <div data-testid={`stack-stage-${item.id}`}>{item.display_name}</div>
  ),
}))

vi.mock('./components/StackItemWizard', () => ({
  StackItemWizard: ({ catalogEntries, existingItem, existingPlan, intent, onClose, onSave }: StackItemWizardProps) => (
    <div role="dialog" aria-label="stack-item-wizard">
      <span data-testid="wizard-catalog-ids">{catalogEntries.map(entry => entry.id).join(',')}</span>
      <span data-testid="wizard-intent">{intent ?? ''}</span>
      <span data-testid="wizard-item-id">{existingItem?.id ?? ''}</span>
      <span data-testid="wizard-plan-id">{existingPlan?.id ?? ''}</span>
      <span data-testid="wizard-plan-method">{existingPlan?.method ?? ''}</span>
      <span data-testid="wizard-plan-dose">{existingPlan?.dose ?? ''}</span>
      <span data-testid="wizard-plan-unit">{existingPlan?.unit ?? ''}</span>
      <span data-testid="wizard-plan-frequency">{existingPlan?.frequency ?? ''}</span>
      <span data-testid="wizard-plan-routine-group">{existingPlan?.routineGroup ?? ''}</span>
      <span data-testid="wizard-plan-time">{existingPlan?.time ?? ''}</span>
      <button
        type="button"
        onClick={() => {
          const inventory = {
            enabled: false,
            packageQuantity: null,
            packageUnit: null,
            remainingQuantity: null,
            brand: '',
            batchNumber: '',
            expiresAt: null,
          }
          if (existingItem && existingPlan) {
            void onSave({
              id: existingItem.id,
              displayName: existingItem.display_name,
              trackingLevel: existingItem.tracking_level,
              category: existingItem.category,
              dosageForm: existingItem.dosage_form,
              brand: existingItem.brand ?? '',
              colorHex: existingItem.color_hex ?? '',
              notes: existingItem.notes ?? '',
              ingredients: existingItem.ingredients,
              pkProfileMethod: existingItem.pk_profile_method,
              plan: existingPlan,
              inventory,
            }, 'update').then(onClose)
            return
          }
          void onSave({
            displayName: 'New setup',
            trackingLevel: 'intake_only',
            category: 'supplement',
            dosageForm: 'tablet',
            brand: '',
            colorHex: '#f97316',
            notes: '',
            ingredients: [{
              catalog_substance_id: null,
              custom_name: 'New setup',
              amount_value: null,
              amount_unit: null,
              basis_value: null,
              basis_unit: null,
              position: 0,
            }],
            pkProfileMethod: null,
            plan: {
              name: 'Start plan',
              dose: null,
              unit: null,
              method: 'Oral',
              frequency: 'daily',
              xDaysInterval: null,
              scheduleDays: [],
              startDate: '2026-08-16',
              endDate: null,
              routineGroup: 'morning',
              time: null,
              reminders: [],
            },
            inventory,
          }, 'create').then(onClose)
        }}
      >
        save hydrated plan
      </button>
    </div>
  ),
}))

vi.mock('./components/StackArchive', () => ({
  StackArchive: () => null,
}))

vi.mock('./extensions/peptide/VialTrackingEditor', () => ({
  VialTrackingEditor: () => null,
  emptyVialTrackingDraft: () => ({
    name: '',
    pk_profile_id: '',
  }),
}))

vi.mock('./services/stackItems', async importOriginal => {
  const original = await importOriginal<typeof import('./services/stackItems')>()
  return {
    ...original,
    loadStackItems: vi.fn(async (_client: unknown, archived: boolean) => archived ? [] : loadedItems),
  }
})

vi.mock('./services/substanceCatalog', () => ({
  searchSubstanceCatalog: vi.fn(async () => ({ entries: [], unavailable: false })),
}))

vi.mock('./lib/colorMigration', () => ({
  isLocalColorMigrationComplete: () => true,
  migrateLocalColors: vi.fn(async () => false),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

function visibleCardFor(name: string): HTMLElement | null {
  const nameNode = screen.getAllByText(name).find(node => node.closest('.card'))
  const card = nameNode?.closest<HTMLElement>('.card') ?? null
  return card?.closest('.hidden') ? null : card
}

async function renderPage(): Promise<void> {
  render(
    <MemoryRouter initialEntries={['/my-stack']}>
      <MyStackPage />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getAllByText('Existing Premium Vial').length).toBeGreaterThan(0))
}

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location-search">{location.search}</span>
}

function versionedCycle(effectiveFrom: string) {
  const segment = {
    frequency: activeCycle.frequency,
    x_days_interval: activeCycle.x_days_interval,
    schedule_days: activeCycle.schedule_days,
    intake_time: activeCycle.intake_time,
    intake_time_custom: activeCycle.intake_time_custom,
  }
  return {
    ...activeCycle,
    schedule_history: [
      { ...segment, effective_from: activeCycle.start_date, dose: 100, unit: 'mg' },
      { ...segment, effective_from: effectiveFrom, dose: 150, unit: 'mg' },
    ],
  }
}

describe('MyStackPage non-vial visibility', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('tyd_peptide_view', 'vials')
    visibilityMocks.escalations = []
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps an active non-vial item visible and editable beside the premium vial stage', async () => {
    await renderPage()

    const card = visibleCardFor(qaName)
    expect(card).not.toBeNull()
    expect(screen.getByTestId('stack-stage-vial-1')).not.toBeNull()
    expect(screen.queryByTestId('stack-stage-tablet-1')).toBeNull()
    const actions = within(card!)
    expect(actions.getByRole('button', { name: 'bearbeiten' })).not.toBeNull()
    expect(actions.getByRole('button', { name: 'loeschen' })).not.toBeNull()
  })


  it('summarizes a non-vial item with dosage form and ingredient strength', async () => {
    await renderPage()

    const card = visibleCardFor(qaName)
    expect(card).not.toBeNull()
    expect(card?.textContent).toContain('dosage_form_tablet')
    expect(card?.textContent).toContain('Magnesium: 100 mg / 1 tablet')
    expect(card?.textContent).toContain('Vitamin D3: 5000 IU / 1 tablet')
    expect(card?.textContent).not.toContain('method_subkutan')
  })
  it('shows an exact-name non-vial search result instead of a blank vial view', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'peptid_suchen' }))
    fireEvent.change(screen.getByPlaceholderText('peptid_suchen'), { target: { value: qaName } })

    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    expect(screen.queryByText('kein_peptid_gefunden_msg')).toBeNull()
  })

  it('opens a PK deep link with the existing item and its active plan', async () => {
    const cyclesEq = vi.fn(async () => ({ data: [activeCycle], error: null }))
    const stackDataClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: cyclesEq })) })),
    }

    render(
      <MemoryRouter initialEntries={['/my-stack?edit=tablet-1&intent=pk']}>
        <LocationProbe />
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'stack-item-wizard' })).toBeTruthy())
    expect(screen.getByTestId('wizard-intent').textContent).toBe('pk')
    expect(screen.getByTestId('wizard-item-id').textContent).toBe('tablet-1')
    expect(screen.getByTestId('wizard-plan-id').textContent).toBe('cycle-active-1')
    expect(screen.getByTestId('wizard-plan-method').textContent).toBe('Oral')
    expect(screen.getByTestId('wizard-plan-dose').textContent).toBe('100')
    expect(screen.getByTestId('wizard-plan-unit').textContent).toBe('mg')
    expect(screen.getByTestId('wizard-catalog-ids').textContent).toContain('vitamin-d3')
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe(''))
  })

  it.each([
    { label: 'before the future boundary', offsetDays: 1, dose: 100 },
    { label: 'on the effective-date boundary', offsetDays: 0, dose: 150 },
  ])('hydrates and saves the active schedule quantity $label', async ({ offsetDays, dose }) => {
    localStorage.setItem('tyd_peptide_view', 'list')
    const cycle = versionedCycle(format(addDays(new Date(), offsetDays), 'yyyy-MM-dd'))
    const cyclesEq = vi.fn(async () => ({ data: [cycle], error: null }))
    const cyclesSelect = vi.fn(() => ({ eq: cyclesEq }))
    const rpc = vi.fn(async () => ({ data: loadedItems[0], error: null }))
    const stackDataClient = {
      from: vi.fn((table: string) => {
        if (table !== 'cycles') throw new Error(`Unexpected table: ${table}`)
        return { select: cyclesSelect }
      }),
      rpc,
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())

    fireEvent.click(within(visibleCardFor(qaName)!).getByRole('button', { name: 'bearbeiten' }))

    expect(screen.getByTestId('wizard-plan-id').textContent).toBe(cycle.id)
    expect(screen.getByTestId('wizard-plan-method').textContent).toBe(cycle.method)
    expect(screen.getByTestId('wizard-plan-dose').textContent).toBe(String(dose))
    expect(screen.getByTestId('wizard-plan-unit').textContent).toBe('mg')
    fireEvent.click(screen.getByRole('button', { name: 'save hydrated plan' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({ id: cycle.id, dose, unit: 'mg' }),
    }))
    await waitFor(() => {
      const activeItemLoads = vi.mocked(loadStackItems).mock.calls.filter(
        ([client, archived]) => (client as unknown) === stackDataClient && archived === false,
      )
      expect(activeItemLoads).toHaveLength(2)
      expect(stackDataClient.from).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText('Substanz gespeichert')).toBeNull()
    expect(screen.queryByText('Zyklus anlegen')).toBeNull()
  })

  it('hydrates the base segment without folding an active escalation into the editable dose', async () => {
    localStorage.setItem('tyd_peptide_view', 'list')
    const cycle = {
      ...activeCycle,
      dose: 5,
      unit: 'mg',
    }
    visibilityMocks.escalations = [{
      id: 'same-unit-step',
      cycle_id: cycle.id,
      increase_amount: 5,
      unit: 'mg',
      start_type: 'date',
      start_date: activeCycle.start_date,
      start_after_days: null,
      notes: null,
    }]
    const cyclesEq = vi.fn(async () => ({ data: [cycle], error: null }))
    const rpc = vi.fn(async () => ({ data: loadedItems[0], error: null }))
    const stackDataClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: cyclesEq })) })),
      rpc,
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())

    fireEvent.click(within(visibleCardFor(qaName)!).getByRole('button', { name: 'bearbeiten' }))

    expect(screen.getByTestId('wizard-plan-dose').textContent).toBe('5')
    expect(screen.getByTestId('wizard-plan-unit').textContent).toBe('mg')
    fireEvent.click(screen.getByRole('button', { name: 'save hydrated plan' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({ id: cycle.id, dose: 5, unit: 'mg' }),
    }))
    expect(visibilityMocks.escalations).toHaveLength(1)
  })

  it('hydrates every editable schedule field from the segment active before a future change', async () => {
    localStorage.setItem('tyd_peptide_view', 'list')
    const futureDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const cycle = {
      ...activeCycle,
      dose: 150,
      frequency: 'Wochentage wählen',
      schedule_days: ['Mo'],
      intake_time: 'morgens',
      intake_time_custom: '09:30',
      schedule_history: [{
        effective_from: activeCycle.start_date,
        frequency: 'Täglich',
        x_days_interval: null,
        schedule_days: [],
        intake_time: 'abends',
        intake_time_custom: '20:30',
        dose: 100,
        unit: 'mg',
      }, {
        effective_from: futureDate,
        frequency: 'Wochentage wählen',
        x_days_interval: null,
        schedule_days: ['Mo'],
        intake_time: 'morgens',
        intake_time_custom: '09:30',
        dose: 150,
        unit: 'mg',
      }],
    }
    const cyclesEq = vi.fn(async () => ({ data: [cycle], error: null }))
    const rpc = vi.fn(async () => ({ data: loadedItems[0], error: null }))
    const stackDataClient = {
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: cyclesEq })) })),
      rpc,
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())

    fireEvent.click(within(visibleCardFor(qaName)!).getByRole('button', { name: 'bearbeiten' }))

    expect(screen.getByTestId('wizard-plan-dose').textContent).toBe('100')
    expect(screen.getByTestId('wizard-plan-frequency').textContent).toBe('Täglich')
    expect(screen.getByTestId('wizard-plan-routine-group').textContent).toBe('evening')
    expect(screen.getByTestId('wizard-plan-time').textContent).toBe('20:30')
  })

  it('does not show the retired cycle prompt after atomically saving a new setup', async () => {
    localStorage.setItem('tyd_peptide_view', 'list')
    const cyclesEq = vi.fn(async () => ({ data: [], error: null }))
    const cyclesSelect = vi.fn(() => ({ eq: cyclesEq }))
    const rpc = vi.fn(async () => ({ data: loadedItems[0], error: null }))
    const stackDataClient = {
      from: vi.fn(() => ({ select: cyclesSelect })),
      rpc,
    }

    render(
      <MemoryRouter initialEntries={['/my-stack']}>
        <MyStackPage stackDataClient={stackDataClient as never} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'neues_peptid_title' })).not.toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'neues_peptid_title' }))
    fireEvent.click(screen.getByRole('button', { name: 'save hydrated plan' }))

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1))
    expect(rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_item: expect.objectContaining({ id: null }),
      p_plan: expect.objectContaining({ id: null }),
    }))
    expect(screen.queryByText('Substanz gespeichert')).toBeNull()
    expect(screen.queryByText('Zyklus anlegen')).toBeNull()
  })
})

describe('Füllstandsanzeige im Karussell', () => {
  it('bindet die Prozentzeile an die Form statt an die Darreichungsform', () => {
    const source = readFileSync(resolve('src/features/my-stack/MyStackPage.tsx'), 'utf8')

    expect(source).toContain('hasMeaningfulFill')
    expect(source).toContain('isActive && showsFillPct')
    // no branching on the dosage form itself — a new form must only have to
    // declare its capabilities, not be added here as well
    expect(source).not.toMatch(/dosage_form === '/)
  })

  it('kennt genau eine Glasform mit aussagekräftigem Füllstand', () => {
    expect(getDosageForm('vial').stageForm?.hasMeaningfulFill).toBe(true)
    expect(getDosageForm('ampoule').stageForm?.hasMeaningfulFill).toBe(false)
  })
})
