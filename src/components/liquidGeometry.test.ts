import { describe, expect, test } from 'vitest'
import { buildLiquid, fillSloshResponse, liquidSurfaceY, LIQUID_VB_H } from './liquidGeometry'

describe('liquidGeometry', () => {
  test('builds one coherent set of paths for body, surface, glow and rim', () => {
    const g = buildLiquid({ fill: 0.6 })
    expect(g.body.startsWith('M')).toBe(true)
    expect(g.body.trimEnd().endsWith('Z')).toBe(true)
    expect(g.surface.startsWith('M')).toBe(true)
    expect(g.glow.startsWith('M')).toBe(true)
    expect(g.rim.startsWith('M')).toBe(true)
  })

  test('tilts the surface so the liquid climbs the rising wall', () => {
    const right = buildLiquid({ fill: 0.5, tilt: 1 })
    expect(right.rightWallY).toBeLessThan(right.leftWallY) // right wall higher

    const left = buildLiquid({ fill: 0.5, tilt: -1 })
    expect(left.leftWallY).toBeLessThan(left.rightWallY) // left wall higher
  })

  test('a harder tilt produces a larger wall-to-wall difference', () => {
    const soft = buildLiquid({ fill: 0.5, tilt: 0.2 })
    const hard = buildLiquid({ fill: 0.5, tilt: 1 })
    expect(Math.abs(hard.leftWallY - hard.rightWallY)).toBeGreaterThan(
      Math.abs(soft.leftWallY - soft.rightWallY),
    )
  })

  test('keeps the surface below the rim and above the floor', () => {
    const g = buildLiquid({ fill: 0.5, tilt: 0.6 })
    expect(g.surfaceY).toBeGreaterThan(0)
    expect(g.surfaceY).toBeLessThan(LIQUID_VB_H)
  })

  test('animates over time so the surface stays alive at rest', () => {
    const a = buildLiquid({ fill: 0.7, time: 0 })
    const b = buildLiquid({ fill: 0.7, time: 1 })
    expect(a.rim).not.toBe(b.rim)
  })

  test('the specular highlight follows the tilt direction', () => {
    const right = buildLiquid({ fill: 0.5, tilt: 1 })
    const left = buildLiquid({ fill: 0.5, tilt: -1 })
    expect(right.highlightX).toBeGreaterThan(left.highlightX)
  })

  test('a fuller vial has a higher surface than an emptier one', () => {
    expect(liquidSurfaceY(0.9)).toBeLessThan(liquidSurfaceY(0.2))
  })

  test('a half-full vial sloshes more than a nearly-full or near-empty one', () => {
    const half = fillSloshResponse(0.5)
    expect(half).toBeCloseTo(1, 5)
    expect(half).toBeGreaterThan(fillSloshResponse(0.95))
    expect(half).toBeGreaterThan(fillSloshResponse(0.1))
    // a nearly-full vial is more constrained than a comfortably-full one
    expect(fillSloshResponse(0.6)).toBeGreaterThan(fillSloshResponse(0.95))
  })

  test('never emits non-finite coordinates even for garbage input', () => {
    const g = buildLiquid({ fill: Number.NaN, tilt: Number.NaN, energy: Number.NaN, time: Number.NaN })
    expect(Number.isFinite(g.highlightX)).toBe(true)
    expect(Number.isFinite(g.highlightY)).toBe(true)
    expect(Number.isFinite(g.leftWallY)).toBe(true)
    expect(g.rim).not.toContain('NaN')
  })
})
