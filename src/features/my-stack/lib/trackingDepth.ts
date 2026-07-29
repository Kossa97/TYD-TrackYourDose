import type { TrackingLevel } from '../types'

export interface TrackingCapabilities {
  quantity: boolean
  titration: boolean
  productStrength: boolean
  pk: boolean
  inventory: boolean
}

const CAPABILITIES: Record<TrackingLevel, TrackingCapabilities> = {
  intake_only: {
    quantity: false,
    titration: false,
    productStrength: false,
    pk: false,
    inventory: false,
  },
  with_amount: {
    quantity: true,
    titration: true,
    productStrength: false,
    pk: false,
    inventory: false,
  },
  complete: {
    quantity: true,
    titration: true,
    productStrength: true,
    pk: true,
    inventory: true,
  },
}

export function trackingCapabilities(level: TrackingLevel): TrackingCapabilities {
  return CAPABILITIES[level]
}
