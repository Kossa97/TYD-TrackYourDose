/**
 * LiveBlutspiegelChart — Canvas-based 7-day PK history chart.
 * All rendering via <canvas> + requestAnimationFrame (no Recharts).
 * Pan state lives in refs for 60fps performance; only button visibility
 * and tooltip live in React state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'
import type { CycleChartData } from '../services/liveBlutspiegelChart'

const WINDOW_MS = 7 * 24 * 3_600_000     // 7 days
const DAY_MS    = 24 * 3_600_000
const PAD = { top: 18, right: 12, bottom: 36, left: 40 } as const

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Binary-search linear interpolation. */
function lerp(pts: CycleChartData['points'], ts: number): number {
  if (!pts.length) return 0
  if (ts <= pts[0].timestamp) return pts[0].level
  if (ts >= pts[pts.length - 1].timestamp) return pts[pts.length - 1].level
  let lo = 0, hi = pts.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (pts[mid].timestamp <= ts) lo = mid; else hi = mid
  }
  const t = (ts - pts[lo].timestamp) / (pts[hi].timestamp - pts[lo].timestamp)
  return pts[lo].level + t * (pts[hi].level - pts[lo].level)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TooltipData {
  canvasX: number
  timestamp: number
  items: Array<{ name: string; level: number; accent: string }>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveBlutspiegelChart({
  cycles,
  loading = false,
}: {
  cycles: CycleChartData[]
  loading?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  // ── Refs (no re-render on change) ───────────────────────────────────────
  const panOffsetRef    = useRef(0)          // ms shifted left from "now"
  const maxOffsetRef    = useRef(0)
  const isPanning       = useRef(false)
  const panStartX       = useRef<number | null>(null)
  const panStartOff     = useRef(0)
  const velRef          = useRef(0)
  const lastPanX        = useRef(0)
  const lastPanT        = useRef(0)
  const momentumRaf     = useRef<number | null>(null)
  const drawRaf         = useRef<number | null>(null)
  const activeCyclesRef = useRef<CycleChartData[]>([])

  // ── State (only what drives React UI) ───────────────────────────────────
  const [activeCycleIds, setActiveCycleIds] = useState<Set<string>>(new Set())
  const [showJetzt, setShowJetzt]           = useState(false)
  const [tooltip, setTooltip]               = useState<TooltipData | null>(null)

  // Initialise toggles whenever data arrives
  useEffect(() => {
    if (cycles.length) setActiveCycleIds(new Set(cycles.map(c => c.cycleId)))
  }, [cycles.map(c => c.cycleId).join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  const activeCycles = useMemo(
    () => cycles.filter(c => activeCycleIds.has(c.cycleId)),
    [cycles, activeCycleIds],
  )

  // Keep ref in sync before draw fires
  useEffect(() => { activeCyclesRef.current = activeCycles }, [activeCycles])

  // Max pan (distance from oldest data-point to "now" minus one window)
  useEffect(() => {
    const allTs = cycles.flatMap(c => c.points.map(p => p.timestamp))
    maxOffsetRef.current = allTs.length
      ? Math.max(0, Date.now() - Math.min(...allTs) - WINDOW_MS)
      : 0
  }, [cycles])

  // ── Draw (reads only from refs — zero stale-closure issues) ─────────────
  const scheduleRedraw = useCallback(() => {
    if (drawRaf.current) cancelAnimationFrame(drawRaf.current)
    drawRaf.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current
      const wrap   = wrapRef.current
      if (!canvas || !wrap) return

      const dpr  = Math.min(window.devicePixelRatio || 1, 2)
      const cssW = wrap.offsetWidth
      const cssH = wrap.offsetHeight
      if (cssW < 10 || cssH < 10) return

      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width  = cssW * dpr
        canvas.height = cssH * dpr
      }

      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      const dX = PAD.left
      const dY = PAD.top
      const dW = cssW - PAD.left - PAD.right
      const dH = cssH - PAD.top - PAD.bottom

      const offsetMs  = panOffsetRef.current
      const now       = Date.now()
      const viewEnd   = now - offsetMs
      const viewStart = viewEnd - WINDOW_MS

      const tsToX = (ts: number) => dX + ((ts - viewStart) / WINDOW_MS) * dW
      const lvToY = (lv: number) => dY + (1 - Math.max(0, Math.min(100, lv)) / 100) * dH

      // ── Horizontal gridlines ────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth   = 1
      for (let lv = 0; lv <= 100; lv += 10) {
        const y = lvToY(lv)
        ctx.beginPath(); ctx.moveTo(dX, y); ctx.lineTo(dX + dW, y); ctx.stroke()
      }

      // ── X-axis day ticks ────────────────────────────────────────────────
      const firstTick = Math.ceil(viewStart / DAY_MS) * DAY_MS
      ctx.font         = '10px ui-monospace,monospace'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'top'
      for (let ts = firstTick; ts <= viewEnd + 1; ts += DAY_MS) {
        const x = tsToX(ts)
        if (x < dX - 2 || x > dX + dW + 2) continue
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.lineWidth   = 1
        ctx.beginPath(); ctx.moveTo(x, dY); ctx.lineTo(x, dY + dH); ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.28)'
        ctx.fillText(
          format(new Date(ts), 'EEE dd.', { locale: deLocale }),
          x, dY + dH + 5,
        )
      }

      // ── "Jetzt" line ────────────────────────────────────────────────────
      const nowX = tsToX(now)
      if (nowX >= dX && nowX <= dX + dW) {
        ctx.strokeStyle = '#00ccf5'
        ctx.lineWidth   = 1.5
        ctx.setLineDash([4, 3])
        ctx.beginPath(); ctx.moveTo(nowX, dY); ctx.lineTo(nowX, dY + dH); ctx.stroke()
        ctx.setLineDash([])
        ctx.font         = '9px ui-monospace,monospace'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle    = '#00ccf5'
        ctx.fillText('Jetzt', nowX, dY + 2)
      }

      // ── Per-cycle curves ────────────────────────────────────────────────
      const buf = WINDOW_MS * 0.02
      for (const cycle of activeCyclesRef.current) {
        if (cycle.points.length < 2) continue
        const pts = cycle.points.filter(
          p => p.timestamp >= viewStart - buf && p.timestamp <= viewEnd + buf,
        )
        if (pts.length < 2) continue

        // Gradient fill
        const grad = ctx.createLinearGradient(0, dY, 0, dY + dH)
        grad.addColorStop(0, cycle.accent + '44')
        grad.addColorStop(1, cycle.accent + '00')

        ctx.beginPath()
        ctx.moveTo(tsToX(pts[0].timestamp), lvToY(pts[0].level))
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(tsToX(pts[i].timestamp), lvToY(pts[i].level))
        }
        ctx.lineTo(tsToX(pts[pts.length - 1].timestamp), dY + dH)
        ctx.lineTo(tsToX(pts[0].timestamp), dY + dH)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()

        // Curve stroke
        ctx.beginPath()
        ctx.moveTo(tsToX(pts[0].timestamp), lvToY(pts[0].level))
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(tsToX(pts[i].timestamp), lvToY(pts[i].level))
        }
        ctx.strokeStyle = cycle.accent
        ctx.lineWidth   = 2
        ctx.setLineDash([])
        ctx.stroke()

        // Dose markers
        for (const m of cycle.doseMarkers) {
          const x = tsToX(m.timestamp)
          if (x < dX - 10 || x > dX + dW + 10) continue
          const lv = lerp(cycle.points, m.timestamp)
          const y  = lvToY(lv)

          if (m.status === 'taken') {
            // Vertical dashed stem
            ctx.strokeStyle = 'rgba(16,185,129,0.30)'
            ctx.lineWidth   = 1
            ctx.setLineDash([3, 3])
            ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, dY + dH); ctx.stroke()
            ctx.setLineDash([])
            // Green dot
            ctx.fillStyle   = '#10b981'
            ctx.strokeStyle = 'rgba(5,8,20,0.8)'
            ctx.lineWidth   = 1.5
            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
          } else {
            // Red ×
            const s = 4
            ctx.strokeStyle = '#ef4444'
            ctx.lineWidth   = 2
            ctx.setLineDash([])
            ctx.beginPath()
            ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s)
            ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s)
            ctx.stroke()
          }
        }

        // Peak markers (▲)
        ctx.save()
        ctx.shadowColor = cycle.accent
        ctx.shadowBlur  = 8
        ctx.fillStyle   = cycle.accent
        for (const pk of cycle.peakMarkers) {
          const x = tsToX(pk.timestamp)
          if (x < dX - 10 || x > dX + dW + 10) continue
          const y = lvToY(pk.level) - 12
          ctx.beginPath()
          ctx.moveTo(x,     y - 5)
          ctx.lineTo(x + 4, y + 3)
          ctx.lineTo(x - 4, y + 3)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      // ── Y-axis overlay (covers curve overflow) ──────────────────────────
      ctx.fillStyle = 'rgba(6,10,24,0.92)'
      ctx.fillRect(0, 0, PAD.left - 1, cssH)

      ctx.font         = '10px ui-monospace,monospace'
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle    = 'rgba(255,255,255,0.28)'
      for (let lv = 10; lv <= 100; lv += 10) {
        ctx.fillText(String(lv), PAD.left - 5, lvToY(lv))
      }
      // "%" unit label vertical
      ctx.save()
      ctx.translate(7, dY + dH / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.font         = '9px ui-monospace,monospace'
      ctx.fillStyle    = 'rgba(255,255,255,0.18)'
      ctx.fillText('%', 0, 0)
      ctx.restore()
    })
  }, [])  // Intentionally empty — reads all live values from refs

  // Trigger redraws
  useEffect(() => { scheduleRedraw() }, [activeCycles, scheduleRedraw])

  // ResizeObserver
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(scheduleRedraw)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scheduleRedraw])

  // ── Momentum ─────────────────────────────────────────────────────────────

  const cancelMomentum = () => {
    if (momentumRaf.current) { cancelAnimationFrame(momentumRaf.current); momentumRaf.current = null }
  }

  const startMomentum = (initVel: number, initOff: number) => {
    let vel = initVel
    let off = initOff
    const step = () => {
      vel *= 0.92
      off = Math.max(0, Math.min(maxOffsetRef.current, off + vel))
      panOffsetRef.current = off
      setShowJetzt(off > 0)
      scheduleRedraw()
      if (Math.abs(vel) > 0.5) momentumRaf.current = requestAnimationFrame(step)
    }
    momentumRaf.current = requestAnimationFrame(step)
  }

  // ── Pointer handlers ─────────────────────────────────────────────────────

  const onPointerDown = (e: React.PointerEvent) => {
    cancelMomentum()
    isPanning.current  = true
    panStartX.current  = e.clientX
    panStartOff.current = panOffsetRef.current
    lastPanX.current   = e.clientX
    lastPanT.current   = e.timeStamp
    velRef.current     = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setTooltip(null)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (isPanning.current && panStartX.current !== null) {
      const dx   = e.clientX - panStartX.current
      const dt   = e.timeStamp - lastPanT.current
      if (dt > 0) velRef.current = -(e.clientX - lastPanX.current) / dt * 16
      lastPanX.current = e.clientX
      lastPanT.current = e.timeStamp

      const wrap = wrapRef.current
      const dW   = (wrap?.offsetWidth ?? 360) - PAD.left - PAD.right
      const deltaMs = -(dx / dW) * WINDOW_MS
      const newOff  = Math.max(0, Math.min(maxOffsetRef.current, panStartOff.current + deltaMs))
      panOffsetRef.current = newOff
      setShowJetzt(newOff > 0)
      scheduleRedraw()
      return
    }

    // Hover tooltip
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const dX   = PAD.left
    const dW   = rect.width - PAD.left - PAD.right
    if (cssX < dX || cssX > dX + dW) { setTooltip(null); return }

    const now      = Date.now()
    const viewEnd  = now - panOffsetRef.current
    const viewStart = viewEnd - WINDOW_MS
    const ts = viewStart + ((cssX - dX) / dW) * WINDOW_MS

    const items = activeCyclesRef.current
      .filter(c => c.points.length > 0)
      .map(c => ({ name: c.peptideName, level: lerp(c.points, ts), accent: c.accent }))

    setTooltip({ canvasX: cssX, timestamp: ts, items })
  }

  const onPointerUp = () => {
    if (!isPanning.current) return
    isPanning.current = false
    panStartX.current = null
    const vel = velRef.current
    if (Math.abs(vel) > 1) startMomentum(vel, panOffsetRef.current)
  }

  const onPointerCancel = () => {
    isPanning.current = false
    panStartX.current = null
    cancelMomentum()
  }

  const toggleCycle = (id: string) => {
    setActiveCycleIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(154,170,191,0.45)', fontSize: '0.78rem' }}>Verlauf wird geladen…</span>
      </div>
    )
  }

  if (!cycles.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Cycle toggle buttons */}
      {cycles.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cycles.map(c => {
            const active = activeCycleIds.has(c.cycleId)
            return (
              <button
                key={c.cycleId}
                onClick={() => toggleCycle(c.cycleId)}
                style={{
                  padding: '4px 11px', borderRadius: 99,
                  fontSize: '0.68rem', fontWeight: 800, fontFamily: 'inherit',
                  border: `1px solid ${c.accent}50`,
                  background: active ? c.accent + '22' : 'transparent',
                  color: active ? c.accent : 'rgba(154,170,191,0.40)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {c.peptideName}
              </button>
            )
          })}
        </div>
      )}

      {/* Canvas wrapper */}
      <div style={{ position: 'relative' }}>
        <div
          ref={wrapRef}
          style={{ height: 240, touchAction: 'pan-y', userSelect: 'none', cursor: 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={() => { if (!isPanning.current) setTooltip(null) }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />

          {/* Tooltip */}
          {tooltip && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(
                  tooltip.canvasX + 10,
                  (wrapRef.current?.offsetWidth ?? 300) - 135,
                ),
                top: PAD.top,
                background: 'rgba(7,9,26,0.97)',
                border: '1px solid rgba(0,204,245,0.25)',
                borderRadius: 10,
                padding: '8px 10px',
                pointerEvents: 'none',
                zIndex: 10,
                minWidth: 124,
              }}
            >
              <p style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.55)', marginBottom: 5, fontFamily: 'monospace' }}>
                {format(new Date(tooltip.timestamp), 'EEE dd.MM · HH:mm', { locale: deLocale })}
              </p>
              {tooltip.items.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.accent, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.6rem', color: 'rgba(213,224,242,0.65)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, color: item.accent, fontFamily: 'monospace', flexShrink: 0 }}>
                    {item.level.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* "Jetzt ↩" reset button */}
        {showJetzt && (
          <button
            onClick={() => { cancelMomentum(); panOffsetRef.current = 0; setShowJetzt(false); scheduleRedraw() }}
            style={{
              position: 'absolute', bottom: 40, right: 14,
              fontSize: '0.55rem', fontWeight: 800, color: '#00ccf5',
              background: 'rgba(0,204,245,0.12)', border: '1px solid rgba(0,204,245,0.25)',
              borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Jetzt ↩
          </button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { dot: <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />, label: 'Einnahme' },
          { dot: <span style={{ fontSize: '0.8rem', color: '#ef4444', lineHeight: 1 }}>×</span>, label: 'Übersprungen' },
          { dot: <span style={{ fontSize: '0.7rem', color: 'rgba(154,170,191,0.55)', lineHeight: 1 }}>▲</span>, label: 'Peak' },
        ].map(({ dot, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {dot}
            <span style={{ fontSize: '0.55rem', color: 'rgba(154,170,191,0.42)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
