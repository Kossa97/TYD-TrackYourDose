// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveBlutspiegelChart } from './LiveBlutspiegelChart'
import type { CycleChartData } from '../services/liveBlutspiegelChart'

interface StrokeRecord {
  style: string
  width: number
  dash: number[]
  points: Array<[number, number]>
}

const strokes: StrokeRecord[] = []
let currentDash: number[] = []
let currentPoints: Array<[number, number]> = []

const context = {
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  shadowColor: '',
  shadowBlur: 0,
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(() => { currentPoints = [] }),
  moveTo: vi.fn((x: number, y: number) => { currentPoints.push([x, y]) }),
  lineTo: vi.fn((x: number, y: number) => { currentPoints.push([x, y]) }),
  stroke: vi.fn(() => {
    strokes.push({
      style: String(context.strokeStyle),
      width: context.lineWidth,
      dash: [...currentDash],
      points: [...currentPoints],
    })
  }),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  closePath: vi.fn(),
  arc: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  setLineDash: vi.fn((dash: number[]) => { currentDash = [...dash] }),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
}

describe('LiveBlutspiegelChart aggregate curve styles', () => {
  beforeEach(() => {
    strokes.length = 0
    currentDash = []
    currentPoints = []
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T12:00:00.000Z'))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(performance.now())
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 400 })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 240 })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('draws actual solid and planned dashed without including points after interruption', async () => {
    const now = Date.now()
    const cycle: CycleChartData = {
      cycleId: 'cycle-1',
      peptideName: 'BPC-157',
      accent: '#00ccf5',
      points: [
        { timestamp: now - 5 * 3_600_000, level: 20, status: 'actual' },
        { timestamp: now - 4 * 3_600_000, level: 40, status: 'actual' },
        { timestamp: now - 3 * 3_600_000, level: 60, status: 'planned' },
        { timestamp: now - 2 * 3_600_000, level: 50, status: 'planned' },
        { timestamp: now - 30 * 60_000, level: 90, status: 'planned' },
      ],
      doseMarkers: [],
      peakMarkers: [],
      unit: 'mg',
      halfLifeHours: 4,
      interruptedAt: now - 60 * 60_000,
    }

    render(<LiveBlutspiegelChart cycles={[cycle]} />)

    const curveStrokes = strokes.filter(stroke => stroke.style === cycle.accent && stroke.width === 2)
    expect(curveStrokes.some(stroke => stroke.dash.length === 0)).toBe(true)
    expect(curveStrokes.some(stroke => stroke.dash.join(',') === '6,5')).toBe(true)
    const rightmostCurveX = Math.max(...curveStrokes.flatMap(stroke => stroke.points.map(([x]) => x)))
    const postInterruptionX = 40 + (((now - 30 * 60_000) - (now - 7 * 24 * 3_600_000)) / (7 * 24 * 3_600_000)) * 348
    expect(rightmostCurveX).toBeLessThan(postInterruptionX)
  })
})
