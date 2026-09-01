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

const patchItem: StackItem = {
  ...vialItem,
  id: 'nikotin-patch',
  display_name: 'Nikotinpflaster',
  category: 'medication',
  dosage_form: 'patch',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Nikotin',
    amount_value: 21,
    amount_unit: 'mg',
    basis_unit: 'patch',
  }],
}

function renderStage(item: StackItem): string {
  return renderToStaticMarkup(createElement(StackStage, { item }))
}

describe('StackStage', () => {
  it('rendert das bestehende Vial nur für freigeschaltete Vial-Einträge', () => {
    expect(renderStage(vialItem)).toContain('data-stack-renderer="vial"')
    expect(renderStage(patchItem)).toContain('data-stack-renderer="unsupported"')
  })

  it('behält nicht freigeschaltete Formen in einer textuellen Darstellung', () => {
    const html = renderStage(patchItem)
    const source = readFileSync(new URL('./StackStage.tsx', import.meta.url), 'utf8')

    expect(html).toContain('Nikotinpflaster')
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
    expect(renderStage(patchItem)).toContain('data-stack-renderer="unsupported"')
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

  it('hält den Tabletten-Adapter frei von eigener Grafik und von Physik', () => {
    const source = readFileSync(new URL('../extensions/tablet/TabletRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('TabletVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('SloshProvider')
    expect(source).not.toContain('fillPct')
  })

  it('benutzt als Negativbeispiel eine Form, die wirklich keinen Renderer hat', () => {
    // Diese Datei prueft mit patchItem, dass Formen ohne Buehnengrafik im
    // Textzustand bleiben. Bekommt patch selbst einen Renderer, muss das
    // Beispiel auf eine andere Form ohne Renderer wechseln.
    expect(
      getDosageForm(patchItem.dosage_form).stageRenderer,
      'patch hat jetzt einen Renderer — Negativbeispiel auf eine andere Form ohne stageRenderer umstellen',
    ).toBeUndefined()
  })
})
