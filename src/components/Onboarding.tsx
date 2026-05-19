import {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, X, RotateCcw } from 'lucide-react'
import { useOnboarding } from '../context/OnboardingContext'
import { ONBOARDING_STEPS, ONBOARDING_TOUR_STEP_COUNT } from './onboardingSteps'
import { OB_Z } from './onboardingLayers'
import { computeCalloutLayout, type CalloutPlacement } from './onboardingPlacement'
import {
  getOnboardingInteractionEl,
  getOpenAppModal,
  isInsideOpenModal,
  isOnboardingInteractionNode,
  measureOnboardingTarget,
  shouldShowOnboardingSpotlight,
} from './onboardingTarget'

const SPOT_PAD = 8
const SCRIM = 'rgba(0, 6, 18, 0.58)'

function CalloutArrow({ placement, left }: { placement: CalloutPlacement; left: number }) {
  if (placement === 'center') return null
  const above = placement === 'top'
  return (
    <span
      className="ob-callout-arrow"
      style={{
        position: 'absolute',
        left,
        ...(above
          ? { bottom: -7, borderTop: '8px solid rgba(12, 24, 48, 0.99)' }
          : { top: -7, borderBottom: '8px solid rgba(12, 24, 48, 0.99)' }),
      }}
    />
  )
}

function SpotlightScrim({ hole }: { hole: DOMRect | null }) {
  const paneStyle: CSSProperties = {
    position: 'fixed',
    background: SCRIM,
    pointerEvents: 'auto',
  }

  if (!hole || hole.width < 2 || hole.height < 2) {
    return (
      <div id="ob-scrim-root" aria-hidden>
        <div className="ob-scrim-pane fixed inset-0" style={{ ...paneStyle, zIndex: OB_Z.scrim }} />
      </div>
    )
  }

  const x = Math.max(0, hole.left - SPOT_PAD)
  const y = Math.max(0, hole.top - SPOT_PAD)
  const w = hole.width + SPOT_PAD * 2
  const h = hole.height + SPOT_PAD * 2
  const r = 10

  // Ring is rendered OUTSIDE #ob-scrim-root so its z-index is in the global stacking context.
  // Inside #ob-scrim-root (z-index 10000), any child z-index is capped by the parent — the nav
  // and modals at 10030/10040 would cover a ring at 10045 if it were nested inside the scrim root.
  return (
    <>
      <div id="ob-scrim-root" aria-hidden>
        <div className="ob-scrim-pane" style={{ ...paneStyle, zIndex: OB_Z.scrim, top: 0, left: 0, right: 0, height: y }} />
        <div className="ob-scrim-pane" style={{ ...paneStyle, zIndex: OB_Z.scrim, top: y, left: 0, width: x, height: h }} />
        <div className="ob-scrim-pane" style={{ ...paneStyle, zIndex: OB_Z.scrim, top: y, left: x + w, right: 0, height: h }} />
        <div className="ob-scrim-pane" style={{ ...paneStyle, zIndex: OB_Z.scrim, top: y + h, left: 0, right: 0, bottom: 0 }} />
      </div>
      <div
        className="ob-highlight-ring pointer-events-none"
        style={{
          position: 'fixed',
          zIndex: OB_Z.ring,
          top: y,
          left: x,
          width: w,
          height: h,
          borderRadius: r,
        }}
      />
    </>
  )
}

function isPanelNode(node: EventTarget | null): boolean {
  if (!(node instanceof Node)) return false
  return !!document.getElementById('ob-callout')?.contains(node)
}

