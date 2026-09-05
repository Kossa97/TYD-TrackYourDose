import type { StageFormSpec } from '../../stage/types'

// Streifen mit ganz runden Enden — der Radius ist die halbe Höhe, damit die
// Enden echte Halbkreise sind und keine abgerundeten Ecken. Die viewBox ist
// auf die Objektgrenzen beschnitten.
export const PATCH_VIEWBOX = { x: 0, y: 0, width: 300, height: 88 } as const
export const PATCH_ASPECT = PATCH_VIEWBOX.width / PATCH_VIEWBOX.height

export const PATCH_BODY = {
  x: 0,
  y: 0,
  width: 300,
  height: 88,
  rx: 44,
} as const

// Das Wundkissen sitzt mittig und ist die Fläche, auf der der Name steht —
// dieselbe Rolle wie der Bildschirm beim Pen.
const PAD_WIDTH = 104
const PAD_HEIGHT = 54
export const PATCH_PAD = {
  x: (PATCH_BODY.width - PAD_WIDTH) / 2,
  y: (PATCH_BODY.height - PAD_HEIGHT) / 2,
  width: PAD_WIDTH,
  height: PAD_HEIGHT,
  rx: 5,
} as const

// Bewusst ohne Farbfeld: ein Pflaster ist hautfarben, und ein farbiger Balken
// darauf war der eine Fremdkoerper im Bild. Damit hat color_hex auf dieser
// Form keinen Platz — sie ist die einzige, die ohne auskommt.
export const PATCH_NAME_ZONE = {
  left: PATCH_PAD.x + 6,
  right: PATCH_PAD.x + PATCH_PAD.width - 6,
  top: PATCH_PAD.y + 5,
  bottom: PATCH_PAD.y + PATCH_PAD.height - 5,
} as const

export const PATCH_NAME_PCT = {
  left: (PATCH_NAME_ZONE.left - PATCH_VIEWBOX.x) / PATCH_VIEWBOX.width,
  top: (PATCH_NAME_ZONE.top - PATCH_VIEWBOX.y) / PATCH_VIEWBOX.height,
  width: (PATCH_NAME_ZONE.right - PATCH_NAME_ZONE.left) / PATCH_VIEWBOX.width,
  height: (PATCH_NAME_ZONE.bottom - PATCH_NAME_ZONE.top) / PATCH_VIEWBOX.height,
} as const

// Die Lochung. Sie wird gerechnet statt gezeichnet: versetzte Reihen, und
// jedes Loch, das auf dem Kissen oder jenseits der runden Enden läge, fällt
// heraus. Ohne die zweite Prüfung säßen Löcher außerhalb des Umrisses.
export const PATCH_DOT_R = 2.2
const DOT_MARGIN = 6
const DOT_ROWS = [18, 35, 53, 70]
const DOT_STEP = 16

export const PATCH_DOTS: readonly { x: number; y: number }[] = DOT_ROWS.flatMap((y, reihe) => {
  const punkte: { x: number; y: number }[] = []
  for (let x = 12 + (reihe % 2) * (DOT_STEP / 2); x <= PATCH_BODY.width - 12; x += DOT_STEP) {
    const aufDemKissen =
      x > PATCH_PAD.x - DOT_MARGIN &&
      x < PATCH_PAD.x + PATCH_PAD.width + DOT_MARGIN &&
      y > PATCH_PAD.y - DOT_MARGIN &&
      y < PATCH_PAD.y + PATCH_PAD.height + DOT_MARGIN
    if (aufDemKissen) continue

    // In den Halbkreisen an den Enden zählt der Abstand zur Kappenmitte.
    const kappe =
      x < PATCH_BODY.rx
        ? PATCH_BODY.rx
        : x > PATCH_BODY.width - PATCH_BODY.rx
          ? PATCH_BODY.width - PATCH_BODY.rx
          : null
    if (kappe !== null) {
      const abstand = Math.hypot(x - kappe, y - PATCH_BODY.height / 2)
      if (abstand > PATCH_BODY.rx - DOT_MARGIN) continue
    }

    punkte.push({ x, y })
  }
  return punkte
})

// Wie weit der Schimmer beim Wischen wandert.
export const PATCH_SHEEN_SHIFT = 34

