// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { createElement, type ComponentType } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FEATURES } from '../config/features'
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

function resolvedQuery(data: unknown, error: { message: string } | null = null, applyFilters = false, gate?: Promise<void>) {
  const query: Record<string, unknown> = {}
  const filters: Array<{ method: string; column: string; value: unknown }> = []
  // `select` gehoert dazu, weil ein Insert sein Ergebnis zurueckliest
  // (`.insert(...).select('id').single()`) — ohne das lief die Kette ins Leere
  // und warf eine unbehandelte Ablehnung neben dem gruenen Test.
  for (const method of ['eq', 'gte', 'lt', 'lte', 'in', 'order', 'limit', 'single', 'select']) {
    query[method] = vi.fn((column: string, value: unknown) => {
      filters.push({ method, column, value })
      return query
    })
  }
  query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    const result = applyFilters && Array.isArray(data) ? data.filter(row => filters.every(filter => {
      if (filter.column === 'logged_at') {
        const time = Date.parse(row.logged_at)
        const bound = Date.parse(String(filter.value))
        if (filter.method === 'gte') return time >= bound
        if (filter.method === 'lte') return time <= bound
        if (filter.method === 'lt') return time < bound
      }
      if (filter.column === 'routine_slot_key' && filter.method === 'in') {
        return (filter.value as string[]).includes(row.routine_slot_key)
      }
      return true
    })) : data
    return Promise.resolve(gate).then(() => ({ data: result, error })).then(resolve, reject)
  }
  return query
}

