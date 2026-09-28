export function getSyringeGraduation(capacityUnits: number, step: number | null): {
  minorStep: number | null
  majorStep: number | null
} {
  const unavailable = { minorStep: null, majorStep: null }
  if (!Number.isFinite(capacityUnits) || capacityUnits <= 0 || step === null
    || !Number.isFinite(step) || step <= 0 || step > capacityUnits) return unavailable

  const intervals = capacityUnits / step
  const count = Math.round(intervals)
  if (!Number.isFinite(intervals) || count < 1 || count > 200
    || Math.abs(intervals - count) > Number.EPSILON * Math.max(1, intervals) * 8) return unavailable

  const majorEvery = [1, 2, 5, 10, 20].find(value => value >= count / 10)!
  return { minorStep: step, majorStep: step * majorEvery }
}
