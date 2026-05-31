/**
 * LiveCycleChartCanvas — Canvas-Verlaufsgraph für einen einzelnen Zyklus.
 * Pan-/Lese-Zustand lebt in Refs (60fps, kein Re-Render pro Frame).
 * Wischen: Finger rechts = Vergangenheit, kein Momentum/Snap.
 * Ablesen: Touch ~300ms halten (dann scrubben) / Maus-Hover.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'
import {
  lerpLevel, panViewEnd, clampViewEnd, pickDayTicks,
  type ChartPoint, type MarkerPoint,
} from './chartMath'

const PAD = { top: 16, right: 10, bottom: 24, left: 40 } as const
const HOLD_MS = 300
const HOLD_MOVE_PX = 6
const MIN_PX_PER_TICK = 56

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function LiveCycleChartCanvas({
  points,
  doseMarkers,
  peakMarkers,
  accent,
  windowMs,
  height = 180,
}: {
  points: ChartPoint[]
  doseMarkers: MarkerPoint[]
  peakMarkers: MarkerPoint[]
  accent: string
  windowMs: number
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Daten in Refs (draw liest nur Refs → keine stale closures)
  const pointsRef = useRef(points)
  const doseRef = useRef(doseMarkers)
  const peakRef = useRef(peakMarkers)
  const accentRef = useRef(accent)
  const windowMsRef = useRef(windowMs)

  // Pan-/Lese-Zustand
  const viewEndRef = useRef(0)
  const followLiveRef = useRef(true)
  const isPanning = useRef(false)
  const panStartX = useRef(0)
  const panStartViewEnd = useRef(0)
  const holdTimer = useRef<number | null>(null)
  const isReadingRef = useRef(false)
  const readTsRef = useRef(0)
  const pointerTypeRef = useRef<string>('mouse')
  const drawRaf = useRef<number | null>(null)

  const [showJetzt, setShowJetzt] = useState(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const pts = pointsRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = wrap.offsetWidth
    const cssH = wrap.offsetHeight
    if (cssW < 10 || cssH < 10) return
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const dX = PAD.left, dY = PAD.top
    const dW = cssW - PAD.left - PAD.right
    const dH = cssH - PAD.top - PAD.bottom
    if (pts.length < 2) return

    const win = windowMsRef.current
    const now = pts[pts.length - 1].ts
    const viewEnd = viewEndRef.current
    const viewStart = viewEnd - win
    const tsToX = (ts: number) => dX + ((ts - viewStart) / win) * dW
    const lvToY = (lv: number) => dY + (1 - Math.max(0, Math.min(100, lv)) / 100) * dH

    const style = getComputedStyle(document.documentElement)
    const border = style.getPropertyValue('--border').trim() || 'rgba(255,255,255,0.06)'
    const muted = style.getPropertyValue('--text-muted').trim() || 'rgba(154,170,191,0.55)'
    const surface = style.getPropertyValue('--surface').trim() || 'rgba(6,10,24,0.92)'

    // Gridlines
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    for (const lv of [0, 25, 50, 75, 100]) {
      const y = lvToY(lv)
      ctx.beginPath(); ctx.moveTo(dX, y); ctx.lineTo(dX + dW, y); ctx.stroke()
    }

    // X-Ticks
    const ticks = pickDayTicks(viewStart, viewEnd, dW, MIN_PX_PER_TICK)
    ctx.font = '9px ui-monospace,monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const ts of ticks) {
      const x = tsToX(ts)
      if (x < dX - 2 || x > dX + dW + 2) continue
      ctx.strokeStyle = border
      ctx.beginPath(); ctx.moveTo(x, dY); ctx.lineTo(x, dY + dH); ctx.stroke()
      ctx.fillStyle = muted
      ctx.fillText(format(new Date(ts), 'EEE dd.', { locale: deLocale }), x, dY + dH + 4)
    }

    // Kurve + Marker (auf Plot geclippt)
    ctx.save()
    ctx.beginPath(); ctx.rect(dX, dY, dW, dH); ctx.clip()
    const buf = win * 0.05
    const vis = pts.filter(p => p.ts >= viewStart - buf && p.ts <= viewEnd + buf)
    if (vis.length >= 2) {
      const grad = ctx.createLinearGradient(0, dY, 0, dY + dH)
      grad.addColorStop(0, accentRef.current + '38')
      grad.addColorStop(1, accentRef.current + '00')
      ctx.beginPath()
      ctx.moveTo(tsToX(vis[0].ts), lvToY(vis[0].level))
      for (let i = 1; i < vis.length; i++) ctx.lineTo(tsToX(vis[i].ts), lvToY(vis[i].level))
      ctx.lineTo(tsToX(vis[vis.length - 1].ts), dY + dH)
      ctx.lineTo(tsToX(vis[0].ts), dY + dH)
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
      ctx.beginPath()
      ctx.moveTo(tsToX(vis[0].ts), lvToY(vis[0].level))
      for (let i = 1; i < vis.length; i++) ctx.lineTo(tsToX(vis[i].ts), lvToY(vis[i].level))
      ctx.strokeStyle = accentRef.current; ctx.lineWidth = 1.8; ctx.stroke()
    }
    for (const m of doseRef.current) {
      const x = tsToX(m.ts)
      if (x < dX - 6 || x > dX + dW + 6) continue
      ctx.beginPath(); ctx.arc(x, lvToY(m.level), 3, 0, Math.PI * 2)
      ctx.fillStyle = '#10b981'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1
    }
    for (const m of peakRef.current) {
      const x = tsToX(m.ts)
      if (x < dX - 6 || x > dX + dW + 6) continue
      ctx.beginPath(); ctx.arc(x, lvToY(m.level), 3, 0, Math.PI * 2)
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1
    }
    ctx.restore()

    // Y-Maske (deckt Überlauf links) + Labels
    ctx.fillStyle = surface
    ctx.fillRect(0, 0, dX - 1, cssH)
    ctx.font = '9px ui-monospace,monospace'
    ctx.fillStyle = muted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const lv of [0, 25, 50, 75, 100]) ctx.fillText(String(lv), dX - 5, lvToY(lv))
    ctx.save()
    ctx.translate(8, dY + dH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = muted
    ctx.fillText('Spiegel %', 0, 0)
    ctx.restore()

    // "jetzt"-Label
    const nowX = tsToX(now)
    if (nowX >= dX && nowX <= dX + dW) {
      ctx.fillStyle = '#00ccf5'
      ctx.font = '8px ui-monospace,monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText('jetzt', Math.min(nowX, dX + dW), dY - 2)
    }

    // Ables-Linie
    if (isReadingRef.current) {
      const ts = Math.max(viewStart, Math.min(viewEnd, readTsRef.current))
      const x = tsToX(ts)
      const lv = lerpLevel(pts, ts)
      const y = lvToY(lv)
      ctx.strokeStyle = 'rgba(226,232,240,0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 2])
      ctx.beginPath(); ctx.moveTo(x, dY); ctx.lineTo(x, dY + dH); ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = surface; ctx.fill()
      ctx.strokeStyle = accentRef.current; ctx.lineWidth = 2; ctx.stroke()

      const label = format(new Date(ts), 'EEE dd.MM · HH:mm', { locale: deLocale })
      const valStr = lv.toFixed(1) + '%'
      ctx.font = '9px ui-monospace,monospace'
      const chipW = Math.max(ctx.measureText(label).width, 40) + 16
      const chipH = 34
      let cx = x + 8
      if (cx + chipW > dX + dW) cx = x - 8 - chipW
      const cy = dY + 2
      ctx.fillStyle = 'rgba(7,9,26,0.95)'
      ctx.strokeStyle = accentRef.current + '66'
      ctx.lineWidth = 1
      roundRect(ctx, cx, cy, chipW, chipH, 8)
      ctx.fill(); ctx.stroke()
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillStyle = muted; ctx.fillText(label, cx + 8, cy + 6)
      ctx.fillStyle = accentRef.current
      ctx.font = '12px ui-monospace,monospace'
      ctx.fillText(valStr, cx + 8, cy + 18)
    }
  }, [])

  const scheduleRedraw = useCallback(() => {
    if (drawRaf.current) cancelAnimationFrame(drawRaf.current)
    drawRaf.current = requestAnimationFrame(draw)
  }, [draw])

  // Props → Refs synchronisieren, Anker pflegen, neu zeichnen
  useEffect(() => {
    pointsRef.current = points
    doseRef.current = doseMarkers
    peakRef.current = peakMarkers
    accentRef.current = accent
    windowMsRef.current = windowMs
    if (points.length) {
      const now = points[points.length - 1].ts
      const start = points[0].ts
      if (followLiveRef.current) viewEndRef.current = now
      viewEndRef.current = clampViewEnd(viewEndRef.current, start, now, windowMs)
      setShowJetzt(!followLiveRef.current)
    }
    scheduleRedraw()
  }, [points, doseMarkers, peakMarkers, accent, windowMs, scheduleRedraw])

  // ResizeObserver
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(scheduleRedraw)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scheduleRedraw])

  const clientXToTs = (clientX: number) => {
    const wrap = wrapRef.current
    if (!wrap) return viewEndRef.current
    const rect = wrap.getBoundingClientRect()
    const dW = rect.width - PAD.left - PAD.right
    const frac = Math.max(0, Math.min(1, (clientX - rect.left - PAD.left) / dW))
    return (viewEndRef.current - windowMsRef.current) + frac * windowMsRef.current
  }

  const onPointerDown = (e: React.PointerEvent) => {
    pointerTypeRef.current = e.pointerType
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    isPanning.current = true
    panStartX.current = e.clientX
    panStartViewEnd.current = viewEndRef.current
    if (e.pointerType === 'mouse') {
      // Maus: Drücken startet Pan → Hover-Ablesen beenden
      isReadingRef.current = false
      scheduleRedraw()
    } else {
      // Touch/Pen: ~300ms halten → Ablesen
      if (holdTimer.current) clearTimeout(holdTimer.current)
      const cx = e.clientX
      holdTimer.current = window.setTimeout(() => {
        isReadingRef.current = true
        readTsRef.current = clientXToTs(cx)
        scheduleRedraw()
      }, HOLD_MS)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    // Maus-Hover (kein Knopf gedrückt) → ablesen
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      isReadingRef.current = true
      readTsRef.current = clientXToTs(e.clientX)
      scheduleRedraw()
      return
    }
    if (!isPanning.current) return
    if (isReadingRef.current) {
      readTsRef.current = clientXToTs(e.clientX)
      scheduleRedraw()
      return
    }
    const dx = e.clientX - panStartX.current
    if (Math.abs(dx) > HOLD_MOVE_PX && holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    const pts = pointsRef.current
    if (!pts.length) return
    const now = pts[pts.length - 1].ts
    const start = pts[0].ts
    const wrap = wrapRef.current
    const dW = (wrap?.offsetWidth ?? 320) - PAD.left - PAD.right
    const ve = clampViewEnd(
      panViewEnd(panStartViewEnd.current, dx, dW, windowMsRef.current),
      start, now, windowMsRef.current,
    )
    viewEndRef.current = ve
    followLiveRef.current = ve >= now - 1000
    setShowJetzt(!followLiveRef.current)
    scheduleRedraw()
  }

  const endInteraction = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
    isPanning.current = false
    if (isReadingRef.current && pointerTypeRef.current !== 'mouse') {
      isReadingRef.current = false
      scheduleRedraw()
    }
  }

  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      isReadingRef.current = false
      scheduleRedraw()
    }
  }

  const jumpToNow = () => {
    const pts = pointsRef.current
    if (!pts.length) return
    followLiveRef.current = true
    viewEndRef.current = pts[pts.length - 1].ts
    setShowJetzt(false)
    scheduleRedraw()
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={wrapRef}
        style={{ height, touchAction: 'pan-y', userSelect: 'none', cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onPointerLeave={onPointerLeave}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
      {showJetzt && (
        <button
          type="button"
          onClick={jumpToNow}
          style={{
            position: 'absolute', top: 0, right: 2,
            fontSize: '0.52rem', fontWeight: 800, color: accent,
            background: `${accent}15`, border: `1px solid ${accent}25`,
            borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Jetzt ↩
        </button>
      )}
    </div>
  )
}
