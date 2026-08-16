// @vitest-environment jsdom

import { createElement, type ComponentType } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Home, buildHomeDoseLogPayload, buildHomeRoutineIntake, resolveHomeIntakeQuantity } from './Home'

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
vi.mock('../components/BlutspiegelCarousel', () => ({ BlutspiegelCarousel: () => null }))
vi.mock('../components/ExpiryWarningBanners', () => ({ ExpiryWarningBanners: () => null }))
vi.mock('../components/WorkflowBanner', () => ({ WorkflowBanner: () => null }))
vi.mock('../components/injection3d/InjectionTrackerHero', () => ({ InjectionTrackerHero: () => null }))

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  disconnect() {}
})

function resolvedQuery(data: unknown) {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'single']) {
    query[method] = vi.fn(() => query)
  }
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => (
    Promise.resolve({ data, error: null }).then(resolve, reject)
  )
  return query
}

function createHomeClient(
  fixtures: Record<string, unknown[]>,
  rpcImplementation: (name: string, params: { p_entries?: unknown[]; p_dose_log_id?: string }) => Promise<{
    data: unknown
    error: { message: string } | null
  }> = async () => ({ data: [{ id: 'saved-log-1' }, { id: 'saved-log-2' }], error: null }),
) {
  const selectCounts = new Map<string, number>()
  const selectCalls: Array<{ table: string; columns: string }> = []
  const mutationCalls: Array<{ table: string; operation: 'insert' | 'update'; values: unknown }> = []
  const rpc = vi.fn(rpcImplementation)
  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      selectCounts.set(table, (selectCounts.get(table) ?? 0) + 1)
      selectCalls.push({ table, columns })
      return resolvedQuery(fixtures[table] ?? [])
    }),
    insert: vi.fn((values: unknown) => {
      mutationCalls.push({ table, operation: 'insert', values })
      return resolvedQuery(table === 'dose_logs' ? { id: 'saved-single-log' } : null)
    }),
    update: vi.fn((values: unknown) => {
      mutationCalls.push({ table, operation: 'update', values })
      return resolvedQuery(null)
    }),
    delete: vi.fn(() => resolvedQuery(null)),
  }))
  return { from, rpc, selectCounts, selectCalls, mutationCalls }
}

function intakeOnlyHomeCycle() {
  return {
    id: 'cycle-1',
    stack_item_id: 'stack-1',
    dose: 100,
    unit: 'mcg',
    method: 'Oral',
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    start_date: '2020-01-01',
    end_date: null,
    intake_time: 'morgens',
    intake_time_custom: null,
    schedule_history: null,
    stack_items: { display_name: 'Vitamin D3', tracking_level: 'intake_only', dosage_form: 'capsule' },
  }
}

function quantifiedHomeCycle() {
  return {
    ...intakeOnlyHomeCycle(),
    id: 'cycle-2',
    stack_item_id: 'stack-2',
    dose: 25,
    unit: 'mg',
    stack_items: { display_name: 'Zink', tracking_level: 'complete', dosage_form: 'capsule' },
  }
}

async function confirmSingleHomeIntake(name: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }))
  fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

