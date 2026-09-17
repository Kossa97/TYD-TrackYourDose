import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Passt ein Buehnenobjekt in eine Flaeche ein.
 *
 * Jede Darreichungsform bringt eigene feste Pixelmasse mit — ein Pen ist bei
 * Karussellgroesse 237 px hoch, eine Kapsel 92 px breit. Eine gemeinsame
 * Vergroesserung gibt es deshalb nicht: derselbe Faktor, der die Kapsel
 * bildschirmfuellend macht, schoebe den Pen weit ueber den Rand.
 *
 * Statt in elf Dateien elf neue Zahlen zu setzen, wird hier GEMESSEN und
 * skaliert: `scale = min(Breite/Objektbreite, Hoehe/Objekthoehe)`. Die
 * Groessenverhaeltnisse ZWISCHEN den Formen bleiben damit erhalten — ein Pen
 * steht weiterhin hoeher da als eine Kapsel —, und jede neue Form passt von
 * selbst.
 *
 * Skaliert wird vom Boden, damit alle Objekte auf derselben Standlinie stehen.
 *
 * WICHTIG fuer die Bildqualitaet: eine CSS-Skalierung vergroessert nicht die
 * Zeichnung, sondern das fertige Bild. Der Aufrufer muss deshalb die groesste
 * passende Vorlage hereingeben (`size="large"`, nicht `carousel`), damit hier
 * ueberwiegend VERKLEINERT wird — das ist immer scharf. `maxScale` ist die
 * Notbremse dagegen: was darueber hinaus vergroessert werden muesste, ist kein
 * Skalierungsproblem, sondern eine zu kleine Vorlage.
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
}

export function StageFit({ children, className, maxScale = 1.6 }: StageFitProps) {
  const flaecheRef = useRef<HTMLDivElement>(null)
  const objektRef = useRef<HTMLDivElement>(null)
  const [skala, setSkala] = useState(1)

  useLayoutEffect(() => {
    const flaeche = flaecheRef.current
    const objekt = objektRef.current
    if (!flaeche || !objekt) return

    const messen = () => {
      const platz = flaeche.getBoundingClientRect()
      // Die NATIVE Groesse des Objekts, also ohne die Skalierung, die wir ihm
      // gerade selbst gegeben haben — sonst misst sich die Rechnung immer
      // wieder an ihrem eigenen Ergebnis und schaukelt sich hoch.
      const breite = objekt.offsetWidth
      const hoehe = objekt.offsetHeight
      if (!platz.width || !platz.height || !breite || !hoehe) return
      setSkala(Math.min(maxScale, platz.width / breite, platz.height / hoehe))
    }

    messen()
    if (typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(flaeche)
    beobachter.observe(objekt)
    return () => beobachter.disconnect()
  }, [maxScale])

  return (
    <div ref={flaecheRef} data-stage-fit className={`flex items-end justify-center ${className ?? ''}`}>
      <div
        ref={objektRef}
        data-stage-fit-object
        // `shrink-0`: die grossen Vorlagen sind breiter als der Karussellplatz
        // (Kapsel 364 px, Pen-Nachbarn) — als Flex-Kind wuerden sie sonst auf
        // die Flaechenbreite gestaucht, und gemessen wuerde die gestauchte
        // Breite statt der echten.
        className="shrink-0"
        style={{ transform: `scale(${skala})`, transformOrigin: 'bottom center' }}
      >
        {children}
      </div>
    </div>
  )
}
