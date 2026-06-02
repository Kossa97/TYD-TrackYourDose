/**
 * LiveCycleChartCanvas — Canvas-Verlaufsgraph für einen einzelnen Zyklus.
 * Pan-/Lese-Zustand lebt in Refs (60fps, kein Re-Render pro Frame).
 * Wischen: Finger rechts = Vergangenheit, kein Momentum/Snap.
 * Ablesen: Touch ~300ms halten (dann scrubben) / Maus-Hover.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { format } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'
import {
  lerpLevel, panViewEnd, clampViewEnd, pickDayTicks,
  type ChartPoint, type MarkerPoint, type NamedMarker,
} from './chartMath'
import { hapticTick } from '../../lib/haptics'

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

export interface LiveCycleChartHandle {
  jumpToStart: () => void
  jumpToNow: () => void
}

interface LiveCycleChartProps {
  points: ChartPoint[]
  doseMarkers: MarkerPoint[]
  peakMarkers: MarkerPoint[]
  namedMarkers?: NamedMarker[]
  accent: string
  windowMs: number
  height?: number
  onNavState?: (showJetzt: boolean, hasHistory: boolean) => void
}

export const LiveCycleChartCanvas = forwardRef<LiveCycleChartHandle, LiveCycleChartProps>(
function LiveCycleChartCanvas({
  points,
  doseMarkers,
  peakMarkers,
  namedMarkers = [],
  accent,
  windowMs,
  height = 180,
  onNavState,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Daten in Refs (draw liest nur Refs → keine stale closures)
  const pointsRef = useRef(points)
  const doseRef = useRef(doseMarkers)
  const peakRef = useRef(peakMarkers)
  const namedRef = useRef(namedMarkers)
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
  const lastHapticDay = useRef<number | null>(null)

  const [showJetzt, setShowJetzt] = useState(false)
  const [hasHistory, setHasHistory] = useState(false)
  const onNavStateRef = useRef(onNavState)
  useEffect(() => { onNavStateRef.current = onNavState }, [onNavState])
  const notifyNav = useCallback((jetzt: boolean, hist: boolean) => {
    setShowJetzt(jetzt); setHasHistory(hist)
    onNavStateRef.current?.(jetzt, hist)
  }, [])

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
    const Y_MAX = 112
    const tsToX = (ts: number) => dX + ((ts - viewStart) / win) * dW
    const lvToY = (lv: number) => dY + (1 - Math.max(0, Math.min(Y_MAX, lv)) / Y_MAX) * dH

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
    const readingX = isReadingRef.current
      ? tsToX(Math.max(viewStart, Math.min(viewEnd, readTsRef.current)))
      : null

    // Alle Marker sammeln
    type LiveMk = { x: number; y: number; text: string; color: string; dist: number; filled: boolean }
    const allMarkers: LiveMk[] = []
    for (const m of doseRef.current) {
      const x = tsToX(m.ts)
      if (x < dX - 6 || x > dX + dW + 6) continue
      const dist = readingX != null ? Math.abs(x - readingX) : Infinity
      allMarkers.push({ x, y: lvToY(m.level), text: 'Einnahme', color: '#10b981', dist, filled: true })
    }
    for (const m of peakRef.current) {
      const x = tsToX(m.ts)
      if (x < dX - 6 || x > dX + dW + 6) continue
      const dist = readingX != null ? Math.abs(x - readingX) : Infinity
      allMarkers.push({ x, y: lvToY(m.level), text: 'Peak', color: '#f59e0b', dist, filled: false })
    }

    // Gruppieren (< 10px = Split-Kreis)
    const SPLIT_THRESH = 10
    const liveGroups: LiveMk[][] = []
    for (const m of allMarkers) {
      const grp = liveGroups.find(g => Math.abs(g[0].x - m.x) <= SPLIT_THRESH)
      if (grp) grp.push(m)
      else liveGroups.push([m])
    }

    const nearCandidates: { x: number; y: number; text: string; color: string; dist: number }[] = []
    for (const grp of liveGroups) {
      const cx = grp.reduce((s, m) => s + m.x, 0) / grp.length
      const cy = grp.reduce((s, m) => s + m.y, 0) / grp.length
      const nearDist = Math.min(...grp.map(m => m.dist))
      const near = nearDist <= 26
      const r = near ? 4.5 : 3

      if (grp.length === 1) {
        const m = grp[0]
        if (m.filled) {
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fillStyle = m.color; ctx.globalAlpha = near ? 1 : 0.9; ctx.fill(); ctx.globalAlpha = 1
          if (near) { ctx.lineWidth = 1.5; ctx.strokeStyle = surface; ctx.stroke() }
        } else {
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fillStyle = m.color; ctx.globalAlpha = near ? 1 : 0.85; ctx.fill(); ctx.globalAlpha = 1
          ctx.lineWidth = 1; ctx.strokeStyle = surface; ctx.stroke()
        }
      } else {
        // Split-Kreis
        const n = grp.length
        const step = (2 * Math.PI) / n
        const start = -Math.PI / 2
        grp.forEach((m, i) => {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, r, start + i * step, start + (i + 1) * step)
          ctx.closePath()
          ctx.globalAlpha = near ? 1 : 0.9; ctx.fillStyle = m.color; ctx.fill(); ctx.globalAlpha = 1
        })
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.lineWidth = 1; ctx.strokeStyle = surface; ctx.stroke()
      }

      if (near) grp.forEach(m => nearCandidates.push({ x: cx, y: cy, text: m.text, color: m.color, dist: m.dist }))
    }
    ctx.restore()

    // Nahe NamedMarkers (Wirkungsbeginn etc.) zeichnen — gleich behandelt wie Sim-Marker
    for (const nm of namedRef.current) {
      const nx = tsToX(nm.ts)
      if (nx < dX - 6 || nx > dX + dW + 6) continue
      const ny = lvToY(lerpLevel(pts, nm.ts))
      const ndist = readingX != null ? Math.abs(nx - readingX) : Infinity
      const nnear = ndist <= 26
      ctx.beginPath(); ctx.arc(nx, ny, nnear ? 4 : 3, 0, Math.PI * 2)
      ctx.fillStyle = nm.color; ctx.globalAlpha = nnear ? 1 : 0.8; ctx.fill(); ctx.globalAlpha = 1
      ctx.lineWidth = 1; ctx.strokeStyle = surface; ctx.stroke()
      if (nnear) nearCandidates.push({ x: nx, y: ny, text: nm.label, color: nm.color, dist: ndist })
    }

    // Labels gestapelt — gleiche Namen zusammenfassen ("Peak ×2" statt doppelt)
    if (nearCandidates.length > 0) {
      nearCandidates.sort((a, b) => a.dist - b.dist)
      // Dedup: gleicher Text → zusammenfassen mit Zähler
      const seen = new Map<string, { text: string; x: number; y: number; color: string; count: number; dist: number }>()
      for (const c of nearCandidates) {
        if (seen.has(c.text)) seen.get(c.text)!.count++
        else seen.set(c.text, { text: c.text, x: c.x, y: c.y, color: c.color, count: 1, dist: c.dist })
      }
      const unique = [...seen.values()].sort((a, b) => a.dist - b.dist)
      ctx.font = '9px ui-monospace,monospace'
      const LINE = 13
      const refX = unique[0].x
      const minY = Math.min(...unique.map(c => c.y))
      const stackH = unique.length * LINE
      const placeBelow = minY - stackH < dY + 6
      let labelY = placeBelow
        ? Math.max(...unique.map(c => c.y)) + 16
        : minY - 6
      ctx.globalAlpha = 0.95
      for (const lb of unique) {
        const text = lb.text
        const tw = ctx.measureText(text).width
        const lx = Math.max(dX + 2, Math.min(dX + dW - tw - 2, refX - tw / 2))
        ctx.textAlign = 'left'
        ctx.textBaseline = placeBelow ? 'top' : 'bottom'
        ctx.fillStyle = lb.color
        ctx.fillText(text, lx, labelY)
        labelY += placeBelow ? LINE : -LINE
      }
      ctx.globalAlpha = 1
    }

    // Y-Achsen-Labels (ohne Balken — direkt auf dem Karten-Hintergrund)
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
      // Ables-Punkt nur zeigen, wenn kein Marker in der Nähe ist (< 8px)
      const nearestMarkerDist = nearCandidates.length > 0
        ? Math.min(...nearCandidates.map(c => c.dist))
        : Infinity
      if (nearestMarkerDist >= 8) {
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = surface; ctx.fill()
        ctx.strokeStyle = accentRef.current; ctx.lineWidth = 2; ctx.stroke()
      }

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
    namedRef.current = namedMarkers
    accentRef.current = accent
    windowMsRef.current = windowMs
    if (points.length) {
      const now = points[points.length - 1].ts
      const start = points[0].ts
      if (followLiveRef.current) viewEndRef.current = now
      viewEndRef.current = clampViewEnd(viewEndRef.current, start, now, windowMs)
      notifyNav(!followLiveRef.current, now - start > windowMs)
    }
    scheduleRedraw()
  }, [points, doseMarkers, peakMarkers, namedMarkers, accent, windowMs, scheduleRedraw])

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
    lastHapticDay.current = Math.floor(viewEndRef.current / (24 * 3_600_000))
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
    notifyNav(!followLiveRef.current, hasHistory)
    scheduleRedraw()

    // Haptic tick: einmal pro überschrittener Tagsgrenze
    const DAY_MS = 24 * 3_600_000
    const currentDay = Math.floor(ve / DAY_MS)
    if (lastHapticDay.current !== null && lastHapticDay.current !== currentDay) {
      void hapticTick()
    }
    lastHapticDay.current = currentDay
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
    notifyNav(false, hasHistory)
    scheduleRedraw()
  }

  const jumpToStart = () => {
    const pts = pointsRef.current
    if (!pts.length) return
    followLiveRef.current = false
    const now = pts[pts.length - 1].ts
    const start = pts[0].ts
    viewEndRef.current = clampViewEnd(start + windowMsRef.current, start, now, windowMsRef.current)
    notifyNav(true, hasHistory)
    scheduleRedraw()
  }

  useImperativeHandle(ref, () => ({ jumpToStart, jumpToNow }), [jumpToStart, jumpToNow])

  return (
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
  )
})

