import type { CSSProperties } from 'react'

export const PANEL_STYLE: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 20,
}

export const CYAN = 'var(--accent)'
export const TEXT = 'var(--text)'
export const MUTED = 'var(--text-muted)'
export const GREEN = '#10b981'
export const RED = '#ef4444'
/** Rot als Flaeche — fuer Auffaelliges. */
export const RED_WEAK = 'rgba(239,68,68,0.15)'
/**
 * Flaechen der Plaketten in der Uebersicht. Dunkler als GREEN/RED, damit
 * weisse Schrift darauf lesbar bleibt (Kontrast >= 4,5:1).
 */
export const PILL_GREEN = '#15803d'
export const PILL_RED = '#dc2626'
export const PILL_GRAY = '#475569'
