// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubstanceBrowser } from './SubstanceBrowser'
import type { StackCategory, SubstanceCatalogEntry } from '../types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const vorlage = options?.defaultValue
      if (typeof vorlage !== 'string') return key
      return vorlage.replace(/{{\s*(\w+)\s*}}/g, (_treffer, name: string) => (
        options?.[name] === undefined ? '' : String(options[name])
      ))
    },
  }),
}))

afterEach(cleanup)

function eintrag(
  name: string,
  category: StackCategory = 'peptide',
  aliases: string[] = [],
  active = true,
): SubstanceCatalogEntry {
  return {
    id: name,
    canonical_name: name,
    aliases,
    default_category: category,
    suggested_units: [],
    suggested_dosage_forms: [],
    pk_profile_id: null,
    active,
  }
}

const KATALOG = [
  eintrag('BPC-157', 'peptide', ['Body Protection Compound']),
  eintrag('Ipamorelin'),
  eintrag('TB-500'),
  eintrag('Semax'),
  eintrag('Ibuprofen', 'medication'),
  eintrag('Metformin', 'medication'),
  eintrag('Zink', 'supplement'),
  eintrag('Östradiol', 'hormone'),
]

function oeffnen() {
  fireEvent.click(screen.getByRole('button', { name: /Katalog durchblättern/ }))
}

describe('SubstanceBrowser', () => {
  it('steht zugeklappt da und nennt, wie viel drinsteckt', () => {
    // Der Substanzschritt ist der erste Eindruck des Formulars. Fuenf Reiter
    // plus Liste ueber dem Suchfeld waeren mehr, als eine Frage vertraegt.
    render(<SubstanceBrowser entries={KATALOG} onSelect={() => undefined} />)

    const schalter = screen.getByRole('button', { name: /Katalog durchblättern/ })
    expect(schalter.getAttribute('aria-expanded')).toBe('false')
    expect(schalter.textContent).toContain('8')
    expect(document.querySelector('[data-katalog-eintraege]')).toBeNull()
  })

  it('zeigt nach dem Aufklappen die Eintraege der ersten Kategorie', () => {
    render(<SubstanceBrowser entries={KATALOG} onSelect={() => undefined} />)
    oeffnen()

    const liste = document.querySelector('[data-katalog-eintraege]')!
    expect(within(liste as HTMLElement).getByText('BPC-157')).toBeTruthy()
    // Ein Medikament gehoert nicht in den Peptid-Reiter.
    expect(within(liste as HTMLElement).queryByText('Metformin')).toBeNull()
  })

  it('schreibt die Anzahl an jeden Reiter und laesst leere weg', () => {
    // Sonst tippt man auf „Hormone" und findet einen Eintrag, wo man hundert
    // erwartet hat. Und ein Reiter, der auf eine leere Liste fuehrt, sieht aus
    // wie ein Fehler — „Vitamin" und „Sonstiges" stehen hier deshalb nicht.
    render(<SubstanceBrowser entries={KATALOG} onSelect={() => undefined} />)
    oeffnen()

    const reiter = screen.getAllByRole('tab')
    expect(reiter.map(r => r.textContent)).toEqual([
      'stack_category_peptide4',
      'stack_category_medication2',
      'stack_category_hormone1',
      'stack_category_supplement1',
    ])
  })

  it('faellt auf den ersten gefuellten Reiter zurueck, wenn Peptide fehlen', () => {
    // Der Vorgabereiter ist „Peptid". Liegt dort nichts, darf nicht eine leere
    // Liste dastehen — und zwar sofort, nicht nach einem nachziehenden Effekt.
    render(
      <SubstanceBrowser
        entries={[eintrag('Ibuprofen', 'medication'), eintrag('Zink', 'supplement')]}
        onSelect={() => undefined}
      />,
    )
    oeffnen()

    const reiter = screen.getAllByRole('tab')
    expect(reiter).toHaveLength(2)
    expect(reiter[0].getAttribute('aria-selected')).toBe('true')
    const liste = document.querySelector('[data-katalog-eintraege]') as HTMLElement
    expect(within(liste).getByText('Ibuprofen')).toBeTruthy()
  })

  it('wechselt die Liste beim Reiterwechsel', () => {
    render(<SubstanceBrowser entries={KATALOG} onSelect={() => undefined} />)
    oeffnen()
    fireEvent.click(screen.getByRole('tab', { name: /stack_category_medication/ }))

    const liste = document.querySelector('[data-katalog-eintraege]') as HTMLElement
    expect(within(liste).getByText('Ibuprofen')).toBeTruthy()
    expect(within(liste).queryByText('BPC-157')).toBeNull()
  })

  it('gruppiert alphabetisch und reicht den Eintrag beim Antippen weiter', () => {
    const onSelect = vi.fn()
    render(<SubstanceBrowser entries={KATALOG} onSelect={onSelect} />)
    oeffnen()

    const buchstaben = [...document.querySelectorAll('[data-katalog-buchstabe]')]
      .map(el => el.getAttribute('data-katalog-buchstabe'))
    expect(buchstaben).toEqual(['B', 'I', 'S', 'T'])

    fireEvent.click(screen.getByText('TB-500'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0].canonical_name).toBe('TB-500')
  })

  it('zeigt die Sprungleiste erst, wenn die Liste lang genug dafuer ist', () => {
    // Sichtbar sind rund sechs Eintraege. Solange man kaum scrollen muss, ist
    // Wischen schneller als Zielen — die Leiste waere nur Beiwerk.
    render(<SubstanceBrowser entries={KATALOG} onSelect={() => undefined} />)
    oeffnen()
    expect(document.querySelector('[data-katalog-sprungleiste]')).toBeNull()

    cleanup()
    const viele = 'ABCDEFGHIJKLMNOP'.split('').map(b => eintrag(`${b}-Stoff`))
    render(<SubstanceBrowser entries={viele} onSelect={() => undefined} />)
    oeffnen()

    const leiste = document.querySelector('[data-katalog-sprungleiste]')!
    expect(leiste.querySelectorAll('button')).toHaveLength(16)
  })

  it('laesst stillgelegte Eintraege weg — auch aus der Zaehlung', () => {
    render(
      <SubstanceBrowser
        entries={[eintrag('Aktiv'), eintrag('Still', 'peptide', [], false)]}
        onSelect={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: /Katalog durchblättern/ }).textContent).toContain('1')
    oeffnen()
    expect(screen.queryByText('Still')).toBeNull()
  })

  it('verschwindet ganz, wenn es nichts zu blaettern gibt', () => {
    // Ein leerer Aufklapper waere ein Versprechen ohne Inhalt.
    const { container } = render(<SubstanceBrowser entries={[]} onSelect={() => undefined} />)
    expect(container.firstChild).toBeNull()
  })
})
