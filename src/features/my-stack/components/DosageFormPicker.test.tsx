// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOSAGE_FORMS, isStageRenderable } from '../lib/dosageForms'
import { DosageFormPicker } from './DosageFormPicker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// Das Karussell misst per requestAnimationFrame, nicht synchron im
// Scroll-Handler — sonst wuerde jedes Scroll-Event, auch ein winziges beim
// Bremsen, sofort neu rechnen. jsdom hat kein echtes rAF; dieselbe
// Ersatzschaltung wie in StackItemWizard.interaction.test.tsx.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => (
    window.setTimeout(() => callback(performance.now()), 0)
  ))
})

// Setzt die Geometrie, die messen() abfragt. jsdom layoutet nicht wirklich —
// getBoundingClientRect liefert sonst ueberall Nullen, und jedes Objekt waere
// gleich weit von der Mitte entfernt. Gemessen wird in Bildschirmkoordinaten,
// weil `offsetLeft` vom offsetParent zaehlt und damit von einer CSS-Regel
// woanders abhaengt: genau daran ging die Auswahl im echten Browser um 29 px
// daneben. Der Scrollstand steckt hier schon in den Koordinaten — ein Wischen
// verschiebt die Objekte, es gibt nichts extra zu setzen.
function platziere(el: Element, left: number, breite: number): void {
  el.getBoundingClientRect = () => ({
    left,
    width: breite,
    right: left + breite,
    top: 0,
    bottom: 0,
    height: 0,
    x: left,
    y: 0,
    toJSON: () => ({}),
  }) as DOMRect
}

function renderAll(props: Partial<Parameters<typeof DosageFormPicker>[0]> = {}) {
  return render(
    <DosageFormPicker
      value={null}
      suggestedForms={DOSAGE_FORMS.map(form => form.key)}
      onSelect={() => undefined}
      {...props}
    />,
  )
}

const kachel = (labelKey: string) => screen.getByRole('button', { name: labelKey })

