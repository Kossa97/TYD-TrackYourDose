import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  clampViewEnd,
  panHapticStepMs,
  panViewEnd,
} from '../../../components/liveCycleChart/chartMath'
import { hapticTick } from '../../../lib/haptics'

const HOLD_MS = 300
const HOLD_MOVE_PX = 6
const MIN_PX_PER_TICK = 52

interface Args {
  /** Ältester Datenpunkt als Timestamp. */
  dataStart: number
  /** Rechter Anschlag (heute) als Timestamp. */
  now: number
  /** Breite des Sichtfensters in ms. */
  windowMs: number
  /** Ables-Position an den ChartPointerContext melden (null = aus). */
  onPointerX: (x: number | null) => void
}

export interface ChartPanHandle {
  jumpToNow: () => void
  jumpToTs: (ts: number) => void
}

/**
 * Pan-/Lese-Geste für den Verlaufs-Chart — gleiche Mathematik und gleiches
 * Verhalten wie der Blutspiegel-Chart: Finger rechts = Vergangenheit, kein
 * Momentum, Touch ~300ms halten = ablesen, Maus-Hover = ablesen.
 */
export function useChartPan({ dataStart, now, windowMs, onPointerX }: Args) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const viewEndRef = useRef(now)
  const followNowRef = useRef(true)
  const [viewEnd, setViewEnd] = useState(now)

  const rafRef = useRef<number | null>(null)
  const isPanning = useRef(false)
  const isReading = useRef(false)
  const panStartX = useRef(0)
  const panStartViewEnd = useRef(0)
  const holdTimer = useRef<number | null>(null)
  const lastHapticTick = useRef<number | null>(null)

  // Nur ein State-Update pro Frame — Recharts rendert das SVG sonst pro Move-Event neu.
  const commit = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setViewEnd(viewEndRef.current)
    })
  }, [])

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    if (holdTimer.current != null) clearTimeout(holdTimer.current)
  }, [])

  // Datengrenzen oder Fenstergröße geändert → Anker nachziehen.
  useEffect(() => {
    if (followNowRef.current) viewEndRef.current = now
    viewEndRef.current = clampViewEnd(viewEndRef.current, dataStart, now, windowMs)
    setViewEnd(viewEndRef.current)
  }, [dataStart, now, windowMs])

  const localX = useCallback((clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return rect ? clientX - rect.left : 0
  }, [])

  const stopReading = useCallback(() => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (isReading.current) {
      isReading.current = false
      onPointerX(null)
    }
  }, [onPointerX])

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isPanning.current = true
    panStartX.current = e.clientX
    panStartViewEnd.current = viewEndRef.current
    lastHapticTick.current = null

    if (e.pointerType === 'mouse') {
      // Maus: Drücken startet Pan → Hover-Ablesen beenden
      isReading.current = false
      onPointerX(null)
      return
    }
    // Touch/Pen: ~300ms halten → Ablesen
    if (holdTimer.current != null) clearTimeout(holdTimer.current)
    const cx = e.clientX
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      isReading.current = true
      onPointerX(localX(cx))
    }, HOLD_MS)
  }, [localX, onPointerX])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Maus-Hover ohne gedrückte Taste → ablesen
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      isReading.current = true
      onPointerX(localX(e.clientX))
      return
    }
    if (!isPanning.current) return
    if (isReading.current) {
      onPointerX(localX(e.clientX))
      return
    }

    const dx = e.clientX - panStartX.current
    if (Math.abs(dx) > HOLD_MOVE_PX && holdTimer.current != null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }

    const width = wrapRef.current?.offsetWidth ?? 320
    const ve = clampViewEnd(
      panViewEnd(panStartViewEnd.current, dx, width, windowMs),
      dataStart, now, windowMs,
    )
    viewEndRef.current = ve
    followNowRef.current = ve >= now - 1000
    commit()

    const stepMs = panHapticStepMs(ve - windowMs, ve, width, MIN_PX_PER_TICK)
    const tickIdx = Math.floor(ve / stepMs)
    if (lastHapticTick.current !== null && lastHapticTick.current !== tickIdx) {
      void hapticTick()
    }
    lastHapticTick.current = tickIdx
  }, [commit, dataStart, localX, now, onPointerX, windowMs])

  const endInteraction = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    isPanning.current = false
    if (e.pointerType !== 'mouse') stopReading()
    else if (holdTimer.current != null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [stopReading])

  const onPointerLeave = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      isReading.current = false
      onPointerX(null)
    }
  }, [onPointerX])

  const jumpToNow = useCallback(() => {
    followNowRef.current = true
    viewEndRef.current = now
    setViewEnd(now)
  }, [now])

  const jumpToTs = useCallback((ts: number) => {
    // Ziel-Zeitpunkt links im Fenster zeigen (wie jumpToStart beim Blutspiegel).
    const ve = clampViewEnd(ts + windowMs, dataStart, now, windowMs)
    followNowRef.current = ve >= now - 1000
    viewEndRef.current = ve
    setViewEnd(ve)
  }, [dataStart, now, windowMs])

  return {
    wrapRef,
    viewStart: viewEnd - windowMs,
    viewEnd,
    showJetzt: viewEnd < now - 1000,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endInteraction,
      onPointerCancel: endInteraction,
      onPointerLeave,
    },
    jumpToNow,
    jumpToTs,
  }
}
