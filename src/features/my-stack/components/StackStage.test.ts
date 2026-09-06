import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { StackItem } from '../types'
import { StackStage } from './StackStage'
import { getDosageForm } from '../lib/dosageForms'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const vialItem: StackItem = {
  id: 'bpc-157-vial',
  user_id: 'user-1',
  display_name: 'BPC-157',
  category: 'peptide',
  dosage_form: 'vial',
  brand: null,
  color_hex: '#06b6d4',
  notes: null,
  configuration_status: 'complete',
  tracking_level: 'complete',
  pk_profile_method: null,
  archived: false,
  archived_at: null,
  created_at: '2026-07-21T00:00:00.000Z',
  updated_at: '2026-07-21T00:00:00.000Z',
  ingredients: [{
    catalog_substance_id: null,
    custom_name: 'BPC-157',
    amount_value: 5,
    amount_unit: 'mg',
    basis_value: 1,
    basis_unit: 'vial',
    position: 0,
  }],
}

// Das Negativbeispiel ist beim Auffangeintrag angekommen: powder und gel
// haben inzwischen eigene Renderer. `other` hat keine einzige Faehigkeit und
// soll dauerhaft auf der Textkarte bleiben — hier endet die Wanderung.
const otherItem: StackItem = {
  ...vialItem,
  id: 'sonstiges-1',
  display_name: 'Sonstige Zubereitung',
  category: 'medication',
  dosage_form: 'other',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Sonstiges',
    amount_value: 5,
    amount_unit: 'g',
    basis_unit: 'g',
  }],
}

function renderStage(item: StackItem): string {
  return renderToStaticMarkup(createElement(StackStage, { item }))
}

