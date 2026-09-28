import { MARKER_CATALOG } from '../../blutwerte/lib/markerCatalog'

export interface MedicalUnit {
  id: string
  family: string
  factor: number
  label?: string
}

// Factors refer to one base unit per family, never across dimensions.
const family = (name: string, factors: Record<string, number>): MedicalUnit[] =>
  Object.entries(factors).map(([id, factor]) => ({ id, family: name, factor }))

export const MEDICAL_UNITS: MedicalUnit[] = [
  ...family('mass', { mg: 1e-3, mcg: 1e-6, g: 1, kg: 1e3, ng: 1e-9, pg: 1e-12 }),
  ...family('volume', { mL: 1e-3, 'µL': 1e-6, L: 1, dL: 0.1, nL: 1e-9, pL: 1e-12, fL: 1e-15 }),
  ...family('mass_concentration', {
    'mg/dL': 0.01, 'mg/mL': 1, 'mg/L': 0.001, 'g/dL': 10, 'g/L': 1,
    'µg/dL': 1e-5, 'µg/mL': 0.001, 'µg/L': 1e-6,
    'ng/dL': 1e-8, 'ng/mL': 1e-6, 'ng/L': 1e-9, 'pg/mL': 1e-9, 'pg/dL': 1e-11,
  }),
  ...family('molar_concentration', { 'mmol/L': 1e-3, 'µmol/L': 1e-6, 'nmol/L': 1e-9, 'pmol/L': 1e-12, 'mol/L': 1 }),
  ...family('activity', { IU: 1, mIU: 1e-3, 'µIU': 1e-6 }),
  ...family('activity_concentration', { 'IU/L': 1, 'IU/mL': 1e3, 'mIU/L': 1e-3, 'mIU/mL': 1, 'µIU/mL': 1e-3 }),
  // 1 U = 1 µmol/min = 1/60 µkat (enzyme activity, not biological IU).
  ...family('enzyme', { 'U/L': 1, 'µkat/L': 60, 'nkat/L': 0.06, 'kU/L': 1000 }),
  ...family('cells', { '/nL': 1e9, '/µL': 1e6, '10^9/L': 1e9, 'Mio/µL': 1e12, '10^12/L': 1e12 }),
  ...family('fraction', { '%': 0.01, fraction: 1 }),
  ...family('filtration', { 'mL/min/1.73m²': 1, 'mL/s/1.73m²': 60 }),
  ...family('sedimentation', { 'mm/h': 1, 'cm/h': 10 }),
  { id: 'hba1c-percent', family: 'hba1c', factor: 1, label: '% (NGSP)' },
  { id: 'hba1c-mmol', family: 'hba1c', factor: 1, label: 'mmol/mol (IFCC)' },
  { id: 'scale', family: 'syringe', factor: 1 },
]

export const UNIT_FAMILIES = [...new Set(MEDICAL_UNITS.map(unit => unit.family))]
export const BLOOD_MARKERS = MARKER_CATALOG.filter(marker => marker.einheit)
export const CONVERSION_SOURCES = {
  mayo: 'https://www.mayocliniclabs.com/order-tests/si-unit-conversion.html',
  labcorp: 'https://www.labcorp.com/test-menu/resources/si-unit-conversion-table',
  ngsp: 'https://ngsp.org/ifcc.asp',
  urea: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11867516/',
}

interface MarkerBridge {
  from: string
  to: string
  factor: number
  source: keyof typeof CONVERSION_SOURCES
}

