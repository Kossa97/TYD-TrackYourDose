import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Passt ein Buehnenobjekt in eine Flaeche ein.
 *
 * Jede Darreichungsform bringt eigene feste Pixelmasse mit — ein Pen ist
 * 589 px hoch, eine Kapsel 364 px breit. Eine gemeinsame Vergroesserung gibt es
 * deshalb nicht: derselbe Faktor, der die Kapsel bildschirmfuellend macht,
 * schoebe den Pen weit ueber den Rand.
 *
 * Statt in elf Dateien elf neue Zahlen zu setzen, wird hier GEMESSEN und
 * skaliert. Die verfuegbare Hoehe wird dabei mit dem Groessenanteil der Form
 * gewichtet: grosse Darreichungsformen nutzen fast die ganze Buehne, kleine
 * bewusst nur einen Teil. So bleiben die Formen untereinander proportional,
 * ohne echte Millimeter 1:1 abzubilden und kleine Tabletten unbedienbar zu
 * machen.
 *
 * WICHTIG fuer die Bildqualitaet: eine CSS-Skalierung vergroessert nicht die
 * Zeichnung, sondern das fertige Bild. Der Aufrufer muss deshalb die groesste
 * passende Vorlage hereingeben (`size="large"`, nicht `carousel`), damit hier
 * ueberwiegend VERKLEINERT wird — das ist immer scharf. `maxScale` ist die
 * Notbremse dagegen: was darueber hinaus vergroessert werden muesste, ist kein
 * Skalierungsproblem, sondern eine zu kleine Vorlage.
 *
 * ## Warum zwei Kaesten statt einem
 *
 * `transform: scale()` aendert das BILD, nicht das Layout: der Kasten des
 * Objekts bleibt so breit wie die Vorlage. Eine 364 px breite Kapsel, die auf
 * 240 px heruntergerechnet wird, belegt im Layout weiterhin 364 px. Zentriert
 * man sie mit `justify-center`, haengt ihre Position an dieser gemessenen
 * Breite — und jede Aenderung darin (erste Messung, Schriftnachladung,
 * Etikettenwechsel) verschiebt sie seitlich. Im Karussell kommt dazu, dass
 * diese 124 px Ueberhang den scrollbaren Bereich des Streifens verbreitern und
 * damit die Fangpunkte verschieben.
 *
 * Deshalb:
 *
 * - Der AEUSSERE Kasten ist genau so gross wie das FERTIGE Bild
 *   (`Vorlage × Faktor`) und steht mit `left-1/2 -translate-x-1/2` mittig. Er
 *   haengt an einer gerechneten Zahl, nicht an einer Flussmessung, und ragt
 *   nirgends heraus.
 * - Der INNERE Kasten behaelt die Vorlagenmasse und wird von seiner unteren
 *   linken Ecke aus skaliert, fuellt den aeusseren also genau aus.
 *
 * Vor der ersten Messung bleibt das Objekt unsichtbar. Gemessen wird in
 * `useLayoutEffect`, also vor dem ersten Anzeigen — es gibt kein Bild in
 * falscher Groesse und keinen Sprung danach.
 *
 * ## Warum `clientWidth` und nicht `getBoundingClientRect`
 *
 * Im Karussell steht jeder Eintrag unter einem `scale()`: der aktive auf 1,
 * die Nachbarn kleiner, und dazwischen laeuft ein Uebergang von 300 ms.
 * `getBoundingClientRect()` liefert die Masse NACH dieser Skalierung,
 * `offsetWidth` dagegen das Layoutmass davor. Wer beides mischt, rechnet den
 * Faktor eines Nachbarn um dessen Eintragsskalierung zu klein — im Browser
 * gemessen 0,998 statt 1,217, also 22 % — und sobald derselbe Eintrag aktiv
 * wird und irgendetwas eine neue Messung ausloest, springt das Objekt um
 * ebendiese 22 %. Genau das war das Zucken nach dem Wischen.
 *
 * `clientWidth`/`clientHeight` sind Layoutmasse und von jeder Skalierung eines
 * Vorfahren unberuehrt. Damit faellt fuer dieselbe Flaeche immer derselbe
 * Faktor heraus, egal ob der Eintrag gerade aktiv, Nachbar oder mitten im
 * Uebergang ist.
 */
