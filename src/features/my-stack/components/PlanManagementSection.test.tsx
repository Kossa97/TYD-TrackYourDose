// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CyclePlanVersion, CycleTimeline } from '../../../lib/planTimeline'
import { PlanManagementSection, type PlanManagementSectionProps } from './PlanManagementSection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'de' },
    t: (_key: string, options?: Record<string, unknown>) => {
      let value = String(options?.defaultValue ?? _key)
      for (const [name, replacement] of Object.entries(options ?? {})) {
        value = value.replaceAll(`{{${name}}}`, String(replacement))
      }
      return value
    },
  }),
}))

const now = new Date('2026-09-19T08:00:00.000Z')

function version(
  id: string,
  dose: number,
  effectiveLocalDate: string,
  changes: Partial<CyclePlanVersion> = {},
): CyclePlanVersion {
  return {
    id,
    cycle_id: 'cycle-1',
    effective_kind: 'local_date',
    effective_at: null,
    effective_local_date: effectiveLocalDate,
    change_kind: id === 'version-current' ? 'initial' : 'dose',
    frequency: 'daily',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
    intake_time: 'abends',
    intake_time_custom: '20:00',
    slot_doses: null,
    slot_days: null,
    dose,
    unit: 'mg',
    method: 'Oral',
    ...changes,
  }
}

function timeline(changes: Partial<CycleTimeline> = {}): CycleTimeline {
  return {
    cycle: {
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      started_at: '2026-09-01T08:00:00.000Z',
      ended_at: null,
    },
    versions: [
      version('version-current', 5, '2026-09-01'),
      version('version-future', 10, '2026-09-21'),
    ],
    pauses: [],
    ...changes,
  }
}

function callbacks(overrides: Partial<PlanManagementSectionProps> = {}): PlanManagementSectionProps {
  return {
    timeline: timeline(),
    now,
    timeZone: 'Europe/Berlin',
    onAdjustDose: vi.fn(),
    onAdjustSchedule: vi.fn(),
    onEditFuture: vi.fn(),
    onRemoveFuture: vi.fn(async () => undefined),
    onPause: vi.fn(async () => undefined),
    onSetPauseEnd: vi.fn(async () => undefined),
    onResume: vi.fn(async () => undefined),
    onEnd: vi.fn(async () => undefined),
    onRestart: vi.fn(),
    ...overrides,
  }
}

afterEach(cleanup)

describe('PlanManagementSection', () => {
  it('shows the resolved current plan, next intake, and the next exact future change', () => {
    render(<PlanManagementSection {...callbacks()} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('Aktiv')
    expect(section.textContent).toContain('5 mg')
    expect(section.textContent).toContain('Täglich')
    expect(section.textContent).toContain('20:00')
    expect(section.textContent).toContain('21.09.2026')
    expect(within(section).getByRole('button', { name: 'Dosis anpassen' })).toBeTruthy()
    expect(within(section).getByRole('button', { name: 'Plan anpassen' })).toBeTruthy()
    expect(within(section).queryByRole('button', { name: 'Bearbeiten' })).toBeNull()
  })

  it('allows edit and removal only for the selected future version', async () => {
    const onEditFuture = vi.fn()
    const onRemoveFuture = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ onEditFuture, onRemoveFuture })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Geplante Änderung vom 21.09.2026 bearbeiten' }))
    expect(onEditFuture).toHaveBeenCalledWith(expect.objectContaining({ id: 'version-future' }))

    expect(screen.queryByRole('button', { name: 'Version version-current entfernen' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Geplante Änderung vom 21.09.2026 entfernen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Änderung entfernen' }))
    await waitFor(() => expect(onRemoveFuture).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'version-future' }),
    ))
  })

  it('passes an optional pause end and keeps the dialog open with retry copy after failure', async () => {
    let rejectPause: ((error: Error) => void) | undefined
    const onPause = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectPause = reject }))
    render(<PlanManagementSection {...callbacks({ onPause })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause bestätigen' }))
    expect(onPause).toHaveBeenCalledWith(null)
    expect((screen.getByRole('button', { name: 'Pause bestätigen' }) as HTMLButtonElement).disabled).toBe(true)

    rejectPause?.(new Error('network'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Bitte versuche es erneut'))
    expect(screen.getByRole('dialog', { name: 'Plan pausieren' })).toBeTruthy()
  })

  it('describes a pause neutrally without due, missed, or skipped language', () => {
    const paused = timeline({
      pauses: [{
        id: 'pause-1',
        cycle_id: 'cycle-1',
        paused_at: '2026-09-18T10:00:00.000Z',
        ends_at: null,
      }],
    })
    render(<PlanManagementSection {...callbacks({ timeline: paused })} />)

    expect(screen.getByText('Während der Pause ist keine Einnahme fällig.')).toBeTruthy()
    expect(screen.getByTestId('plan-management-cycle-1').textContent).not.toMatch(/verpasst|übersprungen/i)
    expect(screen.getByRole('button', { name: 'Fortsetzen' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pausenende festlegen' })).toBeTruthy()
  })

  it('shows ended plans as read-only history with restart as the only action', () => {
    const ended = timeline({
      cycle: {
        id: 'cycle-1',
        stack_item_id: 'stack-1',
        started_at: '2026-09-01T08:00:00.000Z',
        ended_at: '2026-09-18T08:00:00.000Z',
      },
    })
    render(<PlanManagementSection {...callbacks({ timeline: ended })} />)

    expect(screen.getByText('Verlauf')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Neu starten' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Dosis anpassen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Plan anpassen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pausieren' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Beenden' })).toBeNull()
    expect(screen.queryByRole('button', { name: /bearbeiten/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /entfernen/i })).toBeNull()
  })

  it('keeps duplicate-looking timelines independent by cycle identity', () => {
    const firstAdjust = vi.fn()
    const secondAdjust = vi.fn()
    const second = timeline({
      cycle: {
        id: 'cycle-2',
        stack_item_id: 'stack-2',
        started_at: '2026-09-01T08:00:00.000Z',
        ended_at: null,
      },
      versions: [version('second-current', 5, '2026-09-01', { cycle_id: 'cycle-2' })],
    })

    render(
      <>
        <PlanManagementSection {...callbacks({ onAdjustDose: firstAdjust })} />
        <PlanManagementSection {...callbacks({ timeline: second, onAdjustDose: secondAdjust })} />
      </>,
    )

    fireEvent.click(within(screen.getByTestId('plan-management-cycle-2')).getByRole('button', {
      name: 'Dosis anpassen',
    }))
    expect(secondAdjust).toHaveBeenCalledWith(expect.objectContaining({ cycle_id: 'cycle-2' }))
    expect(firstAdjust).not.toHaveBeenCalled()
  })
})