describe('StackStage', () => {
  it('rendert das bestehende Vial nur für freigeschaltete Vial-Einträge', () => {
    expect(renderStage(vialItem)).toContain('data-stack-renderer="vial"')
    expect(renderStage(otherItem)).toContain('data-stack-renderer="unsupported"')
  })

  it('behält nicht freigeschaltete Formen in einer textuellen Darstellung', () => {
    const html = renderStage(otherItem)
    const source = readFileSync(new URL('./StackStage.tsx', import.meta.url), 'utf8')

    expect(html).toContain('Sonstige Zubereitung')
    expect(html).toContain('my_stack_visual_pending')
    expect(html).not.toContain('PeptideVialVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('<img')
    expect(source).not.toContain('lucide-react')
  })

  it('verwendet das bestehende hochwertige Vial mit Bühnenlicht und Slosh-Kontext', () => {
    const source = readFileSync(new URL('../extensions/peptide/VialRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('PeptideVialVisual')
    expect(source).toContain('VialStageLightHandle')
    expect(source).toContain('SloshProvider')
    expect(source).toContain('sloshEngine?: SloshEngine')
    expect(source).not.toContain('useSloshEngine')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('<img')
    expect(source).not.toContain('lucide-react')
  })
})

const ampouleItem: StackItem = {
  ...vialItem,
  id: 'testosteron-ampoule',
  display_name: 'Testosteron Enantat',
  category: 'hormone',
  dosage_form: 'ampoule',
  color_hex: '#e0a23f',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Testosteron Enantat',
    amount_value: 250,
    amount_unit: 'mg',
    basis_unit: 'ml',
  }],
}

describe('StackStage — Ampulle', () => {
  it('rendert die Ampulle für Ampullen-Einträge', () => {
    expect(renderStage(ampouleItem)).toContain('data-stack-renderer="ampoule"')
  })

  it('zeigt Name und Wirkstoffmenge auf dem Etikett', () => {
    const html = renderStage(ampouleItem)

    expect(html).toContain('Testosteron Enantat')
    expect(html).toContain('250 mg / ml')
  })

  it('lässt Formen ohne eigene Grafik weiterhin im Textzustand', () => {
    expect(renderStage(otherItem)).toContain('data-stack-renderer="unsupported"')
  })

  it('hält den Ampullen-Adapter frei von eigener Grafik', () => {
    const source = readFileSync(new URL('../extensions/ampoule/AmpouleRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('AmpouleVisual')
    expect(source).toContain('SloshProvider')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('lucide-react')
  })

  it('reicht keinen Füllstand an die Ampulle durch', () => {
    const source = readFileSync(new URL('../extensions/ampoule/AmpouleRenderer.tsx', import.meta.url), 'utf8')

    expect(source).not.toContain('fillPct')
  })
})

const capsuleItem: StackItem = {
  ...vialItem,
  id: 'vitamin-d3-capsule',
  display_name: 'Vitamin D3',
  category: 'vitamin',
  dosage_form: 'capsule',
  color_hex: '#f0b357',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Vitamin D3',
    amount_value: 5_000,
    amount_unit: 'IU',
    basis_unit: 'capsule',
  }],
}

describe('StackStage — Kapsel', () => {
  it('rendert die Kapsel für Kapsel-Einträge', () => {
    expect(renderStage(capsuleItem)).toContain('data-stack-renderer="capsule"')
  })

  it('trägt den Namen auf der Hülle, aber ohne Etikettband', () => {
    const html = renderStage(capsuleItem)

    // dieselbe Typografie wie auf dem Etikett, nur ohne Band darum
    expect(html).toContain('Vitamin D3')
    expect(html).toContain('data-capsule-detail="name"')
    expect(html).toContain('font-black text-white tracking-normal')
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
  })

  it('hält den Kapsel-Adapter frei von eigener Grafik und von Physik', () => {
    const source = readFileSync(new URL('../extensions/capsule/CapsuleRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('CapsuleVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('SloshProvider')
    expect(source).not.toContain('fillPct')
  })
})

const tabletItem: StackItem = {
  ...vialItem,
  id: 'ibuprofen-tablet',
  display_name: 'Ibuprofen',
  category: 'medication',
  dosage_form: 'tablet',
  color_hex: '#d9c39a',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Ibuprofen',
    amount_value: 400,
    amount_unit: 'mg',
    basis_unit: 'tablet',
  }],
}

describe('StackStage — Tablette', () => {
  it('rendert die Tablette für Tabletten-Einträge', () => {
    expect(renderStage(tabletItem)).toContain('data-stack-renderer="tablet"')
  })

  it('zeigt Bruchrille und Namen, aber kein Etikettband', () => {
    const html = renderStage(tabletItem)

    expect(html).toContain('data-tablet-detail="score"')
    expect(html).toContain('Ibuprofen')
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
  })

  it('hält den Tabletten-Adapter frei von eigener Grafik und von Füllstand', () => {
    const source = readFileSync(new URL('../extensions/tablet/TabletRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('TabletVisual')
    expect(source).not.toContain('<svg')
    // Physik ja, Fuellstand nein: die Tablette rollt, aber sie hat keinen Pegel.
    expect(source).toContain('SloshProvider')
    expect(source).not.toContain('fillPct')
  })

  it('benutzt als Negativbeispiel eine Form, die wirklich keinen Renderer hat', () => {
    // Diese Datei prueft mit otherItem, dass Formen ohne Buehnengrafik im
    // Textzustand bleiben. Bekommt powder selbst einen Renderer, muss das
    // Beispiel auf eine andere Form ohne Renderer wechseln.
    expect(
      getDosageForm(otherItem.dosage_form).stageRenderer,
      'other hat jetzt einen Renderer — der Auffangeintrag sollte auf der Textkarte bleiben',
    ).toBeUndefined()
  })
})

const nasalSprayItem: StackItem = {
  ...vialItem,
  id: 'oxytocin-spray',
  display_name: 'Oxytocin',
  category: 'peptide',
  dosage_form: 'nasal_spray',
  color_hex: '#7dd3fc',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Oxytocin',
    amount_value: 24,
    amount_unit: 'IU',
    basis_unit: 'spray',
  }],
}

describe('StackStage — Nasenspray', () => {
  it('rendert das Nasenspray für Nasenspray-Einträge', () => {
    expect(renderStage(nasalSprayItem)).toContain('data-stack-renderer="nasal_spray"')
  })

  it('zeigt den Kopf und ein Etikett mit Name und Wirkstoffmenge', () => {
    const html = renderStage(nasalSprayItem)

    expect(html).toContain('data-nasal-spray-detail="nozzle"')
    expect(html).toContain('Oxytocin')
    expect(html).toContain('24 IU / spray')
  })

  it('reicht keinen Füllstand an das Nasenspray durch', () => {
    const source = readFileSync(new URL('../extensions/nasal-spray/NasalSprayRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('NasalSprayVisual')
    expect(source).toContain('SloshProvider')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('fillPct')
  })

  it('gibt dem generischen spray-Schlüssel seine eigene Flasche', () => {
    // Beide sind Pumpflaschen — aber nicht dieselbe. Das Mundspray hat die
    // seitliche Düse, das Nasenspray den Kegel nach oben.
    const sprayItem: StackItem = { ...nasalSprayItem, id: 'mundspray', dosage_form: 'spray' }
    const html = renderStage(sprayItem)
    expect(html).toContain('data-stack-renderer="spray"')
    expect(html).toContain('data-spray-detail="nozzle"')
    expect(html).not.toContain('data-nasal-spray-detail="nozzle"')
  })

  it('lässt die Formen ohne Bühnengrafik im Textzustand', () => {
    // Der Gegenbeweis wandert mit: er stand zuletzt auf 'spray', das jetzt
    // eine eigene Grafik hat.
    const liquidItem: StackItem = { ...nasalSprayItem, id: 'saft', dosage_form: 'liquid' }
    expect(renderStage(liquidItem)).toContain('data-stack-renderer="unsupported"')
  })
})

const tubeItem: StackItem = {
  ...vialItem,
  id: 'diclofenac-tube',
  display_name: 'Diclofenac',
  category: 'medication',
  dosage_form: 'tube',
  color_hex: '#f97316',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Diclofenac',
    amount_value: 10,
    amount_unit: 'mg',
    basis_unit: 'g',
  }],
}

describe('StackStage — Tube', () => {
  it('rendert die Tube für Tuben-Einträge', () => {
    expect(renderStage(tubeItem)).toContain('data-stack-renderer="tube"')
  })

  it('zeigt Naht, Deckel und Namen, aber kein Etikettband', () => {
    const html = renderStage(tubeItem)

    expect(html).toContain('data-tube-detail="crimp"')
    expect(html).toContain('data-tube-detail="cap"')
    expect(html).toContain('Diclofenac')
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
  })

  it('reicht dem Adapter weder Farbe noch Füllstand noch Physik durch', () => {
    const source = readFileSync(new URL('../extensions/tube/TubeRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('TubeVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('SloshProvider')
    expect(source).not.toContain('fillPct')
    expect(source).not.toContain('color_hex')
  })

  it('schluckt den gel-Schlüssel nicht', () => {
    // gel benennt einen Stoff, tube einen Behälter — ein Gel als Alutube zu
    // zeichnen behauptet eine Verpackung, die die Daten nicht hergeben. Das
    // galt, solange gel keine eigene Grafik hatte, und gilt weiter: es hat
    // jetzt seinen Tiegel, und der ist nicht die Tube.
    const gelItem: StackItem = { ...tubeItem, id: 'voltaren-gel', dosage_form: 'gel' }
    const html = renderStage(gelItem)
    expect(html).toContain('data-stack-renderer="gel"')
    expect(html).not.toContain('data-stack-renderer="tube"')
  })
})

const penItem: StackItem = {
  ...vialItem,
  id: 'semaglutid-pen',
  display_name: 'Semaglutid',
  category: 'medication',
  dosage_form: 'pen',
  color_hex: '#3f7fbf',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Semaglutid',
    amount_value: 0.25,
    amount_unit: 'mg',
    basis_unit: 'dose',
  }],
}

describe('StackStage — Pen', () => {
  it('rendert den Pen für Pen-Einträge', () => {
    expect(renderStage(penItem)).toContain('data-stack-renderer="pen"')
  })

  it('zeigt Dosisfenster und Namen, aber kein Etikettband', () => {
    const html = renderStage(penItem)

    expect(html).toContain('data-pen-detail="dose-window"')
    expect(html).toContain('Semaglutid')
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
  })

  it('zeigt im Dosisfenster eine 0 statt der geplanten Dosis', () => {
    // Die Bühne zeigt den Stack-Eintrag, nicht eine einzelne Einnahme —
    // dieselbe Grenze wie bei der Bruchmenge der Tablette.
    const html = renderStage(penItem)
    expect(html).toMatch(/data-pen-detail="dose-value"[^>]*>0</)
    expect(html).not.toContain('0.25')
  })

  it('hält den Pen-Adapter frei von eigener Grafik und von Physik', () => {
    const source = readFileSync(new URL('../extensions/pen/PenRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('PenVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('SloshProvider')
    expect(source).not.toContain('fillPct')
  })
})
