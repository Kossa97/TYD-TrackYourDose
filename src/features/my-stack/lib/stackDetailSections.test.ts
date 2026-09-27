import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS, getDosageForm } from './dosageForms'
import { detailAbschnitte, wirkstoffBezug } from './stackDetailSections'

describe('detailAbschnitte', () => {
  const substanz = { id: 'substanz', felder: ['kategorie', 'applikation', 'marke', 'batch', 'quelle', 'analyse', 'notizen'] }

  it('zeigt beim Vial Flüssigkeit, Anmischdatum und Haltbarkeit bei der Zusammensetzung', () => {
    expect(detailAbschnitte(getDosageForm('vial'))).toEqual([
      substanz,
      { id: 'produkt', felder: ['wirkstoff', 'fluessigkeit', 'rekonstituiert_am', 'haltbarkeit'] },
    ])
  })

  it('zeigt bei Pen und Flasche das Öffnen, aber keine zugefügte Flüssigkeit', () => {
    expect(detailAbschnitte(getDosageForm('pen'))[1].felder).toEqual(['wirkstoff', 'rekonstituiert_am', 'haltbarkeit'])
    expect(detailAbschnitte(getDosageForm('drops'))[1].felder).toEqual(['wirkstoff', 'rekonstituiert_am', 'haltbarkeit'])
  })

  it('lässt weg, was die Form nicht kennt', () => {
    expect(detailAbschnitte(getDosageForm('patch'))).toEqual([substanz, { id: 'produkt', felder: ['wirkstoff'] }])
  })
})

describe('wirkstoffBezug', () => {
  it('benennt die Stärke so, wie die Form sie misst', () => {
    // „Wirkstoff pro Vial" stimmt beim Vial und sonst nirgends.
    expect(wirkstoffBezug(getDosageForm('vial'))).toBe('pro_vial')
    expect(wirkstoffBezug(getDosageForm('pen'))).toBe('pro_volumen')
    expect(wirkstoffBezug(getDosageForm('tablet'))).toBe('pro_einheit')
    expect(wirkstoffBezug(getDosageForm('gel'))).toBe('pro_masse')
    expect(wirkstoffBezug(undefined)).toBe('roh')
  })

  it('lässt keine Form ohne Bezug', () => {
    for (const form of DOSAGE_FORMS) {
      expect(wirkstoffBezug(form), form.key).toBeTruthy()
    }
  })
})