// Published conventional → SI factors, reviewed 2026-09-28. Reverse conversions
// divide by the same factor, avoiding inconsistent rounded reciprocal tables.
// No generic bridges for Lp(a), protein hormones or biological IU → mass/moles.
export const MARKER_BRIDGES: Record<string, MarkerBridge> = {
  'Glukose': { from: 'mg/dL', to: 'mmol/L', factor: 0.0555, source: 'labcorp' },
  'Cholesterin gesamt': { from: 'mg/dL', to: 'mmol/L', factor: 0.0259, source: 'labcorp' },
  'LDL-Cholesterin': { from: 'mg/dL', to: 'mmol/L', factor: 0.0259, source: 'labcorp' },
  'HDL-Cholesterin': { from: 'mg/dL', to: 'mmol/L', factor: 0.0259, source: 'labcorp' },
  'Triglyceride': { from: 'mg/dL', to: 'mmol/L', factor: 0.0113, source: 'mayo' },
  'Kreatinin': { from: 'mg/dL', to: 'µmol/L', factor: 88.4, source: 'labcorp' },
  'Harnstoff': { from: 'mg/dL', to: 'mmol/L', factor: 0.1665, source: 'urea' },
  'Harnsäure': { from: 'mg/dL', to: 'µmol/L', factor: 59.48, source: 'urea' },
  'Bilirubin gesamt': { from: 'mg/dL', to: 'µmol/L', factor: 17.1, source: 'labcorp' },
  'Testosteron': { from: 'ng/dL', to: 'nmol/L', factor: 0.0347, source: 'mayo' },
  'Freies Testosteron': { from: 'ng/dL', to: 'pmol/L', factor: 34.672, source: 'mayo' },
  'Östradiol': { from: 'pg/mL', to: 'pmol/L', factor: 3.671, source: 'mayo' },
  'Kortisol': { from: 'µg/dL', to: 'nmol/L', factor: 27.6, source: 'mayo' },
  'DHEA-S': { from: 'µg/dL', to: 'µmol/L', factor: 0.027, source: 'mayo' },
  'Progesteron': { from: 'ng/mL', to: 'nmol/L', factor: 3.18, source: 'mayo' },
  'fT3': { from: 'pg/mL', to: 'pmol/L', factor: 1.54, source: 'mayo' },
  'fT4': { from: 'ng/dL', to: 'pmol/L', factor: 12.87, source: 'mayo' },
  // Vitamin D refers specifically to the app's 25-OH total vitamin D marker.
  'Vitamin D': { from: 'ng/mL', to: 'nmol/L', factor: 2.496, source: 'mayo' },
  'Vitamin B12': { from: 'ng/mL', to: 'pmol/L', factor: 738, source: 'labcorp' },
  'Folsäure': { from: 'ng/mL', to: 'nmol/L', factor: 2.265, source: 'labcorp' },
  'Eisen': { from: 'µg/dL', to: 'µmol/L', factor: 0.179, source: 'labcorp' },
  'Magnesium': { from: 'mg/dL', to: 'mmol/L', factor: 0.4114, source: 'labcorp' },
  'Kalzium': { from: 'mg/dL', to: 'mmol/L', factor: 0.25, source: 'mayo' },
  'Zink': { from: 'µg/dL', to: 'µmol/L', factor: 0.153, source: 'labcorp' },
}

export function medicalUnit(id: string): MedicalUnit {
  const unit = MEDICAL_UNITS.find(unit => unit.id === id)
  if (!unit) throw new Error('invalid_unit')
  return unit
}

export function defaultMarkerUnit(marker: string): string {
  if (marker === 'HbA1c') return 'hba1c-percent'
  return BLOOD_MARKERS.find(item => item.name === marker)?.einheit ?? 'mg'
}

export function unitsForMarker(marker = ''): MedicalUnit[] {
  if (!marker) return MEDICAL_UNITS
  if (!BLOOD_MARKERS.some(item => item.name === marker)) return []
  const baseFamily = medicalUnit(defaultMarkerUnit(marker)).family
  const bridge = MARKER_BRIDGES[marker]
  const families = bridge ? [medicalUnit(bridge.from).family, medicalUnit(bridge.to).family] : [baseFamily]
  return MEDICAL_UNITS.filter(unit => families.includes(unit.family))
}

export function compatibleUnits(from: string, marker = ''): MedicalUnit[] {
  const source = medicalUnit(from)
  const available = unitsForMarker(marker)
  if (!available.some(unit => unit.id === from)) return []
  const bridge = MARKER_BRIDGES[marker]
  return available.filter(unit => unit.family === source.family
    || (!!bridge && ['mass_concentration', 'molar_concentration'].includes(source.family)
      && ['mass_concentration', 'molar_concentration'].includes(unit.family))
    || (!marker && ['volume', 'syringe'].includes(source.family) && ['volume', 'syringe'].includes(unit.family)))
}

export function convertMedicalUnit(
  value: number, from: string, to: string, marker = '',
  syringe?: { ml: number; units: number },
): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('invalid_value')
  if (!compatibleUnits(from, marker).some(unit => unit.id === to)) throw new Error('incompatible_units')
  const source = medicalUnit(from)
  const target = medicalUnit(to)
  let result: number
  if (from === to) result = value
  else if (source.family === 'hba1c') {
    // NGSP = 0.09148 × IFCC + 2.152; these are distinct reporting systems.
    result = from === 'hba1c-percent' ? (value - 2.152) / 0.09148 : value * 0.09148 + 2.152
  } else if (source.family === 'syringe' || target.family === 'syringe') {
    if (!syringe || !Number.isFinite(syringe.ml) || syringe.ml <= 0
      || !Number.isFinite(syringe.units) || syringe.units <= 0) throw new Error('invalid_syringe')
    result = source.family === 'syringe'
      ? value * (syringe.ml / syringe.units * 0.001 / target.factor)
      : value * (source.factor / 0.001 * syringe.units / syringe.ml)
  } else if (source.family === target.family) result = value * (source.factor / target.factor)
  else {
    const bridge = MARKER_BRIDGES[marker]
    const ratio = medicalUnit(bridge.to).factor / medicalUnit(bridge.from).factor * bridge.factor
    result = value * ((source.factor / target.factor) * (source.family === 'mass_concentration' ? ratio : 1 / ratio))
  }
  if (!Number.isFinite(result) || result < 0 || (value > 0 && result === 0 && source.family !== 'hba1c')) {
    throw new Error('numeric_range')
  }
  return result
}
