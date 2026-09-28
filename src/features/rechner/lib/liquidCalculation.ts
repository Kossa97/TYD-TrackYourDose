import { convertMass, parseDecimalInput } from './units'

export type LiquidUnit = 'mg' | 'mcg' | 'g' | 'iu'
export type TargetUnit = LiquidUnit | 'ml'
export type LiquidValues = {
  mode: 'amount' | 'concentration'
  amount: string
  volume: string
  concentration: string
  container: string
  target: string
  frequency: string
  sourceUnit: LiquidUnit
  targetUnit: TargetUnit
  capacityMl: string
  capacityUnits: string
}

type InputField = 'amount' | 'volume' | 'concentration' | 'container' | 'target' | 'frequency' | 'capacityMl' | 'capacityUnits'
type FieldError = 'positive' | 'numeric_range'
type LiquidResult = {
  concentration: number | null
  drawMl: number | null
  drawUnits: number | null
  fullWithdrawals: number | null
  days: number | null
  error: FieldError | 'incompatible_units' | 'exceeds_container' | 'exceeds_syringe' | null
  fieldErrors: Partial<Record<InputField, FieldError>>
  concentrationError: boolean
}

const positiveFinite = (value: number) => Number.isFinite(value) && value > 0
const baseFactor = (unit: LiquidUnit) => unit === 'iu' ? 1 : convertMass(1, unit, 'mg')

// Try alternate evaluation orders when an intermediate overflows or underflows.
function scaledRatio(value: number, multiplier: number, divisor: number): number | null {
  for (const result of [value / divisor * multiplier, value * multiplier / divisor, value * (multiplier / divisor)]) {
    if (positiveFinite(result)) return result
  }
  return null
}

export function convertLiquidValue(value: number, from: TargetUnit, to: TargetUnit, concentration: number | null): number | null {
  if (!positiveFinite(value)) return null
  if (from === to) return value
  if (from !== 'ml' && to !== 'ml') {
    if (from === 'iu' || to === 'iu') return null
    try {
      const converted = convertMass(value, from, to)
      return positiveFinite(converted) ? converted : null
    } catch {
      return null
    }
  }
  if (concentration === null || !positiveFinite(concentration)) return null
  return from === 'ml'
    ? scaledRatio(value, concentration, baseFactor(to as LiquidUnit))
    : scaledRatio(value, baseFactor(from), concentration)
}

function exceeds(value: number, limit: number): boolean {
  return value > limit && value - limit > Math.max(value, limit) * Number.EPSILON * 4
}

function completeWithdrawals(container: number, draw: number): number | null {
  const quotient = container / draw
  if (!Number.isFinite(quotient)) return null
  const nearest = Math.round(quotient)
  // Cap the tolerance so a large, genuinely fractional quotient is still floored.
  const tolerance = Math.min(1e-8, Math.abs(quotient) * Number.EPSILON * 4)
  const count = Math.abs(quotient - nearest) <= tolerance ? nearest : Math.floor(quotient)
  return Number.isSafeInteger(count) ? count : null
}

export function calculateLiquid(values: LiquidValues): LiquidResult {
  const result: LiquidResult = {
    concentration: null, drawMl: null, drawUnits: null, fullWithdrawals: null, days: null,
    error: null, fieldErrors: {}, concentrationError: false,
  }
  const read = (field: InputField): number | null => {
    const raw = values[field].trim()
    if (!raw) return null
    const parsed = parseDecimalInput(raw)
    if (parsed !== null && parsed > 0) return parsed
    const normalized = raw.replace(',', '.')
    const numeric = Number(normalized)
    const underflow = parsed === 0 && /[1-9]/.test(normalized.split(/[eE]/)[0])
    result.fieldErrors[field] = underflow || (!Number.isNaN(numeric) && !Number.isFinite(numeric)) ? 'numeric_range' : 'positive'
    return null
  }

  let container: number | null
  let concentrationProblem: FieldError | undefined
  if (values.mode === 'amount') {
    const amount = read('amount')
    container = read('volume')
    concentrationProblem = result.fieldErrors.amount ?? result.fieldErrors.volume
    if (amount !== null && container !== null) {
      result.concentration = scaledRatio(amount, baseFactor(values.sourceUnit), container)
      if (result.concentration === null) concentrationProblem = 'numeric_range'
    }
  } else {
    const concentration = read('concentration')
    container = read('container')
    concentrationProblem = result.fieldErrors.concentration
    if (concentration !== null) {
      result.concentration = scaledRatio(concentration, baseFactor(values.sourceUnit), 1)
      if (result.concentration === null) concentrationProblem = 'numeric_range'
    }
  }
  result.concentrationError = concentrationProblem !== undefined

  const target = read('target')
  const capacityMl = read('capacityMl')
  const capacityUnits = read('capacityUnits')
  const frequency = read('frequency')
  result.error = result.fieldErrors.target ?? result.fieldErrors.capacityMl ?? result.fieldErrors.capacityUnits ?? null
  if (values.targetUnit !== 'ml' && concentrationProblem) result.error ??= concentrationProblem
  if (result.error || target === null || capacityMl === null || capacityUnits === null) return result

  if (values.targetUnit !== 'ml' && (values.sourceUnit === 'iu') !== (values.targetUnit === 'iu')) {
    result.error = 'incompatible_units'
    return result
  }
  if (values.targetUnit !== 'ml' && result.concentration === null) return result
  let drawMl = values.targetUnit === 'ml' ? target : convertLiquidValue(target, values.targetUnit, 'ml', result.concentration)
  if (drawMl === null) {
    result.error = 'numeric_range'
    return result
  }
  if (container !== null && exceeds(drawMl, container)) {
    result.error = 'exceeds_container'
    return result
  }
  if (exceeds(drawMl, capacityMl)) {
    result.error = 'exceeds_syringe'
    return result
  }
  // Only remove accepted floating-point noise at the full-syringe boundary.
  // The diagram and the numeric result must agree that this fits the syringe.
  drawMl = Math.min(drawMl, capacityMl)
  const drawUnits = scaledRatio(drawMl, capacityUnits, capacityMl)
  if (drawUnits === null) {
    result.error = 'numeric_range'
    return result
  }
  result.drawMl = drawMl
  result.drawUnits = drawUnits
  if (container !== null) result.fullWithdrawals = completeWithdrawals(container, drawMl)
  if (result.fullWithdrawals !== null && frequency !== null) {
    result.days = result.fullWithdrawals === 0 ? 0 : scaledRatio(result.fullWithdrawals, 7, frequency)
  }
  return result
}
