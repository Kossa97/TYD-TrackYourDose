// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { PkReadinessPanel } from './BlutspiegelSimulation'

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

afterEach(cleanup)
beforeEach(() => {
  i18nTestState.translations = {}
})

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
