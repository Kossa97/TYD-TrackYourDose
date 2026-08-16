// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PkReadinessPanel } from './BlutspiegelSimulation'

afterEach(cleanup)

describe('PkReadinessPanel', () => {
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
})
