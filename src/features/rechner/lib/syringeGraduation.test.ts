import { expect, it } from 'vitest'
import { getSyringeGraduation } from './syringeGraduation'

it.each([
  [30, 1, 5], [50, 1, 5], [100, 2, 10], [30, 0.5, 5],
  [40, 1, 5], [200, 1, 20], [7.5, 0.25, 1.25], [0.3, 0.1, 0.1],
])('uses explicit step %s / %s and groups numbered marks at %s', (capacity, step, major) => {
  expect(getSyringeGraduation(capacity, step)).toEqual({ minorStep: step, majorStep: major })
})

it.each([
  [30, null], [30, 0], [30, -1], [30, NaN], [30, Infinity], [30, 31],
  [30, 4], [30, 0.1], [201, 1], [1e300, 1e-300],
  [0, 1], [-1, 1], [NaN, 1], [Infinity, 1],
])('omits graduations for invalid or unsupported capacity %s / step %s', (capacity, step) => {
  expect(getSyringeGraduation(capacity, step)).toEqual({ minorStep: null, majorStep: null })
})

it('tolerates floating-point error while rejecting a non-integral interval count', () => {
  expect(getSyringeGraduation(0.3, 0.1).minorStep).toBe(0.1)
  expect(getSyringeGraduation(30.000001, 1).minorStep).toBeNull()
})
