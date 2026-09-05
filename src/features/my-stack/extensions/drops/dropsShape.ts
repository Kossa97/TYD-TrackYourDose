import type { StageFormSpec } from '../../stage/types'

// Tropfflasche mit Glaspipette, nach der Vorlage: schlanker Zylinder, kurze
// Schulter, hohe geriffelte Schraubkappe und darauf ein schmaler Gummisauger.
// Gezeichnet auf einem Raster von 100 x 300 Einheiten, die viewBox ist auf
// die Objektgrenzen beschnitten.
export const DROPS_VIEWBOX = { x: 14, y: 16, width: 72, height: 272 } as const
export const DROPS_ASPECT = DROPS_VIEWBOX.width / DROPS_VIEWBOX.height

// Die Durchmesser von oben nach unten. Der Sauger ist schmaler als die
// Kappe und die Kappe schmaler als der Körper — genau diese Staffelung macht
// die Flasche auf einen Blick als Pipettenflasche lesbar. Die Einschnürung
// über dem Kappenrand ist die schmalste Stelle.
export const DROPS_WIDTHS = { waist: 17, teat: 26, cap: 42, body: 72 } as const

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
  seam: 80,
  // Der Sauger reicht darunter weiter, damit die Kappe die Verbindung
  // überdeckt. Ein stumpfer Stoß genau auf der Naht zeigt je nach Skalierung
  // eine Haarlinie — derselbe Grund, aus dem die Pipette in die Kappe
  // hineinreicht.
  bottom: 85,
  // Auf dieser Höhe ist der Sauger am breitesten — knapp unter der Kuppe,
  // von da an verjüngt er sich bis zur Einschnürung.
  widest: 30,
  waistY: 69,
} as const

// Ein geschlossener Umriss: Kuppe, Verjüngung, Einschnürung, und unten der
// kleine Kragen, mit dem der Sauger auf der Kappe aufsitzt.
//
// Das Verhältnis von Höhe zu Breite ist knapp 2,5 : 1 — schlanker wäre es
// ein Pinselgriff, nicht der Gummiball der Vorlage.
export const DROPS_TEAT_PATH =
  'M37 30 C37 14 63 14 63 30 ' +
  'C63 48 59 56 58.5 69 ' +
  'C58.5 75 62 75 62 80 ' +
  'L62 85 L38 85 L38 80 ' +
  'C38 75 41.5 75 41.5 69 ' +
  'C41 56 37 48 37 30 Z'

// Die Schraubkappe: kurz, breit, geriffelt, mit leicht gebrochenen Kanten.
export const DROPS_CAP = { x: 29, y: 80, width: 42, height: 22 } as const
export const DROPS_CAP_RADIUS = 2.2
export const DROPS_CAP_PATH =
  'M31.2 80 L68.8 80 C70 80 71 81 71 82.2 L71 99.8 ' +
  'C71 101 70 102 68.8 102 L31.2 102 C30 102 29 101 29 99.8 ' +
  'L29 82.2 C29 81 30 80 31.2 80 Z'

// Die flache Oberseite der Kappe rund um den Sauger. Sie zeigt nach oben,
// vom Licht weg, und ist deshalb dunkler als der Mantel — ohne diesen
// Streifen sähe die Kappe wie ein aufgeklebtes Rechteck aus.
export const DROPS_CAP_TOP_BAND = 4

// Die Riffelung sitzt nur auf dem Mantel, nicht auf der Oberseite und nicht
// auf den gebrochenen Kanten.
export const DROPS_CAP_RIB_YS = { top: 87, bottom: 98 } as const
export const DROPS_CAP_RIB_XS: readonly number[] =
  Array.from({ length: 15 }, (_, i) => Number((31.5 + i * 2.5).toFixed(3)))

// Der Glanzpunkt auf der gewölbten Kuppe des Saugers.
export const DROPS_CAP_DOME = { cx: 50, cy: 32, rx: 8 } as const

// Aussen- und Innenkontur, wie beim Vial und der Ampulle. Die Wandstärke ist
// 5 % der Körperbreite.
//
// Die Flasche hat KEINEN Hals: die Vorlage setzt die Kappe unmittelbar auf
// einen Rundrechteck-Körper, dessen Oberkante links und rechts neben der
// Kappe als Schulter sichtbar bleibt. Der lange Hals mit Schulterbogen davor
// gehörte zu einer anderen Flaschenart und machte die Form kopflastig.
export const DROPS_WALL = 3.6
export const DROPS_BODY = { top: 100, bottom: 288, radiusTop: 14, radiusBottom: 12 } as const
export const DROPS_OUTER_PATH =
  'M28 100 L72 100 C79.7 100 86 106.3 86 114 L86 276 ' +
  'C86 282.6 82.6 288 76 288 L24 288 C17.4 288 14 282.6 14 276 ' +
  'L14 114 C14 106.3 20.3 100 28 100 Z'
export const DROPS_INNER_PATH =
  'M28 103.6 L72 103.6 C77.7 103.6 82.4 108.3 82.4 114 L82.4 276 ' +
  'C82.4 280.6 78.6 284.4 74 284.4 L26 284.4 C21.4 284.4 17.6 280.6 17.6 276 ' +
  'L17.6 114 C17.6 108.3 22.3 103.6 28 103.6 Z'

// Ohne Hals braucht die Wandstärke keinen offenen Pfad mehr. Der Trick war
// nötig, solange die Kontur oben in einem schmalen Hals endete: dort hätte
// ihr Ringschluss einen Strich quer über die Öffnung gezogen. Jetzt ist die
// Oberkante echte Schulter und wird mitgezeichnet, wie beim Nasenspray.

// Sauger, Kappe und Pipette sind EIN Teil: beim Aufschrauben kommt die
// Pipette mit heraus. Sie beginnt deshalb oberhalb der Kappenunterkante und
// wird von der Kappe überdeckt — so gibt es an der Verbindung keine Fuge,
// egal wie groß die Form skaliert wird.
export const DROPS_PIPETTE_TOP = 94
export const DROPS_PIPETTE_PATH =
  `M47 ${DROPS_PIPETTE_TOP} L53 ${DROPS_PIPETTE_TOP} L53 254 ` +
  'C53 260 50.5 262 50 262 C49.5 262 47 260 47 254 Z'

// Die Überdeckung: um so viele Einheiten steckt die Pipette in der Kappe.
export const DROPS_PIPETTE_OVERLAP = DROPS_CAP.y + DROPS_CAP.height - DROPS_PIPETTE_TOP

// Nur der gerade Teil des Innenraums. Das hält die Kammer rechteckig, so
// braucht die Geometrie kein Breitenprofil für die Rundung — derselbe
// Kunstgriff, den Vial, Ampulle und Nasenspray schon benutzen.
//
// Ohne Hals und Schulter beginnt der gerade Teil viel weiter oben: gleich
// unter der oberen Eckenrundung statt erst 50 Einheiten tiefer.
export const DROPS_CHAMBER = {
  x: 17.6,
  y: 118,
  width: 64.8,
  height: 166.4,
  aspect: 64.8 / 166.4,
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
