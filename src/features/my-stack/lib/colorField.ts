// Die Rechnung hinter dem Farbfeld. Sie steht hier und nicht in der Komponente,
// weil ein Rundungsfehler in einer Umrechnung sich nicht als Absturz zeigt,
// sondern als Griff, der beim Anfassen einen Schritt wegspringt.
//
// Innen HSV, nicht HSL: das Feld ist die klassische Flaeche aus Saettigung
// (nach rechts) und Helligkeit (nach oben), und die IST HSV. In HSL waere sie
// nicht rechteckig.

export interface HSV {
  /** 0..360 */
  h: number
  /** 0..1 */
  s: number
  /** 0..1 */
  v: number
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

export function hsvToHex({ h, s, v }: HSV): string {
  const hh = ((h % 360) + 360) % 360
  const ss = clamp01(s)
  const vv = clamp01(v)
  const c = vv * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = vv - c
  const [r, g, b] = hh < 60 ? [c, x, 0]
    : hh < 120 ? [x, c, 0]
      : hh < 180 ? [0, c, x]
        : hh < 240 ? [0, x, c]
          : hh < 300 ? [x, 0, c]
            : [c, 0, x]
  const kanal = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${kanal(r)}${kanal(g)}${kanal(b)}`
}

// Akzeptiert #rgb und #rrggbb. Alles andere ist kein Farbwert — waehrend des
// Tippens steht in einem Feld jeder Zwischenstand, und ein halber Hex-Wert
// darf den Griff nicht auf Schwarz ziehen.
export function hexToHsv(hex: string): HSV | null {
  const roh = hex.trim().toLowerCase()
  const kurz = /^#([0-9a-f]{3})$/.exec(roh)
  const lang = /^#([0-9a-f]{6})$/.exec(roh)
  if (!kurz && !lang) return null
  const voll = kurz ? kurz[1].split('').map(z => z + z).join('') : lang![1]
  const [r, g, b] = [0, 2, 4].map(i => parseInt(voll.slice(i, i + 2), 16) / 255)

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) h = ((b - r) / d + 2) * 60
    else h = ((r - g) / d + 4) * 60
  }

  return { h, s: max === 0 ? 0 : d / max, v: max }
}

// Wo ein Griff liegt, wenn ein Zeiger an Stelle x eines Feldes der Breite w
// aufsetzt. Auch ausserhalb: wer ueber den Rand hinauszieht, bleibt am Rand
// haengen, statt dass der Wert springt.
export function anteil(position: number, start: number, laenge: number): number {
  if (!Number.isFinite(laenge) || laenge <= 0) return 0
  return clamp01((position - start) / laenge)
}

// Unsere eigenen Farbtoene, als Marken auf der Farbtonschiene. Sie schraenken
// nichts ein — sie zeigen nur, wo die Farben der App liegen.
export const MARKEN_FARBTOENE = [
  { name: 'amber', h: 37.7 },
  { name: 'emerald', h: 160.1 },
  { name: 'accent', h: 190.0 },
  { name: 'violet', h: 258.3 },
  { name: 'rose', h: 349.7 },
] as const

// Der Startpunkt, wenn noch keine Farbe gesetzt ist: unser Akzent. Kein
// Zufallston und kein Grau — die App hat eine Farbe, und das ist sie.
export const FELD_START: HSV = { h: 190, s: 1, v: 0.96 }
