import { describe, expect, it } from 'vitest'
import { carriesLabel, type StageFormSpec } from './types'

const withChamber: StageFormSpec = {
  viewBox: { x: 0, y: 0, width: 120, height: 294 },
  chamber: { x: 4, y: 36, width: 112, height: 247, aspect: 0.794 },
  hasMeaningfulFill: true,
}

const withoutChamber: StageFormSpec = {
  viewBox: { x: 0, y: 0, width: 120, height: 120 },
  chamber: null,
  hasMeaningfulFill: false,
}

describe('carriesLabel', () => {
  it('gives our label to every container that holds liquid', () => {
    expect(carriesLabel(withChamber)).toBe(true)
  })

  it('withholds it from forms without a liquid chamber', () => {
    expect(carriesLabel(withoutChamber)).toBe(false)
  })

  it('is independent of whether the fill level says anything', () => {
    expect(carriesLabel({ ...withChamber, hasMeaningfulFill: false })).toBe(true)
  })
})
