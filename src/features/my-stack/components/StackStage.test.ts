import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { StackItem } from '../types'
import { StackStage } from './StackStage'

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

const capsuleItem: StackItem = {
  ...vialItem,
  id: 'vitamin-d3-capsule',
  display_name: 'Vitamin D3',
  category: 'vitamin',
  dosage_form: 'capsule',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Vitamin D3',
    amount_value: 5_000,
    amount_unit: 'IU',
    basis_unit: 'capsule',
  }],
}

function renderStage(item: StackItem): string {
  return renderToStaticMarkup(createElement(StackStage, { item }))
}

describe('StackStage', () => {
  it('rendert das bestehende Vial nur für freigeschaltete Vial-Einträge', () => {
    expect(renderStage(vialItem)).toContain('data-stack-renderer="vial"')
    expect(renderStage(capsuleItem)).toContain('data-stack-renderer="unsupported"')
  })

  it('behält nicht freigeschaltete Formen in einer textuellen Darstellung', () => {
    const html = renderStage(capsuleItem)
    const source = readFileSync(new URL('./StackStage.tsx', import.meta.url), 'utf8')

    expect(html).toContain('Vitamin D3')
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
