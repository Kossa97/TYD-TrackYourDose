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

// Beim Wischen biegen sich die beiden Enden gegenläufig, die Mitte mit dem
// Kissen bleibt ruhig — ein Pflaster ist biegsam, sein Kissen nicht. Dafür
// wird der Streifen in drei Abschnitte geschnitten; die Enden drehen um einen
// Angelpunkt, der unter dem Mittelstück liegt, damit die Schnittkante nie
// sichtbar wird.
export const PATCH_FLEX_MAX_DEG = 3.5
export const PATCH_PIVOT_Y = PATCH_BODY.height / 2
export const PATCH_FLEX_CUT = { left: 95, right: 205 } as const

// Das Mittelstück überlappt beide Schnitte und wird zuletzt gezeichnet.
export const PATCH_FLEX_CLIPS = {
  left: { x: -30, width: PATCH_FLEX_CUT.left + 30 },
  right: { x: PATCH_FLEX_CUT.right, width: PATCH_BODY.width - PATCH_FLEX_CUT.right + 30 },
  middle: { x: PATCH_FLEX_CUT.left - 4, width: PATCH_FLEX_CUT.right - PATCH_FLEX_CUT.left + 8 },
} as const

// Die Enden hängen nicht starr am Kippwinkel, sondern schwingen nach: jedes
// an einer eigenen Feder. Unterschiedliche Steifigkeit heißt unterschiedliche
// Eigenfrequenz — sonst wackelten beide im Gleichtakt, und das sähe nach
// einem Scharnier aus statt nach Flattern.
// Dämpfungsgrad = daempfung / (2 * sqrt(steifigkeit)): 0,37 links und 0,29
// rechts, beide deutlich unter 1 und damit schwingend statt kriechend.
export const PATCH_FLUTTER = {
  left: { steifigkeit: 150, daempfung: 9 },
  right: { steifigkeit: 190, daempfung: 8 },
} as const

// Unterhalb davon ist die Bewegung nicht mehr zu sehen und die Schleife hält
// an, statt für immer Bilder zu rechnen.
export const PATCH_FLUTTER_RUHE = { winkel: 0.01, tempo: 0.05 } as const

// Jedes Loch gehört zu genau einem Abschnitt und wird mit ihm bewegt.
export const PATCH_DOTS_LEFT = PATCH_DOTS.filter(p => p.x <= PATCH_FLEX_CUT.left)
export const PATCH_DOTS_RIGHT = PATCH_DOTS.filter(p => p.x >= PATCH_FLEX_CUT.right)

export const PATCH_SPEC: StageFormSpec = {
  viewBox: PATCH_VIEWBOX,
  // Kein Behälter, keine Flüssigkeit: weder Etikettband noch Füllstand.
  chamber: null,
  hasMeaningfulFill: false,
}
