import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PatchVisual } from './PatchVisual'

const render = (props: Partial<Parameters<typeof PatchVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(PatchVisual, { name: 'Nikotinpflaster', ...props }))

// useId erzeugt bei jedem Rendern eine andere Kennung; fuer die Clip-Namen
// zaehlt nur der Teil dahinter.
const uidFrei = (html: string) => html.match(/id="([^"]*?)bodyClip"/)?.[1] ?? ''

describe('PatchVisual', () => {
  it('meldet sich als Pflaster-Renderer', () => {
    expect(render()).toContain('data-patch-detail="root"')
  })

  it('zeichnet Streifen, Lochung und Wundkissen', () => {
    const html = render()
    expect(html).toContain('data-patch-detail="body"')
    expect(html).toContain('data-patch-detail="dots"')
    expect(html).toContain('data-patch-detail="pad"')
  })

  it('zeigt kein Farbfeld', () => {
    // Ein Pflaster ist hautfarben; ein farbiges Feld darauf war der eine
    // Fremdkoerper im Bild. Diese Form nimmt color_hex deshalb gar nicht an.
    const html = render()
    expect(html).not.toContain('data-patch-detail="stripe"')
    const source = readFileSync(new URL('./PatchVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('color: string')
  })

  it('beschneidet den Schimmer auf den Streifen', () => {
    // Der Schimmer wandert mit dem Licht; unbeschnitten malt er neben das
    // Pflaster. Derselbe Fehler wie beim Tabletten-Glanz.
    const source = readFileSync(new URL('./PatchVisual.tsx', import.meta.url), 'utf8')
    const gruppe = source.match(/bodyClip\)`\}>[\s\S]*?data-patch-detail="sheen"/)?.[0] ?? ''
    expect(gruppe).not.toBe('')
  })

  it('haengt die Lochung an die Abschnitte, nicht an den ganzen Streifen', () => {
    // Sonst blieben die Loecher stehen, waehrend sich die Enden biegen.
    const source = readFileSync(new URL('./PatchVisual.tsx', import.meta.url), 'utf8')
    const links = source.match(/leftClip\)`\}>[\s\S]*?<\/g>\s*<\/g>/)?.[0] ?? ''
    expect(links).toContain('PATCH_DOTS_LEFT')
    const rechts = source.match(/rightClip\)`\}>[\s\S]*?<\/g>\s*<\/g>/)?.[0] ?? ''
    expect(rechts).toContain('PATCH_DOTS_RIGHT')
  })

  it('laesst den Schimmer mit dem Licht wandern', () => {
    expect(render({ lightOffset: 0 })).toMatch(/data-patch-detail="sheen"[^>]*translate\(0/)
    expect(render({ lightOffset: 1 })).toMatch(/data-patch-detail="sheen"[^>]*translate\(34/)
    expect(render({ lightOffset: -1 })).toMatch(/data-patch-detail="sheen"[^>]*translate\(-34/)
  })

  it('setzt den Namen waagerecht auf das Kissen, nicht gedreht wie beim Pen', () => {
    // Die Streifenform gibt ihm die Breite, und ungedrehter Text bekommt die
    // schaerfere Subpixel-Glaettung.
    const html = render()
    expect(html).toContain('data-patch-detail="name"')
    expect(html).not.toContain('rotate(-90deg)')
  })

  it('laesst zu lange Namen durchlaufen statt sie abzuschneiden', () => {
    const html = render({ name: 'Rivastigmin transdermal 9,5 mg pro 24 Stunden' })
    expect(html).toMatch(/data-patch-detail="name"[^>]*overflow-hidden/)
    // Die aeussere Huelle braucht eine feste Breite, sonst misst der Marquee
    // seinen Ueberhang gegen sich selbst und loest nie aus.
    expect(html).toMatch(
      /<span class="block overflow-hidden whitespace-nowrap w-full[^"]*"><span class="vial-label-marquee/,
    )
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    expect(render({ size: 'large' })).toContain('h-[109.5px]')
    expect(render({ size: 'carousel' })).toContain('h-[44px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[55.9px]')
    expect(render({ size: 'compact' })).toContain('h-[33px]')
    expect(render({ size: 'mini' })).toContain('h-[18px]')
  })

  it('laesst beim Wischen die Enden flattern, die Mitte nicht', () => {
    // Ein Pflaster ist biegsam, sein Wundkissen nicht. Die beiden Enden
    // drehen gegenlaeufig um Angelpunkte, die unter dem Mittelstueck liegen,
    // damit die Schnittkante nie sichtbar wird.
    const source = readFileSync(new URL('./PatchVisual.tsx', import.meta.url), 'utf8')
    expect(source).toContain('useSloshSubscribe')
    // Der Kippwinkel ist nur das Ziel, nicht die Stellung: die Enden schwingen
    // an eigenen Federn nach und brauchen dafuer eine eigene Schleife.
    expect(source).toContain('requestAnimationFrame')
    expect(source).toContain('PATCH_FLUTTER')
    // Sie haelt an, statt fuer immer Bilder zu rechnen.
    expect(source).toContain('cancelAnimationFrame')
    expect(source).toContain('document.hidden')
    // Im verborgenen Tab haelt sie an — und muss sich selbst wieder aufnehmen,
    // sonst blieben die Enden ausgelenkt stehen. Genau das ist im Browser
    // passiert, bevor der Zuhoerer dazukam.
    expect(source).toContain('visibilitychange')
    expect(source).toContain('prefers-reduced-motion')
    const html = render()
    expect(html).toContain(`${uidFrei(html)}leftClip`)
    expect(html).toContain(`${uidFrei(html)}midClip`)
  })

  it('bekommt weder Etikettband noch Fuellstand', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
    const source = readFileSync(new URL('./PatchVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('LiquidGraphic')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Pflaster')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-patch-focus="0.42"')
    expect(html).toContain('data-patch-light-offset="-0.35"')
  })
})
