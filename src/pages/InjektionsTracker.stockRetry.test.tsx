// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InjektionsTracker } from './InjektionsTracker'

const trackerMocks = vi.hoisted(() => {
  const intake = {
    cycleId: 'cycle-1',
    stackItemId: 'stack-1',
    stackItemName: 'Peptide',
    cycleName: 'Cycle',
    dose: 1,
    unit: 'mg',
    method: 'Subkutan',
    scheduledAt: '2026-08-26T08:00:00.000Z',
    daysOverdue: 0,
    status: 'open' as const,
    doseLogId: null,
  }
  return {
    user: { id: 'user-1' },
    intake,
    confirmIntakeDoseLog: vi.fn(async () => 'committed-dose-log'),
    debitStock: vi.fn()
      .mockRejectedValueOnce(new Error('stock offline'))
      .mockResolvedValueOnce(0.9),
    saveInjectionLog: vi.fn(async () => 'injection-log-1'),
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  }
})

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: trackerMocks.user }) }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key }),
}))
vi.mock('react-hot-toast', () => ({ default: trackerMocks.toast }))
vi.mock('../lib/injectionPersistence', () => ({
  assertInjectionProSchema: vi.fn(async () => undefined),
  confirmIntakeDoseLog: trackerMocks.confirmIntakeDoseLog,
  loadInjectionLogs: vi.fn(async () => []),
  loadSelectableInjectionIntakes: vi.fn(async () => [trackerMocks.intake]),
  isDoseLogAlreadyLinkedError: vi.fn(() => false),
  isInjectionProSchemaError: vi.fn(() => false),
  resolveInjectionDoseLogId: vi.fn(async (_intake, confirm: () => Promise<string>) => confirm()),
  saveInjectionLog: trackerMocks.saveInjectionLog,
}))
vi.mock('../features/my-stack/extensions/peptide/vialStock', () => ({
  debitPeptideStockForDoseById: trackerMocks.debitStock,
}))
vi.mock('../lib/injectionGeometry', () => ({
  proximityWarning: () => ({ level: 'none', nearestLogId: null, distance: null }),
}))
vi.mock('../components/injection3d/InjectionMapCanvas', () => ({
  InjectionMapCanvas: ({ onDraftPinChange }: { onDraftPinChange: (pin: unknown) => void }) => (
    <button type="button" onClick={() => onDraftPinChange({
      model_version: 'placeholder-v1',
      body_region: 'abdomen',
      body_side: 'right',
      position: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      uv: null,
      camera_state: null,
    })}>Pin setzen</button>
  ),
}))
vi.mock('../components/injection3d/InjectionLogSheet', () => ({
  InjectionLogSheet: ({ onSave }: { onSave: (input: unknown) => void }) => (
    <button type="button" onClick={() => onSave({
      mode: 'intake',
      intake: trackerMocks.intake,
      dose: 1,
      unit: 'mg',
      method: 'Subkutan',
      notes: null,
      loggedAt: '2026-08-26T08:00:00.000Z',
      substanceLabel: null,
    })}>Einnahme speichern</button>
  ),
}))
vi.mock('../components/injection3d/InjectionTrackerTabs', () => ({ InjectionTrackerTabs: () => null }))
vi.mock('../components/injection3d/InjectionIntroSheet', () => ({
  INJECTION_INTRO_VERSION: 1,
  InjectionIntroSheet: () => null,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  trackerMocks.debitStock
    .mockRejectedValueOnce(new Error('stock offline'))
    .mockResolvedValueOnce(0.9)
})

describe('InjektionsTracker committed stock retry', () => {
  it('saves the injection and retries stock with the committed log id without confirming again', async () => {
    render(createElement(MemoryRouter, null, createElement(InjektionsTracker)))

    fireEvent.click(await screen.findByRole('button', { name: 'Pin setzen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Position übernehmen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Einnahme speichern' }))

    const retry = await screen.findByRole('button', { name: 'Bestand erneut versuchen' })
    expect(trackerMocks.confirmIntakeDoseLog).toHaveBeenCalledTimes(1)
    expect(trackerMocks.saveInjectionLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ doseLogId: 'committed-dose-log' }),
    )
    expect(trackerMocks.debitStock).toHaveBeenNthCalledWith(1, expect.anything(), 'committed-dose-log')

    fireEvent.click(retry)

    await waitFor(() => expect(trackerMocks.debitStock).toHaveBeenCalledTimes(2))
    expect(trackerMocks.debitStock).toHaveBeenNthCalledWith(2, expect.anything(), 'committed-dose-log')
    expect(trackerMocks.confirmIntakeDoseLog).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Bestand erneut versuchen' })).toBeNull())
  })
})
