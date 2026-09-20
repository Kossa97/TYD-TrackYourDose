// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

const impact = vi.hoisted(() => vi.fn())

vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact },
  ImpactStyle: { Light: 'LIGHT' },
}))

import { hapticTick } from './haptics'

afterEach(() => {
  vi.restoreAllMocks()
  impact.mockReset()
})

describe('hapticTick', () => {
  it('does not call the web vibration fallback without active user input', async () => {
    impact.mockRejectedValueOnce(new Error('native haptics unavailable'))
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { isActive: false },
    })

    await hapticTick()

    expect(vibrate).not.toHaveBeenCalled()
  })
})
