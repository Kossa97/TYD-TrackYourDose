import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('Fortschritt dense metric interaction', () => {
  test('labels the nearest real measurement date in the tooltip', () => {
    const source = readSource('./MetricTooltip.tsx')

    expect(source).toContain('nearestMetric')
    expect(source).toContain('metricDateIso')
    expect(source).toContain('Messwert vom')
  })

  test('draws one active metric point from the shared tooltip selection', () => {
    const source = readSource('./ActiveMetricPointLayer.tsx')

    expect(source).toContain('useChartTooltipContent')
    expect(source).toContain('nearestMetric: true')
    expect(source).toContain('DefaultZIndexes.activeDot')
    expect(source).toContain('fill={color}')
  })
})
