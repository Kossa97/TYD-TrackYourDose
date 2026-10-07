/**
 * Der Blutspiegel-Graph, nach dem Vorbild der Aktien-App:
 *
 *  - Kein Rahmen, keine Karte. Flaeche mit Verlauf, Y-Werte rechts, Zeit unten.
 *  - Fester Zeitraum (vom Aufrufer), Y-Achse passt sich dem Ausschnitt an.
 *  - Wechsel von Zeitraum oder Substanz gleitet (Achsen) bzw. blendet (Kurve)
 *    in ~350 ms, statt zu springen.
 *  - Finger auf den Graph: senkrechte Linie + Punkt folgen dem Finger, der
 *    Teil rechts davon wird blasser; Wert und Zeit meldet `onScrub` an die
 *    Ueberschrift. Maus: sofort. Touch: waagerecht ziehen oder kurz halten —
 *    senkrecht bleibt Scrollen der Seite.
 *  - Einnahmen als feine Striche am unteren Rand (wie die Volumenbalken).
 *
 * Alles laeuft in einem Canvas mit requestAnimationFrame; React rendert den
 * Graph nur bei neuen Props, nicht pro Frame.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { hapticTick } from '../../../lib/haptics'
import {
  easeOutCubic,
  indexAtOrBefore,
  levelAt,
  timeStep,
  timeTicks,
  visibleSlice,
  yDomainFor,
  type LevelPoint,
  type YDomain,
} from './stocksChartMath'

export interface ChartMarker { ts: number; label: string; color: string }

export interface StocksChartProps {
  points: LevelPoint[]
  start: number
  end: number
  accent: string
  height: number
  /** Wechselt die Substanz, blendet die Kurve über statt zu gleiten. */
  seriesKey: string
  intakes?: number[]
  markers?: ChartMarker[]
  formatTick: (ts: number, stepMs: number) => string
  /** Eigene X-Ticks (z. B. Stunden nach der Gabe); Standard: Uhrzeit/Tage. */
  xTicks?: (start: number, end: number, widthPx: number) => { ticks: number[]; step: number }
  formatValue?: (value: number) => string
  onScrub?: (point: LevelPoint | null) => void
  ariaLabel: string
  /** Punkt am Kurvenende (Live). */
  liveEnd?: boolean
}

const AXIS_RIGHT = 38
const AXIS_BOTTOM = 22
const INTAKE_STRIP = 12
const PAD_TOP = 10
const ANIM_MS = 350
const REVEAL_MS = 650
const HOLD_MS = 180
const DRAG_START_PX = 6

interface View { start: number; end: number; lo: number; hi: number }

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim()
  return v || fallback
}