// Der Streifen liegt auf der Bühne, statt in ihr zu schweben. Der Schatten
// steht knapp unter der Unterkante und wandert dem Licht entgegen.
export const PATCH_GROUND = {
  cx: PATCH_BODY.width / 2,
  cy: PATCH_BODY.height + 7,
  rx: PATCH_BODY.width / 2 - 12,
  ry: 6,
} as const
export const PATCH_GROUND_SHIFT = 10

// Die Lochung sind Löcher, keine weißen Punkte: unter jedem hellen Kreis
// liegt ein dunkler, leicht nach unten rechts versetzt — das ist der Schatten
// in der Lochwand, gegenüber der Lichtseite oben links.
export const PATCH_HOLE_OFFSET = { x: 0.4, y: 0.55 } as const

// Beim Wischen biegt sich der Streifen. Nicht in Teilen: er ist EIN Umriss,
// der durchgehend verformt wird. Drei starre Abschnitte gegeneinander zu
// drehen ergab einen sichtbaren Knick in der Kontur — die Fläche liess sich
// abdecken, der Sprung in der Linie nicht.
export const PATCH_BEND_MAX = 7
export const PATCH_FLEX_CUT = { left: 95, right: 205 } as const

// Auslenkungsprofil eines einseitig eingespannten Balkens: quadratisch mit
// dem Abstand vom Einspannpunkt. Am Einspannpunkt ist es null UND hat dort
// die Steigung null — genau deshalb geht die Biegung ohne Knick in das
// ruhende Mittelstueck ueber.
export const patchBiegung = (x: number) => {
  const l = PATCH_FLEX_CUT.left
  const r = PATCH_FLEX_CUT.right
  return {
    gL: x < l ? ((l - x) / l) ** 2 : 0,
    gR: x > r ? ((x - r) / (PATCH_BODY.width - r)) ** 2 : 0,
  }
}

// Der Umriss wird als Punktfolge abgelegt, damit er sich Bild fuer Bild neu
// zusammensetzen laesst. Die Kappen sind echte Halbkreise, in 10-Grad-
// Schritten abgetastet: der Sehnenfehler bleibt unter 0,2 Einheiten.
const umriss = (einzug: number) => {
  const links = einzug
  const rechts = PATCH_BODY.width - einzug
  const oben = einzug
  const unten = PATCH_BODY.height - einzug
  const r = PATCH_BODY.rx - einzug
  const mitte = PATCH_BODY.height / 2
  const punkte: { x: number; y: number }[] = []

  for (let x = links + r; x <= rechts - r; x += 14) punkte.push({ x, y: oben })
  punkte.push({ x: rechts - r, y: oben })
  for (let grad = -90; grad <= 90; grad += 10) {
    const bogen = (grad * Math.PI) / 180
    punkte.push({ x: rechts - r + Math.cos(bogen) * r, y: mitte + Math.sin(bogen) * r })
  }
  for (let x = rechts - r; x >= links + r; x -= 14) punkte.push({ x, y: unten })
  punkte.push({ x: links + r, y: unten })
  for (let grad = 90; grad <= 270; grad += 10) {
    const bogen = (grad * Math.PI) / 180
    punkte.push({ x: links + r + Math.cos(bogen) * r, y: mitte + Math.sin(bogen) * r })
  }
  return punkte.map(pt => ({ ...pt, ...patchBiegung(pt.x) }))
}

export const PATCH_OUTLINE = umriss(0)
export const PATCH_OUTLINE_INNER = umriss(1.2)

// Auch jedes Loch traegt sein Gewicht: es wandert mit der Stelle, an der es
// sitzt. Blieben die Loecher liegen, waere die Biegung sofort als Trick zu
// erkennen.
export const PATCH_DOTS_BEND = PATCH_DOTS.map(pt => ({ ...pt, ...patchBiegung(pt.x) }))

export const PATCH_FLUTTER = {
  left: { steifigkeit: 150, daempfung: 9 },
  right: { steifigkeit: 190, daempfung: 8 },
} as const

// Unterhalb davon ist die Bewegung nicht mehr zu sehen und die Schleife hält
// an, statt für immer Bilder zu rechnen.
export const PATCH_FLUTTER_RUHE = { winkel: 0.01, tempo: 0.05 } as const

export const PATCH_SPEC: StageFormSpec = {
  viewBox: PATCH_VIEWBOX,
  // Kein Behälter, keine Flüssigkeit: weder Etikettband noch Füllstand.
  chamber: null,
  hasMeaningfulFill: false,
}