describe('Home upcoming intake confirmation flow', () => {
  it('adapts a home slot to the shared group model with its pending log', () => {
    const intake = buildHomeRoutineIntake({
      key: 'cycle-1-1080',
      time: '18:00',
      min: 1080,
      substance: 'Vitamin D3',
      dose: null,
      doseNumber: null,
      unit: null,
      stackItemId: 'stack-1',
      cycleId: 'cycle-1',
      pendingLogId: 'pending-1',
      trackingLevel: 'intake_only',
      dosageForm: 'capsule',
      method: 'Oral',
      scheduledAt: '2026-07-29T18:00:00.000Z',
    })

    expect(intake).toMatchObject({
      pendingLogId: 'pending-1',
      group: 'evening',
      dose: null,
      unit: null,
      injectable: false,
    })
  })

  it('wires a mixed routine group to one RPC and one post-success log reload', async () => {
    const client = createHomeClient({
      cycles: [intakeOnlyHomeCycle(), quantifiedHomeCycle()],
      dose_logs: [],
      stack_items: [
        { id: 'stack-1', display_name: 'Vitamin D3', dosage_form: 'capsule' },
        { id: 'stack-2', display_name: 'Zink', dosage_form: 'capsule' },
      ],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    fireEvent.click(await screen.findByRole('button', { name: 'Alles eingenommen – Morgens' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alles eingenommen' }))

    expect(await within(dialog).findByText('Routine gespeichert')).toBeTruthy()
    await waitFor(() => expect(client.rpc).toHaveBeenCalledTimes(2))
    expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: expect.arrayContaining([
        expect.objectContaining({ stack_item_id: 'stack-1', dose: null, unit: null }),
        expect.objectContaining({ stack_item_id: 'stack-2', dose: 25, unit: 'mg' }),
      ]),
    })
    expect(client.rpc.mock.calls[0][1].p_entries).toHaveLength(2)
    expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'saved-log-2',
    })
    await waitFor(() => expect(client.selectCounts.get('dose_logs')).toBe(2))
  })

  it('retries only generic inventory after a committed home routine', async () => {
    let inventoryAttempts = 0
    const client = createHomeClient({
      cycles: [quantifiedHomeCycle()],
      dose_logs: [],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'capsule' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    }, async name => {
      if (name === 'confirm_intake_group') {
        return { data: [{ id: 'saved-log-2' }], error: null }
      }
      inventoryAttempts += 1
      return inventoryAttempts === 1
        ? { data: null, error: { message: 'inventory offline' } }
        : { data: 41, error: null }
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    fireEvent.click(await screen.findByRole('button', { name: 'Alles eingenommen – Morgens' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alles eingenommen' }))

    const retry = await within(dialog).findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)

    fireEvent.click(retry)
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(([name]) => name === 'confirm_intake_group')).toHaveLength(1)
  })

  it('reuses a pending single log and applies only generic inventory with its committed id', async () => {
    const pendingAt = new Date()
    pendingAt.setHours(8, 0, 0, 0)
    const client = createHomeClient({
      cycles: [quantifiedHomeCycle()],
      dose_logs: [{
        id: 'pending-single-log',
        stack_item_id: 'stack-2',
        taken: null,
        logged_at: pendingAt.toISOString(),
      }],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'capsule' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    }, async name => name === 'apply_inventory_confirmation'
      ? { data: 41, error: null }
      : { data: [], error: null })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    await confirmSingleHomeIntake('Zink')

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'pending-single-log',
    }))
    expect(client.mutationCalls.filter(call => call.table === 'dose_logs' && call.operation === 'insert'))
      .toHaveLength(0)
    expect(client.mutationCalls).toContainEqual(expect.objectContaining({
      table: 'dose_logs',
      operation: 'update',
      values: expect.objectContaining({ taken: true }),
    }))
    expect(client.selectCalls.some(call => (
      call.table === 'stack_items' && call.columns.includes('vial_amount_mg')
    ))).toBe(false)
  })

  it('retries only generic inventory after a committed single intake', async () => {
    let inventoryAttempts = 0
    const client = createHomeClient({
      cycles: [quantifiedHomeCycle()],
      dose_logs: [],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'capsule' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    }, async name => {
      if (name !== 'apply_inventory_confirmation') return { data: [], error: null }
      inventoryAttempts += 1
      return inventoryAttempts === 1
        ? { data: null, error: { message: 'inventory offline' } }
        : { data: 41, error: null }
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    await confirmSingleHomeIntake('Zink')

    const retry = await screen.findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(client.mutationCalls.filter(call => call.table === 'dose_logs' && call.operation === 'insert'))
      .toHaveLength(1)
    expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'saved-single-log',
    })

    fireEvent.click(retry)
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.mutationCalls.filter(call => call.table === 'dose_logs' && call.operation === 'insert'))
      .toHaveLength(1)
  })

  it('keeps a single vial confirmation on the legacy stock path only', async () => {
    const pendingAt = new Date()
    pendingAt.setHours(8, 0, 0, 0)
    const vialCycle = {
      ...quantifiedHomeCycle(),
      stack_items: { display_name: 'Zink', tracking_level: 'complete' as const, dosage_form: 'vial' },
    }
    const client = createHomeClient({
      cycles: [vialCycle],
      dose_logs: [{
        id: 'pending-vial-log',
        stack_item_id: 'stack-2',
        taken: null,
        logged_at: pendingAt.toISOString(),
      }],
      stack_items: [{ id: 'stack-2', display_name: 'Zink', dosage_form: 'vial' }],
      inventory_items: [],
      dose_escalations: [],
      injection_logs: [],
    })
    const TestHome = Home as ComponentType<{ homeDataClient: unknown }>
    render(createElement(MemoryRouter, null, createElement(TestHome, { homeDataClient: client })))

    await confirmSingleHomeIntake('Zink')

    await waitFor(() => expect(client.selectCalls.some(call => (
      call.table === 'stack_items' && call.columns.includes('vial_amount_mg')
    ))).toBe(true))
    expect(client.rpc.mock.calls.some(([name]) => name === 'apply_inventory_confirmation')).toBe(false)
  })

  it('uses the active schedule segment quantity and supplied unit label for today', () => {
    const quantity = resolveHomeIntakeQuantity({
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      start_date: '2026-07-01',
      end_date: null,
      frequency: 'Taeglich',
      x_days_interval: null,
      schedule_days: null,
      intake_time: 'morgens',
      intake_time_custom: null,
      dose: 1,
      unit: 'tablet',
      schedule_history: [{
        effective_from: '2026-07-20',
        frequency: 'Taeglich',
        x_days_interval: null,
        schedule_days: null,
        intake_time: 'morgens',
        intake_time_custom: null,
        dose: 0.5,
        unit: 'Tablette',
      }],
    }, new Date('2026-07-29T08:00:00'), [])

    expect(quantity).toEqual({
      doseNumber: 0.5,
      unit: 'Tablette',
      dose: '\u00BD Tablette',
    })
  })

  it('keeps an unknown active schedule quantity nullable for today', () => {
    const quantity = resolveHomeIntakeQuantity({
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      start_date: '2026-07-01',
      end_date: null,
      frequency: 'Taeglich',
      x_days_interval: null,
      schedule_days: null,
      intake_time: 'morgens',
      intake_time_custom: null,
      dose: 100,
      unit: 'mcg',
      schedule_history: [{
        effective_from: '2026-07-20',
        frequency: 'Taeglich',
        x_days_interval: null,
        schedule_days: null,
        intake_time: 'morgens',
        intake_time_custom: null,
        dose: null,
        unit: null,
      }],
    }, new Date('2026-07-29T08:00:00'), [])

    expect(quantity).toEqual({ doseNumber: null, unit: null, dose: null })
  })

  it('does not pair a schedule unit with a rejected mixed-unit adjustment', () => {
    const quantity = resolveHomeIntakeQuantity({
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      start_date: '2026-07-01',
      end_date: null,
      frequency: 'Taeglich',
      x_days_interval: null,
      schedule_days: null,
      intake_time: 'morgens',
      intake_time_custom: null,
      dose: 10,
      unit: 'mg',
      schedule_history: null,
    }, new Date('2026-07-29T08:00:00'), [{
      cycle_id: 'cycle-1',
      increase_amount: 5,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-07-20',
      start_after_days: null,
    }])

    expect(quantity).toEqual({ doseNumber: null, unit: null, dose: null })
  })

  it('builds an unknown taken log with null quantity and the chosen timestamp', () => {
    const payload = buildHomeDoseLogPayload({
      userId: 'user-1',
      stackItemId: 'stack-1',
      doseNumber: null,
      unit: null,
      method: 'Oral',
      scheduledAt: '2026-07-29T06:00:00.000Z',
      taken: true,
      timeValue: '10:45',
    })

    expect(payload).toEqual({
      user_id: 'user-1',
      stack_item_id: 'stack-1',
      dose: null,
      unit: null,
      method: 'Oral',
      logged_at: '2026-07-29T08:45:00.000Z',
      taken: true,
    })
  })

  it('keeps skipped logs false when their quantity is unknown', () => {
    const payload = buildHomeDoseLogPayload({
      userId: 'user-1',
      stackItemId: 'stack-1',
      doseNumber: null,
      unit: null,
      method: null,
      scheduledAt: '2026-07-29T06:00:00.000Z',
      taken: false,
    })

    expect(payload).toEqual(expect.objectContaining({
      dose: null,
      unit: null,
      logged_at: '2026-07-29T06:00:00.000Z',
      taken: false,
    }))
  })
})
