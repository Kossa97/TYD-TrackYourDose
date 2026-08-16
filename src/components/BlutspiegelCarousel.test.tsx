// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BlutspiegelCarousel } from './BlutspiegelCarousel'
import { getCurrentBlutspiegelLevel } from '../services/blutspiegelHistory'

const cycles = [{
  id: 'cycle-1',
  dose: 5,
  unit: 'mg',
  method: 'Subkutan',
  intake_time_custom: '08:00',
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
    from: () => {
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = () => Promise.resolve({ data: cycles, error: null })
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
})

describe('BlutspiegelCarousel PK readiness', () => {
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
})