export const StocksChart = memo(function StocksChart({
  points, start, end, accent, height, seriesKey, intakes = [], markers = [],
  formatTick, xTicks, formatValue = v => String(Math.round(v)), onScrub, ariaLabel, liveEnd = false,
}: StocksChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const widthRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  // Was gerade gezeichnet wird (animiert) und wohin es geht.
  const viewRef = useRef<View | null>(null)
  const fromViewRef = useRef<View | null>(null)
  const targetViewRef = useRef<View | null>(null)
  const animStartRef = useRef(0)

  // Kurven-Ueberblendung beim Substanzwechsel
  const pointsRef = useRef(points)
  const prevPointsRef = useRef<LevelPoint[] | null>(null)
  const prevAccentRef = useRef(accent)
  const currentAccentRef = useRef(accent)
  const fadeStartRef = useRef(0)
  const seriesKeyRef = useRef(seriesKey)
  const revealStartRef = useRef<number | null>(null)

  const propsRef = useRef({ intakes, markers, formatTick, xTicks, formatValue, liveEnd, height })
  const onScrubRef = useRef(onScrub)
  useLayoutEffect(() => {
    propsRef.current = { intakes, markers, formatTick, xTicks, formatValue, liveEnd, height }
    onScrubRef.current = onScrub
  })

  const scrubTsRef = useRef<number | null>(null)
  const lastHapticBucketRef = useRef<number | null>(null)

  // ── Zeichnen ──────────────────────────────────────────────────────────────
  // Die Zeichenfunktion plant sich selbst neu, solange etwas gleitet; ueber
  // den Ref, weil sie sich innerhalb ihrer eigenen Definition nicht kennt.
  const drawRef = useRef<(now: number) => void>(() => {})
  const draw = useCallback((now: number) => {
    rafRef.current = null
    const canvas = canvasRef.current
    const target = targetViewRef.current
    if (!canvas || !target) return
    const width = widthRef.current
    const color = currentAccentRef.current
    const { intakes: intakeList, markers: markerList, formatTick: fmtTick, xTicks: customTicks, formatValue: fmtValue, liveEnd: showLive, height: h } = propsRef.current
    if (width <= 0) return

    const reduced = prefersReducedMotion()
    let animating = false

    // Achsen gleiten
    const from = fromViewRef.current
    let view = target
    if (from && !reduced) {
      const t = Math.min(1, (now - animStartRef.current) / ANIM_MS)
      const e = easeOutCubic(t)
      view = {
        start: lerp(from.start, target.start, e),
        end: lerp(from.end, target.end, e),
        lo: lerp(from.lo, target.lo, e),
        hi: lerp(from.hi, target.hi, e),
      }
      if (t < 1) animating = true
      else fromViewRef.current = null
    }
    viewRef.current = view

    // Kurve blendet
    let fade = 1
    if (prevPointsRef.current && !reduced) {
      fade = Math.min(1, (now - fadeStartRef.current) / ANIM_MS)
      if (fade < 1) animating = true
      else prevPointsRef.current = null
    }

    // Erster Auftritt: Kurve waechst von links
    let reveal = 1
    if (revealStartRef.current != null && !reduced) {
      reveal = easeOutCubic(Math.min(1, (now - revealStartRef.current) / REVEAL_MS))
      if (reveal < 1) animating = true
      else revealStartRef.current = null
    }

    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, h)

    const muted = cssVar(canvas, '--text-muted', '#8a94a6')
    const grid = 'rgba(148,163,184,0.16)'
    const surface = cssVar(canvas, '--surface', '#05060d')

    const plotL = 0
    const plotR = width - AXIS_RIGHT
    const plotT = PAD_TOP
    const plotB = h - AXIS_BOTTOM - INTAKE_STRIP
    const plotW = plotR - plotL
    const plotH = plotB - plotT
    const span = Math.max(1, view.end - view.start)
    const xOf = (ts: number) => plotL + ((ts - view.start) / span) * plotW
    const yOf = (lv: number) => plotB - ((lv - view.lo) / Math.max(1e-9, view.hi - view.lo)) * plotH

    // Horizontale Linien + Werte rechts (die Ziel-Ticks, mit gleitender Lage)
    ctx.font = '500 11px ui-sans-serif, system-ui, -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.lineWidth = 1
    for (const tick of targetDomainTicks(target)) {
      const y = Math.round(yOf(tick)) + 0.5
      if (y < plotT - 1 || y > plotB + 1) continue
      ctx.strokeStyle = grid
      ctx.beginPath(); ctx.moveTo(plotL, y); ctx.lineTo(plotR, y); ctx.stroke()
      ctx.fillStyle = muted
      ctx.fillText(fmtValue(tick), plotR + 8, y)
    }

    // Senkrechte Linien + Zeit unten
    const xAxis = customTicks
      ? customTicks(view.start, view.end, plotW)
      : (() => { const step = timeStep(view.start, view.end, plotW); return { step, ticks: timeTicks(view.start, view.end, step) } })()
    const step = xAxis.step
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (const ts of xAxis.ticks) {
      const x = Math.round(xOf(ts)) + 0.5
      ctx.strokeStyle = grid
      ctx.beginPath(); ctx.moveTo(x, plotT); ctx.lineTo(x, plotB + INTAKE_STRIP); ctx.stroke()
      ctx.fillStyle = muted
      const label = fmtTick(ts, step)
      if (x + 4 + ctx.measureText(label).width < plotR) ctx.fillText(label, x + 4, plotB + INTAKE_STRIP + 6)
    }
    // Grundlinie
    ctx.strokeStyle = grid
    ctx.beginPath(); ctx.moveTo(plotL, plotB + INTAKE_STRIP + 0.5); ctx.lineTo(plotR, plotB + INTAKE_STRIP + 0.5); ctx.stroke()

    // Einnahmen als Striche
    ctx.fillStyle = muted
    for (const ts of intakeList) {
      if (ts < view.start || ts > view.end) continue
      const x = xOf(ts)
      ctx.fillRect(Math.round(x) - 1, plotB + 3, 2, INTAKE_STRIP - 4)
    }

    // Kurve(n)
    const scrubTs = scrubTsRef.current
    const revealX = plotL + plotW * reveal
    const drawSeries = (pts: LevelPoint[], stroke: string, alpha: number) => {
      const slice = visibleSlice(pts, view.start, view.end)
      if (slice.length < 2 || alpha <= 0) return
      const path = new Path2D()
      slice.forEach((p, i) => {
        const x = xOf(p.ts)
        const y = yOf(p.level)
        if (i === 0) path.moveTo(x, y)
        else path.lineTo(x, y)
      })
      const firstX = xOf(slice[0].ts)
      const lastX = xOf(slice[slice.length - 1].ts)
      const area = new Path2D(path)
      area.lineTo(lastX, plotB)
      area.lineTo(firstX, plotB)
      area.closePath()

      const paint = (dim: boolean) => {
        const grad = ctx.createLinearGradient(0, plotT, 0, plotB)
        grad.addColorStop(0, hexAlpha(stroke, dim ? 0.08 : 0.32))
        grad.addColorStop(1, hexAlpha(stroke, 0))
        ctx.fillStyle = grad
        ctx.fill(area)
        ctx.strokeStyle = dim ? hexAlpha(stroke, 0.35) : stroke
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke(path)
      }

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.beginPath(); ctx.rect(plotL, 0, Math.max(0, Math.min(plotR, revealX) - plotL), plotB); ctx.clip()
      if (scrubTs != null) {
        const sx = xOf(scrubTs)
        ctx.save(); ctx.beginPath(); ctx.rect(plotL, 0, sx - plotL, plotB); ctx.clip(); paint(false); ctx.restore()
        ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, plotR - sx, plotB); ctx.clip(); paint(true); ctx.restore()
      } else {
        paint(false)
      }
      ctx.restore()
    }
    const prev = prevPointsRef.current
    if (prev) drawSeries(prev, prevAccentRef.current, 1 - fade)
    const pts = pointsRef.current
    drawSeries(pts, color, fade)

    // Markierungen (manuelle Simulation)
    if (markerList.length && reveal >= 1) {
      ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, sans-serif'
      ctx.textBaseline = 'bottom'
      for (const m of markerList) {
        const lv = levelAt(pts, m.ts)
        if (lv == null || m.ts < view.start || m.ts > view.end) continue
        const x = xOf(m.ts)
        const y = yOf(lv)
        ctx.fillStyle = surface
        ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = m.color
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill()
        const w = ctx.measureText(m.label).width
        const lx = Math.min(Math.max(plotL, x - w / 2), plotR - w)
        ctx.fillStyle = muted
        ctx.fillText(m.label, lx, Math.max(plotT + 10, y - 8))
      }
    }

    // Live-Punkt am Ende
    if (showLive && scrubTs == null && reveal >= 1 && pts.length) {
      const last = pts[pts.length - 1]
      if (last.ts >= view.start && last.ts <= view.end + 60_000) {
        const x = xOf(last.ts)
        const y = yOf(last.level)
        ctx.fillStyle = hexAlpha(color, 0.25)
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill()
      }
    }

    // Ablese-Linie
    if (scrubTs != null) {
      const lv = levelAt(pts, scrubTs)
      const x = Math.round(xOf(scrubTs)) + 0.5
      ctx.strokeStyle = muted
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, plotT - 4); ctx.lineTo(x, plotB + INTAKE_STRIP); ctx.stroke()
      if (lv != null) {
        const y = yOf(lv)
        ctx.fillStyle = surface
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill()
      }
    }

    if (animating) rafRef.current = requestAnimationFrame(t => drawRef.current(t))
  }, [])
  useLayoutEffect(() => { drawRef.current = draw }, [draw])

  const schedule = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  // ── Props → Ziel-Ansicht ─────────────────────────────────────────────────
  useEffect(() => {
    const domain = yDomainFor(points, start, end)
    const nextTarget: View = { start, end, lo: domain.lo, hi: domain.hi }
    domainTicks.set(nextTarget, domain)
    const now = performance.now()
    const seriesChanged = seriesKeyRef.current !== seriesKey
    if (targetViewRef.current && viewRef.current) {
      fromViewRef.current = { ...viewRef.current }
      animStartRef.current = now
    } else {
      revealStartRef.current = now
    }
    if (seriesChanged && pointsRef.current.length) {
      prevPointsRef.current = pointsRef.current
      prevAccentRef.current = currentAccentRef.current
      fadeStartRef.current = now
    }
    currentAccentRef.current = accent
    seriesKeyRef.current = seriesKey
    pointsRef.current = points
    targetViewRef.current = nextTarget
    schedule()
  }, [points, start, end, seriesKey, accent, schedule])

  useEffect(() => { schedule() }, [intakes, markers, height, liveEnd, formatTick, schedule])

  // Breite
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w !== widthRef.current) {
        widthRef.current = w
        schedule()
      }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [schedule])

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }, [])

  // ── Ablesen ──────────────────────────────────────────────────────────────
  const gesture = useRef<{ id: number; x: number; y: number; scrubbing: boolean; hold: number | null } | null>(null)

  const scrubAt = useCallback((clientX: number) => {
    const canvas = canvasRef.current
    const view = viewRef.current
    const pts = pointsRef.current
    if (!canvas || !view || !pts.length) return
    const rect = canvas.getBoundingClientRect()
    const plotW = rect.width - AXIS_RIGHT
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / plotW))
    let ts = view.start + frac * (view.end - view.start)
    ts = Math.min(Math.max(ts, pts[0].ts), pts[pts.length - 1].ts)
    // auf den naechsten Datenpunkt einrasten (15-min-Raster)
    const i = indexAtOrBefore(pts, ts)
    const a = pts[Math.max(0, i)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const snap = Math.abs(ts - a.ts) <= Math.abs(b.ts - ts) ? a : b
    if (scrubTsRef.current === snap.ts) return
    scrubTsRef.current = snap.ts
    const bucket = Math.floor(snap.ts / timeStep(view.start, view.end, plotW))
    if (lastHapticBucketRef.current != null && bucket !== lastHapticBucketRef.current) void hapticTick()
    lastHapticBucketRef.current = bucket
    onScrubRef.current?.(snap)
    schedule()
  }, [schedule])

  const endScrub = useCallback(() => {
    const g = gesture.current
    if (g?.hold != null) window.clearTimeout(g.hold)
    gesture.current = null
    if (scrubTsRef.current == null) return
    scrubTsRef.current = null
    lastHapticBucketRef.current = null
    onScrubRef.current?.(null)
    schedule()
  }, [schedule])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointsRef.current.length) return
    const startScrub = e.pointerType === 'mouse'
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, scrubbing: startScrub, hold: null }
    if (startScrub) {
      scrubAt(e.clientX)
      return
    }
    const x = e.clientX
    gesture.current.hold = window.setTimeout(() => {
      const g = gesture.current
      if (!g || g.scrubbing) return
      g.scrubbing = true
      try { canvasRef.current?.setPointerCapture(g.id) } catch { /* ignore */ }
      void hapticTick()
      scrubAt(x)
    }, HOLD_MS)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) {
      return
    }
    if (!g.scrubbing) {
      const dx = Math.abs(e.clientX - g.x)
      const dy = Math.abs(e.clientY - g.y)
      if (dy > DRAG_START_PX && dy > dx) { endScrub(); return }
      if (dx < DRAG_START_PX) return
      g.scrubbing = true
      if (g.hold != null) window.clearTimeout(g.hold)
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    scrubAt(e.clientX)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const pts = pointsRef.current
    const view = viewRef.current
    if (!pts.length || !view) return
    if (e.key === 'Escape') { endScrub(); return }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const current = scrubTsRef.current ?? pts[pts.length - 1].ts
    const stepMs = (view.end - view.start) / 48
    const next = Math.min(Math.max(current + (e.key === 'ArrowLeft' ? -stepMs : stepMs), Math.max(view.start, pts[0].ts)), pts[pts.length - 1].ts)
    const lv = levelAt(pts, next)
    if (lv == null) return
    scrubTsRef.current = next
    onScrubRef.current?.({ ts: next, level: lv })
    schedule()
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onPointerLeave={e => { if (e.pointerType === 'mouse') endScrub() }}
        onKeyDown={onKeyDown}
        onBlur={endScrub}
        onContextMenu={e => e.preventDefault()}
        style={{
          display: 'block', width: '100%', height,
          touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none', outline: 'none', cursor: 'crosshair',
        }}
      />
    </div>
  )
})

// Ticks gehoeren zur Ziel-Ansicht; beim Gleiten wandern dieselben Linien mit.
const domainTicks = new WeakMap<View, YDomain>()
function targetDomainTicks(view: View): number[] {
  return domainTicks.get(view)?.ticks ?? []
}

/** '#rrggbb' + Deckkraft → rgba(). Andere Farbangaben bleiben, wie sie sind. */
function hexAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
