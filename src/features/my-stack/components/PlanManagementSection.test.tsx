// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CyclePlanVersion, CycleTimeline } from '../../../lib/planTimeline'
import { PlanManagementSection, type PlanManagementSectionProps } from './PlanManagementSection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'de' },
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        my_stack_rhythm_unit_day: 'Tagen',
        my_stack_rhythm_unit_week: 'Wochen',
        my_stack_rhythm_unit_month: 'Monaten',
      }
      let value = translations[key] ?? String(options?.defaultValue ?? key)
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
    needsReview: false,
    onResolveConflict: vi.fn(async () => undefined),
    ...overrides,
  }
}

afterEach(cleanup)

describe('PlanManagementSection', () => {
  it('replaces every ordinary plan presentation with a history-preserving conflict choice', async () => {
    const onResolveConflict = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ needsReview: true, onResolveConflict })} />)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('Welcher Plan läuft wirklich?')
    expect(section.textContent).toContain('Deine bisherigen Einnahmen und der gesamte Verlauf bleiben erhalten.')
    expect(section.textContent).not.toContain('Aktiv')
    expect(section.textContent).not.toContain('5 mg')
    expect(section.textContent).not.toContain('Nächste Einnahme')
    expect(section.textContent).not.toContain('Nächste Änderung')
    expect(within(section).queryByRole('button', { name: 'Dosis anpassen' })).toBeNull()
    expect(within(section).queryByRole('button', { name: 'Plan anpassen' })).toBeNull()

    fireEvent.click(within(section).getByRole('button', { name: 'Diesen laufenden Plan behalten' }))
    await waitFor(() => expect(onResolveConflict).toHaveBeenCalledTimes(1))
  })

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

  it('converts pause and pause-end wall clocks to deterministic timezone-safe instants', async () => {
    const onPause = vi.fn(async () => undefined)
    const onSetPauseEnd = vi.fn(async () => undefined)
    const { rerender } = render(<PlanManagementSection {...callbacks({ onPause, onSetPauseEnd })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis (optional)'), {
      target: { value: '2026-09-19T10:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pause bestätigen' }))
    await waitFor(() => expect(onPause).toHaveBeenCalledWith('2026-09-19T08:30:00.000Z'))

    const paused = timeline({
      pauses: [{
        id: 'pause-1',
        cycle_id: 'cycle-1',
        paused_at: '2026-09-18T10:00:00.000Z',
        ends_at: null,
      }],
    })
    rerender(<PlanManagementSection {...callbacks({ timeline: paused, onPause, onSetPauseEnd })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pausenende festlegen' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis'), {
      target: { value: '2026-10-25T02:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pausenende speichern' }))
    await waitFor(() => expect(onSetPauseEnd).toHaveBeenCalledWith('2026-10-25T00:30:00.000Z'))
  })

  it('rejects a DST-gap wall clock without closing the pause dialog', async () => {
    const onPause = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ onPause })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis (optional)'), {
      target: { value: '2026-03-29T02:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Pause bestätigen' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Bitte versuche es erneut'))
    expect(onPause).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Plan pausieren' })).toBeTruthy()
  })

  it('does not let a canceled invalid pause value block ending the plan', async () => {
    const onEnd = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ onEnd })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis (optional)'), {
      target: { value: '2026-03-29T02:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    fireEvent.click(screen.getByRole('button', { name: 'Beenden' }))
    fireEvent.click(screen.getByRole('button', { name: 'Plan beenden' }))

    await waitFor(() => expect(onEnd).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not let a canceled invalid pause value block removing a future version', async () => {
    const onRemoveFuture = vi.fn(async () => undefined)
    render(<PlanManagementSection {...callbacks({ onRemoveFuture })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    fireEvent.change(screen.getByLabelText('Pausieren bis (optional)'), {
      target: { value: '2026-03-29T02:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))

    fireEvent.click(screen.getByRole('button', { name: 'Geplante Änderung vom 21.09.2026 entfernen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Änderung entfernen' }))

    await waitFor(() => expect(onRemoveFuture).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
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

  it('keeps ended history visible while restart is pending and retryable after failure', async () => {
    let rejectRestart: ((error: Error) => void) | undefined
    const onRestart = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectRestart = reject }))
    const ended = timeline({
      cycle: {
        id: 'cycle-1',
        stack_item_id: 'stack-1',
        started_at: '2026-09-01T08:00:00.000Z',
        ended_at: '2026-09-18T08:00:00.000Z',
      },
    })
    render(<PlanManagementSection {...callbacks({ timeline: ended, onRestart })} />)

    const restart = screen.getByRole('button', { name: 'Neu starten' }) as HTMLButtonElement
    fireEvent.click(restart)
    expect(restart.disabled).toBe(true)
    expect(screen.getByText('Verlauf')).toBeTruthy()

    rejectRestart?.(new Error('network'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Bitte versuche es erneut'))
    expect(restart.disabled).toBe(false)
    expect(screen.getByText('Verlauf')).toBeTruthy()
  })

  it('treats a planned initial version as an editable future preview with its next intake', async () => {
    const planned = timeline({
      cycle: {
        id: 'cycle-1',
        stack_item_id: 'stack-1',
        started_at: '2026-09-20T08:00:00.000Z',
        ended_at: null,
      },
      versions: [version('version-planned', 5, '2026-09-20', { change_kind: 'initial' })],
    })
    render(<PlanManagementSection {...callbacks({ timeline: planned })} />)
    expect((screen.getByRole('button', { name: /Geplante Änderung.*entfernen/ }) as HTMLButtonElement).disabled).toBe(true)

    const section = screen.getByTestId('plan-management-cycle-1')
    expect(section.textContent).toContain('Geplant')
    expect(section.textContent).toContain('20.09.2026 · 20:00')
    expect(within(section).getByRole('button', { name: 'Geplante Änderung vom 20.09.2026 bearbeiten' })).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: 'Geplante Änderung vom 20.09.2026 entfernen' }))
    expect(screen.queryByRole('dialog', { name: 'Geplante Änderung entfernen' })).toBeNull()
    expect(within(section).queryByRole('button', { name: 'Dosis anpassen' })).toBeNull()
    expect(within(section).queryByRole('button', { name: 'Plan anpassen' })).toBeNull()
  })

  it.each([
    {
      label: 'interval',
      changes: { frequency: 'interval', x_days_interval: 10, interval_unit: 'week' },
      expected: 'Alle 10 Wochen',
    },
    {
      label: 'weekdays',
      changes: { frequency: 'weekdays', schedule_days: ['Mo', 'Mi'] },
      expected: 'Mo, Mi',
    },
    {
      label: 'cycle',
      changes: { frequency: 'cycle', cycle_on_days: 5, cycle_off_days: 2 },
      expected: '5 Tage an, 2 Tage Pause',
    },
  ])('shows the complete $label rhythm summary', ({ changes, expected }) => {
    const detailed = timeline({
      versions: [version('version-current', 5, '2026-09-01', changes)],
    })
    render(<PlanManagementSection {...callbacks({ timeline: detailed })} />)

    expect(screen.getByTestId('plan-management-cycle-1').textContent).toContain(expected)
  })

  it('portals confirmations to the viewport and restores focus after Escape', async () => {
    const { container } = render(<PlanManagementSection {...callbacks()} />)
    const pause = screen.getByRole('button', { name: 'Pausieren' })
    pause.focus()
    fireEvent.click(pause)

    const dialog = screen.getByRole('dialog', { name: 'Plan pausieren' })
    const input = screen.getByLabelText('Pausieren bis (optional)')
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(container.contains(dialog)).toBe(false)
    expect((container as HTMLElement).inert).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Plan pausieren' })).toBeNull())
    expect(document.activeElement).toBe(pause)
    expect((container as HTMLElement).inert).not.toBe(true)
  })

  it('contains focus and disables the pause input throughout a pending mutation', async () => {
    let resolvePause: (() => void) | undefined
    const onPause = vi.fn(() => new Promise<void>(resolve => { resolvePause = resolve }))
    render(<PlanManagementSection {...callbacks({ onPause })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pausieren' }))
    const dialog = screen.getByRole('dialog', { name: 'Plan pausieren' })
    const input = screen.getByLabelText('Pausieren bis (optional)') as HTMLInputElement
    const confirm = screen.getByRole('button', { name: 'Pause bestätigen' }) as HTMLButtonElement
    const cancel = screen.getByRole('button', { name: 'Abbrechen' }) as HTMLButtonElement
    const close = screen.getByRole('button', { name: 'Schließen' })

    confirm.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    close.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)

    fireEvent.click(confirm)
    expect(input.disabled).toBe(true)
    expect(confirm.disabled).toBe(true)
    expect(cancel.disabled).toBe(true)
    resolvePause?.()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Plan pausieren' })).toBeNull())
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
