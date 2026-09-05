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
  // The region that holds visible contents. null for forms that show none —
  // tablet, capsule, patch, tube, powder. Not the same as „holds liquid": the
  // gel jar has one and uses no liquid physics at all.
  chamber: StageChamber | null
  // Whether this form's fill level says anything. A vial is drawn down over
  // weeks; a sealed ampoule is either full or gone.
  hasMeaningfulFill: boolean
}

// A container that shows its contents wears our label; nothing else does.
// Derived from the chamber rather than tracked separately, so the two can never
// drift apart: no label without visible contents, and none of them without a
// label. Opaque forms print their name on the body instead.
export function carriesLabel(spec: StageFormSpec): boolean {
  return spec.chamber !== null
}