describe('DosageFormPicker', () => {
  it('zeigt auf jeder Kachel das Objekt, das man bekommt', () => {
    renderAll()

    for (const form of DOSAGE_FORMS.filter(f => isStageRenderable(f.key))) {
      const vorschau = kachel(form.labelKey).querySelector('[data-dosage-form-preview]')
      expect(vorschau, form.key).not.toBeNull()
      expect(vorschau!.getAttribute('data-dosage-form-preview')).toBe(form.key)
    }
  })

  it('faellt fuer Formen ohne Buehnengrafik auf das Symbol zurueck', () => {
    // `other` bekommt keine erfundene Grafik. Die Regel „Formen ohne
    // Buehnengrafik bleiben textlich" wird auch hier nicht aufgeweicht.
    renderAll()

    for (const key of ['other'] as const) {
      const form = DOSAGE_FORMS.find(f => f.key === key)!
      expect(isStageRenderable(key)).toBe(false)
      expect(kachel(form.labelKey).querySelector('[data-dosage-form-preview]')).toBeNull()
      expect(kachel(form.labelKey).querySelector('svg')).not.toBeNull()
    }
  })

  it('haelt die Aufschrift vom Objekt fern', () => {
    // Die Kachel beschriftet sich selbst. Eine zweite Aufschrift auf dem Glas
    // waere in Miniaturgroesse ein Fleck — und stuende im zugaenglichen Namen
    // des Knopfes.
    renderAll()

    const dose = kachel('dosage_form_powder')
    expect(dose.querySelector('.vial-label-marquee')).toBeNull()
    expect(dose.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('reicht die Eintragsfarbe an die gewaehlte Form durch', () => {
    // Nur an sie: die Farbe ist hier das Zeichen fuer „das ist gewaehlt".
    renderAll({ colorHex: '#f97316', value: 'powder' })

    const deckel = kachel('dosage_form_powder').querySelector('[data-powder-detail="lid"]')
    expect(deckel?.getAttribute('fill')).toBe('#f97316')
  })

  it('laesst halb getippte Farben stehen, statt durch Schwarz zu flackern', () => {
    // Im Farbfeld steht waehrend des Tippens jeder Zwischenstand.
    renderAll({ colorHex: '#f9', value: 'powder' })

    const deckel = kachel('dosage_form_powder').querySelector('[data-powder-detail="lid"]')
    expect(deckel?.getAttribute('fill')).not.toBe('#f9')
  })

  it('legt die empfohlenen in die erste Reihe und alle uebrigen darunter', () => {
    render(
      <DosageFormPicker
        value={null}
        suggestedForms={['ampoule', 'vial', 'gel']}
        onSelect={() => undefined}
      />,
    )

    const empfohlen = screen.getByRole('group', { name: 'Für diese Substanz' })
    expect(within(empfohlen).getAllByRole('button')).toHaveLength(3)
    for (const key of ['dosage_form_ampoule', 'dosage_form_vial', 'dosage_form_gel']) {
      expect(within(empfohlen).getByRole('button', { name: key })).toBeTruthy()
    }

    // Beide Reihen stehen immer da: eine Reihe zum Wischen muss nichts
    // verstecken, was man wegwischen kann.
    const uebrige = screen.getByRole('group', { name: 'Weitere Darreichungsformen' })
    expect(within(uebrige).getAllByRole('button')).toHaveLength(DOSAGE_FORMS.length - 3)
    expect(screen.queryByRole('button', { name: /anzeigen/ })).toBeNull()

    // Und jede Form steht genau einmal da.
    for (const form of DOSAGE_FORMS) {
      expect(screen.getAllByRole('button', { name: form.labelKey }), form.key).toHaveLength(1)
    }
  })

  it('nennt die gewaehlte Form im Klartext, sonst steht kein Wort im Bild', () => {
    // Vierzehn Aufschriften unter vierzehn Objekten waren zu viel; keine
    // einzige waere ein Raetsel. Also genau eine: die gewaehlte.
    const { rerender } = render(
      <DosageFormPicker value={null} suggestedForms={[]} onSelect={() => undefined} />,
    )
    expect(document.querySelector('[data-dosage-form-selected]')?.textContent).toBe('')

    rerender(
      <DosageFormPicker value="powder" suggestedForms={[]} onSelect={() => undefined} />,
    )
    expect(document.querySelector('[data-dosage-form-selected]')?.textContent).toBe('dosage_form_powder')
  })

  it('markiert genau ein Objekt als gewaehlt, obwohl beide Reihen etwas zentrieren', () => {
    // Der Befund aus dem Formular: unter der Ueberschrift stand „Vial",
    // waehrend in der oberen Reihe genauso hell eine Kapsel zentriert war.
    // Zwei Karussells haben zwei Mitten, aber nur eine Auswahl — und die
    // muss man sehen koennen, egal in welcher Reihe sie liegt.
    render(
      <DosageFormPicker value="vial" suggestedForms={['capsule']} onSelect={() => undefined} />,
    )

    const markiert = document.querySelectorAll('[data-dosage-active]')
    expect(markiert).toHaveLength(1)
    expect(markiert[0].getAttribute('aria-label')).toBe('dosage_form_vial')
    // Und die Kapsel oben, die zentriert steht, gehoert nicht dazu.
    expect(kachel('dosage_form_capsule').hasAttribute('data-dosage-active')).toBe(false)
  })

  it('faerbt nur die gewaehlte Form, nicht die ganze Reihe', () => {
    // Faerbte die Eintragsfarbe alle Objekte, waere sie kein Zeichen mehr,
    // sondern Hintergrund — und die Gewaehlte bliebe wieder unkenntlich.
    const deckel = () => document
      .querySelector('[data-dosage-form-preview="powder"] [data-powder-detail="lid"]')
      ?.getAttribute('fill')

    const { rerender } = render(
      <DosageFormPicker
        value="powder"
        colorHex="#ff0000"
        suggestedForms={['powder']}
        onSelect={() => undefined}
      />,
    )
    const gewaehlt = deckel()

    rerender(
      <DosageFormPicker
        value={null}
        colorHex="#ff0000"
        suggestedForms={['powder']}
        onSelect={() => undefined}
      />,
    )

    expect(gewaehlt).toBeTruthy()
    expect(deckel()).not.toBe(gewaehlt)
  })

  it('nennt die obere Reihe nach dem Katalog, wenn er etwas vorschlaegt', () => {
    // Vitamin D3 schlaegt nur die Kapsel vor. „Haeufige Darreichungsformen"
    // war dort eine falsche Aussage: Vial, Tablette und Tropfen sind haeufig,
    // standen aber unten in der zweiten Reihe.
    const { rerender } = render(
      <DosageFormPicker value={null} suggestedForms={['capsule']} onSelect={() => undefined} />,
    )
    expect(screen.getByRole('group', { name: 'Für diese Substanz' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Häufige Darreichungsformen' })).toBeNull()

    rerender(
      <DosageFormPicker value={null} suggestedForms={[]} onSelect={() => undefined} />,
    )
    expect(screen.getByRole('group', { name: 'Häufige Darreichungsformen' })).toBeTruthy()
  })

  it('nimmt die neutralen haeufigen Formen, wenn der Katalog nichts vorschlaegt', () => {
    render(
      <DosageFormPicker
        value={null}
        suggestedForms={[]}
        onSelect={() => undefined}
      />,
    )

    const common = screen.getByRole('group', { name: 'Häufige Darreichungsformen' })
    const knoepfe = within(common).getAllByRole('button')
    expect(knoepfe).toHaveLength(5)
    for (const key of ['dosage_form_tablet', 'dosage_form_capsule', 'dosage_form_vial',
      'dosage_form_drops', 'dosage_form_powder']) {
      expect(within(common).getByRole('button', { name: key })).toBeTruthy()
    }
  })

  it('holt die gewaehlte Form in ihrer Reihe ins Bild', () => {
    // Beim Bearbeiten eines bestehenden Eintrags kann sie weit rechts liegen.
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(
      <DosageFormPicker value="patch" suggestedForms={['ampoule', 'vial', 'gel']} onSelect={() => undefined} />,
    )

    expect(screen.getByRole('button', { name: 'dosage_form_patch' }).getAttribute('aria-pressed')).toBe('true')
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('waehlt nichts von sich aus, nur weil beim ersten Bild etwas am naechsten liegt', async () => {
    // jsdom setzt clientWidth/scrollLeft mit 0 an — ohne die Geometrie unten
    // waere jedes Objekt gleich weit weg, und schon das erste Messen koennte
    // eines "zufaellig" als naechstes finden. Genau das darf nicht auswaehlen.
    const onSelect = vi.fn()
    render(
      <DosageFormPicker value={null} suggestedForms={['ampoule', 'vial', 'gel']} onSelect={onSelect} />,
    )

    const gruppe = screen.getByRole('group', { name: 'Für diese Substanz' })
    platziere(gruppe, 0, 300)
    platziere(within(gruppe).getByRole('button', { name: 'dosage_form_ampoule' }), 0, 100)
    platziere(within(gruppe).getByRole('button', { name: 'dosage_form_vial' }), 110, 100)
    platziere(within(gruppe).getByRole('button', { name: 'dosage_form_gel' }), 220, 100)

    await new Promise(resolve => window.setTimeout(resolve, 0))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('waehlt aus, was man ins Zentrum wischt — ohne extra draufzutippen', async () => {
    // Dieselbe Mechanik wie im Vial-Karussell auf der My-Stack-Seite: das
    // zentrierte Objekt wird die Auswahl, das Wischen selbst reicht.
    //
    // jsdom layoutet nicht — vor dem Stubben unten sind offsetLeft/Width bei
    // allen Knoepfen 0, und das lautlose Erst-Messen (siehe Test oben) sucht
    // sich beim Gleichstand den ersten Eintrag der Liste ("ampoule") als
    // Ausgangspunkt aus. Gewischt wird deshalb auf "vial" — sonst waere ein
    // Zufall des leeren DOM die Bedingung, nicht das Wischen selbst.
    const onSelect = vi.fn()
    render(
      <DosageFormPicker value={null} suggestedForms={['ampoule', 'vial', 'gel']} onSelect={onSelect} />,
    )

    const gruppe = screen.getByRole('group', { name: 'Für diese Substanz' })
    platziere(gruppe, 0, 300)
    platziere(within(gruppe).getByRole('button', { name: 'dosage_form_ampoule' }), 0, 100)
    platziere(within(gruppe).getByRole('button', { name: 'dosage_form_vial' }), 110, 100)
    platziere(within(gruppe).getByRole('button', { name: 'dosage_form_gel' }), 220, 100)

    // Gewischt ist, was oben steht: "vial" (Zentrum 160) liegt der Mitte
    // (150 bei 300 px Breite) am naechsten. Das Scroll-Event meldet es.
    fireEvent.scroll(gruppe)
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(onSelect).toHaveBeenCalledWith('vial')

    // Ein zweites Scroll-Event ohne Positionswechsel meldet nichts erneut —
    // es hat sich nichts geaendert, das Wischen ist nur zum Stillstand
    // gekommen (z. B. am Ende der Traegheit).
    fireEvent.scroll(gruppe)
    await new Promise(resolve => window.setTimeout(resolve, 0))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('macht das zentrierte Objekt heller, den Rest dunkler — stetig, nicht nur an/aus', async () => {
    // "Fokus" ist eine Zahl (wie im Vial-Karussell), kein Schalter: sie
    // treibt das Leuchten unter dem Objekt direkt als CSS-Deckkraft.
    render(
      <DosageFormPicker value={null} suggestedForms={['ampoule', 'vial', 'gel']} onSelect={() => undefined} />,
    )

    const gruppe = screen.getByRole('group', { name: 'Für diese Substanz' })
    platziere(gruppe, 0, 300)
    const ampoule = within(gruppe).getByRole('button', { name: 'dosage_form_ampoule' })
    const vial = within(gruppe).getByRole('button', { name: 'dosage_form_vial' })
    // So weit gewischt, dass "vial" (Zentrum 150) exakt in der Mitte des
    // 300 px breiten Karussells steht; "ampoule" ist dann 110 px entfernt.
    platziere(ampoule, -10, 100)
    platziere(vial, 100, 100)
    platziere(within(gruppe).getByRole('button', { name: 'dosage_form_gel' }), 210, 100)

    // Das Leuchten ist der erste <span> unter dem Standplatz-<span>.
    const leuchtstaerke = (knopf: HTMLElement) => Number((knopf.querySelector('span > span') as HTMLElement).style.opacity)

    fireEvent.scroll(gruppe)
    // Der Fokuswert ist ein separater React-State-Update aus einer
    // rAF-Warteschlange — nicht dieselbe Warteschlange wie das synchrone
    // onSelect() im Test darueber. waitFor statt einer festen Anzahl
    // Ticks, damit der Test nicht an einer zufaellig passenden Zahl haengt.
    // "vial" steht schon beim allerersten (geometrielosen) Messen auf 1 --
    // in jsdom sind zunaechst alle Objekte gleich weit von der Mitte entfernt,
    // also gleich hell. Erst wenn "ampoule" unter 1 faellt, hat das ECHTE,
    // geometriebasierte Messen nach dem Wischen tatsaechlich stattgefunden.
    await waitFor(() => expect(leuchtstaerke(ampoule)).toBeLessThan(1))
    expect(leuchtstaerke(ampoule)).toBeGreaterThan(0)
    expect(leuchtstaerke(vial)).toBe(1)
  })
})