export interface StageFitProps {
  children: ReactNode
  /** Groesse der Flaeche, in die eingepasst wird. */
  className?: string
  /**
   * Hoechster Faktor — ohne ihn wuerde ein winziges Objekt ins Gigantische
   * gezogen, und jedes Vergroessern kostet Schaerfe (siehe oben).
   */
  maxScale?: number
  /** Anteil der Buehnenhoehe, den diese Darreichungsform belegen soll. */
  targetHeightRatio?: number
}

/**
 * Faktoren dicht an 1 werden zu genau 1.
 *
 * `scale(1)` ist die Identitaet — der Browser rechnet das Bild dann gar nicht
 * um. Bei 1,04 dagegen wird jede Kante neu abgetastet, fuer vier Prozent mehr
 * Groesse, die niemand sieht. Innerhalb dieser Totzone ist die native
 * Zeichnung das bessere Bild.
 */
const EINRASTEN = 0.08
function einrasten(skala: number) {
  // Nur eine kleine VERGROESSERUNG wird vermieden: sie kostet Schaerfe und
  // bringt kaum sichtbaren Nutzen. Eine Verkleinerung ist dagegen oft
  // absichtlich als Sicherheitsabstand gesetzt und darf nicht verschwinden.
  return skala >= 1 && skala - 1 < EINRASTEN ? 1 : skala
}

interface Einpassung {
  skala: number
  /** Vorlagenmasse, also ohne die Skalierung. */
  breite: number
  hoehe: number
}

export function StageFit({ children, className, maxScale = 1.6, targetHeightRatio = 1 }: StageFitProps) {
  const flaecheRef = useRef<HTMLDivElement>(null)
  const objektRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<Einpassung | null>(null)

  useLayoutEffect(() => {
    const flaeche = flaecheRef.current
    const objekt = objektRef.current
    if (!flaeche || !objekt) return

    const messen = () => {
      // Layoutmasse, KEIN getBoundingClientRect: der Eintrag im Karussell
      // steht unter einem `scale()`, und dessen Ergebnis darf hier nicht
      // einfliessen (siehe oben).
      const platzBreite = flaeche.clientWidth
      const platzHoehe = flaeche.clientHeight
      // Die NATIVE Groesse des Objekts, also ohne die Skalierung, die wir ihm
      // gerade selbst gegeben haben — sonst misst sich die Rechnung immer
      // wieder an ihrem eigenen Ergebnis und schaukelt sich hoch.
      const breite = objekt.offsetWidth
      const hoehe = objekt.offsetHeight
      if (!platzBreite || !platzHoehe || !breite || !hoehe) return
      const skala = einrasten(Math.min(
        maxScale,
        platzBreite / breite,
        (platzHoehe * targetHeightRatio) / hoehe,
      ))
      setFit(vorher => (
        vorher && vorher.skala === skala && vorher.breite === breite && vorher.hoehe === hoehe
          ? vorher
          : { skala, breite, hoehe }
      ))
    }

    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(flaeche)
    beobachter.observe(objekt)
    return () => beobachter.disconnect()
  }, [maxScale, targetHeightRatio])

  const skala = fit?.skala ?? 1
  return (
    <div ref={flaecheRef} data-stage-fit className={`relative ${className ?? ''}`}>
      <div
        data-stage-fit-box
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={fit ? { width: fit.breite * skala, height: fit.hoehe * skala } : undefined}
      >
        <div
          ref={objektRef}
          data-stage-fit-object
          // `w-max`: der Kasten haelt die Vorlagenbreite, statt sich auf die
          // Flaeche stauchen zu lassen — sonst wuerde die gestauchte Breite
          // gemessen und der Faktor waere falsch.
          className="absolute bottom-0 left-0 w-max"
          style={{
            transform: `scale(${skala})`,
            transformOrigin: 'bottom left',
            visibility: fit ? undefined : 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
