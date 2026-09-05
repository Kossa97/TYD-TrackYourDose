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

// Die Ruhelage ist die MITTE, nicht der linke Anschlag. Ein zu langer Name
// stand sonst buendig links und war damit als einziger nicht zentriert —
// text-align kann eine ueberbreite inline-box nicht zentrieren, sie laeuft
// nach rechts ueber. Von der Mitte aus faehrt der Name an beide Enden und
// kehrt zurueck.
export function marqueeRestOffset(overflow: number): number {
  return overflow / 2
}

export function buildMarqueeMotion(overflow: number): MarqueeMotion {
  const mitte = marqueeRestOffset(overflow)
  const hold = 1600
  const move = Math.max(900, overflow * 18)
  // Mitte halten, nach links ans Ende, halten, ganz nach rechts, halten,
  // zurueck in die Mitte.
  const total = hold * 3 + move * 4
  const at = (ms: number) => ms / total

  return {
    keyframes: [
      { transform: `translateX(-${mitte}px)`, offset: 0 },
      { transform: `translateX(-${mitte}px)`, offset: at(hold) },
      { transform: `translateX(-${overflow}px)`, offset: at(hold + move) },
      { transform: `translateX(-${overflow}px)`, offset: at(hold * 2 + move) },
      { transform: 'translateX(0)', offset: at(hold * 2 + move * 3) },
      { transform: 'translateX(0)', offset: at(hold * 3 + move * 3) },
      { transform: `translateX(-${mitte}px)`, offset: 1 },
    ],
    options: { duration: total, iterations: Infinity, easing: 'linear' },
  }
}

// Below this an overflow is not worth animating — it would read as a jitter.
export const MARQUEE_MIN_OVERFLOW = 4
