// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExpiredBadge } from './ExpiredBadge'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const werte = Object.entries(options ?? {}).map(([name, wert]) => `${name}=${String(wert)}`)
      return werte.length > 0 ? `${key}(${werte.join(',')})` : key
    },
  }),
}))

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ExpiredBadge', () => {
  it('alarms first, then says for how long', () => {
    render(<ExpiredBadge daysSince={3} />)
    const badge = screen.getByRole('status')
    expect(badge.dataset.expiredBadge).toBe('alarm')
    expect(badge.className).toContain('tyd-expired-badge-alarm')
    expect(badge.querySelector('svg')?.getAttribute('class')).toContain('tyd-expired-icon-alarm')

    act(() => { vi.advanceTimersByTime(2800) })
    expect(badge.dataset.expiredBadge).toBe('seit')
    expect(badge.className).not.toContain('tyd-expired-badge-alarm')
    // Danach pulsiert nur noch das Symbol, ruhig.
    expect(badge.querySelector('svg')?.getAttribute('class')).toContain('tyd-expired-icon-calm')
  })

  it('reads out both at once, whatever is on screen', () => {
    render(<ExpiredBadge daysSince={3} />)
    expect(screen.getByRole('status').getAttribute('aria-label'))
      .toBe('my_stack_expired_aria(since=my_stack_expired_since_many(n=3))')
  })

  it('says since today and for one day in their own words', () => {
    const { unmount } = render(<ExpiredBadge daysSince={0} />)
    expect(screen.getByText('my_stack_expired_since_today')).toBeTruthy()
    unmount()
    render(<ExpiredBadge daysSince={1} />)
    expect(screen.getByText('my_stack_expired_since_one')).toBeTruthy()
  })
})
