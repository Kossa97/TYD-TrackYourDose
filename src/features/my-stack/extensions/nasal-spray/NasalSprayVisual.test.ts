import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NasalSprayVisual } from './NasalSprayVisual'

const base = { name: 'Oxytocin', amount: 24, unit: 'IU / spray', color: '#7dd3fc' }
const render = (props: Partial<Parameters<typeof NasalSprayVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(NasalSprayVisual, { ...base, ...props }))

describe('NasalSprayVisual', () => {
  it('meldet sich als Nasenspray-Renderer', () => {
    expect(render()).toContain('data-nasal-spray-detail="root"')
  })

  it('zeichnet den dreiteiligen Kopf', () => {
    const html = render()
    expect(html).toContain('data-nasal-spray-detail="nozzle"')
    expect(html).toContain('data-nasal-spray-detail="flange"')
    expect(html).toContain('data-nasal-spray-detail="collar"')
  })

  it('gibt der Kragenrille ein explizites fill, damit sie nicht schwarz fuellt', () => {
    const html = render()
    expect(html).toMatch(/data-nasal-spray-detail="collar-groove"[^>]*fill="none"/)
  })

  it('beschneidet die Fluessigkeit an der Innenkontur, nicht an der Aussenkontur', () => {
    const source = readFileSync(new URL('./NasalSprayVisual.tsx', import.meta.url), 'utf8')
    const window = source.match(/data-nasal-spray-detail="liquid-window"[\s\S]{0,120}/)?.[0] ?? ''
    expect(window).toContain('innerClip')
    expect(window).not.toContain('outerClip')
  })

  it('beschneidet das Kopflicht auf den Kopf', () => {
    // Unbeschnitten malte der Lichtstreifen neben die Duese ins Leere — der
    // Fehler, den die Kantenlichter der Ampulle einmal hatten.
    const source = readFileSync(new URL('./NasalSprayVisual.tsx', import.meta.url), 'utf8')
    const light = source.match(/headClip[\s\S]{0,400}?head-light/)?.[0] ?? ''
    expect(light).not.toBe('')
  })

  it('haelt die im Spec festgelegten Hoehen ein', () => {
    expect(render({ size: 'large' })).toContain('h-[464px]')
    expect(render({ size: 'carousel' })).toContain('h-[186.4px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[236.8px]')
    expect(render({ size: 'compact' })).toContain('h-[140px]')
    expect(render({ size: 'mini' })).toContain('h-[76px]')
  })

  it('leitet jede Breite aus derselben Form ab', () => {
    // 0,2708 mal die Hoehe, auf eine Nachkommastelle.
    expect(render({ size: 'large' })).toContain('w-[125.7px]')
    expect(render({ size: 'carousel' })).toContain('w-[50.5px]')
    expect(render({ size: 'carousel' })).toContain('sm:w-[64.1px]')
    expect(render({ size: 'compact' })).toContain('w-[37.9px]')
    expect(render({ size: 'mini' })).toContain('w-[20.6px]')
  })

  it('spannt das Etikett ueber die volle Breite, wie bei der Ampulle', () => {
    // Dieselben Randwerte wie AmpouleVisual: left-[4%] right-[4%] rounded-sm.
    const html = render()
    expect(html).toContain('left-[4%]')
    expect(html).toContain('right-[4%]')
    expect(html).not.toContain('inset-x-[6%]')
  })

  it('traegt Name und Wirkstoffmenge auf dem Etikett', () => {
    const html = render()
    expect(html).toContain('Oxytocin')
    expect(html).toContain('24 IU / spray')
  })

  it('laesst die Detailzeile weg, wenn keine Menge bekannt ist', () => {
    const html = render({ amount: null, unit: null })
    expect(html).toContain('Oxytocin')
    // Die Signaturklasse der Detailzeile darf gar nicht erst erscheinen.
    expect(html).not.toContain('font-bold uppercase tracking-wide')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Nasenspray')
  })

  it('zeigt keinen Prozentwert', () => {
    expect(render()).not.toContain('data-fill-pct')
  })

  it('faerbt die Fluessigkeit mit der Eintragsfarbe', () => {
    expect(render({ color: '#a3e635' })).toContain('#a3e635')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-nasal-spray-focus="0.42"')
    expect(html).toContain('data-nasal-spray-light-offset="-0.35"')
  })
})
