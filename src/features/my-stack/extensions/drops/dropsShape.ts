import type { StageFormSpec } from '../../stage/types'

// Tropfflasche mit Glaspipette, nach der Vorlage: schlanker Zylinder, kurze
// Schulter, hohe geriffelte Schraubkappe und darauf ein schmaler Gummisauger.
// Gezeichnet auf einem Raster von 100 x 300 Einheiten, die viewBox ist auf
// die Objektgrenzen beschnitten.
export const DROPS_VIEWBOX = { x: 14, y: 16, width: 72, height: 272 } as const
export const DROPS_ASPECT = DROPS_VIEWBOX.width / DROPS_VIEWBOX.height

// Die Durchmesser von oben nach unten. Der Sauger ist schmaler als die
// Kappe, die Kappe schmaler als der Körper und breiter als der Hals — genau
// diese Staffelung macht die Flasche auf einen Blick als Pipettenflasche
// lesbar. Die Einschnürung über dem Kappenrand ist die schmalste Stelle.
export const DROPS_WIDTHS = { waist: 19, teat: 28, neck: 24, cap: 48, body: 72 } as const

// Der Kopf ist ZWEITEILIG, wie in der Vorlage: ein Gummisauger auf einer
// geriffelten Schraubkappe. Das ist die Umkehr des einteiligen Gussstücks
// aus dem vorigen Durchgang — die Vorlage zeigt zwei Teile aus zwei
// Materialien, mattes Gummi über glatterem Kunststoff, mit einer sichtbaren
// Naht dazwischen.
//
// Die Proportion kommt ebenfalls von dort: eine kurze breite Kappe, ein
// deutlich höherer, schmalerer Sauger darüber. Die Kappe überdeckt den Hals
// (24) auf beiden Seiten um 12 Einheiten.
export const DROPS_TEAT = {
  top: 16,
  // Die sichtbare Naht: hier setzt der Kragen auf dem Kappenrand auf.
  seam: 86,
  // Der Sauger reicht darunter weiter, damit die Kappe die Verbindung
  // überdeckt. Ein stumpfer Stoß genau auf der Naht zeigt je nach Skalierung
  // eine Haarlinie — derselbe Grund, aus dem die Pipette in die Kappe
  // hineinreicht.
  bottom: 91,
  // Auf dieser Höhe ist der Sauger am breitesten — knapp unter der Kuppe,
  // von da an verjüngt er sich bis zur Einschnürung.
  widest: 32,
  waistY: 74,
} as const

// Ein geschlossener Umriss: Kuppe, Verjüngung, Einschnürung, und unten der
// kleine Kragen, mit dem der Sauger auf der Kappe aufsitzt.
//
// Das Verhältnis von Höhe zu Breite ist knapp 2,5 : 1 — schlanker wäre es
// ein Pinselgriff, nicht der Gummiball der Vorlage.
export const DROPS_TEAT_PATH =
  'M36 32 C36 15 64 15 64 32 ' +
  'C64 52 60 60 59.5 74 ' +
  'C59.5 81 63 81 63 86 ' +
  'L63 91 L37 91 L37 86 ' +
  'C37 81 40.5 81 40.5 74 ' +
  'C40 60 36 52 36 32 Z'

// Die Schraubkappe: kurz, breit, geriffelt, mit leicht gebrochenen Kanten.
export const DROPS_CAP = { x: 26, y: 86, width: 48, height: 26 } as const
export const DROPS_CAP_RADIUS = 2.5
export const DROPS_CAP_PATH =
  'M28.5 86 L71.5 86 C72.9 86 74 87.1 74 88.5 L74 109.5 ' +
  'C74 110.9 72.9 112 71.5 112 L28.5 112 C27.1 112 26 110.9 26 109.5 ' +
  'L26 88.5 C26 87.1 27.1 86 28.5 86 Z'

// Die flache Oberseite der Kappe rund um den Sauger. Sie zeigt nach oben,
// vom Licht weg, und ist deshalb dunkler als der Mantel — ohne diesen
// Streifen sähe die Kappe wie ein aufgeklebtes Rechteck aus.
export const DROPS_CAP_TOP_BAND = 5

// Die Riffelung sitzt nur auf dem Mantel, nicht auf der Oberseite und nicht
// auf den gebrochenen Kanten.
export const DROPS_CAP_RIB_YS = { top: 93, bottom: 109 } as const
export const DROPS_CAP_RIB_XS: readonly number[] =
  Array.from({ length: 17 }, (_, i) => Number((29.5 + i * 2.5625).toFixed(3)))

// Der Glanzpunkt auf der gewölbten Kuppe des Saugers.
export const DROPS_CAP_DOME = { cx: 50, cy: 34, rx: 9 } as const

// Aussen- und Innenkontur, wie beim Vial und der Ampulle. Die Wandstärke ist
// 5 % der Körperbreite.
export const DROPS_WALL = 3.6
export const DROPS_OUTER_PATH =
  'M38 112 L62 112 L62 128 C62 136 86 140 86 152 L86 278 ' +
  'C86 284 82 288 76 288 L24 288 C18 288 14 284 14 278 L14 152 ' +
  'C14 140 38 136 38 128 Z'
