// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOSAGE_FORMS, isStageRenderable } from '../lib/dosageForms'
import { DosageFormPicker } from './DosageFormPicker'
import { buehnenSkala } from '../lib/buehnenSkala'
import { fuellfarbe } from '../lib/fuellfarben'

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

  it('faerbt die gewaehlte Form nicht ein, sondern zeigt ihr Material', () => {
    // In diesem Schritt hat der Nutzer noch keine Farbe gewaehlt. Im Entwurf
    // steht trotzdem eine: MyStackPage vergibt beim Oeffnen eine zufaellige
    // aus zwoelf (`getRandomStackItemColor`), darunter Rosarot. Reichte der
    // Schritt sie durch, wuerde das Antippen einer Form sie scheinbar
    // willkuerlich einfaerben — genau der Fehler, der hier nicht
    // wiederkommen soll. Gefaerbt wird im Farbschritt danach.
    renderAll({ value: 'powder' })

    const deckel = kachel('dosage_form_powder').querySelector('[data-powder-detail="lid"]')
    expect(deckel?.getAttribute('fill')).toBe(fuellfarbe())
  })

  it('graut nicht gewaehlte Formen aus, hebt nur die gewaehlte hervor', () => {
    // Die Farbe im Objekt selbst zeigt die Auswahl — nicht das Licht in der
    // Mitte, das jede Reihe unabhaengig von der Auswahl fuer sich zeigt.
    renderAll({ value: 'powder' })

    const rahmen = (key: string) => kachel(`dosage_form_${key}`).querySelector<HTMLElement>('.origin-bottom')

    expect(rahmen('powder')?.style.filter).toBe('none')
    expect(rahmen('tablet')?.style.filter).toBe('grayscale(0.9) brightness(0.55)')
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

  it('hebt kleine Formen an, ohne dem Pen seinen Vorrang zu nehmen', () => {
    // Gemessene native Groessen aus dem Karussell. Linear skaliert waere eine
    // Kapsel neben einem Pen (42 zu 237 px) kaum zu erkennen; alle gleich
    // gross zu machen naehme dem Pen die wahre Aussage, dass er das groessere
    // Ding ist. Beides soll gelten.
    const reihe = { groessteHoehe: 237, platzHoehe: 261, platzBreite: 199 }
    const hoeheNach = (masse: { hoehe: number; breite: number }) =>
      masse.hoehe * buehnenSkala({ ...masse, ...reihe })

    const pen = hoeheNach({ hoehe: 237, breite: 60 })
    const vial = hoeheNach({ hoehe: 191, breite: 105 })

    // Die Reihenfolge bleibt: der Pen ist weiterhin das groessere Objekt.
    expect(pen).toBeGreaterThan(vial)

    // Das groesste schoepft die Reihe fast aus, ohne sie zu ueberschreiten.
    expect(pen).toBeLessThanOrEqual(reihe.platzHoehe)
    expect(pen).toBeGreaterThan(reihe.platzHoehe * 0.85)

    // Und der Abstand zwischen beiden ist kleiner geworden: genau das meint
    // „gelockert". Nativ steht das Vial bei 81% der Pen-Hoehe, danach naeher
    // an ihm — aber nie darueber, sonst waere der Maßstab aufgegeben.
    expect(vial / pen).toBeGreaterThan(191 / 237)
    expect(vial / pen).toBeLessThan(1)
  })

  it('laesst die Breite die Skalierung begrenzen, damit nichts ueber den Nachbarn liegt', () => {
    // Eine liegende Kapsel ist flach und breit. Nur nach der Hoehe skaliert
    // waere sie dreimal so breit wie ihr Standplatz -- genau so lagen im
    // Formular Tablette und Kapsel uebereinander.
    const masse = { hoehe: 42, breite: 140, groessteHoehe: 237, platzHoehe: 261, platzBreite: 199 }
    const breiteNach = masse.breite * buehnenSkala(masse)

    expect(breiteNach).toBeLessThanOrEqual(masse.platzBreite)
    // Sie schoepft ihn dabei aber aus — eine flache, breite Form waechst in
    // die Richtung, die sie hat, statt klein zu bleiben.
    expect(breiteNach).toBeGreaterThan(masse.breite)
  })

  it('schiebt den Fokus durch den imperativen Griff in die Buehnenform', () => {
    // Der Grund, warum es fluessig laeuft: beim Wischen rendert React nicht.
    // Jede Form meldet einen Griff an, und der Mess-Frame schreibt Licht und
    // Fokus direkt in den DOM. Kaeme der Fokus wieder als Prop, liefe jedes
    // Bild des Wischens durch eine Renderrunde ueber die ganze Reihe.
    render(
      <DosageFormPicker value={null} suggestedForms={['capsule', 'vial', 'gel']} onSelect={() => undefined} />,
    )

    const gruppe = screen.getByRole('group', { name: 'Für diese Substanz' })
    platziere(gruppe, 0, 300)
    const kapsel = within(gruppe).getByRole('button', { name: 'dosage_form_capsule' })
    // Die Kapsel steht exakt in der Mitte, ihre Nachbarn weit daneben.
    platziere(kapsel, 100, 100)
    platziere(within(gruppe).getByRole('button', { name: 'dosage_form_vial' }), 260, 100)
    platziere(within(gruppe).getByRole('button', { name: 'dosage_form_gel' }), 420, 100)

    const fokus = () => kapsel.querySelector('[data-capsule-focus]')?.getAttribute('data-capsule-focus')
    const vorher = fokus()

    fireEvent.scroll(gruppe)

    return waitFor(() => {
      // Die zentrierte Kapsel steht auf vollem Licht — geschrieben hat das
      // die Buehnenform selbst, ueber ihren Griff.
      expect(Number(fokus())).toBe(1)
      expect(fokus()).not.toBe(vorher)
    })
  })

  it('macht die gewaehlte Form nicht groesser als die anderen', () => {
    // Ein Objekt, das beim Wischen anschwillt, macht die Reihe unruhig. Die
    // Groesse haengt nur am Platz, nicht an der Auswahl; dass etwas gewaehlt
    // ist, sagt allein die Farbe.
    const rahmen = (knopf: HTMLElement) =>
      (knopf.querySelector('[data-dosage-form-preview]')?.parentElement as HTMLElement | null)?.style.transform

    const { rerender } = render(
      <DosageFormPicker value={null} suggestedForms={['capsule', 'vial']} onSelect={() => undefined} />,
    )
    const ungewaehlt = rahmen(kachel('dosage_form_capsule'))

    rerender(
      <DosageFormPicker value="capsule" suggestedForms={['capsule', 'vial']} onSelect={() => undefined} />,
    )

    expect(rahmen(kachel('dosage_form_capsule'))).toBe(ungewaehlt)
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

  it('sieht gewaehlt und ungewaehlt gleich aus — die Auswahl sagt das Licht', () => {
    // Das Gegenstueck zum Test darueber: die Auswahl aendert die Farbe des
    // Objekts nicht, weder auf der gewaehlten noch auf einer anderen Form.
    // Was gewaehlt ist, sagen der Spot darunter und der Name unter der Reihe.
    const deckel = () => document
      .querySelector('[data-dosage-form-preview="powder"] [data-powder-detail="lid"]')
      ?.getAttribute('fill')

    const { rerender } = render(
      <DosageFormPicker value="powder" suggestedForms={['powder']} onSelect={() => undefined} />,
    )
    const gewaehlt = deckel()

    rerender(
      <DosageFormPicker value={null} suggestedForms={['powder']} onSelect={() => undefined} />,
    )

    expect(gewaehlt).toBe(fuellfarbe())
    expect(deckel()).toBe(gewaehlt)
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

  it('waehlt beim Start die erste empfohlene Form vor — und nur sie', async () => {
    // Die erste Form der vorderen Reihe steht beim Oeffnen ohnehin zentriert.
    // Sie unbeleuchtet dort stehen zu lassen, hiesse dem Nutzer eine Mitte zu
    // zeigen, die nichts bedeutet. Das ist kein stilles Auswaehlen: man sieht
    // sie hervorgehoben, und ihr Name steht darunter.
    //
    // Was weiterhin nicht passieren darf: dass die geratene Geometrie des
    // ersten Bildes etwas auswaehlt. jsdom layoutet nicht, ohne die Stubs
    // unten ist jedes Objekt gleich weit von der Mitte weg — gemeldet wird
    // trotzdem genau die erste Form, nicht irgendeine. Und die hintere Reihe
    // meldet gar nichts: dort steht nichts, was zu dieser Substanz passt.
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
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('ampoule')
  })

  it('waehlt aus, was man ins Zentrum wischt — ohne extra draufzutippen', async () => {
    // Dieselbe Mechanik wie im Vial-Karussell auf der My-Stack-Seite: das
    // zentrierte Objekt wird die Auswahl, das Wischen selbst reicht.
    //
    // Die vordere Reihe waehlt beim Start ihre erste Form vor ("ampoule",
    // siehe Test oben) — dieser erste Aufruf gehoert nicht zum Wischen.
    // Gewischt wird deshalb auf "vial": nur ein echter Positionswechsel darf
    // danach noch etwas melden.
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
    await waitFor(() => expect(onSelect).toHaveBeenLastCalledWith('vial'))
    const nachDemWischen = onSelect.mock.calls.length

    // Ein zweites Scroll-Event ohne Positionswechsel meldet nichts erneut —
    // es hat sich nichts geaendert, das Wischen ist nur zum Stillstand
    // gekommen (z. B. am Ende der Traegheit).
    fireEvent.scroll(gruppe)
    await new Promise(resolve => window.setTimeout(resolve, 0))
    expect(onSelect).toHaveBeenCalledTimes(nachDemWischen)
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
    // Beide Bedingungen zusammen, weil jede einzelne auch ohne echtes Messen
    // wahr sein kann: ohne gemessene Werte stehen alle Objekte auf demselben
    // Ruhewert (0,42 — unter 1), und beim geometrielosen Messen in jsdom sind
    // alle gleich weit von der Mitte weg und damit alle auf 1. Nur wenn das
    // zentrierte Vial auf 1 steht UND die Ampulle daneben darunter liegt, hat
    // die Messung mit echter Geometrie stattgefunden.
    await waitFor(() => {
      expect(leuchtstaerke(vial)).toBe(1)
      expect(leuchtstaerke(ampoule)).toBeLessThan(1)
    })
    expect(leuchtstaerke(ampoule)).toBeGreaterThan(0)
  })
})
