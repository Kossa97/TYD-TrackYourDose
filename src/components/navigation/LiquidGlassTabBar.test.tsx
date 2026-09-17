// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
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
const reiter = (id: string) => document.querySelector(`[${TAB_ATTR}="${id}"]`) as HTMLElement

/** Ein Zeigerereignis, wie es ein Finger auslöst. jsdom kennt PointerEvent nicht. */
function zeiger(art: string, ziel: HTMLElement, clientX: number) {
  const e = new MouseEvent(art, { bubbles: true, cancelable: true, clientX }) as MouseEvent & {
    pointerId: number
  }
  Object.defineProperty(e, 'pointerId', { value: 1 })
  // In `act`, damit React die Zustandsänderung fertig einarbeitet, bevor der
  // Test ins DOM schaut.
  act(() => { ziel.dispatchEvent(e) })
}

describe('LiquidGlassTabBar', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {} unobserve() {} disconnect() {}
    })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  const bauen = (
    activeId: string | null,
    haken: { onSelect?: (id: string) => void; onPreviewChange?: (id: string) => void } = {},
  ) => render(
    <LiquidGlassTabBar
      items={eintraege(['home', 'my-stack', 'kalender', 'profil'])}
      activeId={activeId}
      centerIndex={2}
      centerAction={<button type="button" aria-label="Quick Actions" className="tyd-tabbar-item" data-tyd-center>+</button>}
      ariaLabel="Navigation"
      {...haken}
    />,
  )

  /** Damit `setPointerCapture` in jsdom nicht auf die Nase fällt. */
  const zeigerfaehig = (el: HTMLElement) => {
    el.setPointerCapture = () => {}
    el.releasePointerCapture = () => {}
    el.hasPointerCapture = () => true
  }

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

  it('lässt die Pille dem Finger folgen, solange er liegt', () => {
    // Halten und schieben: der Finger setzt auf einem Reiter auf, die Pille
    // folgt ihm die Leiste entlang.
    masse({
      home: { links: 8, breite: 70 },
      'my-stack': { links: 82, breite: 90 },
      kalender: { links: 200, breite: 80 },
      profil: { links: 284, breite: 68 },
    })
    bauen('home')
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 62, width: 360, height: 62, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    expect(pille().dataset.gehalten).toBe('true')

    zeiger('pointermove', leiste(), 240)          // über „Kalender" (Mitte 240)
    expect(pille().style.transform).toBe('translateX(200px)')
  })

  it('öffnet beim Loslassen den Reiter unter dem Finger', () => {
    const geoeffnet: string[] = []
    masse({
      home: { links: 8, breite: 70 },
      kalender: { links: 200, breite: 80 },
    })
    bauen('home', { onSelect: id => geoeffnet.push(id) })
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 62, width: 360, height: 62, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointermove', leiste(), 240)
    zeiger('pointerup', leiste(), 240)

    expect(geoeffnet).toEqual(['kalender'])
  })

  it('lässt einen einfachen Tipp der Verknüpfung selbst', () => {
    // Ohne Wandern gibt es kein `onSelect`: dann macht die Verknüpfung ihre
    // Arbeit, samt allem, was ein Browser an einer Verknüpfung kann.
    const geoeffnet: string[] = []
    masse({ home: { links: 8, breite: 70 } })
    bauen('home', { onSelect: id => geoeffnet.push(id) })
    zeigerfaehig(leiste())

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointerup', leiste(), 40)

    expect(geoeffnet).toEqual([])
  })

  it('startet kein Ziehen an der mittleren Schaltfläche', () => {
    // Sie ist kein Reiter — wer sie drückt, will den Schnellzugriff, nicht die
    // Leiste entlangfahren.
    const geoeffnet: string[] = []
    masse({ home: { links: 8, breite: 70 }, kalender: { links: 200, breite: 80 } })
    bauen('home', { onSelect: id => geoeffnet.push(id) })
    zeigerfaehig(leiste())

    zeiger('pointerdown', document.querySelector('[data-tyd-center]') as HTMLElement, 150)
    zeiger('pointermove', leiste(), 240)
    zeiger('pointerup', leiste(), 240)

    expect(geoeffnet).toEqual([])
    expect(pille().dataset.gehalten).toBe('false')
  })

  it('meldet jeden Reiter, über den der Finger gleitet', () => {
    // Für den Klick am Gerät — ein Tick je Reiter, wie am Rad einer Uhr.
    const gestreift: string[] = []
    masse({
      home: { links: 8, breite: 70 },
      'my-stack': { links: 82, breite: 90 },
      kalender: { links: 200, breite: 80 },
    })
    bauen('home', { onPreviewChange: id => gestreift.push(id) })
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 62, width: 360, height: 62, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointermove', leiste(), 128)
    zeiger('pointermove', leiste(), 240)

    expect(gestreift).toEqual(['my-stack', 'kalender'])
  })

  it('hält die vorgelesene Seite an der echten Route, nicht am Finger', () => {
    // Was vorgelesen wird, darf nicht von einer Geste abhängen, die noch
    // läuft: `aria-current` bleibt auf der Seite, auf der man wirklich ist.
    masse({ home: { links: 8, breite: 70 }, kalender: { links: 200, breite: 80 } })
    bauen('home')
    zeigerfaehig(leiste())
    leiste().getBoundingClientRect = () => ({ left: 0, top: 0, right: 360, bottom: 62, width: 360, height: 62, x: 0, y: 0, toJSON: () => ({}) })

    zeiger('pointerdown', reiter('home'), 40)
    zeiger('pointermove', leiste(), 240)

    expect(document.querySelector('[aria-current="page"]')?.getAttribute(TAB_ATTR)).toBe('home')
  })

  it('trägt eine Beschriftung für die Vorlesung', () => {
    masse({ home: { links: 8, breite: 70 } })
    bauen('home')

    expect(leiste().getAttribute("aria-label")).toBe("Navigation")
    expect(leiste().tagName).toBe('NAV')
  })
})
