// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { denyProps, installDenyFeedback } from './denyFeedback'

describe('denyFeedback', () => {
  let uninstall: (() => void) | null = null
  afterEach(() => {
    uninstall?.()
    uninstall = null
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  function button(attrs: Record<string, string> = {}) {
    const el = document.createElement('button')
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value)
    el.innerHTML = '<span>Label</span>'
    const onClick = vi.fn()
    el.addEventListener('click', onClick)
    document.body.append(el)
    return { el, onClick }
  }

  it('haelt den Klick auf einen gesperrten Knopf an und laesst ihn wackeln', () => {
    vi.useFakeTimers()
    const notify = vi.fn()
    uninstall = installDenyFeedback(document, notify)
    const { el, onClick } = button({ 'aria-disabled': 'true', 'data-deny-reason': 'Keine Daten' })

    el.querySelector('span')!.click()

    expect(onClick).not.toHaveBeenCalled()
    expect(el.hasAttribute('data-deny')).toBe(true)
    expect(notify).toHaveBeenCalledWith('Keine Daten')
    vi.advanceTimersByTime(700)
    expect(el.hasAttribute('data-deny')).toBe(false)
  })

  it('zeigt ohne Grund nur den Rahmen', () => {
    const notify = vi.fn()
    uninstall = installDenyFeedback(document, notify)
    const { el } = button({ 'aria-disabled': 'true' })
    el.click()
    expect(el.hasAttribute('data-deny')).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })

  it('laesst freie Knoepfe in Ruhe', () => {
    const notify = vi.fn()
    uninstall = installDenyFeedback(document, notify)
    const { el, onClick } = button({ 'aria-disabled': 'false' })
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(el.hasAttribute('data-deny')).toBe(false)
  })

  it('setzt die Attribute nur, solange gesperrt ist', () => {
    expect(denyProps(true, 'Grund')).toEqual({ 'aria-disabled': true, 'data-deny-reason': 'Grund' })
    expect(denyProps(false, 'Grund')).toEqual({ 'aria-disabled': undefined, 'data-deny-reason': undefined })
  })
})
