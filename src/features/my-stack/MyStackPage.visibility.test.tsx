// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { LoadedStackItem } from './services/stackItems'
import { MyStackPage } from './MyStackPage'

const qaName = 'Codex QA Stack Lifecycle 2026-07-24'

type LoadedLegacyStackItem = LoadedStackItem & { default_method?: string }
const loadedItems: LoadedLegacyStackItem[] = [
  {
    id: 'capsule-1',
    user_id: 'user-1',
    display_name: qaName,
    category: 'supplement',
    dosage_form: 'capsule',
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
      stack_item_id: 'capsule-1',
      catalog_substance_id: null,
      custom_name: 'Magnesium',
      amount_value: 100,
      amount_unit: 'mg',
      basis_value: 1,
      basis_unit: 'capsule',
      position: 0,
      substance_catalog: null,
    }, {
      id: 'ingredient-1b',
      stack_item_id: 'capsule-1',
      catalog_substance_id: 'vitamin-d3',
      custom_name: '',
      amount_value: 5_000,
      amount_unit: 'IU',
      basis_value: 1,
      basis_unit: 'capsule',
      position: 1,
      substance_catalog: {
        id: 'vitamin-d3',
        canonical_name: 'Vitamin D3',
        aliases: [],
        default_category: 'vitamin',
        suggested_units: ['IU'],
        suggested_dosage_forms: ['capsule'],
        pk_profile_id: null,
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('../../lib/supabase', () => {
  const result = { data: [], error: null }
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = () => builder
  builder.order = () => builder
  builder.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
  return { supabase: { from: () => builder } }
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
  StackItemWizard: () => null,
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

describe('MyStackPage non-vial visibility', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('tyd_peptide_view', 'vials')
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
    expect(screen.queryByTestId('stack-stage-capsule-1')).toBeNull()
    const actions = within(card!)
    expect(actions.getByRole('button', { name: 'bearbeiten' })).not.toBeNull()
    expect(actions.getByRole('button', { name: 'loeschen' })).not.toBeNull()
  })


  it('summarizes a non-vial item with dosage form and ingredient strength', async () => {
    await renderPage()

    const card = visibleCardFor(qaName)
    expect(card).not.toBeNull()
    expect(card?.textContent).toContain('dosage_form_capsule')
    expect(card?.textContent).toContain('Magnesium: 100 mg / 1 capsule')
    expect(card?.textContent).toContain('Vitamin D3: 5000 IU / 1 capsule')
    expect(card?.textContent).not.toContain('method_subkutan')
  })
  it('shows an exact-name non-vial search result instead of a blank vial view', async () => {
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'peptid_suchen' }))
    fireEvent.change(screen.getByPlaceholderText('peptid_suchen'), { target: { value: qaName } })

    await waitFor(() => expect(visibleCardFor(qaName)).not.toBeNull())
    expect(screen.queryByText('kein_peptid_gefunden_msg')).toBeNull()
  })
})
