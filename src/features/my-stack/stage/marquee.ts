// One marquee motion for every stage form: the label band on glass containers
// and the engraving on a capsule use the same hold, run and return, so a long
// name behaves identically wherever it appears.
//
// Only the timing lives here. How much a consumer overflows and what it moves —
// an HTML span, an SVG group — stays with the consumer, because measuring a
// laid-out element and measuring a glyph box are different jobs.

export interface MarqueeMotion {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
}

// Die Ruhelage ist der ANFANG des Namens, nicht seine Mitte.
//
// Vorher ruhte ein zu langer Name mittig — der Gedanke war, dass er dann
// wie jeder kurze Name zentriert steht. In der Ansicht hiess das aber: was
// man im Ruhezustand sieht, ist ein Stueck aus der MITTE des Wortes, vorn und
// hinten abgeschnitten („Semagluti" auf der Ampulle). Ein Etikett liest man
// von vorne. Also faengt der Lauf vorne an, faehrt einmal bis ans andere Ende
// durch und kommt zurueck.
export function marqueeRestOffset(): number {
  return 0
}

export function buildMarqueeMotion(overflow: number): MarqueeMotion {
  const hold = 1600
  const move = Math.max(900, overflow * 18)
  // Vorne halten, einmal ganz nach hinten durchlaufen, hinten halten, wieder
  // nach vorne. Beide Enden werden voll ausgefahren: bei `0` steht der erste
  // Buchstabe an der linken Etikettkante, bei `-overflow` der letzte an der
  // rechten. Dazwischen laeuft der Name durch, ohne in der Mitte zu ruhen.
  const total = hold * 2 + move * 2
  const at = (ms: number) => ms / total

  return {
    keyframes: [
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(0)', offset: at(hold) },
      { transform: `translateX(-${overflow}px)`, offset: at(hold + move) },
      { transform: `translateX(-${overflow}px)`, offset: at(hold * 2 + move) },
      { transform: 'translateX(0)', offset: 1 },
    ],
    options: { duration: total, iterations: Infinity, easing: 'linear' },
  }
}

// Below this an overflow is not worth animating — it would read as a jitter.
export const MARQUEE_MIN_OVERFLOW = 4
