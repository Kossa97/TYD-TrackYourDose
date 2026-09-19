// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BlutspiegelCarousel } from './BlutspiegelCarousel'
import { getCurrentBlutspiegelLevel } from '../services/blutspiegelHistory'
import { FEATURES } from '../config/features'
vi.mock('../config/features', () => ({ FEATURES: { planTimelineV2: false } }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      let value = typeof options?.defaultValue === 'string' ? options.defaultValue : key
      for (const [name, replacement] of Object.entries(options ?? {})) {
        if (name !== 'defaultValue') value = value.replace(`{{${name}}}`, String(replacement))
      }
      return value
    },
  }),
}))

const carouselMocks = vi.hoisted(() => ({
  escalations: [] as Array<Record<string, unknown>>,
  tables: [] as string[],
  normalized: null as Record<string, unknown> | null,
}))

const cycles = [{
  id: 'cycle-1',
  stack_item_id: 'stack-1',
  start_date: '2026-08-01',
  dose: null as number | null,
  unit: null as string | null,
  method: 'Subkutan',
  frequency: 'Täglich',
  x_days_interval: null,
  schedule_days: [],
  intake_time: 'custom',
  intake_time_custom: null as string | null,
  schedule_history: [{
    effective_from: '2026-08-01',
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: [],
    intake_time: 'custom',
    intake_time_custom: '08:00',
    dose: 5,
    unit: 'mg',
  }],
  active: true,
  end_date: null,
  stack_items: {
    id: 'stack-1',
    display_name: 'BPC-157',
    tracking_level: 'with_amount',
    pk_profile_method: 'Subkutan',
    ingredients: [{
      position: 0,
      substance_catalog: {
        pk_profile_id: 'pk-1',
        pk_profiles: {
          name: 'BPC-157',
          half_life_hours: 4,
          tmax_hours: 1,
          bioavailability_sc: 1,
          category: 'peptide',
        },
      },
    }],
  },
}]

vi.mock('../context/AuthContext', () => {
  const user = { id: 'user-1' }
  return { useAuth: () => ({ user }) }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      carouselMocks.tables.push(table)
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = () => builder
      builder.order = () => builder
      builder.then = (resolve: any) => Promise.resolve({
        data: table === 'cycles' ? (carouselMocks.normalized ? [carouselMocks.normalized] : cycles) : carouselMocks.escalations,
        error: null,
      }).then(resolve)
      return builder
    },
  },
}))

vi.mock('../services/blutspiegelHistory', async importOriginal => {
  const original = await importOriginal<typeof import('../services/blutspiegelHistory')>()
  return {
    ...original,
    getCurrentBlutspiegelLevel: vi.fn(),
  }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  carouselMocks.escalations = []
  carouselMocks.tables = []
  carouselMocks.normalized = null
  ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false
  cycles[0].dose = null
  cycles[0].unit = null
  cycles[0].intake_time_custom = null
  cycles[0].stack_items.tracking_level = 'with_amount'
})

describe('BlutspiegelCarousel PK readiness', () => {
  it('renders normalized readiness without legacy escalation reads', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    carouselMocks.normalized = { ...cycles[0], active: false, schedule_history: null,
      started_at: '2026-08-01T00:00:00Z', ended_at: null, pauses: [], versions: [{
        id: 'v1', cycle_id: 'cycle-1', effective_kind: 'local_date', effective_at: null, effective_local_date: '2026-08-01',
        change_kind: 'initial', frequency: 'Täglich', x_days_interval: null, interval_unit: null, cycle_on_days: null,
        cycle_off_days: null, schedule_days: [], intake_time: 'custom', intake_time_custom: '08:00',
        slot_doses: null, slot_days: null, dose: 5, unit: 'mg', method: 'Subkutan',
      }] }
    render(<MemoryRouter><BlutspiegelCarousel /></MemoryRouter>)
    await screen.findByText(/PK-Daten unvollständig/)
    expect(screen.queryByText(/Fehlend:.*Dosis/)).toBeNull()
    expect(carouselMocks.tables).not.toContain('dose_escalations')
  })
  it('shows an incomplete card and does not calculate a live curve', async () => {
    render(
      <MemoryRouter>
        <BlutspiegelCarousel />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText(/PK-Daten unvollständig/)).toBeTruthy())
    expect(screen.getByRole('link', { name: /Angaben vervollständigen/ }).getAttribute('href'))
      .toBe('/my-stack?edit=stack-1&intent=pk')
    expect(getCurrentBlutspiegelLevel).not.toHaveBeenCalled()
  })

  it('uses the active schedule segment instead of incomplete flat fields', async () => {
    cycles[0].stack_items.tracking_level = 'complete'
    vi.mocked(getCurrentBlutspiegelLevel).mockResolvedValue({
      currentLevel: 50,
      trend: 'stable',
      sparkData: Array(20).fill(50),
      nextDoseIn: '1h',
      levelAfterNextDose: 75,
      peakLabel: 'in 1h',
      unit: 'mg',
      interruptedAt: null,
    })

    render(
      <MemoryRouter>
        <BlutspiegelCarousel />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Geschätzter Wirkstoff/)).toBeTruthy()
    expect(screen.queryByText(/PK-Daten unvollständig/)).toBeNull()
  })

  it('does not calculate when an active escalation unit mismatches the segment', async () => {
    cycles[0].stack_items.tracking_level = 'complete'
    cycles[0].dose = 5
    cycles[0].unit = 'mg'
    cycles[0].intake_time_custom = '08:00'
    carouselMocks.escalations = [{
      cycle_id: 'cycle-1',
      increase_amount: 500,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-08-01',
      start_after_days: null,
    }]

    render(
      <MemoryRouter>
        <BlutspiegelCarousel />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText(/PK-Daten unvollständig/)).toBeTruthy())
    expect(getCurrentBlutspiegelLevel).not.toHaveBeenCalled()
  })
})
