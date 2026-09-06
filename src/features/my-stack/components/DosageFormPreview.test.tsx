// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOSAGE_FORMS, isStageRenderable } from '../lib/dosageForms'
import { DosageFormPreview } from './DosageFormPreview'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

// Das Vial bringt seine Keyframes als <style> im eigenen Markup mit. Der
// Regelsatz ist Text im DOM, aber nichts, was jemand im Bild sieht — fuer die
// Frage „steht eine Aufschrift auf dem Objekt" muss er raus.
function sichtbarerText(container: HTMLElement): string {
  const kopie = container.cloneNode(true) as HTMLElement
  kopie.querySelectorAll('style').forEach(el => el.remove())
  return kopie.textContent?.trim() ?? ''
}

describe('DosageFormPreview', () => {
  it('zeigt fuer jede Form mit Buehnengrafik deren eigenen Renderer', () => {
    for (const form of DOSAGE_FORMS.filter(f => isStageRenderable(f.key))) {
      const { container, unmount } = render(<DosageFormPreview dosageForm={form.key} />)

      expect(container.querySelector('[data-stack-renderer]')?.getAttribute('data-stack-renderer'), form.key)
        .toBe(form.stageRenderer)
      unmount()
    }
  })

  it('erfindet keine Grafik fuer Formen, die keine haben', () => {
    // Die Regel „Formen ohne Buehnengrafik bleiben textlich" gilt auch im
    // Formular. Hier heisst sie: gar nichts zeigen — die Textkarte des Stacks
    // waere in einer Auswahlkachel sinnlos.
    for (const key of ['liquid', 'other'] as const) {
      const { container, unmount } = render(<DosageFormPreview dosageForm={key} />)

      expect(container.firstChild, key).toBeNull()
      unmount()
    }
  })

  it('uebernimmt Name, Farbe und Wirkstoffmenge aus dem Entwurf', () => {
    const { container } = render(
      <DosageFormPreview
        dosageForm="ampoule"
        displayName="Testosteron Enantat"
        colorHex="#e0a23f"
        ingredients={[{
          catalog_substance_id: null,
          custom_name: 'Testosteron Enantat',
          amount_value: 250,
          amount_unit: 'mg',
          basis_value: 1,
          basis_unit: 'ml',
          position: 0,
        }]}
      />,
    )

    expect(container.textContent).toContain('Testosteron Enantat')
    expect(container.textContent).toContain('250 mg / ml')
    // Die Ampulle reicht die Farbe als CSS-Farbe an die Fluessigkeit weiter,
    // nicht als Hex-Attribut — geprueft wird also, was wirklich ankommt.
    expect(container.innerHTML).toContain('rgb(224, 162, 63)')
  })

  it('kann das Objekt ohne jede Aufschrift zeigen', () => {
    // Was die Auswahlkachel braucht: sie beschriftet sich selbst.
    const { container } = render(
      <DosageFormPreview dosageForm="powder" displayName="Kreatin" showLabel={false} />,
    )

    expect(container.querySelector('[data-powder-detail="root"]')).not.toBeNull()
    expect(sichtbarerText(container)).toBe('')
  })

  it('gilt fuer jede Form: ohne showLabel steht der Name nicht im Bild', () => {
    // Sieben Formen drucken ihren Namen auf den Koerper statt auf ein Band.
    // Ohne einen Schalter dafuer stuende in jeder Kachel ein Fleck aus
    // 3,5-px-Text — und im zugaenglichen Namen des Knopfes.
    //
    // Geprueft wird der NAME, nicht jedes Zeichen: das Zaehlwerk des Pens
    // zeigt seine Null weiter. Die gehoert zum Geraet wie die Riffelung, nicht
    // zur Beschriftung.
    for (const form of DOSAGE_FORMS.filter(f => isStageRenderable(f.key))) {
      const { container, unmount } = render(
        <DosageFormPreview dosageForm={form.key} displayName="Testname" size="mini" showLabel={false} />,
      )

      expect(sichtbarerText(container), form.key).not.toContain('Testname')
      unmount()
    }
  })
})