export function Onboarding() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { step, total, active, needsLanguagePick, next, prev, skip } = useOnboarding()

  const meta = ONBOARDING_STEPS[step]
  const steps = ONBOARDING_STEPS.map(m => ({
    ...m,
    title: t(m.titleKey),
    subtitle: t(m.subtitleKey),
    description: t(m.descriptionKey),
    tapHint: m.tapHintKey ? t(m.tapHintKey) : null,
  }))
  const s = steps[step]

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [fieldIndex, setFieldIndex] = useState(0)
  const [panelH, setPanelH] = useState(200)
  const [layout, setLayout] = useState<ReturnType<typeof computeCalloutLayout>>(() =>
    computeCalloutLayout(null, window.innerWidth, window.innerHeight, 200, { prefer: 'center' }),
  )

  const panelRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const nextRef = useRef(next)

  useEffect(() => {
    nextRef.current = next
  }, [next])

  const wantsTarget = !!meta?.targetSelector
  const showSpotlight = shouldShowOnboardingSpotlight(meta, targetRect)
  // Target inside an open modal → snap card to top of viewport, ring stays on field
  const isModalTarget = showSpotlight && modalOpen
  const useCenteredCallout = !showSpotlight || meta?.placement === 'center' || isModalTarget
  const isFirst = step === 0
  const isLast = step === total - 1
  const tourStepNumber = step > 0 && !isLast ? step : null
  const progressLabel =
    tourStepNumber === null
      ? isFirst
        ? t('ob_intro')
        : t('finish')
      : t('step_of', { current: tourStepNumber, total: ONBOARDING_TOUR_STEP_COUNT })

  useEffect(() => {
    document.body.classList.toggle('onboarding-active', active && !needsLanguagePick)
    return () => document.body.classList.remove('onboarding-active')
  }, [active, needsLanguagePick])

  useEffect(() => {
    if (!active || needsLanguagePick) return
    const route = meta?.route ?? (step === 0 ? '/' : undefined)
    if (route) navigate(route)
  }, [step, active, needsLanguagePick, meta?.route, navigate])

  const syncModalLayer = useCallback(() => {
    document.querySelectorAll('[data-app-modal]').forEach(el => {
      const modal = el as HTMLElement
      const visible = modal.getBoundingClientRect().height > 0
      if (visible && active && !needsLanguagePick) {
        modal.style.zIndex = String(OB_Z.appModal)
        modal.style.pointerEvents = 'auto'
      } else {
        modal.style.zIndex = ''
        modal.style.pointerEvents = ''
      }
    })
  }, [active, needsLanguagePick])

  useEffect(() => {
    if (!active || needsLanguagePick) return
    syncModalLayer()
    const mo = new MutationObserver(syncModalLayer)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true })
    return () => {
      mo.disconnect()
      document.querySelectorAll('[data-app-modal]').forEach(el => {
        const modal = el as HTMLElement
        modal.style.zIndex = ''
        modal.style.pointerEvents = ''
      })
    }
  }, [active, needsLanguagePick, syncModalLayer])

  // Returns cycle fields: individual inputs OR data-ob-self containers (treated as one field block)
  const getCycleFields = useCallback((el: HTMLElement | null): HTMLElement[] => {
    if (!el) return []
    const SINGLE = 'input:not([type="hidden"]):not([type="file"]):not([disabled]), select:not([disabled])'
    if (el.matches(SINGLE)) return [el]

    const selfContainers = [...el.querySelectorAll<HTMLElement>('[data-ob-self]')]
    const result: HTMLElement[] = []

    for (const input of [...el.querySelectorAll<HTMLElement>(SINGLE)]) {
      const r = input.getBoundingClientRect()
      if (r.height <= 4 || r.height >= 72 || r.width <= 20) continue
      // If inside a data-ob-self container, use the container as the field (once)
      const parent = selfContainers.find(c => c.contains(input))
      if (parent) {
        if (!result.includes(parent)) result.push(parent)
      } else {
        result.push(input)
      }
    }
    return result
  }, [])

  const measureTarget = useCallback(() => {
    setModalOpen(!!getOpenAppModal())
    const el = getOnboardingInteractionEl(meta)
    // In cycle mode, measure the specific active field instead of the whole section
    if (meta?.advance === 'next' && el) {
      const fields = getCycleFields(el)
      if (fields.length > 0) {
        const active = fields[Math.min(fieldIndex, fields.length - 1)]
        const r = active.getBoundingClientRect()
        if (r.width >= 2 && r.height >= 2) { setTargetRect(r); return }
      }
    }
    setTargetRect(measureOnboardingTarget(meta))
  }, [meta, fieldIndex, getCycleFields])

  // Reset field cycling on step change
  useEffect(() => { setFieldIndex(0) }, [step])

  useEffect(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    setTargetRect(null)

    if (!active || needsLanguagePick || !meta) return

    const el = getOnboardingInteractionEl(meta)

    if (meta.scrollTarget && el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' })
        window.setTimeout(measureTarget, 350)
      })
    } else {
      measureTarget()
    }

    const poll = window.setInterval(measureTarget, 100)
    const stopPoll = window.setTimeout(() => clearInterval(poll), 10000)

    const onLayout = () => measureTarget()
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    const modalEl = el?.closest('[data-app-modal]')
    modalEl?.addEventListener('scroll', onLayout, true)

    return () => {
      clearInterval(poll)
      clearTimeout(stopPoll)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
      modalEl?.removeEventListener('scroll', onLayout, true)
    }
  }, [step, active, needsLanguagePick, meta, measureTarget])

  useEffect(() => {
    if (!active || needsLanguagePick || meta?.id !== 'add-stock') return
    let advanced = false
    const tryAdvance = () => {
      if (advanced || !getOpenAppModal()) return
      advanced = true
      nextRef.current()
    }
    tryAdvance()
    const mo = new MutationObserver(tryAdvance)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [step, active, needsLanguagePick, meta?.id])

  useEffect(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    if (!active || needsLanguagePick || meta?.advance !== 'click' || meta?.id === 'add-stock') return
    const el = getOnboardingInteractionEl(meta)
    if (!el) return
    const handler = () => window.setTimeout(() => nextRef.current(), 80)
    el.addEventListener('click', handler, { once: true })
    cleanupRef.current = () => el.removeEventListener('click', handler)
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [step, active, needsLanguagePick, meta])

  useEffect(() => {
    if (!active || needsLanguagePick || !showSpotlight) return
    const el = getOnboardingInteractionEl(meta)
    if (!el) return
    el.setAttribute('data-ob-active', '')
    return () => el.removeAttribute('data-ob-active')
  }, [step, active, needsLanguagePick, meta, showSpotlight])


  useEffect(() => {
    if (!active || needsLanguagePick) return
    const block = (e: Event) => {
      const node = e.target
      if (isPanelNode(node)) return
      if (node instanceof Element && node.closest('[data-ob-confirm]')) return
      if (node instanceof Node && isInsideOpenModal(node)) return
      if (isOnboardingInteractionNode(node, meta)) return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('click', block, true)
    document.addEventListener('pointerdown', block, true)
    return () => {
      document.removeEventListener('click', block, true)
      document.removeEventListener('pointerdown', block, true)
    }
  }, [step, active, needsLanguagePick, meta])

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPanelH(el.offsetHeight))
    ro.observe(el)
    setPanelH(el.offsetHeight)
    return () => ro.disconnect()
  }, [step, s?.title, s?.description, s?.tapHint, showSpotlight, useCenteredCallout])

  useLayoutEffect(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const hole = showSpotlight ? targetRect : null

    if (useCenteredCallout) {
      // Modal steps: card snaps to top so entire form is visible below
      const snap = meta?.snapToViewport ?? (isModalTarget ? 'top' : undefined)
      setLayout(computeCalloutLayout(null, vw, vh, panelH, { prefer: 'center', snap }))
      return
    }

    const prefer =
      meta?.placement === 'top' ? 'top' : meta?.placement === 'bottom' ? 'bottom' : 'auto'
    const maxBottom = hole ? hole.top - 12 : undefined
    setLayout(
      computeCalloutLayout(hole, vw, vh, panelH, { prefer, maxBottom }),
    )
  }, [targetRect, panelH, step, useCenteredCallout, showSpotlight, meta?.placement, meta?.snapToViewport, isModalTarget])

  if (!active || needsLanguagePick || !s) return null

  const panelStyle: CSSProperties = {
    position: 'fixed',
    zIndex: OB_Z.panel,
    top: layout.top,
    left: layout.left,
    width: layout.width,
    pointerEvents: 'auto',
  }

  const scrimLayer = <SpotlightScrim hole={showSpotlight ? targetRect : null} />

  const calloutLayer = (
    <div
      id="ob-callout"
      ref={panelRef}
      className={`ob-callout-card ob-callout-panel ${useCenteredCallout ? 'ob-callout-center' : 'ob-callout-anchored'}`}
      style={panelStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ob-callout-title"
    >
      {!useCenteredCallout && (
        <CalloutArrow placement={layout.placement} left={layout.arrowLeft} />
      )}

      <div key={step} className="ob-step-enter">
        <div className="ob-callout-header">
          <span className="ob-step-badge">{progressLabel}</span>
          <button type="button" onClick={skip} className="ob-callout-close" aria-label={t('skip')}>
            <X size={16} />
          </button>
        </div>

        <div className={`ob-callout-main ${useCenteredCallout ? 'ob-callout-main--center' : ''}`}>
          <div className="ob-callout-title-row">
            <span className="ob-emoji-glow text-xl leading-none" aria-hidden>
              {s.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="ob-callout-kicker">{s.subtitle}</p>
              <p id="ob-callout-title" className="ob-callout-title">
                {s.title}
              </p>
            </div>
          </div>

          <p className="ob-callout-body whitespace-pre-line">{s.description}</p>

          {s.advance === 'click' && showSpotlight && (
            <p className="ob-tap-cue">{s.tapHint ?? t('ob_tap_highlight')}</p>
          )}

          {wantsTarget && !showSpotlight && !getOnboardingInteractionEl(meta) && (
            <p className="ob-waiting-hint">{t('ob_waiting_target')}</p>
          )}
        </div>

        <div className="ob-callout-actions">
          <button type="button" onClick={prev} disabled={isFirst} className="ob-nav-btn" aria-label={t('back')}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={skip} className="ob-skip-inline">
            {t('skip')}
          </button>
          <button type="button" onClick={() => nextRef.current()} className="ob-primary-btn flex-1 justify-center">
            {isLast ? t('finish') : s.advance === 'click' ? t('ob_continue') : t('next')}
            <ChevronRight size={14} />
          </button>
        </div>

        {isFirst && (
          <button type="button" onClick={skip} className="ob-skip-tour-link">
            {t('ob_skip_tour')}
          </button>
        )}
        {isLast && <p className="ob-profile-hint">{t('ob_profile_hint')}</p>}
      </div>
    </div>
  )

  // Confirm button: cycles through single-line fields one by one within a step
  const confirmBtn = (() => {
    if (!isModalTarget || meta?.advance !== 'next' || !targetRect) return null

    const el = getOnboardingInteractionEl(meta)
    const fields = getCycleFields(el)
    const hasCycle = fields.length > 1
    const currentField = fields[Math.min(fieldIndex, fields.length - 1)] ?? null

    const handleConfirm = () => {
      if (hasCycle && fieldIndex < fields.length - 1) {
        setFieldIndex(i => i + 1)
      } else {
        setFieldIndex(0)
        nextRef.current()
      }
    }

    // Position: inside the current field, vertically centred, at the far right
    const r = currentField?.getBoundingClientRect() ?? targetRect
    const SIZE = 40
    const INNER = 4 // gap from field's right/top edge
    const top = r.top + (r.height - SIZE) / 2
    const left = r.right - SIZE - INNER

    return createPortal(
      <button
        type="button"
        data-ob-confirm
        onClick={handleConfirm}
        aria-label="Confirm"
        style={{
          position: 'fixed',
          zIndex: OB_Z.panel - 2,
          top,
          left,
          width: SIZE,
          height: SIZE,
          background: 'linear-gradient(135deg, rgba(0,204,245,0.97), rgba(0,110,190,0.97))',
          border: '2px solid rgba(0,238,255,0.6)',
          borderRadius: '50%',
          color: '#07091a',
          fontWeight: 800,
          fontSize: '1.1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 0 18px rgba(0,204,245,0.5)',
        }}
      >
        ✓
      </button>,
      document.body,
    )
  })()

  return (
    <>
      {createPortal(scrimLayer, document.body)}
      {confirmBtn}
      {createPortal(calloutLayer, document.body)}
    </>
  )
}

export function OnboardingRestartButton() {
  const { restart } = useOnboarding()
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={() => {
        restart()
        navigate('/')
      }}
      className="ob-restart-btn"
    >
      <RotateCcw size={15} />
      {t('ob_restart')}
    </button>
  )
}
