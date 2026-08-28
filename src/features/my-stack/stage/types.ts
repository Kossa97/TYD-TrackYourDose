export interface StageBox {
  x: number
  y: number
  width: number
  height: number
}

export interface StageChamber extends StageBox {
  // The rendered chamber's width / height in px. Drives how steeply the surface
  // tilts, so a narrow form does not slosh more violently than a wide one.
  aspect: number
}

export interface StageFormSpec {
  viewBox: StageBox
  // null for forms that hold no liquid — tablet, capsule, patch.
  chamber: StageChamber | null
  // Whether this form's fill level says anything. A vial is drawn down over
  // weeks; a sealed ampoule is either full or gone.
  hasMeaningfulFill: boolean
}

// A container that holds liquid wears our label; nothing else does. Derived
// from the chamber rather than tracked separately, so the two can never drift
// apart: there is no label without liquid and no liquid without a label.
export function carriesLabel(spec: StageFormSpec): boolean {
  return spec.chamber !== null
}
