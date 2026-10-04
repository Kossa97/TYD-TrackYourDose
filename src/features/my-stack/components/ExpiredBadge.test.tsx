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
const block = css.slice(css.indexOf('/* ── Abgelaufen-Abzeichen'), css.indexOf('/* Onboarding overlay'))

describe('ExpiredBadge', () => {
  it('schreibt den ganzen Satz aus — heute, ein Tag, mehrere Tage', () => {
    const { rerender } = render(<ExpiredBadge daysSince={3} />)
    expect(screen.getByText('my_stack_expired_full_days(n=3)')).toBeTruthy()
    rerender(<ExpiredBadge daysSince={1} />)
    expect(screen.getByText('my_stack_expired_full_day')).toBeTruthy()
    rerender(<ExpiredBadge daysSince={0} />)
    expect(screen.getByText('my_stack_expired_full_today')).toBeTruthy()
  })

  it('ohne Rahmen und Flaeche: alarmieren tut nur das Symbol', () => {
    render(<ExpiredBadge daysSince={3} />)
    const abzeichen = document.querySelector<HTMLElement>('[data-expired-badge]')!
    expect(abzeichen.className).not.toMatch(/\bborder\b|\bbg-|rounded/)
    expect(document.querySelector('svg')!.getAttribute('class')).toContain('tyd-expired-icon')
    expect(block).not.toContain('box-shadow')
  })

  it('das Symbol blinkt endlos, bei weniger Bewegung steht es still', () => {
    expect(block).toMatch(/\.tyd-expired-icon\s*\{\s*animation:[^;]*\b6s\b[^;]*\binfinite\b/)
    const reduziert = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduziert).toContain('.tyd-expired-icon { animation: none !important; }')
  })
})
