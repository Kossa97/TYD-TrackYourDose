// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiquidGlassTabBar, TAB_ATTR, type GlassTabItem } from './LiquidGlassTabBar'

function masse(reiter: Record<string, { links: number; breite: number }>, kapsel = 360) {
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get(this: HTMLElement) { return reiter[this.getAttribute(TAB_ATTR) ?? '']?.links ?? 0 },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      const eigen = reiter[this.getAttribute(TAB_ATTR) ?? '']
      return eigen ? eigen.breite : kapsel
    },
  })
}

const eintraege = (ids: string[]): GlassTabItem[] => ids.map(id => ({
  id,
  label: id,
  icon: <svg data-icon={id} />,
  render: ({ className, children, ...rest }) => (
    <a key={id} href={`/${id}`} className={className} {...rest}>{children}</a>
  ),
}))

const pille = () => document.querySelector('[data-tyd-pill]') as HTMLElement
const leiste = () => document.querySelector('.tyd-tabbar') as HTMLElement

describe('LiquidGlassTabBar', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {} unobserve() {} disconnect() {}
    })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  const bauen = (activeId: string | null) => render(
    <LiquidGlassTabBar
      items={eintraege(['home', 'my-stack', 'kalender', 'profil'])}
      activeId={activeId}
      centerIndex={2}
      centerAction={<button type="button" aria-label="Quick Actions" className="tyd-tabbar-center">+</button>}
      ariaLabel="Navigation"
    />,
  )

  it('legt die Pille auf den aktiven Reiter, gemessen statt gerechnet', () => {
    // Die Reiter sind unterschiedlich breit, sobald eine Beschriftung länger
    // ist — eine Formel aus „Kapselbreite durch Anzahl" träfe daneben.
    masse({ home: { links: 8, breite: 70 }, 'my-stack': { links: 82, breite: 96 } })
    bauen('my-stack')

    expect(pille().style.transform).toBe('translateX(82px)')
    expect(pille().style.width).toBe('96px')
  })

  it('blendet die Pille aus, wo kein Reiter gilt', () => {
    // Auf „/faq" ist man in keinem Reiter — dann gehört dorthin auch keine
    // Pille, statt sie willkürlich unter „Home" zu parken.
    masse({ home: { links: 8, breite: 70 } })
    bauen(null)

    expect(pille().dataset.ohneZiel).toBe('true')
  })

  it('schiebt die mittlere Schaltfläche zwischen zwei und zwei Reiter', () => {
    masse({ home: { links: 8, breite: 70 } })
    bauen('home')

    const kinder = [...leiste().children].slice(1)   // ohne die Pille
    expect(kinder.map(k => k.getAttribute(TAB_ATTR) ?? k.getAttribute('aria-label')))
      .toEqual(['home', 'my-stack', 'Quick Actions', 'kalender', 'profil'])
  })

  it('setzt den aktiven Reiter als aktuelle Seite, für Vorlesung und Farbe', () => {
    masse({ kalender: { links: 200, breite: 80 } })
    bauen('kalender')

    const aktiv = document.querySelector('[aria-current="page"]')
    expect(aktiv?.getAttribute(TAB_ATTR)).toBe('kalender')
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })

  it('führt den Schimmer im Glas der Pille nach', () => {
    // Der räumliche Anteil: Apple holt ihn aus echter Brechung, wir deuten ihn
    // mit einem Lichtfleck an, der dort sitzt, wo die Pille steht.
    masse({ 'my-stack': { links: 82, breite: 96 } }, 360)
    bauen('my-stack')

    // (82 + 96/2) / 360 = 36,11 %
    expect(leiste().style.getPropertyValue('--tyd-glint')).toBe('36.11111111111111%')
  })

  it('trägt eine Beschriftung für die Vorlesung', () => {
    masse({ home: { links: 8, breite: 70 } })
    bauen('home')

    expect(leiste().getAttribute("aria-label")).toBe("Navigation")
    expect(leiste().tagName).toBe('NAV')
  })
})
