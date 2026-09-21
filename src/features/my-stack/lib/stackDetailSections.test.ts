import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS, getDosageForm } from './dosageForms'
import { detailAbschnitte, produktTitel, wirkstoffBezug, zeigtFeld } from './stackDetailSections'

describe('detailAbschnitte', () => {
  it('zeigt Flüssigkeit, Datum und Haltbarkeit nur, wo man selbst anmischt', () => {
    // Genau eine Form löst auf: das Vial. Überall sonst standen dort drei
    // Kacheln „Nicht gesetzt", und das sieht nicht nach „noch nicht
    // ausgefüllt" aus, sondern nach kaputt.
    for (const form of DOSAGE_FORMS) {
      const loest = form.capabilities.includes('reconstitutable')
      for (const feld of ['fluessigkeit', 'rekonstituiert_am', 'haltbarkeit'] as const) {
        expect(zeigtFeld(form, feld), `${form.key} / ${feld}`).toBe(loest)
      }
    }
    expect(zeigtFeld(getDosageForm('vial'), 'fluessigkeit')).toBe(true)
    expect(zeigtFeld(getDosageForm('patch'), 'fluessigkeit')).toBe(false)
  })

  it('zeigt den Vorrat nur, wo die Form einen Bestand führt', () => {
    for (const form of DOSAGE_FORMS) {
      expect(zeigtFeld(form, 'vorrat'), form.key)
        .toBe(form.capabilities.includes('inventory_capable'))
    }
  })

  it('zeigt Applikation und Herkunft bei jeder Form', () => {
    for (const form of DOSAGE_FORMS) {
      for (const feld of ['applikation', 'batch', 'quelle', 'analyse', 'notizen'] as const) {
        expect(zeigtFeld(form, feld), `${form.key} / ${feld}`).toBe(true)
      }
    }
  })

  it('ordnet den Wirkstoff bei jeder Form der Zusammensetzung zu', () => {
    for (const form of DOSAGE_FORMS) {
      const abschnitte = detailAbschnitte(form)
      expect(abschnitte.find(a => a.id === 'substanz')?.felder, form.key).not.toContain('wirkstoff')
      expect(abschnitte.find(a => a.id === 'produkt')?.felder, form.key).toContain('wirkstoff')
    }
  })

  it('verträgt eine unbekannte Form', () => {
    expect(detailAbschnitte(undefined).map(a => a.id)).toEqual(['substanz', 'produkt'])
    expect(detailAbschnitte(undefined).find(a => a.id === 'produkt')?.felder).toContain('wirkstoff')
  })

  it('nennt zuerst, WAS es ist, dann was diese Packung ist', () => {
    expect(detailAbschnitte(getDosageForm('vial')).map(a => a.id)).toEqual(['substanz', 'produkt'])
    expect(detailAbschnitte(getDosageForm('tablet')).map(a => a.id)).toEqual(['substanz', 'produkt'])
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

describe('produktTitel', () => {
  it('heißt „Rekonstitution", wo eine Flüssigkeit zugefügt wird', () => {
    const vial = detailAbschnitte(getDosageForm('vial')).find(a => a.id === 'produkt')!
    expect(produktTitel(vial)).toBe('rekonstitution')
  })

  it('heißt sonst „Zusammensetzung" — auch beim Pen', () => {
    for (const key of ['pen', 'tablet', 'patch', 'gel'] as const) {
      const abschnitt = detailAbschnitte(getDosageForm(key)).find(a => a.id === 'produkt')!
      expect(produktTitel(abschnitt), key).toBe('zusammensetzung')
    }
  })
})
