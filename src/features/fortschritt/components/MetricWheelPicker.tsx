import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { fieldLabel } from '../styles'

const ITEM_H = 30
const WHEEL_H = ITEM_H * 3
const PAD = 1

export const METRIC_WHEEL_CSS = `
  .tyd-metric-wheel-scroll {
    height: ${WHEEL_H}px;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-snap-type: y mandatory;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    touch-action: pan-y;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .tyd-metric-wheel-scroll::-webkit-scrollbar {
    display: none;
  }
  .tyd-metric-wheel-item {
    height: ${ITEM_H}px;
    scroll-snap-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    user-select: none;
    -webkit-user-select: none;
  }
  .tyd-metric-wheel-item.is-active {
    color: var(--text);
  }
`

function splitValue(value: number) {
  const rounded = Math.round(value * 10) / 10
  const whole = Math.floor(rounded + 1e-9)
  const dec = Math.round((rounded - whole) * 10)
  return { whole, dec }
}

function buildRange(min: number, max: number) {
  const out: number[] = []
  for (let i = min; i <= max; i++) out.push(i)
  return out
}

const DEC_OPTIONS = buildRange(0, 9)

interface Props {
  label: string
  unit: string
  value: number | null
  onChange: (value: number) => void
  intMin: number
  intMax: number
  placeholder: string
  defaultWhole: number
  defaultDec: number
}

export function MetricWheelPicker({
  label,
  unit,
  value,
  onChange,
  intMin,
  intMax,
  placeholder,
  defaultWhole,
  defaultDec,
}: Props) {
  const wholeRef = useRef<HTMLDivElement>(null)
  const decRef = useRef<HTMLDivElement>(null)
  const intOptions = useRef(buildRange(intMin, intMax)).current
  const suppressEmitRef = useRef(false)
  const touchedRef = useRef(value != null)

  const { whole: activeWhole, dec: activeDec } = value != null
    ? splitValue(value)
    : { whole: defaultWhole, dec: defaultDec }

  const scrollToIndex = useCallback((el: HTMLDivElement | null, index: number) => {
    if (!el) return
    suppressEmitRef.current = true
    el.scrollTop = index * ITEM_H
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        suppressEmitRef.current = false
      })
    })
  }, [])

  useEffect(() => {
    touchedRef.current = value != null
  }, [value])

  useLayoutEffect(() => {
    const wholeIdx = intOptions.indexOf(activeWhole)
    const decIdx = DEC_OPTIONS.indexOf(activeDec)
    scrollToIndex(wholeRef.current, wholeIdx >= 0 ? wholeIdx : 0)
    scrollToIndex(decRef.current, decIdx >= 0 ? decIdx : 0)
  }, [activeWhole, activeDec, intOptions, scrollToIndex])

  const emitValue = useCallback(() => {
    if (suppressEmitRef.current) return
    const wholeEl = wholeRef.current
    const decEl = decRef.current
    if (!wholeEl || !decEl) return

    const wholeIdx = Math.round(wholeEl.scrollTop / ITEM_H)
    const decIdx = Math.round(decEl.scrollTop / ITEM_H)
    const whole = intOptions[Math.min(Math.max(wholeIdx, 0), intOptions.length - 1)]
    const dec = DEC_OPTIONS[Math.min(Math.max(decIdx, 0), DEC_OPTIONS.length - 1)]
    if (value != null || touchedRef.current) {
      onChange(Math.round((whole + dec / 10) * 10) / 10)
    }
  }, [intOptions, onChange, value])

  useEffect(() => {
    const wholeEl = wholeRef.current
    const decEl = decRef.current
    if (!wholeEl || !decEl) return

    const onScroll = () => emitValue()
    wholeEl.addEventListener('scroll', onScroll, { passive: true })
    decEl.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      wholeEl.removeEventListener('scroll', onScroll)
      decEl.removeEventListener('scroll', onScroll)
    }
  }, [emitValue])

  const display = value != null
    ? `${value.toFixed(1).replace('.', ',')} ${unit}`
    : placeholder

  const displayStyle: CSSProperties = {
    fontSize: '0.72rem',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    color: value != null ? 'var(--accent)' : 'var(--text-dim)',
  }

  const wheelFrame: CSSProperties = {
    position: 'relative',
    borderRadius: 12,
    background: 'var(--surface-input)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    opacity: value != null ? 1 : 0.72,
  }

  const highlight: CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: 4,
    right: 4,
    height: ITEM_H,
    transform: 'translateY(-50%)',
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
    background: 'rgba(0,204,245,0.06)',
    borderRadius: 8,
    pointerEvents: 'none',
    zIndex: 1,
  }

  const fade: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'linear-gradient(to bottom, var(--surface-input) 0%, transparent 28%, transparent 72%, var(--surface-input) 100%)',
    zIndex: 2,
  }

  const renderColumn = (
    ref: RefObject<HTMLDivElement | null>,
    options: number[],
    active: number,
    format: (n: number) => string,
  ) => (
    <div
      className="tyd-metric-wheel-scroll"
      ref={ref}
      onTouchStart={() => { touchedRef.current = true }}
      onWheel={() => { touchedRef.current = true }}
    >
      {Array.from({ length: PAD }, (_, i) => (
        <div key={`pad-top-${i}`} className="tyd-metric-wheel-item" aria-hidden>&nbsp;</div>
      ))}
      {options.map(n => (
        <div
          key={n}
          className={`tyd-metric-wheel-item${n === active ? ' is-active' : ''}`}
        >
          {format(n)}
        </div>
      ))}
      {Array.from({ length: PAD }, (_, i) => (
        <div key={`pad-bot-${i}`} className="tyd-metric-wheel-item" aria-hidden>&nbsp;</div>
      ))}
    </div>
  )

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
        gap: 6,
      }}>
        <label style={{ ...fieldLabel, fontSize: '0.56rem', marginBottom: 0 }}>{label}</label>
        <span style={displayStyle}>{display}</span>
      </div>

      <div style={wheelFrame}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px', gap: 0 }}>
          {renderColumn(wholeRef, intOptions, activeWhole, n => String(n))}
          {renderColumn(decRef, DEC_OPTIONS, activeDec, n => `.${n}`)}
        </div>
        <div style={highlight} aria-hidden />
        <div style={fade} aria-hidden />
      </div>
    </div>
  )
}
