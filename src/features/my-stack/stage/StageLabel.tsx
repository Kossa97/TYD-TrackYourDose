import { useEffect, useRef } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode, RefObject } from 'react'
import { buildMarqueeMotion, marqueeRestOffset, MARQUEE_MIN_OVERFLOW } from './marquee'

// The scrolling name. It only animates when the text really overflows —
// measured, never guessed from the name length — so short names stay still.
// Exported because a capsule carries the same name without a band around it.
export function StageMarquee({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) {
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const innerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const inner = innerRef.current
    if (!wrap || !inner || typeof window === 'undefined') return

    let anim: Animation | null = null

    const setup = () => {
      anim?.cancel()

      // Ein zu langer Name ruht am ANFANG, nicht in seiner Mitte: was man im
      // Ruhezustand sieht, soll der Wortanfang sein und nicht ein Stueck aus
      // der Mitte. Das gilt auch bei abgeschalteter Bewegung — dort ist die
      // Ruhelage alles, was man sieht.
      const overflow = inner.scrollWidth - wrap.clientWidth
      const ruht = overflow > MARQUEE_MIN_OVERFLOW ? marqueeRestOffset() : 0
      inner.style.transform = `translateX(-${ruht}px)`

      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
      if (overflow <= MARQUEE_MIN_OVERFLOW) return

      const motion = buildMarqueeMotion(overflow)
      anim = inner.animate(motion.keyframes, motion.options)
    }

    setup()

    if (typeof ResizeObserver === 'undefined') {
      return () => anim?.cancel()
    }

    const ro = new ResizeObserver(setup)
    ro.observe(wrap)
    ro.observe(inner)

    return () => {
      anim?.cancel()
      ro.disconnect()
    }
  }, [children])

  return (
    <span ref={wrapRef} className={`block overflow-hidden whitespace-nowrap ${className}`}>
      <span ref={innerRef} className="vial-label-marquee inline-block will-change-transform">
        {children}
      </span>
    </span>
  )
}

// Each form tags the band with its own debugging attributes, so the shared
// component must accept data-* alongside the regular div attributes.
type DivProps = HTMLAttributes<HTMLDivElement> & { [key: `data-${string}`]: string }

export interface StageLabelProps {
  name: string
  detail: string | null
  className: string
  nameClassName: string
  detailClassName: string
  wrapperProps?: DivProps
  innerProps?: DivProps
  sheenRef?: RefObject<HTMLDivElement | null>
  sheenStyle?: CSSProperties
}

// The glass band every liquid-holding container wears. Position and typography
// come from the form; the material is the same everywhere it belongs.
export function StageLabel({
  name,
  detail,
  className,
  nameClassName,
  detailClassName,
  wrapperProps,
  innerProps,
  sheenRef,
  sheenStyle,
}: StageLabelProps) {
  return (
    <div
      {...wrapperProps}
      // Die Aufschrift steht MITTIG im Band — bei jeder Form gleich.
      //
      // Vorher lag sie oben an: die meisten Formen geben dem Band eine feste
      // Hoehe (`top`/`height` in Prozent), und ein Block ohne Ausrichtung
      // faengt am oberen Rand an. Solange zwei Zeilen darin standen, fiel das
      // kaum auf; seit die Mengenzeile wegfaellt, sobald keine Menge
      // eingetragen ist, stand der Name allein und klebte an der Oberkante.
      //
      // `justify-center` richtet den Inhalt aus, nicht die Zeilen einzeln: eine
      // Zeile sitzt in der Mitte, zwei sitzen als Block in der Mitte.
      //
      // KEIN `backdrop-blur`. Es stand hier mit 2 px und hat einen sichtbaren
      // Fehler gekostet: `backdrop-filter` liest, was HINTER dem Band liegt —
      // aber nur aus derselben Zeichenebene. Solange die Fuellanimation laeuft,
      // liegt die Fluessigkeit auf einer eigenen Ebene (jede laufende
      // CSS-Animation legt sie dorthin), und WebKit nimmt die nicht in den
      // Hintergrund auf. Beim Laden blieb das Band deshalb dunkel, waehrend
      // darueber und darunter schon Gruen stand, und wurde erst richtig, wenn
      // die Animation endete oder ein Wisch die Ebenen neu zusammensetzte.
      //
      // Zwei Pixel Unschaerfe ueber einer fast einfarbigen Fluessigkeit sind
      // das nicht wert. Was dabei verlorenging, war nicht der milchige TON —
      // den macht die weisse Flaeche —, sondern die Streuung: Blaeschen und
      // Glanzlichter lasen sich ploetzlich scharf durch das Band.
      //
      // Statt des Durchgriffs jetzt ein senkrechter Verlauf. Milchglas ist an
      // seinen Kanten dichter als in der Mitte, weil das Licht dort streift;
      // genau das macht die Tiefe aus, die vorher aus der Unschaerfe kam.
      //
      // Die Werte sind bewusst klein. Hier stand vorher `bg-white/28`, und das
      // hat NIE eine Flaeche gezeichnet: Tailwind kennt Deckkraft nur in
      // Fuenferschritten, 28 ist keiner davon, also fiel die Klasse still aus
      // dem Stylesheet. Der milchige Eindruck kam damit allein aus der
      // Unschaerfe, und ein Band mit 28 Prozent Weiss waere heller als es je
      // war. Im Mittel sind es jetzt (10 + 2x5 + 10) / 4 = 7,5 Prozent: ein
      // Hauch an den Kanten, in der Mitte fast klar. Alle drei Werte liegen auf
      // der Skala und lassen sich in Fuenferschritten anheben.
      className={`absolute ${className} flex flex-col justify-center overflow-hidden border-y border-white/40 bg-gradient-to-b from-white/10 via-white/5 to-white/10 text-center shadow-[0_8px_22px_rgba(0,0,0,0.28)]`}
    >
      <div {...innerProps} className="relative w-full overflow-hidden">
        <StageMarquee className={nameClassName}>{name}</StageMarquee>
        {detail !== null && detail !== '' && <p className={detailClassName}>{detail}</p>}
      </div>
      {sheenRef && (
        <div
          ref={sheenRef}
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-white/10 to-black/10"
          style={sheenStyle}
        />
      )}
    </div>
  )
}