function createDashboardClient(
  fixtures: Record<string, unknown[]>,
  rpcImplementation: (name: string, params: unknown) => Promise<{
    data: unknown
    error: { message: string } | null
  }> = async () => ({ data: [{ id: 'saved-log-1' }], error: null }),
  options: { errors?: Record<string, { message: string } | null>; filterLogs?: boolean; logReadGate?: Promise<void> } = {},
) {
  const selectCounts = new Map<string, number>()
  const selectCalls: Array<{ table: string; columns: string }> = []
  const mutations: RecordedMutation[] = []
  const logQueries: ReturnType<typeof resolvedQuery>[] = []
  const rpc = vi.fn(rpcImplementation)
  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      selectCounts.set(table, (selectCounts.get(table) ?? 0) + 1)
      selectCalls.push({ table, columns })
      const query = resolvedQuery(fixtures[table] ?? [], options.errors?.[table] ?? null,
        table === 'dose_logs' && options.filterLogs, table === 'dose_logs' ? options.logReadGate : undefined)
      if (table === 'dose_logs') logQueries.push(query)
      return query
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
  return { from, rpc, selectCounts, selectCalls, mutations, logQueries }
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

function onDemandCycle() {
  return {
    ...intakeOnlyCycle(),
    id: 'cycle-2',
    name: 'Ibuprofen',
    stack_item_id: 'stack-2',
    frequency: 'Bei Bedarf',
    stack_items: { display_name: 'Ibuprofen', tracking_level: 'intake_only' },
  }
}

function LocationProbe() {
  const location = useLocation()
  return createElement('output', { 'data-testid': 'location' }, location.pathname + location.search)
}

function renderDashboard(client: ReturnType<typeof createDashboardClient>) {
  const TestDashboard = Dashboard as ComponentType<{ dashboardDataClient: unknown }>
  return render(createElement(MemoryRouter, null, createElement(TestDashboard, { dashboardDataClient: client }), createElement(LocationProbe)))
}

afterEach(() => {
  cleanup()
  ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Dashboard normalized timeline path', () => {
  it('holt die Tageslogs nebeneinander statt nacheinander', () => {
    // Die Seite lud ihre Zeitbereiche und danach die Slot-Schluessel in
    // 100er-Paeckchen -- jedes mit `await` hinter dem vorigen, obwohl keines
    // vom anderen abhaengt. Bei einem Monatsraster mit mehreren Plaenen sind
    // das schnell ein halbes Dutzend Rundreisen in Reihe. Die Paeckchen
    // bleiben (sie begrenzen die Laenge der Adresse), nur das Warten nicht.
    const quelle = readFileSync('src/pages/Dashboard.tsx', 'utf8')
    const lader = quelle.slice(
      quelle.indexOf('const byId = new Map<string, DoseLog>()'),
      quelle.indexOf('setTimelines(loadedTimelines)'),
    )

    expect(lader).toContain('await Promise.all(ranges.map(range =>')
    expect(lader).toContain('await Promise.all(paeckchen.map(schluessel =>')
    // Kein `await` mehr innerhalb einer Schleife in diesem Abschnitt.
    const schleifenZeilen = lader.split('\n')
    const inSchleife = schleifenZeilen.some((zeile, i) => (
      /^\s*for \(/.test(zeile)
      && schleifenZeilen.slice(i, i + 8).some(folge => /await dashboardDataClient/.test(folge))
    ))
    expect(inSchleife, 'ein `await` steckt wieder in einer Schleife').toBe(false)
  })

  it('explains blocked migrated plans and links to their timezone review', async () => {
    const fixtures = startFixFixture()
    fixtures.cycles.unshift({
      ...fixtures.cycles[0],
      id: 'archived-review-cycle',
      stack_item_id: 'archived-stack-item',
      timezone_review_required: true,
    })
    fixtures.cycles[1].timezone_review_required = true
    const client = createDashboardClient(fixtures)

    renderDashboard(client)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Existing intake plans still need a time zone confirmation.')
    expect(screen.queryByText('Noch nichts für heute protokolliert')).toBeNull()
    fireEvent.click(within(alert).getByRole('button', { name: 'Confirm time zone in My Stack' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent)
      .toBe('/my-stack?review=timezone&stackItem=stack-1'))
  })

  it.each([false, true])('keeps a decided V2 log immutable in the calendar (%s)', async taken => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ ...pendingLog(), taken }]
    renderDashboard(createDashboardClient(fixtures))
    fireEvent.click(await screen.findByRole('button', { name: /Bereits protokolliert/ }))
    await screen.findByText('Vitamin D3')
    await waitFor(() => expect(screen.queryByText('Lädt…')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Doch eingenommen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'eintrag_loeschen' })).toBeNull()
  })
  it.each([
    { archived: true, configuration_status: 'complete', migration_conflicts: [] },
    { archived: false, configuration_status: 'needs_review', migration_conflicts: [] },
    { archived: false, configuration_status: 'complete', migration_conflicts: [{ resolved_at: null }] },
  ])('offers no dues for an unavailable item and resumes after resolution: %j', async item => {
    const fixtures = startFixFixture()
    Object.assign(fixtures.cycles[0].stack_items, item)
    fixtures.cycles.push({ ...fixtures.cycles[0], id: 'competing-cycle' })
    const client = createDashboardClient(fixtures)
    const page = renderDashboard(client)
    await waitFor(() => expect(client.selectCounts.get('cycles')).toBe(2))
    await waitFor(() => expect(screen.queryByText('Lädt…')).toBeNull())
    const morningTab = screen.queryByRole('tab', { name: /^morgens/ })
    if (morningTab) fireEvent.click(morningTab)
    expect(screen.queryAllByRole('button', { name: 'eingenommen' })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Alle als eingenommen markieren' })).toBeNull()
    page.unmount()
    vi.setSystemTime(new Date('2026-09-18T08:05:00Z'))
    const selected = normalizedCycle()
    Object.assign(selected.stack_items, { archived: false, configuration_status: 'complete', migration_conflicts: [] })
    selected.versions[0].dose = 20
    const rejected = Object.assign(normalizedCycle(), {
      id: 'competing-cycle', active: false, end_date: '2026-09-18',
      ended_at: '2026-09-18T08:00:00Z', closed_by_migration_resolution: true,
    })
    rejected.versions[0] = { ...rejected.versions[0], id: 'rejected-version', cycle_id: rejected.id, dose: 10 }
    rejected.stack_items = selected.stack_items
    fixtures.cycles = [selected, rejected]
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'eingenommen' })).toHaveLength(1))
    expect(screen.getByText('20 mg')).not.toBeNull()
    expect(screen.queryByText('10 mg')).toBeNull()
  })

  function startFixFixture(frequency = 'Täglich', instant = '2026-09-18T14:00:00Z') {
    vi.stubEnv('TZ', 'Europe/Berlin')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(instant))
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    return {
      cycles: [normalizedCycle(frequency)], dose_logs: [] as unknown[],
      stack_items: [{ id: 'stack-1', display_name: 'Vitamin D3', default_method: 'Oral',
        dosage_form: 'capsule', tracking_level: 'complete' }],
    }
  }

  async function openSingle() {
    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'eingenommen' }))
  }

  function pendingLog(keyed = true) {
    return { id: 'pending-exact', stack_item_id: 'stack-1', taken: null, dose: 25, unit: 'mg',
      method: 'Oral', notes: null, stack_items: { display_name: 'Vitamin D3' },
      logged_at: '2026-09-18T07:00:00.000Z', cycle_id: keyed ? 'timeline-cycle' : null,
      plan_version_id: keyed ? 'timeline-version' : null,
      routine_slot_key: keyed ? 'timeline-cycle@2026-09-18T06:00:00.000Z' : null }
  }

  function browseToNovember() {
    fireEvent.click(screen.getByRole('button', { name: 'Monat anzeigen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }))
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy()
    expect(screen.getByText('18.09.2026')).toBeTruthy()
  }

  it.each(['keyed', 'legacy'])('keeps selected-day %s coverage while browsing a distant month', async kind => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [{ ...pendingLog(kind === 'keyed'), taken: true,
      logged_at: kind === 'keyed' ? '2026-07-01T06:00:00.000Z' : '2026-09-17T22:30:00.000Z' }]
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(screen.queryByRole('button', { name: /Alle als eingenommen/ })).toBeNull())
    await screen.findByText(kind === 'keyed' ? 'Alle geplanten Einnahmen sind bestätigt.' : 'Bereits protokolliert')
    const initialQueries = client.logQueries.length
    browseToNovember()
    await waitFor(() => expect(client.logQueries.length).toBeGreaterThan(initialQueries))
    await waitFor(() => expect(screen.getAllByRole('status').some(element => element.textContent?.includes('Lädt'))).toBe(false))
    const morningTab = screen.queryByRole('tab', { name: /^morgens/ })
    if (morningTab) fireEvent.click(morningTab)
    expect(screen.queryByRole('button', { name: /Alle als eingenommen/ })).toBeNull()
    const queries = client.logQueries.slice(initialQueries)
    const keyBatches = queries.flatMap(query => (query.in as ReturnType<typeof vi.fn>).mock.calls.map(call => call[1] as string[]))
    expect(keyBatches.flat()).toContain('timeline-cycle@2026-09-18T06:00:00.000Z')
    expect(keyBatches.flat()).toContain('timeline-cycle@2026-11-18T07:00:00.000Z')
    expect(keyBatches.every(keys => keys.length <= 100)).toBe(true)
    if (kind === 'legacy') {
      expect(queries.some(query => (query.gte as ReturnType<typeof vi.fn>).mock.calls
        .some(call => call[1] === '2026-09-17T22:00:00.000Z'))).toBe(true)
      expect(queries.some(query => (query.lt as ReturnType<typeof vi.fn>).mock.calls
        .some(call => call[1] === '2026-09-18T22:00:00.000Z'))).toBe(true)
    }
  })

  it('waits for the newly selected-day snapshot before offering due actions', async () => {
    const fixtures = startFixFixture()
    const options: { filterLogs: boolean; logReadGate?: Promise<void> } = { filterLogs: true }
    const client = createDashboardClient(fixtures, undefined, options)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    await screen.findByRole('button', { name: 'Alle als eingenommen markieren' })
    fixtures.dose_logs = [{ ...pendingLog(), taken: true,
      logged_at: '2026-07-01T06:00:00.000Z', routine_slot_key: 'timeline-cycle@2026-09-19T06:00:00.000Z' }]
    let release!: () => void
    options.logReadGate = new Promise<void>(resolve => { release = resolve })
    vi.stubGlobal('PointerEvent', MouseEvent)
    const nextDay = document.querySelector('[data-calendar-date="2026-09-19"]')!
    fireEvent.pointerDown(nextDay, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(nextDay, { clientX: 30, clientY: 30 })
    expect(screen.getByText('19.09.2026')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Alle als eingenommen markieren' })).toBeNull()
    expect(screen.getAllByRole('status').some(element => element.textContent?.includes('Lädt'))).toBe(true)
    await act(async () => { release() })
    expect(await screen.findByText('Alle geplanten Einnahmen sind bestätigt.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Alle als eingenommen markieren' })).toBeNull()
  })

  it.each(['single', 'group'])('refreshes the current union after an older %s confirmation finishes', async kind => {
    const fixtures = startFixFixture()
    let finish!: () => void
    const confirmation = new Promise<void>(resolve => { finish = resolve })
    const client = createDashboardClient(fixtures, async name => {
      if (name === 'confirm_intake_group') {
        await confirmation
        fixtures.dose_logs = [{ ...pendingLog(), taken: true, logged_at: '2026-07-01T06:00:00.000Z' }]
      }
      return { data: [{ id: 'saved-log-1' }], error: null }
    }, { filterLogs: true })
    renderDashboard(client)
    if (kind === 'single') {
      await openSingle()
      fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    } else {
      fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Alle als eingenommen markieren' }))
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Alle als eingenommen markieren' }))
    }
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', expect.anything()))
    browseToNovember()
    await screen.findByRole('button', { name: 'Alle als eingenommen markieren' })
    const queriesBeforeCompletion = client.logQueries.length
    await act(async () => { finish() })
    await waitFor(() => expect(client.logQueries.length).toBeGreaterThan(queriesBeforeCompletion))
    await waitFor(() => expect(screen.getAllByRole('status').some(element => element.textContent?.includes('Lädt'))).toBe(false))
    expect(await screen.findByText('Alle geplanten Einnahmen sind bestätigt.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Alle als eingenommen/ })).toBeNull()
    const refreshedKeys = client.logQueries.slice(queriesBeforeCompletion)
      .flatMap(query => (query.in as ReturnType<typeof vi.fn>).mock.calls.flatMap(call => call[1] as string[]))
    expect(refreshedKeys).toContain('timeline-cycle@2026-11-18T07:00:00.000Z')
    expect(refreshedKeys).toContain('timeline-cycle@2026-09-18T06:00:00.000Z')
  })

  it('preserves a committed group inventory-only retry after month navigation', async () => {
    const fixtures = startFixFixture()
    let finishInventory!: () => void
    const inventory = new Promise<void>(resolve => { finishInventory = resolve })
    let inventoryAttempts = 0
    const client = createDashboardClient(fixtures, async name => {
      if (name === 'confirm_intake_group') {
        fixtures.dose_logs = [{ ...pendingLog(), taken: true, logged_at: '2026-07-01T06:00:00.000Z' }]
      }
      if (name === 'apply_inventory_confirmation' && ++inventoryAttempts === 1) {
        await inventory
        return { data: null, error: { message: 'retry inventory' } }
      }
      return { data: [{ id: 'saved-log-1' }], error: null }
    }, { filterLogs: true })
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Alle als eingenommen markieren' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Alle als eingenommen markieren' }))
    await screen.findByText('Routine gespeichert')
    browseToNovember()
    await screen.findByText('Alle geplanten Einnahmen sind bestätigt.')
    await act(async () => { finishInventory() })
    fireEvent.click(await screen.findByRole('button', { name: 'Bestand erneut versuchen' }))
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Bestand erneut versuchen' })).toBeNull())
    expect(client.rpc.mock.calls.filter(call => call[0] === 'confirm_intake_group')).toHaveLength(1)
    expect(screen.getByText('Alle geplanten Einnahmen sind bestätigt.')).toBeTruthy()
  })

  it('keeps the original 08:00 occurrence in a pending group confirmation', async () => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [pendingLog()]
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Alle als eingenommen markieren' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Alle als eingenommen markieren' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ dose_log_id: 'pending-exact',
        slot_key: 'timeline-cycle@2026-09-18T06:00:00.000Z', logged_at: '2026-09-18T06:00:00.000Z' })],
    }))
  })

  it('keeps the original pending occurrence in the injection deep link', async () => {
    const fixtures = startFixFixture()
    fixtures.cycles[0].versions[0].method = 'Subkutan'
    fixtures.dose_logs = [pendingLog()]
    renderDashboard(createDashboardClient(fixtures))
    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mit Injektion bestätigen' }))
    const url = new URL(screen.getByTestId('location').textContent!, 'https://example.test')
    expect(url.searchParams.get('scheduledAt')).toBe('2026-09-18T06:00:00.000Z')
  })

  it.each([false, true])('confirms a normalized single intake through exact RPC (pending=%s)', async pending => {
    const fixtures = startFixFixture()
    if (pending) fixtures.dose_logs = [pendingLog(false)]
    fixtures.cycles[0].versions.push({ ...fixtures.cycles[0].versions[0], id: 'afternoon-version',
      effective_kind: 'instant', effective_at: '2026-09-18T13:00:00Z', effective_local_date: null } as never)
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    await openSingle()
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '16:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ dose_log_id: pending ? 'pending-exact' : null,
        plan_version_id: 'afternoon-version', slot_key: 'timeline-cycle@2026-09-18T06:00:00.000Z',
        logged_at: '2026-09-18T14:00:00.000Z' })],
    }))
    expect(client.mutations).toEqual([])
    expect(client.rpc).toHaveBeenCalledWith('apply_inventory_confirmation', { p_dose_log_id: 'saved-log-1' })
  })

  it.each([false, true])('skips a normalized single intake through the lifecycle-locked RPC (pending=%s)', async pending => {
    const fixtures = startFixFixture()
    if (pending) fixtures.dose_logs = [pendingLog()]
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'uebersprungen' }))
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        dose_log_id: pending ? 'pending-exact' : null,
        plan_version_id: 'timeline-version',
        slot_key: 'timeline-cycle@2026-09-18T06:00:00.000Z',
        logged_at: pending ? '2026-09-18T07:00:00.000Z' : '2026-09-18T06:00:00.000Z',
        taken: false,
      })],
    }))
    expect(client.mutations).toEqual([])
  })

  it('surfaces a rejected pending provenance change without a legacy write', async () => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [pendingLog()]
    const client = createDashboardClient(fixtures, async () => ({ data: null, error: { message: 'Existing version mismatch' } }))
    renderDashboard(client)
    await openSingle()
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(pageMocks.toast.error).toHaveBeenCalled())
    expect(client.mutations).toEqual([])
    expect(screen.getByRole('button', { name: 'Eingenommen' })).toBeTruthy()
  })

  it.each(['start', 'resume'])('offers PRN after a 15:00 %s and resolves the submitted 16:00 version', async kind => {
    const fixtures = startFixFixture('Bei Bedarf')
    if (kind === 'start') fixtures.cycles[0].started_at = '2026-09-18T13:00:00Z'
    else fixtures.cycles[0].pauses = [{ id: 'p', cycle_id: 'timeline-cycle',
      paused_at: '2026-09-17T00:00:00Z', ends_at: '2026-09-18T13:00:00Z' }]
    fixtures.cycles[0].versions.push({ ...fixtures.cycles[0].versions[0], id: 'prn-afternoon',
      effective_kind: 'instant', effective_at: '2026-09-18T13:00:00Z', effective_local_date: null } as never)
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))
    expect(await screen.findByText('Einnahme bestätigen')).toBeTruthy()
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '16:00' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Eingenommen' }).at(-1)!)
    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({ plan_version_id: 'prn-afternoon', logged_at: '2026-09-18T14:00:00.000Z' })],
    }))
  })

  it('rejects a chosen PRN minute inside a pause before issuing any write', async () => {
    const fixtures = startFixFixture('Bei Bedarf')
    fixtures.cycles[0].pauses = [{ id: 'p', cycle_id: 'timeline-cycle',
      paused_at: '2026-09-18T13:00:00Z', ends_at: '2026-09-18T15:00:00Z' }]
    const client = createDashboardClient(fixtures)
    renderDashboard(client)
    fireEvent.click(await screen.findByRole('button', { name: 'Eingenommen' }))
    expect(await screen.findByText('Einnahme bestätigen')).toBeTruthy()
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '16:00' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Eingenommen' }).at(-1)!)
    await waitFor(() => expect(pageMocks.toast.error).toHaveBeenCalled())
    expect(client.rpc).not.toHaveBeenCalled()
    expect(client.mutations).toEqual([])
  })

  it('renders the Berlin spring-gap day without aborting', async () => {
    const fixtures = startFixFixture('Täglich', '2026-03-29T12:00:00Z')
    fixtures.cycles[0].versions[0].intake_time_custom = '02:30'
    renderDashboard(createDashboardClient(fixtures))
    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    expect(await screen.findByRole('button', { name: 'eingenommen' })).toBeTruthy()
  })

  it('shows normalized load failure instead of empty data and retries safely', async () => {
    const errors = { cycles: { message: 'timeline unavailable' } as { message: string } | null }
    const client = createDashboardClient(startFixFixture(), undefined, { errors })
    renderDashboard(client)
    expect(screen.getAllByRole('status').some(element => element.textContent?.includes('Lädt'))).toBe(true)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'eingenommen' })).toBeNull()
    errors.cycles = null
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    expect(await screen.findByRole('button', { name: 'eingenommen' })).toBeTruthy()
  })

  it('removes stale Calendar confirmation actions when a refresh fails', async () => {
    const errors = { cycles: null as { message: string } | null, dose_logs: null as { message: string } | null }
    const client = createDashboardClient(startFixFixture(), async () => {
      errors.dose_logs = { message: 'logs unavailable' }
      return { data: [{ id: 'saved-log-1' }], error: null }
    }, { errors })
    renderDashboard(client)
    await openSingle()
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'eingenommen' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Alle als eingenommen/ })).toBeNull()
  })

  it('fetches keyed coverage independently when actual time moved outside the month', async () => {
    const fixtures = startFixFixture('Täglich', '2026-09-01T14:00:00Z')
    fixtures.dose_logs = [{ ...pendingLog(), taken: true,
      logged_at: '2026-08-30T21:00:00.000Z', routine_slot_key: 'timeline-cycle@2026-09-01T06:00:00.000Z' }]
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    await waitFor(() => expect(screen.getByText('Alle geplanten Einnahmen sind bestätigt.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'eingenommen' })).toBeNull()
    expect(client.logQueries.some(query => (query.in as ReturnType<typeof vi.fn>).mock.calls.length > 0)).toBe(true)
  })

  it('fetches legacy coverage from the positive-offset first local day boundary', async () => {
    const fixtures = startFixFixture('Täglich', '2026-09-01T14:00:00Z')
    fixtures.cycles[0].versions[0].intake_time_custom = '00:30'
    fixtures.dose_logs = [{ ...pendingLog(false), taken: true, logged_at: '2026-08-31T22:30:00.000Z' }]
    const client = createDashboardClient(fixtures, undefined, { filterLogs: true })
    renderDashboard(client)
    expect(await screen.findByText('Bereits protokolliert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Alle als eingenommen/ })).toBeNull()
    expect(client.logQueries[0].gte).toHaveBeenCalledWith('logged_at', '2026-08-30T22:00:00.000Z')
    expect(client.logQueries[0].lt).toHaveBeenCalledWith('logged_at', '2026-10-04T22:00:00.000Z')
  })

  it('retries only inventory after a committed normalized pending confirmation', async () => {
    const fixtures = startFixFixture()
    fixtures.dose_logs = [pendingLog(false)]
    let inventoryAttempts = 0
    const client = createDashboardClient(fixtures, async name => {
      if (name === 'apply_inventory_confirmation' && ++inventoryAttempts === 1) {
        return { data: null, error: { message: 'retry inventory' } }
      }
      return { data: [{ id: 'pending-exact' }], error: null }
    })
    renderDashboard(client)
    await openSingle()
    fireEvent.click(screen.getByRole('button', { name: 'Eingenommen' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Bestand erneut versuchen' }))
    await waitFor(() => expect(inventoryAttempts).toBe(2))
    expect(client.rpc.mock.calls.filter(call => call[0] === 'confirm_intake_group')).toHaveLength(1)
    expect(client.mutations).toEqual([])
  })

  function normalizedCycle(frequency = 'Täglich', pauses: unknown[] = []) {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    return {
      id: 'timeline-cycle',
      stack_item_id: 'stack-1',
      name: 'Vitamin D3',
      start_date: localDate,
      end_date: null as string | null,
      active: true,
      frequency,
      x_days_interval: null,
      interval_unit: null,
      cycle_on_days: null,
      cycle_off_days: null,
      schedule_days: null,
      intake_time: frequency === 'Bei Bedarf' ? '' : 'morgens',
      intake_time_custom: frequency === 'Bei Bedarf' ? null : '08:00',
      slot_doses: null,
      slot_days: null,
      dose: 25,
      unit: 'mg',
      method: 'Oral',
      schedule_history: null,
      stack_items: { display_name: 'Vitamin D3', tracking_level: 'complete' },
      timezone_review_required: false,
      started_at: new Date(today.getTime() - 86_400_000).toISOString(),
      ended_at: null as string | null,
      versions: [{
        id: 'timeline-version',
        cycle_id: 'timeline-cycle',
        effective_kind: 'local_date',
        effective_at: null,
        effective_local_date: localDate,
        change_kind: 'initial',
        frequency,
        x_days_interval: null,
        interval_unit: null,
        cycle_on_days: null,
        cycle_off_days: null,
        schedule_days: [],
        intake_time: frequency === 'Bei Bedarf' ? '' : 'morgens',
        intake_time_custom: frequency === 'Bei Bedarf' ? null : '08:00',
        slot_doses: null,
        slot_days: null,
        dose: 25,
        unit: 'mg',
        method: 'Oral',
      }],
      pauses,
    }
  }

  it('enables the verified timeline rollout by default', () => {
    const source = readFileSync('src/config/features.ts', 'utf8')
    expect(source).toMatch(/planTimelineV2:\s*true/)
  })

  it('uses timeline slots without dose escalations and confirms the exact version', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const client = createDashboardClient({
      cycles: [normalizedCycle()],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Vitamin D3', default_method: 'Oral',
        dosage_form: 'capsule', tracking_level: 'complete',
      }],
    })
    renderDashboard(client)

    fireEvent.click(await screen.findByRole('tab', { name: /^morgens/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Alle als eingenommen markieren' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alle als eingenommen markieren' }))

    await waitFor(() => expect(client.rpc).toHaveBeenCalledWith('confirm_intake_group', {
      p_entries: [expect.objectContaining({
        cycle_id: 'timeline-cycle',
        plan_version_id: 'timeline-version',
        slot_key: expect.stringMatching(/^timeline-cycle@/),
      })],
    }))
    expect(client.selectCounts.get('dose_escalations')).toBeUndefined()
    expect(client.selectCalls.find(call => call.table === 'cycles')?.columns)
      .toContain('cycle_plan_versions')
  })

  it('keeps lifecycle-valid PRN access without creating a due intake', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const client = createDashboardClient({
      cycles: [normalizedCycle('Bei Bedarf')],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Ibuprofen', default_method: 'Oral',
        dosage_form: 'tablet', tracking_level: 'intake_only',
      }],
    })
    renderDashboard(client)

    const prn = await waitFor(() => {
      const row = document.querySelector('[data-on-demand-cycle="timeline-cycle"]')
      if (!row) throw new Error('missing normalized PRN row')
      return row as HTMLElement
    })
    expect(prn.textContent).toContain('Ibuprofen')
    expect(screen.queryByRole('button', { name: 'Alle als eingenommen markieren' })).toBeNull()
  })

  it('renders one neutral message for a fully paused selected day', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const now = new Date()
    const client = createDashboardClient({
      cycles: [normalizedCycle('Täglich', [{
        id: 'pause-1',
        cycle_id: 'timeline-cycle',
        paused_at: new Date(now.getTime() - 86_400_000).toISOString(),
        ends_at: new Date(now.getTime() + 86_400_000).toISOString(),
      }])],
      dose_logs: [],
      stack_items: [{
        id: 'stack-1', display_name: 'Vitamin D3', default_method: 'Oral',
        dosage_form: 'capsule', tracking_level: 'complete',
      }],
    })
    renderDashboard(client)

    expect(await screen.findByText('Plan pausiert')).toBeTruthy()
    expect(screen.getAllByText('Während der Pause ist keine Einnahme fällig.')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Alle als eingenommen markieren' })).toBeNull()
  })
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
      planVersionId: null,
      pendingLogId: 'pending-1',
      group: 'midday',
      dose: null,
      unit: null,
      injectable: true,
    })
  })

  it('bietet „Bei Bedarf" zum Eintragen an, ohne es fällig zu machen', async () => {
    // Der Haken an einer Frequenz ohne Plan: `cycleAppliesToDay` gibt für sie
    // nie true zurück — richtig so, nichts soll fällig werden oder als
    // verpasst gelten. Genau deshalb erschiene sie ohne diesen Weg NIRGENDS,
    // und man könnte ein Schmerzmittel gar nicht eintragen.
    const client = createDashboardClient({
      cycles: [onDemandCycle()],
      dose_logs: [],
      stack_items: [{ id: 'stack-2', display_name: 'Ibuprofen', dosage_form: 'tablet' }],
      dose_escalations: [],
    })
    renderDashboard(client)

    const zeile = await waitFor(() => {
      const treffer = document.querySelector('[data-on-demand-cycle="cycle-2"]')
      if (!treffer) throw new Error('keine Bei-Bedarf-Zeile')
      return treffer as HTMLElement
    })
    expect(zeile.textContent).toContain('Ibuprofen')

    // Kein „fällig", kein „verpasst": es steht keine geplante Einnahme da.
    expect(screen.queryByRole('button', { name: 'Alle als eingenommen markieren' })).toBeNull()

    fireEvent.click(within(zeile).getByRole('button', { name: 'Eingenommen' }))
    await waitFor(() => expect(
      client.mutations.filter(eintrag => eintrag.table === 'dose_logs' && eintrag.kind === 'insert'),
    ).toHaveLength(1))
    expect(client.mutations.find(eintrag => eintrag.kind === 'insert')?.values).toMatchObject({
      stack_item_id: 'stack-2',
      taken: true,
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
    expect(client.selectCounts.get('dose_escalations')).toBe(1)
    expect(client.selectCalls.find(call => call.table === 'cycles')?.columns)
      .not.toContain('cycle_plan_versions')
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
