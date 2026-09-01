import { CAPSULE_ENGRAVING } from './capsuleShape'

export interface EngravingFit {
  text: string
  fontSize: number
  truncated: boolean
}

// Schmale Versalien laufen bei rund 0,52 der Schriftgröße pro Zeichen, dazu der
// Sperrsatz. Reicht für die Layoutentscheidung und braucht kein DOM.
export function estimateEngravingWidth(text: string, fontSize: number): number {
  return text.length * (fontSize * 0.52 + CAPSULE_ENGRAVING.letterSpacing)
}

// Erst schrumpfen, dann kürzen — und beim Kürzen keine Auslassungspunkte: eine
// Prägung endet einfach, sie kündigt nichts an.
export function fitEngraving(displayName: string): EngravingFit {
  const { maxWidth, maxFontSize, minFontSize } = CAPSULE_ENGRAVING
  const text = (displayName ?? '').trim().toUpperCase() || 'KAPSEL'

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 0.5) {
    if (estimateEngravingWidth(text, fontSize) <= maxWidth) {
      return { text, fontSize, truncated: false }
    }
  }

  let cut = text.length
  while (cut > 1 && estimateEngravingWidth(text.slice(0, cut), minFontSize) > maxWidth) cut--
  return { text: text.slice(0, cut).trimEnd(), fontSize: minFontSize, truncated: true }
}
