import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TubeVisual } from './TubeVisual'

const render = (props: Partial<Parameters<typeof TubeVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(TubeVisual, { name: 'Ibuprofen', ...props }))

describe('TubeVisual', () => {
  it('meldet sich als Tuben-Renderer', () => {
    expect(render()).toContain('data-tube-detail="root"')
  })

  it('zeichnet Blech, Naht, Deckel und Mulde', () => {
    const html = render()
    expect(html).toContain('data-tube-detail="body"')
    expect(html).toContain('data-tube-detail="crimp"')
    expect(html).toContain('data-tube-detail="cap"')
    expect(html).toContain('data-tube-detail="recess"')
    expect(html).toContain('data-tube-detail="cap-seam"')
  })

  it('gibt Riffelung und Fugen ein explizites fill, damit nichts schwarz fuellt', () => {
    const html = render()
    expect(html).toMatch(/data-tube-detail="crimp-ribs"[^>]*fill="none"/)
    expect(html).toMatch(/data-tube-detail="cap-seam"[^>]*fill="none"/)
  })

  it('kippt das Oberlicht mit der Lage im Karussell', () => {
    // Mittig unter der Lampe symmetrisch, seitlich schraeg. Positiver
    // Versatz heisst Lampe rechts, die helle Seite kippt also nach rechts.
    expect(render({ lightOffset: 0 })).toContain('rotate(0.0 0.5 0.5)')
    expect(render({ lightOffset: 1 })).toContain('rotate(34.0 0.5 0.5)')
    expect(render({ lightOffset: -1 })).toContain('rotate(-34.0 0.5 0.5)')
  })

  it('laesst den Glanzkern zur beleuchteten Seite wandern', () => {
    // Zur Lampe hin, nicht von ihr weg: der Kern lief bisher mit dem
    // Bodenschatten mit, also auf die Schattenseite.
    expect(render({ lightOffset: 0 })).toMatch(/data-tube-detail="core"[^>]*cx="60"/)
    expect(render({ lightOffset: 1 })).toMatch(/data-tube-detail="core"[^>]*cx="77"/)
    expect(render({ lightOffset: -1 })).toMatch(/data-tube-detail="core"[^>]*cx="43"/)
  })

  it('laesst die Kantensaeume beim Wischen stehen', () => {
    const source = readFileSync(new URL('./TubeVisual.tsx', import.meta.url), 'utf8')
    const saeume = source.match(/data-tube-detail="seams"[\s\S]{0,200}/)?.[0] ?? ''
    // Sie gehoeren zur Silhouette, nicht zur Beleuchtung.
    expect(saeume).not.toContain('lightOffset')
    expect(saeume).not.toContain('rotate')
  })

  it('benutzt die Eintragsfarbe nicht', () => {
    // Erste Form ohne color_hex: Aluminium hat eine feste Farbe, der Name
    // uebernimmt das Unterscheiden.
    const source = readFileSync(new URL('./TubeVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('color_hex')
    // Kein color-Prop in der Schnittstelle. Als Zeilenanfang gepruefte
    // Deklaration, damit stopColor="…" keinen Fehlalarm ausloest.
    expect(source).not.toMatch(/^\s*color\??:/m)
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    expect(render({ size: 'large' })).toContain('h-[464px]')
    expect(render({ size: 'large' })).toContain('w-[129.7px]')
    expect(render({ size: 'carousel' })).toContain('h-[186.4px]')
    expect(render({ size: 'carousel' })).toContain('w-[52.1px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[236.8px]')
    expect(render({ size: 'carousel' })).toContain('sm:w-[66.2px]')
    expect(render({ size: 'compact' })).toContain('h-[140px]')
    expect(render({ size: 'mini' })).toContain('h-[76px]')
  })

  it('setzt die Aufschrift mit dem aus der Verjuengung hergeleiteten Einzug', () => {
    const html = render()
    expect(html).toContain('data-tube-detail="name"')
    expect(html).toContain('top:46%')
    expect(html).toContain('left:7.59%')
    expect(html).toContain('right:7.59%')
  })

  it('beschriftet weiss, wie fuer helles Metall vorgesehen', () => {
    expect(render()).toContain('font-black text-white')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Tube')
  })

  it('bekommt weder Etikettband noch Fuellstand noch Physik', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
    const source = readFileSync(new URL('./TubeVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('SloshContext')
    // Der Bauteilaufruf, nicht der Importpfad: StageMarquee liegt in
    // StageLabel.tsx, der Dateiname steht also zwangslaeufig im Quelltext.
    expect(source).not.toContain('<StageLabel')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-tube-focus="0.42"')
    expect(html).toContain('data-tube-light-offset="-0.35"')
  })
})
