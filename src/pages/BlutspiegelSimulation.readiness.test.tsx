// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BlutspiegelSimulation, PkReadinessPanel } from './BlutspiegelSimulation'
import { FEATURES } from '../config/features'
vi.mock('../config/features', () => ({ FEATURES: { planTimelineV2: false } }))
const pageDb = vi.hoisted(() => ({ tables: [] as string[], cycles: [] as any[] }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: pageUser }) }))
const pageUser = { id: 'user-1' }
vi.mock('../lib/supabase', () => ({ supabase: { from: (table: string) => {
  pageDb.tables.push(table)
  const query: any = { select: () => query, eq: () => query, order: () => query,
    then: (resolve: any) => Promise.resolve({ data: table === 'cycles' ? pageDb.cycles : [], error: null }).then(resolve) }
  return query
} } }))

const i18nTestState = vi.hoisted(() => ({ translations: {} as Record<string, string> }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      let value = i18nTestState.translations[key]
        ?? (typeof options?.defaultValue === 'string' ? options.defaultValue : key)
      for (const [name, replacement] of Object.entries(options ?? {})) {
        if (name !== 'defaultValue') value = value.replace(`{{${name}}}`, String(replacement))
      }
      return value
    },
  }),
}))

afterEach(() => { cleanup(); (FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false })
beforeEach(() => {
  i18nTestState.translations = {}
})

describe('PkReadinessPanel', () => {
  it('loads normalized page readiness without querying escalations', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    pageDb.tables = []
    pageDb.cycles = [{ id: 'c1', stack_item_id: 's1', started_at: '2026-08-01T00:00:00Z', ended_at: null,
      pauses: [], versions: [{ id: 'v1', cycle_id: 'c1', effective_kind: 'local_date', effective_at: null,
        effective_local_date: '2026-08-01', change_kind: 'initial', frequency: 'Täglich', x_days_interval: null,
        interval_unit: null, cycle_on_days: null, cycle_off_days: null, schedule_days: [], intake_time: 'custom',
        intake_time_custom: '08:00', slot_doses: null, slot_days: null, dose: 1, unit: 'mg', method: 'Subkutan' }],
      stack_items: { id: 's1', display_name: 'Normalized item', tracking_level: 'with_amount', pk_profile_method: 'Subkutan',
        ingredients: [{ position: 0, substance_catalog: { pk_profile_id: 'pk1', pk_profiles: { name: 'Profile', half_life_hours: 4, tmax_hours: 1, bioavailability_sc: 1, category: 'peptide' } } }] } }]
    render(<MemoryRouter><BlutspiegelSimulation /></MemoryRouter>)
    await screen.findByText(/Normalized item: PK-Daten unvollständig/)
    expect(pageDb.tables).not.toContain('dose_escalations')
  })
  it('explains missing PK data and links directly to the existing stack item', () => {
    render(
      <MemoryRouter>
        <PkReadinessPanel
          stackItemId="stack-1"
          itemName="BPC-157"
          readiness={{ status: 'missing', missing: ['complete_tracking', 'time'] }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText(/BPC-157/).textContent).toContain('PK-Daten unvollständig')
    expect(screen.getByText(/Vollständiges Tracking/)).toBeTruthy()
    expect(screen.getByText(/Genaue Uhrzeit/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Angaben vervollständigen/ }).getAttribute('href'))
      .toBe('/my-stack?edit=stack-1&intent=pk')
  })

  it('explains an unsupported profile without offering a fabricated curve', () => {
    render(
      <MemoryRouter>
        <PkReadinessPanel
          stackItemId="stack-2"
          itemName="Eigene Mischung"
          readiness={{ status: 'unsupported', reason: 'no_profile' }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Kein verknüpftes PK-Profil/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Angaben vervollständigen/ })).toBeNull()
    expect(screen.queryByRole('img', { name: /Kurve/ })).toBeNull()
  })

  it('labels the dashed planned curve through the pk_planned translation', async () => {
    const simulation = await import('./BlutspiegelSimulation') as typeof import('./BlutspiegelSimulation') & {
      PkCurveLegend?: ComponentType
    }
    expect(simulation.PkCurveLegend, 'the live curve needs a rendered planned legend entry').toBeTypeOf('function')
    if (!simulation.PkCurveLegend) return

    i18nTestState.translations = { pk_planned: 'Planned translation' }
    render(createElement(simulation.PkCurveLegend))

    const label = screen.getByText('Planned translation')
    const line = label.parentElement?.querySelector('span')
    expect(line?.style.borderTopStyle).toBe('dashed')
  })
})
