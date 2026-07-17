import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('Fortschritt-Chart-Aufbauanimation', () => {
  test('animiert Linie und gestaffelte Punkte mit eigenem Metrikschlüssel', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('animationKey')
    expect(source).toContain('fortschritt-chart-line-reveal')
    expect(source).toContain('POINT_ANIMATION_MS')
    expect(source).toContain('fortschritt-chart-point')
    expect(source).toContain('animateMetric')
    expect(source).toContain('setAnimateMetric(false)')
  })

  test('animiert nur die sichtbaren Daten des aktuellen Zeitfensters', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('animationPointData')
    expect(source).toContain('visibleLineData')
    expect(source).toContain('viewStart')
    expect(source).toContain('viewEnd')
    expect(source).toContain('.filter(point => point.ts >= viewStart && point.ts <= viewEnd)')
    expect(source).toContain('data={visibleLineData}')
    expect(source).toContain('new Map(animationPointData.map')
    expect(source).toContain('clipLineDataToWindow')
    expect(source).toContain('interpolateLinePoint')
    expect(source).not.toContain('Math.max(0, firstInView - 1)')
  })

  test('setzt die Animation beim Metrikwechsel vor dem Paint zur?ck', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('useLayoutEffect')
    expect(source).toContain('useLayoutEffect(() => {')
    expect(source).toContain('[metricKey, lineData.length, showPersistentDots]')
  })

  test('beh?lt Gewicht und drei Monate als Standardauswahl', () => {
    const section = readSource('./VerlaufSection.tsx')
    const chartWindow = readSource('../../lib/chartWindow.ts')

    expect(section).toContain("useState<MetricKey>('weight')")
    expect(chartWindow).toContain("DEFAULT_CHART_WINDOW: ChartWindowKey = '3m'")
  })


  test('startet die Punktanimation nach der Linienanimation', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('animate={animateMetric}')
    expect(source).toContain('LINE_ANIMATION_MS + animationIndex * POINT_ANIMATION_STEP_MS')
  })
  test('enthuellt die Linie raeumlich ueber den sichtbaren Plot', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('from { clip-path: inset(0 100% 0 0); }')
    expect(source).toContain('to { clip-path: inset(0 0 0 0); }')
    expect(source).not.toContain('stroke-dasharray: 0 4000')
  })

  test('laesst Randpunkte vollstaendig ueber den Plot-Clip hinausragen', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toMatch(/<div\r?\n\s+className="fortschritt-metric-chart"\r?\n\s+ref=\{wrapRef\}/)
    expect(source).toMatch(/}\r?\n\s+\.fortschritt-metric-chart \.recharts-line-dots/)
    expect(source).toContain('clip-path: none;')
  })

  test('animiert Zyklus-Balken über eine eigene Reveal-Klasse', () => {
    const source = readSource('./CycleBandLayer.tsx')

    expect(source).toContain('fortschritt-cycle-reveal')
    expect(source).toContain('transformOrigin')
  })

  test('haelt Punkte bis zu ihrem gestaffelten Start verborgen', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('animation-fill-mode: both')
    expect(source).toContain('from { opacity: 0; transform: scale(.55); }')
  })
  test('staffelt Punkte ?ber stabile sichtbare Datenindizes', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('visiblePointIndex')
    expect(source).toContain('dotProps.payload?.ts')
    expect(source).toContain('animationIndex')
  })

  test('staffelt jeden sichtbaren Punkt stabil nach der Linienanimation', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('const [animateMetric, setAnimateMetric] = useState(true)')
    expect(source).not.toContain('visiblePointCount')
    expect(source).not.toContain('pointAnimationDone')
    expect(source).not.toContain('animateLine')
    expect(source).toContain('animationDelay')
    expect(source).toContain('POINT_ANIMATION_STEP_MS')
  })

  test('reduziert nur Gewicht und KFA in 3M auf Linie plus aktiven Messpunkt', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('usesReducedMetricPoints(metricKey, windowKey)')
    expect(source).toContain('showPersistentDots')
    expect(source).toContain('dot={showPersistentDots ?')
    expect(source).toContain('<ActiveMetricPointLayer')
    expect(source).toContain('enabled={reducedMetricPoints}')
  })

  test('entfernt im reduzierten Modus nur Metrik-Snap-Ziele', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('reducedMetricPoints ? [] : series.map(point => point.date)')
    expect(source).toContain('buildTooltipSnapDates(metricSnapDates, bands)')
  })

  test('beendet die reduzierte Animation nach der Linie ohne Punktlaufzeit', () => {
    const source = readSource('./MetricChart.tsx')

    expect(source).toContain('showPersistentDots')
    expect(source).toContain('? Math.max(0, visiblePointTotal - 1) * POINT_ANIMATION_STEP_MS + POINT_ANIMATION_MS')
    expect(source).toContain(': 0')
  })
})
