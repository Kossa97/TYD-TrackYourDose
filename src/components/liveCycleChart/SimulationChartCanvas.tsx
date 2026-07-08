/**
 * SimulationChartCanvas — statischer Canvas-Graph für die manuelle PK-Simulation.
 * Gleicher Look wie LiveCycleChartCanvas, aber: X-Achse = Stunden nach Injektion,
 * keine Pan/Live-Logik, keine Marker, keine Referenzlinien.
 * Ablesen: Maus-Hover (Desktop) bzw. Berühren/Ziehen (Touch) → exakter Wert.
 */
import { useCallback, useEffect, useRef } from 'react'
import { lerpLevel, pickNiceTicks, type ChartPoint, type NamedMarker } from './chartMath'

const PAD = { top: 16, right: 12, bottom: 40, left: 46 } as const

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function SimulationChartCanvas({
  points,
  accent,
  markers = [],
  phaseSplitTs,
  height = 260,
}: {
  /** ts = Stunden nach Injektion, level = % (auf Peak = 100 normiert) */
  points: ChartPoint[]
  accent: string
  markers?: NamedMarker[]
  /** Stunde, an der Anstiegs- in Abbauphase übergeht (Peak) — für dezente Tönung */
  phaseSplitTs?: number
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const pointsRef = useRef(points)
  const accentRef = useRef(accent)
  const markersRef = useRef(markers)
  const phaseRef = useRef(phaseSplitTs)
  const isReadingRef = useRef(false)
  const readXRef = useRef(0)
  const drawRaf = useRef<number | null>(null)

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

    const xStart = pts[0].ts
    const xEnd = pts[pts.length - 1].ts
    const xSpan = xEnd - xStart || 1
    const Y_MAX = 112
    const tsToX = (ts: number) => dX + ((ts - xStart) / xSpan) * dW
    const lvToY = (lv: number) => dY + (1 - Math.max(0, Math.min(Y_MAX, lv)) / Y_MAX) * dH

    const style = getComputedStyle(document.documentElement)
    const border = style.getPropertyValue('--border').trim() || 'rgba(255,255,255,0.06)'
    const muted = style.getPropertyValue('--text-muted').trim() || 'rgba(154,170,191,0.55)'
    const surface = style.getPropertyValue('--surface').trim() || '#060714'

    // Gridlines + Y-Labels
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    for (const lv of [0, 25, 50, 75, 100]) {
      const y = lvToY(lv)
      ctx.beginPath(); ctx.moveTo(dX, y); ctx.lineTo(dX + dW, y); ctx.stroke()
    }

    // X-Ticks (Stunden) — adaptive, runde Schritte gegen Überlappung
    const xTickVals = pickNiceTicks(xStart, xEnd, dW, 64)
    ctx.font = '10px ui-monospace,monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const tick of xTickVals) {
      if (tick < xStart || tick > xEnd) continue
      const x = tsToX(tick)
      ctx.strokeStyle = border
      ctx.beginPath(); ctx.moveTo(x, dY); ctx.lineTo(x, dY + dH); ctx.stroke()
      ctx.fillStyle = muted
      const lbl = (Number.isInteger(tick) ? `${tick}` : tick.toFixed(1)) + 'h'
      ctx.fillText(lbl, x, dY + dH + 5)
    }

    // X-Achsentitel
    ctx.fillStyle = muted
    ctx.font = '10px ui-monospace,monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('Zeit nach Injektion (Stunden)', dX + dW / 2, cssH - 2)

    // Kurve (auf Plot geclippt)
    ctx.save()
    ctx.beginPath(); ctx.rect(dX, dY, dW, dH); ctx.clip()
    const grad = ctx.createLinearGradient(0, dY, 0, dY + dH)
    grad.addColorStop(0, accentRef.current + '38')
    grad.addColorStop(1, accentRef.current + '00')
    ctx.beginPath()
    ctx.moveTo(tsToX(pts[0].ts), lvToY(pts[0].level))
    for (let i = 1; i < pts.length; i++) ctx.lineTo(tsToX(pts[i].ts), lvToY(pts[i].level))
    ctx.lineTo(tsToX(pts[pts.length - 1].ts), dY + dH)
    ctx.lineTo(tsToX(pts[0].ts), dY + dH)
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
    // Phasen-Tönung: Anstiegsphase (bis Peak) ganz leicht heller
    const splitTs = phaseRef.current
    if (splitTs != null && splitTs > xStart && splitTs < xEnd) {
      ctx.save()
      ctx.beginPath(); ctx.rect(dX, dY, tsToX(splitTs) - dX, dH); ctx.clip()
      ctx.beginPath()
      ctx.moveTo(tsToX(pts[0].ts), lvToY(pts[0].level))
      for (let i = 1; i < pts.length; i++) ctx.lineTo(tsToX(pts[i].ts), lvToY(pts[i].level))
      ctx.lineTo(tsToX(pts[pts.length - 1].ts), dY + dH)
      ctx.lineTo(tsToX(pts[0].ts), dY + dH)
      ctx.closePath(); ctx.fillStyle = accentRef.current + '16'; ctx.fill()
      ctx.restore()
    }
    ctx.beginPath()
    ctx.moveTo(tsToX(pts[0].ts), lvToY(pts[0].level))
    for (let i = 1; i < pts.length; i++) ctx.lineTo(tsToX(pts[i].ts), lvToY(pts[i].level))
    ctx.strokeStyle = accentRef.current; ctx.lineWidth = 1.8; ctx.stroke()
    ctx.restore()

    // Y-Maske + Labels
    ctx.fillStyle = surface
    ctx.fillRect(0, 0, dX - 1, cssH)
    ctx.font = '10px ui-monospace,monospace'
    ctx.fillStyle = muted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const lv of [0, 25, 50, 75, 100]) ctx.fillText(`${lv}%`, dX - 6, lvToY(lv))
    ctx.save()
    ctx.translate(10, dY + dH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = muted
    ctx.fillText('Wirkstoffspiegel (%)', 0, 0)
    ctx.restore()

    // Marker — nahe Marker (< 10px) werden als Split-Kreis gezeichnet
    const readingX = isReadingRef.current
      ? tsToX(Math.max(xStart, Math.min(xEnd, readXRef.current)))
      : null

    // 1. Sichtbare Marker berechnen
    type MkEntry = { mx: number; my: number; label: string; color: string; dist: number }
    const visible: MkEntry[] = []
    for (const mk of markersRef.current) {
      if (mk.ts < xStart || mk.ts > xEnd) continue
      const mx = tsToX(mk.ts)
      const my = lvToY(lerpLevel(pts, mk.ts))
      const dist = readingX != null ? Math.abs(mx - readingX) : Infinity
      visible.push({ mx, my, label: mk.label, color: mk.color, dist })
    }

    // 2. Marker nach x-Position gruppieren (innerhalb 10px = selber Kreis)
    const SPLIT_THRESH = 10
    const groups: MkEntry[][] = []
    for (const m of visible) {
      const grp = groups.find(g => Math.abs(g[0].mx - m.mx) <= SPLIT_THRESH)
      if (grp) grp.push(m)
      else groups.push([m])
    }

    const simNear: MkEntry[] = []
    for (const grp of groups) {
      const cx = grp.reduce((s, m) => s + m.mx, 0) / grp.length
      const cy = grp.reduce((s, m) => s + m.my, 0) / grp.length
      const nearDist = Math.min(...grp.map(m => m.dist))
      const near = nearDist <= 26
      const r = near ? 4.4 : 3.2

      // Hairline (gemeinsam, mittlere Farbe bei Gruppe)
      ctx.strokeStyle = grp[0].color + (near ? '40' : '2b')
      ctx.lineWidth = 1; ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(cx, cy + r + 2); ctx.lineTo(cx, dY + dH); ctx.stroke()
      ctx.setLineDash([])

      if (grp.length === 1) {
        // Einfacher Punkt
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.globalAlpha = near ? 1 : 0.9; ctx.fillStyle = grp[0].color; ctx.fill(); ctx.globalAlpha = 1
        ctx.lineWidth = 1; ctx.strokeStyle = surface; ctx.stroke()
      } else {
        // Split-Kreis: N gleichmäßige Tortensegmente
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

      if (near) grp.forEach(m => simNear.push({ ...m, mx: cx, my: cy }))
    }

    // Alle nahen Marker-Labels gestapelt anzeigen (jeder in seiner Farbe)
    if (simNear.length > 0) {
      simNear.sort((a, b) => a.dist - b.dist)
      ctx.font = '9px ui-monospace,monospace'
      const LINE = 13
      const refX = simNear[0].mx
      const minY = Math.min(...simNear.map(c => c.my))
      const stackH = simNear.length * LINE
      const placeBelow = minY - stackH < dY + 6
      let labelY = placeBelow
        ? Math.max(...simNear.map(c => c.my)) + 16
        : minY - 6
      ctx.globalAlpha = 0.95
      for (const lb of simNear) {
        const tw = ctx.measureText(lb.label).width
        const lx = Math.max(dX + 2, Math.min(dX + dW - tw - 2, refX - tw / 2))
        ctx.textAlign = 'left'
        ctx.textBaseline = placeBelow ? 'top' : 'bottom'
        ctx.fillStyle = lb.color
        ctx.fillText(lb.label, lx, labelY)
        labelY += placeBelow ? LINE : -LINE
      }
      ctx.globalAlpha = 1
    }

    // Ables-Linie
    if (isReadingRef.current) {
      const ts = Math.max(xStart, Math.min(xEnd, readXRef.current))
      const x = tsToX(ts)
      const lv = lerpLevel(pts, ts)
      const y = lvToY(lv)
      ctx.strokeStyle = 'rgba(226,232,240,0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 2])
      ctx.beginPath(); ctx.moveTo(x, dY); ctx.lineTo(x, dY + dH); ctx.stroke()
      ctx.setLineDash([])
      // Ables-Punkt nur zeigen, wenn kein Marker in der Nähe ist (< 8px) — sonst doppelte Punkte
      const nearestSimDist = simNear.length > 0 ? simNear[0].dist : Infinity
      if (nearestSimDist >= 8) {
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = surface; ctx.fill()
        ctx.strokeStyle = accentRef.current; ctx.lineWidth = 2; ctx.stroke()
      }

      const label = `${ts.toFixed(1)}h · ${lv.toFixed(1)}%`
      ctx.font = '11px ui-monospace,monospace'
      const chipW = ctx.measureText(label).width + 16
      const chipH = 24
      let cx = x + 8
      if (cx + chipW > dX + dW) cx = x - 8 - chipW
      const cy = dY + 2
      ctx.fillStyle = surface
      ctx.strokeStyle = accentRef.current + '66'
      ctx.lineWidth = 1
      roundRect(ctx, cx, cy, chipW, chipH, 8)
      ctx.fill(); ctx.stroke()
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = accentRef.current
      ctx.fillText(label, cx + 8, cy + chipH / 2)
    }
  }, [])

  const scheduleRedraw = useCallback(() => {
    if (drawRaf.current) cancelAnimationFrame(drawRaf.current)
    drawRaf.current = requestAnimationFrame(draw)
  }, [draw])

  useEffect(() => {
    pointsRef.current = points
    accentRef.current = accent
    markersRef.current = markers
    phaseRef.current = phaseSplitTs
    scheduleRedraw()
  }, [points, accent, markers, phaseSplitTs, scheduleRedraw])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(scheduleRedraw)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scheduleRedraw])

  const clientXToTs = (clientX: number) => {
    const wrap = wrapRef.current
    const pts = pointsRef.current
    if (!wrap || !pts.length) return 0
    const rect = wrap.getBoundingClientRect()
    const dW = rect.width - PAD.left - PAD.right
    const frac = Math.max(0, Math.min(1, (clientX - rect.left - PAD.left) / dW))
    const xStart = pts[0].ts
    const xEnd = pts[pts.length - 1].ts
    return xStart + frac * (xEnd - xStart)
  }

  const startRead = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    isReadingRef.current = true
    readXRef.current = clientXToTs(e.clientX)
    scheduleRedraw()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    // Maus: nur bei Hover ODER gedrückt lesen; Touch: nur während Berührung (buttons>0)
    if (e.pointerType === 'mouse' || e.buttons > 0) {
      isReadingRef.current = true
      readXRef.current = clientXToTs(e.clientX)
      scheduleRedraw()
    }
  }

  const endRead = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') {
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

  return (
    <div ref={wrapRef} style={{ height, touchAction: 'pan-y', userSelect: 'none', cursor: 'crosshair' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
        onPointerDown={startRead}
        onPointerMove={onPointerMove}
        onPointerUp={endRead}
        onPointerCancel={endRead}
        onPointerLeave={onPointerLeave}
      />
    </div>
  )
}
