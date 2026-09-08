import { describe, expect, it } from 'vitest'
import { trackingCapabilities, type TrackingCapabilities } from './trackingDepth'
import { dosePlanCapabilities } from './dosePlan'

describe('trackingCapabilities', () => {
  it('keeps titration in with_amount and complete', () => {
    expect(trackingCapabilities('intake_only').titration).toBe(false)
    expect(trackingCapabilities('with_amount').titration).toBe(true)
    expect(trackingCapabilities('complete').titration).toBe(true)
  })

  it('reserves PK and product strength for complete', () => {
    expect(trackingCapabilities('with_amount').pk).toBe(false)
    expect(trackingCapabilities('with_amount').productStrength).toBe(false)
    expect(trackingCapabilities('complete').pk).toBe(true)
    expect(trackingCapabilities('complete').productStrength).toBe(true)
  })

  it('kennt den Bestand nicht — der haengt am eigenen Schalter', () => {
    // Ob jemand Vorraete fuehrt, ist keine Frage der Messgenauigkeit. Stuende
    // 'inventory' hier, waere der Bestand wieder an die Stufe gekettet und
    // „nur abhaken, aber sag mir wann die Packung leer ist“ unmoeglich.
    const stufen = ['intake_only', 'with_amount', 'complete'] as const

    for (const stufe of stufen) {
      const felder = Object.keys(trackingCapabilities(stufe))
      expect(felder, stufe).not.toContain('inventory')
      expect(felder.sort(), stufe).toEqual(
        (['pk', 'productStrength', 'quantity', 'titration'] satisfies (keyof TrackingCapabilities)[]).sort(),
      )
    }
  })

  it('ist die einzige Wahrheit — dosePlan leitet ab, statt selbst zu urteilen', () => {
    // dosePlanCapabilities hat die Regel frueher eigenstaendig aus
    // `level !== 'intake_only'` abgeleitet. Solange beide dasselbe sagen,
    // faellt eine Abweichung nie auf; deshalb steht sie hier fest.
    const stufen = ['intake_only', 'with_amount', 'complete'] as const

    for (const stufe of stufen) {
      const kann = trackingCapabilities(stufe)
      expect(dosePlanCapabilities(stufe), stufe).toEqual({
        oneOff: kann.quantity,
        permanent: kann.quantity,
        titration: kann.titration,
      })
    }
  })
})
