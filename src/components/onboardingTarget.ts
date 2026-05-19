import type { OnboardingStepMeta } from './onboardingSteps'

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([type="hidden"])'

function unionDomRects(rects: DOMRect[]): DOMRect | null {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity

  for (const r of rects) {
    if (r.width < 2 || r.height < 2) continue
    left = Math.min(left, r.left)
    top = Math.min(top, r.top)
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }

  if (left === Infinity) return null
  return new DOMRect(left, top, right - left, bottom - top)
}

/** Visual bounds for spotlight ring — snaps to inputs/buttons inside section wrappers. */
export function getOnboardingHighlightRect(el: HTMLElement | null): DOMRect | null {
  if (!el) return null

  // data-ob-self: use the element's own bounding rect (e.g. calendar grid, large containers)
  if (el.hasAttribute('data-ob-self')) {
    const r = el.getBoundingClientRect()
    return r.width >= 2 && r.height >= 2 ? r : null
  }

  const tag = el.tagName
  if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) {
    const r = el.getBoundingClientRect()
    return r.width >= 2 && r.height >= 2 ? r : null
  }

  const focusables = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(child => {
    const r = child.getBoundingClientRect()
    return r.width >= 2 && r.height >= 2
  })

  const fields = focusables.filter(c => c.matches('input, select, textarea'))
  const forHighlight = fields.length > 0 ? fields : focusables

  if (forHighlight.length > 0) {
    return unionDomRects(forHighlight.map(c => c.getBoundingClientRect()))
  }

  const r = el.getBoundingClientRect()
  return r.width >= 2 && r.height >= 2 ? r : null
}

/** Element users should tap; nav steps use the full tab link (`<a>`). */
export function getOnboardingInteractionEl(
  meta: Pick<OnboardingStepMeta, 'targetSelector' | 'navTarget'> | null | undefined,
): HTMLElement | null {
  if (!meta?.targetSelector) return null
  const marker = document.querySelector(meta.targetSelector) as HTMLElement | null
  if (!marker) return null
  if (meta.navTarget) {
    return (marker.closest('a') as HTMLElement | null) ?? marker
  }
  return marker
}

export function getOpenAppModal(): HTMLElement | null {
  for (const el of document.querySelectorAll('[data-app-modal]')) {
    const modal = el as HTMLElement
    const { width, height } = modal.getBoundingClientRect()
    if (width > 0 && height > 0) return modal
  }
  return null
}

export function isInsideOpenModal(node: Node | null): boolean {
  if (!node) return false
  const modal = getOpenAppModal()
  return !!modal && modal.contains(node)
}

export function isOnboardingInteractionNode(
  node: EventTarget | null,
  meta: Pick<OnboardingStepMeta, 'targetSelector' | 'navTarget'> | null | undefined,
): boolean {
  if (!(node instanceof Node) || !meta?.targetSelector) return false
  const root = getOnboardingInteractionEl(meta)
  return !!root && root.contains(node)
}

/** Spotlight only when the target is visible and not hidden behind an open sheet. */
export function shouldShowOnboardingSpotlight(
  meta: Pick<OnboardingStepMeta, 'targetSelector' | 'navTarget'> | null | undefined,
  targetRect: DOMRect | null,
): boolean {
  if (!meta?.targetSelector || !targetRect || targetRect.width < 2 || targetRect.height < 2) {
    return false
  }
  const el = getOnboardingInteractionEl(meta)
  if (!el) return false
  const modal = getOpenAppModal()
  if (!modal) return true
  return modal.contains(el)
}

export function measureOnboardingTarget(
  meta: Pick<OnboardingStepMeta, 'targetSelector' | 'navTarget'> | null | undefined,
): DOMRect | null {
  const el = getOnboardingInteractionEl(meta)
  return getOnboardingHighlightRect(el)
}
