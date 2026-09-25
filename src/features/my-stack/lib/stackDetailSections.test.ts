import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS, getDosageForm } from './dosageForms'
import { detailAbschnitte, wirkstoffBezug } from './stackDetailSections'

describe('detailAbschnitte', () => {
  it('zeigt, was die Substanz ist und woraus sie besteht — die Packung steht im Bestand', () => {
    expect(detailAbschnitte()).toEqual([
      { id: 'substanz', felder: ['kategorie', 'applikation', 'marke', 'notizen'] },
      { id: 'produkt', felder: ['wirkstoff'] },
    ])
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
