export type MassUnit = 'g' | 'mg' | 'mcg'
export type VolumeUnit = 'ml' | 'ul'

function validateValue(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error('invalid_value')
}

function checkedResult(value: number): number {
  if (!Number.isFinite(value)) throw new Error('numeric_range')
  return value
}

export function convertMass(value: number, from: MassUnit, to: MassUnit): number {
  validateValue(value)
  const factors = { g: 1000000, mg: 1000, mcg: 1 }
  if (!Object.hasOwn(factors, from) || !Object.hasOwn(factors, to)) throw new Error('invalid_unit')
  return checkedResult(value * (factors[from] / factors[to]))
}

export function convertVolume(value: number, from: VolumeUnit, to: VolumeUnit): number {
  validateValue(value)
  const factors = { ml: 1000, ul: 1 }
  if (!Object.hasOwn(factors, from) || !Object.hasOwn(factors, to)) throw new Error('invalid_unit')
  return checkedResult(value * (factors[from] / factors[to]))
}

export function convertSyringe(value: number, direction: 'ml-to-units' | 'units-to-ml', capacityMl: number, capacityUnits: number): number {
  validateValue(value)
  if (!Number.isFinite(capacityMl) || capacityMl <= 0 || !Number.isFinite(capacityUnits) || capacityUnits <= 0) {
    throw new Error('invalid_syringe')
  }
  if (direction !== 'ml-to-units' && direction !== 'units-to-ml') throw new Error('invalid_direction')
  if (value === 0) return 0
  const ratio = direction === 'ml-to-units' ? capacityUnits / capacityMl : capacityMl / capacityUnits
  return checkedResult(value * ratio)
}

export function parseDecimalInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatCalculatorNumber(value: number, language: string): string {
  if (!Number.isFinite(value)) throw new Error('numeric_range')
  return new Intl.NumberFormat(language.startsWith('de') ? 'de-DE' : 'en-US', {
    maximumSignificantDigits: 6,
    useGrouping: false,
  }).format(value)
}
