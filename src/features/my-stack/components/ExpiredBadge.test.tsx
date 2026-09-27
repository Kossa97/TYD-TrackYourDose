// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8')

describe('ExpiredBadge', () => {
  it('stacks alarm and duration so the badge never jumps, each on its own track of the cycle', () => {
    render(<ExpiredBadge daysSince={3} />)
    const alarm = screen.getByText('my_stack_expired')
    const since = screen.getByText('my_stack_expired_since_days(n=3)')
    expect(alarm.className).toContain('tyd-expired-text-alarm')
    expect(since.className).toContain('tyd-expired-text-since')
    expect(alarm.className).toContain('row-start-1')
    expect(since.className).toContain('row-start-1')
    expect(document.querySelector('svg')!.getAttribute('class')).toContain('tyd-expired-icon')
  })

  it('runs every part on the same endless 6-second cycle, so they stay in step', () => {
    for (const teil of ['badge', 'icon', 'text-alarm', 'text-since']) {
      expect(css, teil).toMatch(new RegExp(`\\.tyd-expired-${teil} \\{[^}]*animation: tyd-expired-[a-z-]+ 6s ease-in-out infinite;`))
    }
  })

  it('keeps the swap but drops blinking and movement for reduced motion', () => {
    const block = css.slice(css.indexOf('.tyd-expired-badge {'), css.indexOf('/* Onboarding overlay'))
    expect(block).toContain('@media (prefers-reduced-motion: reduce)')
    expect(block).toContain('.tyd-expired-text-alarm { animation-name: tyd-expired-fade-alarm; }')
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
})
