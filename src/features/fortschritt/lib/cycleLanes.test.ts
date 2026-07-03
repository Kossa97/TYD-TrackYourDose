import { describe, expect, it } from 'vitest'
import { assignLanes, computeCycleBandLayout, FULL_HEIGHT_LANE_COUNT, intervalsOverlap, laneCount } from './cycleLanes'

describe('intervalsOverlap', () => {
  it('detects overlap', () => {
    expect(intervalsOverlap({ x1: 0, x2: 10 }, { x1: 5, x2: 15 })).toBe(true)
  })

  it('allows touching endpoints', () => {
    expect(intervalsOverlap({ x1: 0, x2: 10 }, { x1: 10, x2: 20 })).toBe(false)
  })
})

describe('assignLanes', () => {
  it('places 4 overlapping cycles in 4 lanes', () => {
    const items = [
      { id: 'a', x1: 0, x2: 100 },
      { id: 'b', x1: 10, x2: 90 },
      { id: 'c', x1: 20, x2: 80 },
      { id: 'd', x1: 30, x2: 70 },
    ]
    const placed = assignLanes(items)
    expect(laneCount(placed)).toBe(4)
    const lanes = new Set(placed.map(p => p.lane))
    expect(lanes.size).toBe(4)
  })

  it('places sequential non-overlapping cycles in one lane', () => {
    const items = [
      { id: 'a', x1: 0, x2: 10 },
      { id: 'b', x1: 10, x2: 20 },
      { id: 'c', x1: 25, x2: 40 },
    ]
    const placed = assignLanes(items)
    expect(laneCount(placed)).toBe(1)
    expect(new Set(placed.map(p => p.lane)).size).toBe(1)
  })

  it('uses 2 lanes when two overlap and one is separate', () => {
    const items = [
      { id: 'a', x1: 0, x2: 50 },
      { id: 'b', x1: 10, x2: 60 },
      { id: 'c', x1: 100, x2: 120 },
    ]
    const placed = assignLanes(items)
    expect(laneCount(placed)).toBe(2)
    const c = placed.find(p => p.id === 'c')
    const a = placed.find(p => p.id === 'a')
    const b = placed.find(p => p.id === 'b')
    expect(c?.lane).toBe(a?.lane)
    expect(b?.lane).not.toBe(a?.lane)
  })
})

describe('computeCycleBandLayout', () => {
  const plotHeight = 200

  it('uses less total height with fewer lanes', () => {
    const one = computeCycleBandLayout(plotHeight, 1)
    const five = computeCycleBandLayout(plotHeight, 5)
    expect(one.blockHeight).toBeLessThan(five.blockHeight)
    expect(five.blockHeight).toBeCloseTo(plotHeight, -1)
  })

  it('scales linearly up to FULL_HEIGHT_LANE_COUNT', () => {
    const three = computeCycleBandLayout(plotHeight, 3)
    expect(three.blockHeight).toBeCloseTo(plotHeight * (3 / FULL_HEIGHT_LANE_COUNT), -1)
  })
})
