import { describe, expect, it } from 'vitest'
import { clampStageLight, useStageLight } from './useStageLight'

describe('clampStageLight', () => {
  it('clamps focus to 0..1 and light offset to -1..1', () => {
    expect(clampStageLight(2, 5)).toEqual({ focus: 1, lightOffset: 1 })
    expect(clampStageLight(-3, -4)).toEqual({ focus: 0, lightOffset: -1 })
  })

  it('falls back to the low end rather than passing garbage on to the DOM', () => {
    expect(clampStageLight(Number.NaN, Number.NaN)).toEqual({ focus: 0, lightOffset: -1 })
  })

  it('leaves values inside the range untouched', () => {
    expect(clampStageLight(0.42, -0.31)).toEqual({ focus: 0.42, lightOffset: -0.31 })
  })
})

describe('useStageLight', () => {
  it('is a hook every stage form can share', () => {
    expect(typeof useStageLight).toBe('function')
  })
})
