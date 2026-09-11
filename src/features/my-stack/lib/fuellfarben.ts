// Womit eine Darreichungsform gefuellt ist, solange der Nutzer keine eigene
// Eintragsfarbe gesetzt hat.
//
// Vorher stand hier ein Material je Form (Wasserblau fuer Fluessigkeiten,
// gepresstes Weiss fuer die Tablette, Elfenbein fuer die Kapsel, ...). Das
// wirkte auf der Buehne wie eine gewaehlte Farbe, nicht wie ein Rohling — und
// genau das soll der Standard nicht behaupten: bevor jemand im Farbschritt
// etwas gewaehlt hat, ist noch nichts entschieden. Ein einziges helles,
// glasiges Weiss fuer alle Formen sagt das ehrlich: leer, durchscheinend,
// bereit fuer die eigene Farbe.
//
// Es ist ein Standardwert, keine feste Farbe: sobald im Farbschritt etwas
// gewaehlt ist, gilt das. Deshalb ohne Parameter — er unterschied sich vorher
// je Form, jetzt gilt derselbe Wert fuer jede.
const GLASWEISS = '#f3f5f7'

export function fuellfarbe(): string {
  return GLASWEISS
}
