// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { createElement, type ComponentType } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dashboard, buildDashboardRoutineIntake } from './Dashboard'

const pageMocks = vi.hoisted(() => {
  const emptyQuery = () => {
    const query: Record<string, unknown> = {}
    for (const method of ['eq', 'gte', 'lte', 'order', 'limit', 'single']) {
      query[method] = vi.fn(() => query)
    }
    query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
      Promise.resolve({ data: [], error: null }).then(resolve, reject)
    )
    return query
  }
  return {
    user: { id: 'user-1' },
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(emptyQuery),
        insert: vi.fn(emptyQuery),
        update: vi.fn(emptyQuery),
        delete: vi.fn(emptyQuery),
      })),
      rpc: vi.fn(async () => ({ data: [], error: null })),
    },
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  }
})

vi.mock('../lib/supabase', () => ({ supabase: pageMocks.supabase }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: pageMocks.user }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}))
vi.mock('react-hot-toast', () => ({ default: pageMocks.toast }))

interface RecordedMutation {
  table: string
  kind: 'insert' | 'update' | 'delete'
  values: unknown
}

function resolvedQuery(data: unknown) {
  const query: Record<string, unknown> = {}
  for (const method of ['eq', 'gte', 'lte', 'order', 'limit', 'single']) {
    query[method] = vi.fn(() => query)
  }
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
    Promise.resolve({ data, error: null }).then(resolve, reject)
  )
  return query
}

function createDashboardClient(
  fixtures: Record<string, unknown[]>,
  rpcImplementation: (name: string, params: unknown) => Promise<{
    data: unknown
    error: { message: string } | null
  }> = async () => ({ data: [{ id: 'saved-log-1' }], error: null }),
) {
  const selectCounts = new Map<string, number>()
  const mutations: RecordedMutation[] = []
  const rpc = vi.fn(rpcImplementation)
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => {
      selectCounts.set(table, (selectCounts.get(table) ?? 0) + 1)
      return resolvedQuery(fixtures[table] ?? [])
    }),
    insert: vi.fn((values: unknown) => {
      mutations.push({ table, kind: 'insert', values })
      return resolvedQuery(null)
    }),
    update: vi.fn((values: unknown) => {
      mutations.push({ table, kind: 'update', values })
      return resolvedQuery(null)
    }),
    delete: vi.fn(() => {
      mutations.push({ table, kind: 'delete', values: null })
      return resolvedQuery(null)
    }),
  }))
  return { from, rpc, selectCounts, mutations }
}

function intakeOnlyCycle() {
  return {
    id: 'cycle-1',
    name: 'Vitamin D3',
    stack_item_id: 'stack-1',
    dose: 100,
    unit: 'mcg',
    method: 'Oral',
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    start_date: '2020-01-01',
    end_date: null,
    active: true,
    intake_time: 'morgens',
    intake_time_custom: null,
    schedule_history: null,
    stack_items: { display_name: 'Vitamin D3', tracking_level: 'intake_only' },
  }
}

