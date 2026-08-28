import type { StageFormSpec } from '../../stage/types'

// The vial's stage description. The shell itself still lives in
// PeptideVialVisual; this is what the stage needs to know about the form.
export const VIAL_SPEC: StageFormSpec = {
  viewBox: { x: 0, y: 0, width: 120, height: 294 },
  chamber: { x: 4, y: 36, width: 112, height: 247, aspect: 0.794 },
  // A vial is drawn down over weeks, so its fill level says something.
  hasMeaningfulFill: true,
}
