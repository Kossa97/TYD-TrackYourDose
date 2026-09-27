export interface ReconstitutionInput {
  vialAmountMg: number
  diluentMl: number
  targetDose: number
  targetUnit: 'mcg' | 'mg'
  syringeCapacityMl: number
  syringeUnits: number
}

export function calculateReconstitution(input: ReconstitutionInput) {
  for (const field of ['vialAmountMg', 'diluentMl', 'targetDose', 'syringeCapacityMl', 'syringeUnits'] as const) {
    if (!Number.isFinite(input[field]) || input[field] <= 0) throw new Error(field)
  }
  if (input.targetUnit !== 'mg' && input.targetUnit !== 'mcg') throw new Error('targetUnit')
  const targetMcg = input.targetUnit === 'mg' ? input.targetDose * 1000 : input.targetDose
  const totalMcg = input.vialAmountMg * 1000
  if (targetMcg > totalMcg) throw new Error('target_exceeds_vial')
  const concentrationMcgPerMl = totalMcg / input.diluentMl
  let drawMl = targetMcg / concentrationMcgPerMl
  if (drawMl > input.syringeCapacityMl) {
    // Allow only floating-point noise at the capacity boundary.
    const tolerance = Number.EPSILON * 8 * input.syringeCapacityMl
    if (drawMl - input.syringeCapacityMl > tolerance) throw new Error('target_exceeds_syringe_capacity')
    drawMl = input.syringeCapacityMl
  }
  const drawUnits = drawMl * input.syringeUnits / input.syringeCapacityMl
  const dosesPerVial = Math.floor(totalMcg / targetMcg)
  if (![targetMcg, totalMcg, concentrationMcgPerMl, drawMl, drawUnits, dosesPerVial].every(value => Number.isFinite(value) && value > 0)) throw new Error('numeric_range')
  return { concentrationMcgPerMl, drawMl, drawUnits, dosesPerVial }
}
