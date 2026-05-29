// Feature-Flags für TYD Release Management
// true  = sichtbar für Nutzer (release-ready)
// false = versteckt (noch in Entwicklung)

export const FEATURES = {
  // ✅ Release v1.0 — aktiv
  SIMULATION_SINGLE_DOSE: true,
  LIVE_BLUTSPIEGEL_CAROUSEL: true,
  PUSH_NOTIFICATIONS: true,
  ABLAUF_WARNUNGEN: true,
  BEFINDLICHKEIT_LOG: true,
  INJEKTIONEN: true,
  THE_LAB: true,
  PEPTIPEDIA: true,

  // 🚧 Post-release — versteckt bis fertig
  LIVE_VERLAUF_CHART: false,
  FOTO_PROGRESS: false,
  PAYWALL: false,
  ZYKLUS_VERGLEICH: false,
} as const

export type FeatureFlag = keyof typeof FEATURES