export const DROPS_INNER_PATH =
  'M41.6 116 L58.4 116 L58.4 130 C58.4 138.5 82.4 142 82.4 154 L82.4 276 ' +
  'C82.4 281 79 284.4 74 284.4 L26 284.4 C21 284.4 17.6 281 17.6 276 ' +
  'L17.6 154 C17.6 142 41.6 138.5 41.6 130 Z'

// Zum Beschneiden der Flüssigkeit braucht es den geschlossenen Pfad oben.
// Gezeichnet werden darf er so aber nicht: der Ringschluss ergäbe einen
// waagerechten Strich quer über den Hals. Die sichtbare Wandstärke ist
// deshalb ein OFFENER Pfad, dessen beide Enden oberhalb der Kappenunterkante
// liegen und von der Kappe verdeckt werden — die Linien laufen in den Deckel
// hinein, statt an einer Kante aufzuhören.
export const DROPS_INNER_STROKE_TOP = 104
export const DROPS_INNER_STROKE_PATH =
  `M41.6 ${DROPS_INNER_STROKE_TOP} L41.6 130 ` +
  'C41.6 138.5 17.6 142 17.6 154 L17.6 276 ' +
  'C17.6 281 21 284.4 26 284.4 L74 284.4 C79 284.4 82.4 281 82.4 276 ' +
  'L82.4 154 C82.4 142 58.4 138.5 58.4 130 ' +
  `L58.4 ${DROPS_INNER_STROKE_TOP}`

// Sauger, Kappe und Pipette sind EIN Teil: beim Aufschrauben kommt die
// Pipette mit heraus. Sie beginnt deshalb oberhalb der Kappenunterkante und
// wird von der Kappe überdeckt — so gibt es an der Verbindung keine Fuge,
// egal wie groß die Form skaliert wird.
export const DROPS_PIPETTE_TOP = 104
export const DROPS_PIPETTE_PATH =
  `M47 ${DROPS_PIPETTE_TOP} L53 ${DROPS_PIPETTE_TOP} L53 254 ` +
  'C53 260 50.5 262 50 262 C49.5 262 47 260 47 254 Z'

// Die Überdeckung: um so viele Einheiten steckt die Pipette in der Kappe.
export const DROPS_PIPETTE_OVERLAP = DROPS_CAP.y + DROPS_CAP.height - DROPS_PIPETTE_TOP

// Nur der gerade Teil des Innenraums. Das hält die Kammer rechteckig, so
// braucht die Geometrie kein Breitenprofil für die Schulter — derselbe
// Kunstgriff, den Vial, Ampulle und Nasenspray schon benutzen.
//
// Die Oberkante sitzt dicht unter dem Ende der Schulter (Innenwand y=154),
// nicht 11 Einheiten darunter: sonst kann oberhalb von y=165 nie Flüssigkeit
// stehen, und im Klarglas bleibt dort ein leerer Streifen.
export const DROPS_CHAMBER = {
  x: 17.6,
  y: 156,
  width: 64.8,
  height: 128.4,
  aspect: 64.8 / 128.4,
} as const

// Fester Pegel. Die App kennt den Stand einer angebrochenen Tropfflasche
// nicht: getVialFillPct liest vials_in_stock, ein vial-spezifisches Altfeld.
// Die Grafik zeigt das Objekt, eine Prozentzahl wäre eine Behauptung.
//
// Der Wert ist deshalb rein optisch: der Spiegel soll ein Stück unter der
// Schulter stehen, wie bei einer normalen Flasche mit Kopfraum. Im Braunglas
// war er unsichtbar und konnte irgendwo liegen; im Klarglas las sich 0,72 auf
// der tiefer angesetzten Kammer als halbleere Flasche.
export const DROPS_FILL = 0.78

// Das Etikettband sitzt auf dem geraden Teil des Körpers — und unterhalb des
// Flüssigkeitsspiegels. Bei y=195 lag seine Oberkante genau auf dem Spiegel
// (Kammeroberkante 165 + 28 % von 119,4 ≈ 198): im Braunglas fiel das nicht
// auf, im Klarglas verdeckte das Band die Oberfläche und ließ von der
// Flüssigkeit nur den dunkelsten Rest darunter stehen.
export const DROPS_LABEL_TOP = 214
export const DROPS_LABEL = {
  topPct: (DROPS_LABEL_TOP - DROPS_VIEWBOX.y) / DROPS_VIEWBOX.height,
  heightPct: 55 / DROPS_VIEWBOX.height,
} as const

// Wo die Flüssigkeit steht, ausgerechnet aus Kammer und Füllgrad. Nur zum
// Prüfen: das Band darf den Spiegel nicht wieder überdecken.
export const DROPS_SURFACE_Y = DROPS_CHAMBER.y + (1 - DROPS_FILL) * DROPS_CHAMBER.height

// Wie weit Glanz und Schatten beim Wischen wandern.
export const DROPS_SHEEN_SHIFT = 14
export const DROPS_GROUND_SHIFT = 5

export const DROPS_SPEC: StageFormSpec = {
  viewBox: DROPS_VIEWBOX,
  chamber: DROPS_CHAMBER,
  // Siehe DROPS_FILL: kein echter Füllstand, deshalb keine Prozentzeile.
  hasMeaningfulFill: false,
}
