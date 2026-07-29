import { describe, expect, it } from 'vitest'
import { trackingCapabilities } from './trackingDepth'

describe('trackingCapabilities', () => {
  it('keeps titration in with_amount and complete', () => {
    expect(trackingCapabilities('intake_only').titration).toBe(false)
    expect(trackingCapabilities('with_amount').titration).toBe(true)
    expect(trackingCapabilities('complete').titration).toBe(true)
  })

  it('reserves PK and inventory opt-in for complete', () => {
    expect(trackingCapabilities('with_amount').pk).toBe(false)
    expect(trackingCapabilities('complete').pk).toBe(true)
    expect(trackingCapabilities('complete').inventory).toBe(true)
  })
})
