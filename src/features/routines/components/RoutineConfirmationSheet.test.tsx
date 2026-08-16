// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoutineConfirmationEntry, RoutineGroupModel, RoutineIntake } from '../intakeGroups'
import { RoutineConfirmationSheet } from './RoutineConfirmationSheet'

function intake(overrides: Partial<RoutineIntake> = {}): RoutineIntake {
  return {
    key: 'd3',
    cycleId: 'cycle-d3',
    pendingLogId: null,
    stackItemId: 'stack-d3',
    stackItemName: 'Vitamin D3',
    trackingLevel: 'intake_only',
    group: 'morning',
    scheduledAt: '2026-07-29T08:00:00.000Z',
    dose: null,
    unit: null,
    method: 'Oral',
    injectable: false,
    ...overrides,
  }
}

function group(): RoutineGroupModel {
  return {
    key: 'morning',
    items: [
      intake(),
      intake({
        key: 'zinc',
        cycleId: 'cycle-zinc',
        stackItemId: 'stack-zinc',
        stackItemName: 'Zink',
        trackingLevel: 'with_amount',
        dose: 25,
        unit: 'mg',
      }),
      intake({
        key: 'testosterone',
        cycleId: 'cycle-testosterone',
        stackItemId: 'stack-testosterone',
        stackItemName: 'Testosteron',
        trackingLevel: 'complete',
        dose: 100,
        unit: 'mg',
        method: 'Subkutan',
        injectable: true,
      }),
    ],
  }
}

afterEach(cleanup)

describe('RoutineConfirmationSheet', () => {
  it('starts every entry selected and lets a user deselect one', () => {
    render(<RoutineConfirmationSheet group={group()} onClose={() => undefined} onConfirm={async () => []} />)

    const d3 = screen.getByRole('checkbox', { name: 'Vitamin D3 auswählen' }) as HTMLInputElement
    const zinc = screen.getByRole('checkbox', { name: 'Zink auswählen' }) as HTMLInputElement
    const testosterone = screen.getByRole('checkbox', { name: 'Testosteron auswählen' }) as HTMLInputElement
    expect([d3.checked, zinc.checked, testosterone.checked]).toEqual([true, true, true])

    fireEvent.click(zinc)
    expect(zinc.checked).toBe(false)
  })

  it('offers local amount editing only for quantified entries', () => {
    render(<RoutineConfirmationSheet group={group()} onClose={() => undefined} onConfirm={async () => []} />)

    expect(screen.getAllByRole('button', { name: 'Menge ändern' })).toHaveLength(2)
    expect(screen.queryByLabelText('Menge für Vitamin D3')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Menge ändern' })[0])
    expect((screen.getByLabelText('Menge für Zink') as HTMLInputElement).value).toBe('25')
  })

  it('confirms without requiring an injection site and exposes site tracking afterward', async () => {
    const onConfirm = vi.fn(async (_entries: RoutineConfirmationEntry[]) => ['log-d3', 'log-zinc', 'log-testosterone'])
    const onAddInjection = vi.fn()
    render(
      <RoutineConfirmationSheet
        group={group()}
        onClose={() => undefined}
        onConfirm={onConfirm}
        onAddInjection={onAddInjection}
      />,
    )

    const confirmButton = screen.getByRole('button', { name: 'Alles eingenommen' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(false)
    expect(screen.queryByRole('button', { name: /Injektionsstelle ergänzen/ })).toBeNull()

    fireEvent.click(confirmButton)

    const injectionButton = await screen.findByRole('button', { name: 'Injektionsstelle ergänzen für Testosteron' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm.mock.calls[0][0]).toHaveLength(3)
    fireEvent.click(injectionButton)
    expect(onAddInjection).toHaveBeenCalledWith(expect.objectContaining({ key: 'testosterone' }), 'log-testosterone')
  })

  it('preserves edits and selections after a failed save and retries the same local state', async () => {
    const onConfirm = vi.fn(async (_entries: RoutineConfirmationEntry[]) => ['log-d3', 'log-zinc'])
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(['log-d3', 'log-zinc'])
    render(<RoutineConfirmationSheet group={group()} onClose={() => undefined} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Testosteron auswählen' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Menge ändern' })[0])
    const amount = screen.getByLabelText('Menge für Zink') as HTMLInputElement
    fireEvent.change(amount, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Alles eingenommen' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Gruppe konnte nicht gespeichert werden.')
    expect((screen.getByRole('checkbox', { name: 'Testosteron auswählen' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('Menge für Zink') as HTMLInputElement).value).toBe('30')

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2))
    const retriedEntries = onConfirm.mock.calls[1][0]
    expect(retriedEntries.find((item: { key: string }) => item.key === 'zinc')).toMatchObject({ actualDose: 30 })
    expect(retriedEntries.find((item: { key: string }) => item.key === 'testosterone')).toMatchObject({ selected: false })
    expect(within(screen.getByRole('dialog')).queryByRole('alert')).toBeNull()
  })

  it('never offers an RPC retry after commit when post-confirm work rejects', async () => {
    const onConfirm = vi.fn(async (_entries: RoutineConfirmationEntry[]) => [
      'log-d3',
      'log-zinc',
      'log-testosterone',
    ])
    const onAfterConfirm = vi.fn(async () => {
      throw new Error('reload failed')
    })
    render(
      <RoutineConfirmationSheet
        group={group()}
        onClose={() => undefined}
        onConfirm={onConfirm}
        onAfterConfirm={onAfterConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Alles eingenommen' }))

    expect(await screen.findByText('Routine gespeichert')).toBeTruthy()
    await waitFor(() => expect(onAfterConfirm).toHaveBeenCalledTimes(1))
    expect(onAfterConfirm).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ key: 'd3' })]),
      ['log-d3', 'log-zinc', 'log-testosterone'],
    )
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
