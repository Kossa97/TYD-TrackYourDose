// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExpiredBadge } from './ExpiredBadge'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const werte = Object.entries(options ?? {}).map(([name, wert]) => `${name}=${String(wert)}`)
      return werte.length > 0 ? `${key}(${werte.join(',')})` : key
    },
  }),
}))

afterEach(cleanup)

function badge(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-expired-badge]')!
}

describe('ExpiredBadge', () => {
  it('alarms first, then says for how long once the alarm has run', () => {
    render(<ExpiredBadge daysSince={3} />)
    expect(badge().dataset.expiredBadge).toBe('alarm')
    expect(badge().className).toContain('tyd-expired-badge-alarm')
    const icon = badge().querySelector('svg')!
    expect(icon.getAttribute('class')).toContain('tyd-expired-icon-alarm')

    // jsdom kennt kein AnimationEvent; React hoert dort auf den Namen mit
    // Praefix. Im Browser kommt „animationend".
    fireEvent.animationEnd(icon)
    fireEvent(icon, new Event('webkitAnimationEnd', { bubbles: true }))
    expect(badge().dataset.expiredBadge).toBe('seit')
    expect(badge().className).not.toContain('tyd-expired-badge-alarm')
    // Das Warnsymbol bleibt und pulsiert ruhig — nicht nur die Farbe warnt.
    expect(badge().querySelector('svg')!.getAttribute('class')).toContain('tyd-expired-icon-calm')
  })

  it('reads out both at once, whatever is on screen', () => {
    render(<ExpiredBadge daysSince={3} />)
    expect(screen.getByText('my_stack_expired_aria(since=my_stack_expired_since_days(n=3))').className).toContain('sr-only')
  })

  it('says since today and for one day in their own words', () => {
    const { unmount } = render(<ExpiredBadge daysSince={0} />)
    expect(screen.getByText('my_stack_expired_since_today')).toBeTruthy()
    unmount()
    render(<ExpiredBadge daysSince={1} />)
    expect(screen.getByText('my_stack_expired_since_day')).toBeTruthy()
  })

  it('shows the end state right away for reduced motion', () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn(() => ({ matches: true }) as unknown as MediaQueryList)
    render(<ExpiredBadge daysSince={2} />)
    expect(badge().dataset.expiredBadge).toBe('seit')
    window.matchMedia = original
  })
})
