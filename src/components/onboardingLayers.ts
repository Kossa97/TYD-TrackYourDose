/** Stacking order during onboarding — panel is always on top and interactive. */
export const OB_Z = {
  scrim: 10_000,
  nav: 10_030,
  target: 10_032,
  appModal: 10_040,
  /** Ring must be above nav (10030) and modal (10040) so it's always visible — pointer-events:none so clicks pass through */
  ring: 10_045,
  /** Tour card — must stay above everything */
  panel: 10_050,
} as const
