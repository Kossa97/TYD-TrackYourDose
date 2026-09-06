import { describe, expect, it } from 'vitest'
import { STAGE_PREVIEW_ID, stagePreviewItem } from './stagePreview'

describe('stagePreviewItem', () => {
  it('ist erkennbar kein gespeicherter Eintrag', () => {
    const item = stagePreviewItem({ dosageForm: 'vial' })

    expect(item.id).toBe(STAGE_PREVIEW_ID)
    expect(item.user_id).toBe('')
    expect(item.created_at).toBe('')
  })

  it('reicht Name, Farbe und Wirkstoffe an die Buehne durch', () => {
    const item = stagePreviewItem({
      dosageForm: 'spray',
      displayName: '  Vitamin D3  ',
      colorHex: '#f0b357',
      ingredients: [{
        catalog_substance_id: null,
        custom_name: 'Vitamin D3',
        amount_value: 1000,
        amount_unit: 'IU',
        basis_value: 1,
        basis_unit: 'spray',
        position: 0,
      }],
    })

    expect(item.dosage_form).toBe('spray')
    expect(item.display_name).toBe('Vitamin D3')
    expect(item.color_hex).toBe('#f0b357')
    expect(item.ingredients[0].amount_value).toBe(1000)
  })

  it('laesst halb getippte Farben nicht durch', () => {
    // Im Farbfeld steht waehrend des Tippens jeder Zwischenstand: '#', '#f',
    // '#f9'. Durchgereicht flackerte die Vorschau bei jedem Tastendruck durch
    // Schwarz, weil SVG einen unvollstaendigen Hex-Wert als schwarz zeichnet.
    for (const halb of ['', '#', '#f', '#f9', '#f9731', 'blau', '  ']) {
      expect(stagePreviewItem({ dosageForm: 'vial', colorHex: halb }).color_hex, halb).toBeNull()
    }
    for (const ganz of ['#fff', '#F97316', '#f97316']) {
      expect(stagePreviewItem({ dosageForm: 'vial', colorHex: ganz }).color_hex, ganz).toBe(ganz)
    }
  })

  it('gibt einen leeren Namen weiter, statt einen zu erfinden', () => {
    // Jede Form hat ihren eigenen Vorgabenamen. Den hier vorwegzunehmen hiesse,
    // ihn an zwei Stellen zu pflegen.
    expect(stagePreviewItem({ dosageForm: 'powder' }).display_name).toBe('')
    expect(stagePreviewItem({ dosageForm: 'powder', displayName: '   ' }).display_name).toBe('')
  })

  it('kopiert die Wirkstoffe, statt den Entwurf zu verlinken', () => {
    // Die Vorschau darf den Entwurf nicht anfassen koennen.
    const ingredients = [{
      catalog_substance_id: null,
      custom_name: 'Test',
      amount_value: 1,
      amount_unit: 'mg',
      basis_value: 1,
      basis_unit: 'tablet',
      position: 0,
    }]
    const item = stagePreviewItem({ dosageForm: 'tablet', ingredients })

    expect(item.ingredients).not.toBe(ingredients)
    expect(item.ingredients).toEqual(ingredients)
  })
})
