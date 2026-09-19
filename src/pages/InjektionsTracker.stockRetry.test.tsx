// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InjektionsTracker } from './InjektionsTracker'
import { FEATURES } from '../config/features'
vi.mock('../config/features', () => ({ FEATURES: { planTimelineV2: false } }))

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
    status: 'open' as 'open' | 'confirmed',
    doseLogId: null as string | null,
  }
  return {
    user: { id: 'user-1' },
    intake,
    loadError: false,
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
vi.mock('../lib/injectionPersistence', async importOriginal => ({
  assertInjectionProSchema: vi.fn(async () => undefined),
  confirmIntakeDoseLog: trackerMocks.confirmIntakeDoseLog,
  loadInjectionLogs: vi.fn(async () => []),
  loadSelectableInjectionIntakes: vi.fn(async () => {
    if (trackerMocks.loadError) throw new Error('Timeline unavailable')
    return [trackerMocks.intake]
  }),
  isDoseLogAlreadyLinkedError: vi.fn(() => false),
  isInjectionProSchemaError: vi.fn(() => false),
  resolveInjectionDoseLogId: (await importOriginal<typeof import('../lib/injectionPersistence')>()).resolveInjectionDoseLogId,
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
  ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false
  trackerMocks.loadError = false
  Object.assign(trackerMocks.intake, { status: 'open', doseLogId: null, dose: 1, unit: 'mg', method: 'Subkutan', scheduledAt: '2026-08-26T08:00:00.000Z' })
  trackerMocks.debitStock
    .mockReset()
    .mockRejectedValueOnce(new Error('stock offline'))
    .mockResolvedValueOnce(0.9)
})

describe('InjektionsTracker committed stock retry', () => {
  it('shows a visible unavailable state when normalized timeline loading fails', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    trackerMocks.loadError = true
    render(createElement(MemoryRouter, null, createElement(InjektionsTracker)))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('inj_plan_load_error'))
  })
  it('pins a confirmed V2 intake using its persisted snapshot rather than editable sheet values', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    Object.assign(trackerMocks.intake, { status: 'confirmed', doseLogId: 'confirmed-log', dose: 250, unit: 'mcg',
      method: 'Intramuskulaer', scheduledAt: '2026-08-25T09:15:00.000Z' })
    render(createElement(MemoryRouter, null, createElement(InjektionsTracker)))
    fireEvent.click(await screen.findByRole('button', { name: 'Pin setzen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Position übernehmen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Einnahme speichern' }))
    await waitFor(() => expect(trackerMocks.saveInjectionLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      doseLogId: 'confirmed-log', cycleId: 'cycle-1', dose: 250, unit: 'mcg', method: 'Intramuskulaer', loggedAt: '2026-08-25T09:15:00.000Z',
    })))
    expect(trackerMocks.confirmIntakeDoseLog).not.toHaveBeenCalled()
  })
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
