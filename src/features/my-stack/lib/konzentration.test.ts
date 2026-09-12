import { describe, expect, it } from 'vitest'
import { konzentrationProMl } from './konzentration'

describe('konzentrationProMl', () => {
  it('rechnet die Rekonstitution eines Pulver-Vials in mg/ml um', () => {
    // 10 mg Pulver, aufgeloest in 2 ml — genau die Angabe, die der
    // Staerke-Schritt bei einem Peptid abfragt.
    expect(konzentrationProMl(10, 'mg', 2, 'ml')).toEqual({ value: 5, unit: 'mg' })
  })

  it('rundet auf drei Nachkommastellen und laesst Nullen weg', () => {
    expect(konzentrationProMl(10, 'mg', 3, 'ml')).toEqual({ value: 3.333, unit: 'mg' })
    expect(konzentrationProMl(10, 'mg', 2, 'ml')!.value).toBe(5)
  })

  it('schweigt, wenn die Produktmenge 1 ml ist', () => {
    // „250 mg pro 1 ml" ist die Konzentration schon. Sie ein zweites Mal
    // hinzuschreiben erklaert nichts.
    expect(konzentrationProMl(250, 'mg', 1, 'ml')).toBeNull()
  })

  it('schweigt bei allem, was nicht in Millilitern gemessen wird', () => {
    expect(konzentrationProMl(500, 'mg', 1, 'capsule')).toBeNull()
    expect(konzentrationProMl(500, 'mg', 2, 'g')).toBeNull()
    expect(konzentrationProMl(500, 'mg', 2, null)).toBeNull()
  })

  it('schweigt bei einer Wirkstoffeinheit, die selbst ein Volumen ist', () => {
    // „2 ml pro 10 ml" waere keine Konzentration.
    expect(konzentrationProMl(2, 'ml', 10, 'ml')).toBeNull()
  })

  it('schweigt bei unvollstaendigen oder unsinnigen Zahlen', () => {
    expect(konzentrationProMl(null, 'mg', 2, 'ml')).toBeNull()
    expect(konzentrationProMl(10, 'mg', null, 'ml')).toBeNull()
    expect(konzentrationProMl(10, 'mg', 0, 'ml')).toBeNull()
    expect(konzentrationProMl(-10, 'mg', 2, 'ml')).toBeNull()
    expect(konzentrationProMl(Number.NaN, 'mg', 2, 'ml')).toBeNull()
  })

  it('nimmt IU und mcg genauso wie mg', () => {
    expect(konzentrationProMl(5000, 'IU', 2, 'ml')).toEqual({ value: 2500, unit: 'IU' })
    expect(konzentrationProMl(600, 'mcg', 3, 'ml')).toEqual({ value: 200, unit: 'mcg' })
  })
})
