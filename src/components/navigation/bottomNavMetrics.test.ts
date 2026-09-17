import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = () => readFileSync(new URL('../../index.css', import.meta.url), 'utf8')
const wert = (name: string) => {
  const treffer = css().match(new RegExp(`--${name}:\\s*([0-9]+)px`))
  return treffer ? Number(treffer[1]) : null
}

describe('Maße der Bottom-Navigation', () => {
  it('reserviert genau so viel Platz, wie die Kapsel samt Abstand belegt', () => {
    // Sieben Stellen rechnen mit `--bottom-nav-height`: Inhaltspolster,
    // FAQ-Knopf, Schnellzugriff, Onboarding (zweimal), `onboardingPlacement`
    // und die My-Stack-Bühne. Stimmt die Summe nicht, verdeckt die Leiste
    // Inhalt oder es bleibt ein toter Streifen darunter.
    expect(wert('bottom-nav-capsule')! + wert('bottom-nav-gap')!)
      .toBe(wert('bottom-nav-height'))
  })

  it('hält die Höhe als glatte Zahl, nicht als Rechnung', () => {
    // `onboardingPlacement.ts` liest sie mit `parseInt`, und eigene
    // Eigenschaften werden nicht ausgerechnet: `parseInt('calc(62px + 12px)')`
    // wäre NaN und die Einblendungen säßen falsch.
    expect(css()).toMatch(/--bottom-nav-height:\s*\d+px/)
    const platzierung = readFileSync(new URL('../onboardingPlacement.ts', import.meta.url), 'utf8')
    expect(platzierung).toContain("getPropertyValue('--bottom-nav-height')")
  })

  it('lässt der Kapsel Abstand zur Sicherheitszone und zu den Rändern', () => {
    expect(css()).toContain('bottom: calc(env(safe-area-inset-bottom) + var(--bottom-nav-gap))')
    expect(css()).toContain('left: max(var(--bottom-nav-inset), env(safe-area-inset-left))')
    expect(css()).toContain('right: max(var(--bottom-nav-inset), env(safe-area-inset-right))')
  })

  it('bleibt flacher als die Höhe, mit der My Stack eingestellt wurde', () => {
    // `MyStackPage` rechnet mit festen 90 px für die Leiste, damit die Bühne
    // bei jedem Umbau gleich groß bleibt und nur höher rutscht. Das trägt nur,
    // solange die Leiste nicht höher wird als 90 — sonst verdeckte sie den
    // unteren Rand der Bühne.
    expect(wert('bottom-nav-height')).toBeLessThanOrEqual(90)
  })

  it('gibt jedem Reiter mindestens 44 px für den Finger', () => {
    expect(css()).toMatch(/\.tyd-tabbar-item\s*\{[^}]*min-height:\s*44px/)
  })

  it('nimmt die Wege heraus, wenn jemand Bewegung abbestellt hat', () => {
    expect(css()).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.tyd-tabbar-pill/)
  })

  it('bleibt brauchbar, wo Unschärfe oder Masken fehlen', () => {
    // Progressive Verbesserung: ohne `backdrop-filter` trägt die dünne Füllung
    // nichts, dann wird die Kapsel deckend. Ohne Masken gibt es statt des
    // Lichtrands einen schlichten Rand — nie gar keine Kante.
    expect(css()).toContain('@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))')
    expect(css()).toContain('@supports not ((mask-composite: exclude) or (-webkit-mask-composite: xor))')
  })
})
