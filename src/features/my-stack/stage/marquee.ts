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

export function buildMarqueeMotion(overflow: number): MarqueeMotion {
  const holdStart = 2200
  const holdEnd = 1200
  const moveOut = Math.max(1800, overflow * 35)
  const moveBack = Math.max(700, overflow * 14)
  const total = holdStart + moveOut + holdEnd + moveBack

  return {
    keyframes: [
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(0)', offset: holdStart / total },
      { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut) / total },
      { transform: `translateX(-${overflow}px)`, offset: (holdStart + moveOut + holdEnd) / total },
      { transform: 'translateX(0)', offset: 1 },
    ],
    options: { duration: total, iterations: Infinity, easing: 'linear' },
  }
}

// Below this an overflow is not worth animating — it would read as a jitter.
export const MARQUEE_MIN_OVERFLOW = 4
