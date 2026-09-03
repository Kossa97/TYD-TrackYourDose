import type { StageFormSpec } from '../../stage/types'

// Querformat: das Pflaster ist breit statt hoch und bricht damit bewusst mit
// der Größenleiter der stehenden Formen. Die viewBox ist auf die
// Objektgrenzen beschnitten.
export const PATCH_VIEWBOX = { x: 6, y: 6, width: 208, height: 132 } as const
export const PATCH_ASPECT = PATCH_VIEWBOX.width / PATCH_VIEWBOX.height

export const PATCH_BODY = { x: 6, y: 6, width: 208, height: 132, rx: 16 } as const

const RIGHT = PATCH_BODY.x + PATCH_BODY.width
const BOTTOM = PATCH_BODY.y + PATCH_BODY.height

// Die abgehobene Ecke sitzt oben rechts: erst sie macht das Pflaster auf einen
// Blick als solches erkennbar. Die Falzlinie läuft unter 45 Grad von A nach B,
// die Ecke dahinter fehlt dem Körper und liegt als Lasche gespiegelt auf ihm.
// Für ein rechtwinklig-gleichschenkliges Dreieck ist das Spiegelbild der
// rechtwinkligen Ecke an der Hypotenuse genau A + B - C.
export const PATCH_FOLD = 56
export const PATCH_FOLD_A = { x: RIGHT - PATCH_FOLD, y: PATCH_BODY.y } as const
export const PATCH_FOLD_B = { x: RIGHT, y: PATCH_BODY.y + PATCH_FOLD } as const
export const PATCH_FLAP_TIP = {
  x: PATCH_FOLD_A.x + PATCH_FOLD_B.x - RIGHT,
  y: PATCH_FOLD_A.y + PATCH_FOLD_B.y - PATCH_BODY.y,
} as const

export const PATCH_BODY_PATH =
  `M${PATCH_BODY.x + PATCH_BODY.rx} ${PATCH_BODY.y} ` +
  `L${PATCH_FOLD_A.x} ${PATCH_FOLD_A.y} ` +
  `L${PATCH_FOLD_B.x} ${PATCH_FOLD_B.y} ` +
  `L${RIGHT} ${BOTTOM - PATCH_BODY.rx} ` +
  `Q${RIGHT} ${BOTTOM} ${RIGHT - PATCH_BODY.rx} ${BOTTOM} ` +
  `L${PATCH_BODY.x + PATCH_BODY.rx} ${BOTTOM} ` +
  `Q${PATCH_BODY.x} ${BOTTOM} ${PATCH_BODY.x} ${BOTTOM - PATCH_BODY.rx} ` +
  `L${PATCH_BODY.x} ${PATCH_BODY.y + PATCH_BODY.rx} ` +
  `Q${PATCH_BODY.x} ${PATCH_BODY.y} ${PATCH_BODY.x + PATCH_BODY.rx} ${PATCH_BODY.y} Z`

export const PATCH_FLAP_PATH =
  `M${PATCH_FOLD_A.x} ${PATCH_FOLD_A.y} ` +
  `L${PATCH_FOLD_B.x} ${PATCH_FOLD_B.y} ` +
  `L${PATCH_FLAP_TIP.x} ${PATCH_FLAP_TIP.y} Z`

// Der Farbstreifen am unteren Rand ist die einzige Stelle, an der color_hex
// sichtbar wird — wie der Farbring beim Pen.
export const PATCH_STRIPE = { y: BOTTOM - 14, height: 14 } as const

// Der Name steht waagerecht unterhalb des Falzes. Anders als beim Pen muss er
// nicht gedreht werden, das Querformat gibt ihm die Breite dafür.
export const PATCH_NAME_ZONE = {
  top: PATCH_FOLD_B.y + 4,
  bottom: PATCH_STRIPE.y - 6,
  left: PATCH_BODY.x + 14,
  right: RIGHT - 14,
} as const

export const PATCH_NAME_PCT = {
  left: (PATCH_NAME_ZONE.left - PATCH_VIEWBOX.x) / PATCH_VIEWBOX.width,
  top: (PATCH_NAME_ZONE.top - PATCH_VIEWBOX.y) / PATCH_VIEWBOX.height,
  width: (PATCH_NAME_ZONE.right - PATCH_NAME_ZONE.left) / PATCH_VIEWBOX.width,
  height: (PATCH_NAME_ZONE.bottom - PATCH_NAME_ZONE.top) / PATCH_VIEWBOX.height,
} as const

// Wie weit der matte Schimmer und der Laschenschatten beim Wischen wandern.
export const PATCH_SHEEN_SHIFT = 26
export const PATCH_FLAP_SHADOW_SHIFT = 3

export const PATCH_SPEC: StageFormSpec = {
  viewBox: PATCH_VIEWBOX,
  // Kein Behälter, keine Flüssigkeit: weder Etikettband noch Füllstand.
  chamber: null,
  hasMeaningfulFill: false,
}
