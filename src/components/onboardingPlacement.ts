export type CalloutPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface CalloutLayout {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: CalloutPlacement
  arrowLeft: number
}

export interface CalloutLayoutOptions {
  prefer?: 'auto' | 'top' | 'bottom' | 'center'
  /** Callout bottom edge must stay above this Y */
  maxBottom?: number
  /** Keep clear of bottom tab bar */
  bottomReserve?: number
  topReserve?: number
}

const MARGIN = 12
const GAP = 18
const MAX_W = 320
const MIN_W = 260

export function getViewportReserves() {
  const nav =
    typeof document !== 'undefined'
      ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-height') || '90', 10)
      : 90
  return { top: 12, bottom: nav + 12 }
}

export function computeCalloutLayout(
  target: DOMRect | null,
  viewportW: number,
  viewportH: number,
  calloutH: number,
  options: CalloutLayoutOptions = {},
): CalloutLayout {
  const reserves = getViewportReserves()
  const topReserve = options.topReserve ?? reserves.top
  const bottomReserve = options.bottomReserve ?? reserves.bottom
  const prefer = options.prefer ?? 'auto'
  const width = Math.min(MAX_W, Math.max(MIN_W, viewportW - MARGIN * 2))
  const maxPanelH = Math.max(120, viewportH - topReserve - bottomReserve)

  if (!target || prefer === 'center') {
    const h = Math.min(calloutH, maxPanelH)
    return {
      top: Math.max(topReserve, (viewportH - h) / 2),
      left: (viewportW - width) / 2,
      width,
      maxHeight: h,
      placement: 'center',
      arrowLeft: width / 2,
    }
  }

  const spaceBelow = viewportH - target.bottom - GAP - bottomReserve
  const spaceAbove = target.top - GAP - topReserve
  let placement: CalloutPlacement = 'bottom'

  if (prefer === 'top') placement = spaceAbove >= calloutH ? 'top' : (spaceBelow >= calloutH ? 'bottom' : 'top')
  else if (prefer === 'bottom') placement = spaceBelow >= calloutH ? 'bottom' : (spaceAbove >= calloutH ? 'top' : 'bottom')
  else placement = spaceBelow >= spaceAbove && spaceBelow >= 100 ? 'bottom' : 'top'

  let top: number
  if (placement === 'bottom') {
    top = target.bottom + GAP
    // If card overlaps bottom reserve or goes off-screen, try flipping to top
    if (top + calloutH > viewportH - bottomReserve && spaceAbove >= calloutH) {
      placement = 'top'
      top = target.top - GAP - calloutH
    } else if (top + calloutH > viewportH - bottomReserve) {
      // Neither side fits fully — put card as far from target as possible
      const targetMidY = target.top + target.height / 2
      if (targetMidY > viewportH / 2) {
        top = Math.max(topReserve, topReserve + 8)
      } else {
        top = Math.max(topReserve, viewportH - bottomReserve - calloutH - 8)
      }
    }
  } else {
    const ceiling = options.maxBottom ?? target.top - GAP
    top = ceiling - calloutH
    // If card overlaps top reserve, try flipping to bottom
    if (top < topReserve && spaceBelow >= calloutH) {
      placement = 'bottom'
      top = target.bottom + GAP
    } else if (top < topReserve) {
      // Neither side fits — put card as far from target as possible
      const targetMidY = target.top + target.height / 2
      if (targetMidY > viewportH / 2) {
        top = topReserve + 8
      } else {
        top = Math.max(topReserve, viewportH - bottomReserve - calloutH - 8)
      }
    }
    if (top + calloutH > ceiling) {
      top = Math.max(topReserve, ceiling - calloutH - 4)
    }
  }

  let left = target.left + target.width / 2 - width / 2
  left = Math.max(MARGIN, Math.min(left, viewportW - width - MARGIN))

  const arrowLeft = Math.max(20, Math.min(target.left + target.width / 2 - left, width - 20))

  return {
    top,
    left,
    width,
    maxHeight: Math.min(calloutH, maxPanelH, viewportH - top - bottomReserve),
    placement,
    arrowLeft,
  }
}
