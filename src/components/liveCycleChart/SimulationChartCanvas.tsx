/**
 * SimulationChartCanvas — statischer Canvas-Graph für die manuelle PK-Simulation.
 * Gleicher Look wie LiveCycleChartCanvas, aber: X-Achse = Stunden nach Injektion,
 * keine Pan/Live-Logik, keine Marker, keine Referenzlinien.
 * Ablesen: Maus-Hover (Desktop) bzw. Berühren/Ziehen (Touch) → exakter Wert.
 */
import { useCallback, useEffect, useRef } from 'react'
import { lerpLevel, type ChartPoint } from './chartMath'

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
  xTicks,
  accent,
  height = 260,
}: {
  /** ts = Stunden nach Injektion, level = % (auf Peak = 100 normiert) */
  points: ChartPoint[]
  xTicks: number[]
  accent: string
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const pointsRef = useRef(points)
  const xTicksRef = useRef(xTicks)
  const accentRef = useRef(accent)
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
    const tsToX = (ts: number) => dX + ((ts - xStart) / xSpan) * dW
    const lvToY = (lv: number) => dY + (1 - Math.max(0, Math.min(100, lv)) / 100) * dH

    const style = getComputedStyle(document.documentElement)
    const border = style.getPropertyValue('--border').trim() || 'rgba(255,255,255,0.06)'
    const muted = style.getPropertyValue('--text-muted').trim() || 'rgba(154,170,191,0.55)'
    const surface = style.getPropertyValue('--surface').trim() || 'rgba(6,10,24,0.92)'

    // Gridlines + Y-Labels
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    for (const lv of [0, 25, 50, 75, 100]) {
      const y = lvToY(lv)
      ctx.beginPath(); ctx.moveTo(dX, y); ctx.lineTo(dX + dW, y); ctx.stroke()
    }

    // X-Ticks (Stunden)
    ctx.font = '10px ui-monospace,monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const tick of xTicksRef.current) {
      if (tick < xStart || tick > xEnd) continue
      const x = tsToX(tick)
      ctx.strokeStyle = border
      ctx.beginPath(); ctx.moveTo(x, dY); ctx.lineTo(x, dY + dH); ctx.stroke()
      ctx.fillStyle = muted
      ctx.fillText(`${tick}h`, x, dY + dH + 5)
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
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = surface; ctx.fill()
      ctx.strokeStyle = accentRef.current; ctx.lineWidth = 2; ctx.stroke()

      const label = `${ts.toFixed(1)}h · ${lv.toFixed(1)}%`
      ctx.font = '11px ui-monospace,monospace'
      const chipW = ctx.measureText(label).width + 16
      const chipH = 24
      let cx = x + 8
      if (cx + chipW > dX + dW) cx = x - 8 - chipW
      const cy = dY + 2
      ctx.fillStyle = 'rgba(7,9,26,0.95)'
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
    xTicksRef.current = xTicks
    accentRef.current = accent
    scheduleRedraw()
  }, [points, xTicks, accent, scheduleRedraw])

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