function renderDashboard(client: ReturnType<typeof createDashboardClient>) {
  const TestDashboard = Dashboard as ComponentType<{ dashboardDataClient: unknown }>
  return render(createElement(MemoryRouter, null, createElement(TestDashboard, { dashboardDataClient: client })))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Dashboard intake confirmation actions', () => {
  it('adapts a dashboard slot to the shared group model without a fake intake-only quantity', () => {
    const intake = buildDashboardRoutineIntake({
      key: 'cycle-1-720',
      cycleId: 'cycle-1',
      pendingLogId: 'pending-1',
      stackItemId: 'stack-1',
      stackItemName: 'Vitamin D3',
      trackingLevel: 'intake_only',
      routineGroup: 'midday',
      minutes: 720,
      scheduledAt: '2026-07-29T12:00:00.000Z',
      dose: 100,
      unit: 'mcg',
      method: 'Subkutan',
    })

    expect(intake).toMatchObject({
      pendingLogId: 'pending-1',
      group: 'midday',
      dose: null,
      unit: null,
      injectable: true,
    })
  })

  it('confirms an intake-only group with one RPC and one post-success log reload', async () => {
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Alle als eingenommen markieren' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alle als eingenommen markieren' }))

    expect(await within(dialog).findByText('Routine gespeichert')).toBeTruthy()
    expect(client.rpc).toHaveBeenCalledTimes(1)
    expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ dose: null, unit: null })],
    })
    await waitFor(() => expect(client.selectCounts.get('dose_logs')).toBe(2))
  })

  it('shows and persists no quantity when confirming one pending intake-only slot', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [{
        id: 'pending-1',
        stack_item_id: 'stack-1',
        dose: 100,
        unit: 'mcg',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: null,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    expect(await screen.findByText('Menge nicht getrackt')).toBeTruthy()
    expect(screen.queryByText('100 mcg')).toBeNull()
    expect(screen.getByRole('button', { name: 'uebersprungen' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'eingenommen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))

    await waitFor(() => expect(client.mutations).toContainEqual({
      table: 'dose_logs',
      kind: 'update',
      values: expect.objectContaining({ taken: true, dose: null, unit: null }),
    }))
    expect(client.mutations.some(mutation => mutation.table === 'stack_items')).toBe(false)
  })

  it('keeps the existing single skip action and sanitizes its intake-only quantity', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [{
        id: 'pending-1',
        stack_item_id: 'stack-1',
        dose: 100,
        unit: 'mcg',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: null,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'uebersprungen' }))

    await waitFor(() => expect(client.mutations).toContainEqual({
      table: 'dose_logs',
      kind: 'update',
      values: { taken: false, dose: null, unit: null },
    }))
  })

  it('keeps the existing single-log undo action wired', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [{
        id: 'completed-1',
        stack_item_id: 'stack-1',
        dose: null,
        unit: null,
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: true,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Rückgängig' }))

    await waitFor(() => expect(client.mutations).toContainEqual({
      table: 'dose_logs',
      kind: 'update',
      values: { taken: null },
    }))
  })

  it('atomically reverses generic inventory when undoing a completed log', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'capsule',
        stack_items: { display_name: 'Vitamin D3', tracking_level: 'complete' },
      }],
      dose_logs: [{
        id: 'completed-generic',
        stack_item_id: 'stack-1',
        dose: 1,
        unit: 'capsule',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: true,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Vitamin D3',
        dosage_form: 'capsule',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async () => ({ data: 42, error: null }))
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Rückgängig' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('reverse_inventory_confirmation', {
      p_dose_log_id: 'completed-generic',
      p_action: 'undo',
    }))
    expect(client.mutations.filter(mutation => mutation.table === 'dose_logs')).toHaveLength(0)
  })

  it('atomically reverses generic inventory before deleting a completed log', async () => {
    vi.stubGlobal('confirm', () => true)
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [intakeOnlyCycle()],
      dose_logs: [{
        id: 'completed-generic',
        stack_item_id: 'stack-1',
        dose: 1,
        unit: 'capsule',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: true,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Vitamin D3',
        dosage_form: 'capsule',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async () => ({ data: 42, error: null }))
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'eintrag_loeschen' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('reverse_inventory_confirmation', {
      p_dose_log_id: 'completed-generic',
      p_action: 'delete',
    }))
    expect(client.mutations.filter(mutation => mutation.table === 'dose_logs')).toHaveLength(0)
  })

  it('atomically reverses a vial ledger movement without a manual stock credit', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 5,
        unit: 'mg',
        stack_items: { display_name: 'Peptide', tracking_level: 'complete' },
      }],
      dose_logs: [{
        id: 'completed-vial',
        stack_item_id: 'stack-1',
        dose: 5,
        unit: 'mg',
        method: 'Subkutan',
        logged_at: now.toISOString(),
        notes: null,
        taken: true,
        stack_items: { display_name: 'Peptide' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Peptide',
        dosage_form: 'vial',
        tracking_level: 'complete',
        vial_amount_mg: 10,
        reconstitution_ml: 1,
        vials_in_stock: 0,
        vials_initial: 1,
        reconstitution_date: null,
      }],
      dose_escalations: [],
    }, async () => ({ data: 0.1, error: null }))
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Rückgängig' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('reverse_inventory_confirmation', {
      p_dose_log_id: 'completed-vial',
      p_action: 'undo',
    }))
    expect(client.mutations.filter(mutation => (
      mutation.table === 'dose_logs' || mutation.table === 'stack_items'
    ))).toHaveLength(0)
  })

  it('retries generic inventory without confirming an existing dose log twice', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    let inventoryAttempts = 0
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'capsule',
        stack_items: { display_name: 'Vitamin D3', tracking_level: 'complete' },
      }],
      dose_logs: [{
        id: 'pending-1',
        stack_item_id: 'stack-1',
        dose: 1,
        unit: 'capsule',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: null,
        stack_items: { display_name: 'Vitamin D3' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Vitamin D3',
        dosage_form: 'capsule',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async name => {
      if (name === 'apply_inventory_confirmation') {
        inventoryAttempts += 1
        return inventoryAttempts === 1
          ? { data: null, error: { message: 'inventory offline' } }
          : { data: 41, error: null }
      }
      return { data: [{ id: 'saved-log-1' }], error: null }
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'eingenommen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))

    const retry = await screen.findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.mutations.filter(mutation => mutation.table === 'dose_logs')).toHaveLength(1)
    expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'pending-1',
    })

    fireEvent.click(retry)
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.mutations.filter(mutation => mutation.table === 'dose_logs')).toHaveLength(1)
  })

  it('applies vial debit through the dose-log inventory RPC without a client stock write', async () => {
    const now = new Date()
    now.setHours(8, 0, 0, 0)
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'mg',
        stack_items: { display_name: 'Peptide', tracking_level: 'complete' },
      }],
      dose_logs: [{
        id: 'pending-1',
        stack_item_id: 'stack-1',
        dose: 1,
        unit: 'mg',
        method: 'Oral',
        logged_at: now.toISOString(),
        notes: null,
        taken: null,
        stack_items: { display_name: 'Peptide' },
      }],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Peptide',
        dosage_form: 'vial',
        tracking_level: 'complete',
        vial_amount_mg: 10,
        reconstitution_ml: 1,
        vials_in_stock: 2,
        vials_initial: 2,
        reconstitution_date: null,
      }],
      dose_escalations: [],
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'eingenommen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'pending-1',
    }))
    expect(client.mutations.some(mutation => mutation.table === 'stack_items')).toBe(false)
  })

  it('retries only vial stock after a committed dashboard group', async () => {
    let stockAttempts = 0
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'mg',
        stack_items: { display_name: 'Peptide', tracking_level: 'complete' },
      }],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Peptide',
        dosage_form: 'vial',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async name => {
      if (name === 'confirm_intake_group') return { data: [{ id: 'saved-vial-log' }], error: null }
      stockAttempts += 1
      return stockAttempts === 1
        ? { data: null, error: { message: 'vial stock offline' } }
        : { data: 0.9, error: null }
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Alle als eingenommen markieren' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alle als eingenommen markieren' }))

    const retry = await within(dialog).findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
    fireEvent.click(retry)
    await waitFor(() => expect(stockAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
  })

  it('retries only generic inventory after a committed group confirmation', async () => {
    let inventoryAttempts = 0
    const client = createDashboardClient({
      cycles: [{
        ...intakeOnlyCycle(),
        dose: 1,
        unit: 'capsule',
        stack_items: { display_name: 'Vitamin D3', tracking_level: 'complete' },
      }],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1',
        display_name: 'Vitamin D3',
        dosage_form: 'capsule',
        tracking_level: 'complete',
      }],
      dose_escalations: [],
    }, async name => {
      if (name === 'confirm_intake_group') {
        return { data: [{ id: 'saved-log-1' }], error: null }
      }
      inventoryAttempts += 1
      return inventoryAttempts === 1
        ? { data: null, error: { message: 'inventory offline' } }
        : { data: 41, error: null }
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Alle als eingenommen markieren' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alle als eingenommen markieren' }))

    const retry = await within(dialog).findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)

    fireEvent.click(retry)
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
  })

  it('groups open intakes into horizontal period carousels and collapsible completed list', () => {
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')

    expect(source).toContain('duePeriodCarousels')
    expect(source).toContain('snap-x snap-mandatory')
    expect(source).toContain("PERIOD_ORDER: PeriodKey[] = ['morgens', 'mittags', 'abends']")
    expect(source).toContain('completedExpanded')
    expect(source).toContain('renderConfirmedLog')
  })

  it('keeps intake cards and carousel chrome at stable dimensions', () => {
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')

    expect(source).toContain('grid grid-cols-[14px_minmax(0,1fr)_14px] items-stretch gap-0.5')
    expect(source).toContain("hasMultiple ? '' : 'invisible pointer-events-none'")
    expect(source).toContain('className="h-[188px] w-full rounded-xl border px-3 py-2.5 transition-colors"')
    expect(source).toContain('<div className="h-9">')
    expect(source).toContain('className="relative flex h-5 items-center px-0.5"')
  })

  it('defaults to week view with expandable month calendar', () => {
    const source = readFileSync('src/pages/Dashboard.tsx', 'utf8')

    expect(source).toContain('calendarExpanded')
    expect(source).toContain('const [calendarExpanded, setCalendarExpanded] = useState(false)')
    expect(source).toContain('visibleCalendarDays')
    expect(source).toContain('changeWeek')
    expect(source).toContain('calendar_expand_month')
  })
})
