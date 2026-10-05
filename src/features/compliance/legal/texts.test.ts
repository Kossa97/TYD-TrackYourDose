import { describe, expect, it } from 'vitest'
import { LEGAL_DOCS, hatPlatzhalter, legalLang, teileAbsatz } from './texts'

describe('Rechtstexte', () => {
  it('haben fuer jede Seite Deutsch und Englisch mit gleicher Gliederung', () => {
    for (const docs of Object.values(LEGAL_DOCS)) {
      expect(docs.de.sections.length).toBe(docs.en.sections.length)
      docs.de.sections.forEach((section, i) => {
        expect(section.paragraphs.length).toBe(docs.en.sections[i].paragraphs.length)
      })
    }
  })

  it('nennen in Deutsch und Englisch dieselben Platzhalter-Stellen', () => {
    const zaehle = (doc: (typeof LEGAL_DOCS)['datenschutz']['de']) =>
      doc.sections.flatMap(s => s.paragraphs).join(' ').match(/\[\[/g)?.length ?? 0
    for (const docs of Object.values(LEGAL_DOCS)) expect(zaehle(docs.de)).toBe(zaehle(docs.en))
  })

  it('erkennt offene Platzhalter', () => {
    expect(hatPlatzhalter(LEGAL_DOCS.impressum.de)).toBe(true)
    expect(hatPlatzhalter({ title: 'x', updated: 'y', sections: [{ heading: 'h', paragraphs: ['fertig'] }] })).toBe(false)
  })

  it('zerlegt Absaetze in Text und Platzhalter', () => {
    expect(teileAbsatz('E-Mail: [[Kontakt]] bitte')).toEqual([
      { text: 'E-Mail: ', platzhalter: false },
      { text: 'Kontakt', platzhalter: true },
      { text: ' bitte', platzhalter: false },
    ])
  })

  it('zeigt Deutsch nur fuer Deutsch, sonst Englisch', () => {
    expect(legalLang('de-AT')).toBe('de')
    expect(legalLang('fr')).toBe('en')
    expect(legalLang(undefined)).toBe('en')
  })
})
