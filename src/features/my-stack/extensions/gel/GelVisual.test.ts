import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GelVisual } from './GelVisual'

const render = (props: Partial<Parameters<typeof GelVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(GelVisual, { name: 'Testogel', color: '#a3e635', ...props }))

const source = () => readFileSync(new URL('./GelVisual.tsx', import.meta.url), 'utf8')

describe('GelVisual', () => {
  it('meldet sich als Gel-Renderer', () => {
    expect(render()).toContain('data-gel-detail="root"')
  })

  it('zeichnet Glas, Masse, Oberflaeche, Deckel und Etikett', () => {
    const html = render()
    expect(html).toContain('data-gel-detail="glass"')
    expect(html).toContain('data-gel-detail="gel"')
    expect(html).toContain('data-gel-detail="gel-fill"')
    // Die Oberflaeche ist eine Linie, keine Ellipse: der Tiegel steht in
    // Frontansicht wie jede andere Form.
    expect(html).toContain('data-gel-detail="gel-top"')
    expect(html).not.toContain('data-gel-detail="gel-surface"')
    expect(html).toContain('data-gel-detail="lid"')
    expect(html).toContain('data-gel-detail="lid-chamfer"')
    // Dasselbe Band wie bei den anderen Glasformen: durchscheinend, mit
    // Glasrand und Glanz — kein eigener weisser Aufkleber.
    expect(html).toContain('data-gel-detail="label"')
    expect(html).toContain('border-y border-white/40 bg-white/28')
  })

  it('faerbt Deckel und Masse, nicht das Glas', () => {
    const html = render({ color: '#f97316' })
    expect(html).toMatch(/data-gel-detail="lid"[^>]*fill="#f97316"/)
    expect(html).toMatch(/data-gel-detail="gel-fill"[^>]*fill="#f97316"/)
    expect(html).not.toMatch(/data-gel-detail="glass"[^>]*fill="#f97316"/)
  })

  it('hoert dieselbe Geste, antwortet aber zaeh', () => {
    // Der inhaltliche Kern der Form. Gel bewegt sich — aber es benutzt die
    // Federantwort nicht direkt, sondern durch das Verzoegerungsglied aus
    // gelFlow. Der Rest des Fluessigkeitsstapels bleibt draussen: kein
    // LiquidGraphic, kein Pegel, keine Blaeschen, kein Etikettband.
    const src = source()
    expect(src).toContain('useSloshSubscribe')
    expect(src).toContain('stepGelFlow')
    expect(src).not.toContain('LiquidGraphic')
    expect(src).not.toContain('fillPct')
    expect(src).not.toContain('bubbles')
    // Das Etikettband kommt dagegen aus derselben Quelle wie bei Vial und
    // Ampulle: die Regel „Band nur, wo Inhalt sichtbar ist" bleibt intakt.
    expect(src).toContain('<StageLabel')
  })

  it('neigt die Oberkante, statt den Koerper zu drehen', () => {
    // Eine zaehe Masse verliert den Kontakt zur Wand nicht. Gekippt wird nur
    // die Oberkante; der Boden bleibt in jedem Pfad derselbe.
    const src = source()
    expect(src).toContain('buildGelBodyPath(rise)')
    expect(src).toContain('buildGelSurfacePath(rise)')
    // Koerper, Oberflaechenlinie und Beschnitt haengen an einer Pfaddefinition
    // und einer Zahl, damit beim Neigen nichts auseinanderlaufen kann.
    expect(src.match(/href=\{`#\$\{uid\}-gelBody`\}/g)?.length).toBe(4)
  })

  it('zeichnet beide Konturen vor dem Deckel', () => {
    // Beide Pfade schliessen oben waagerecht. Als letztes gezeichnet legte
    // dieser Ringschluss einen geraden Strich quer ueber den Deckel — genau
    // der Fehler, der bei der Pulverdose auftrat.
    const src = source()
    expect(src.indexOf('data-gel-detail="outline"')).toBeLessThan(src.indexOf('data-gel-detail="lid"'))
    expect(src.indexOf('data-gel-detail="inner-contour"')).toBeLessThan(src.indexOf('data-gel-detail="lid"'))
  })

  it('beschneidet jedes wandernde Licht auf sein Teil', () => {
    // Derselbe Fehler wie beim Tabletten-Glanz: unbeschnitten malt es daneben.
    const src = source()
    expect(src.indexOf('bodyClip)`}>')).toBeLessThan(src.indexOf('data-gel-detail="bloom"'))
    expect(src.indexOf('bodyClip)`}>')).toBeLessThan(src.indexOf('data-gel-detail="sheen"'))
    expect(src.indexOf('gelClip)`}>')).toBeLessThan(src.indexOf('data-gel-detail="gel-gloss"'))
    expect(render({ lightOffset: 1 })).toMatch(/data-gel-detail="sheen"[^>]*translate\(20/)
    expect(render({ lightOffset: -1 })).toMatch(/data-gel-detail="sheen"[^>]*translate\(-20/)
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    // Die Sprosse unter der Pulverdose: 90,9 -> 115,5. Schritt x1,2706.
    expect(render({ size: 'large' })).toContain('h-[226.1px]')
    expect(render({ size: 'carousel' })).toContain('h-[90.9px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[115.5px]')
    expect(render({ size: 'compact' })).toContain('h-[68.2px]')
    expect(render({ size: 'mini' })).toContain('h-[37.1px]')
  })

  it('setzt den Namen ins Band, mit Durchlauf wie bei den Glasformen', () => {
    const html = render({ name: 'Hydrocortison Acetat Creme 1 Prozent' })
    // Kein eigener Namenskasten mehr: er steht im Band, wie bei Vial und
    // Ampulle, und in derselben Schrift — weiss, fett, mit Schattenkante.
    expect(html).not.toContain('data-gel-detail="name"')
    expect(html).toContain('vial-label-marquee')
    expect(html).toContain('font-black text-white tracking-normal')
    expect(html).toContain('Hydrocortison Acetat Creme 1 Prozent')
  })
})
