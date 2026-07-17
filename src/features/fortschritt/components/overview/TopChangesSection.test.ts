import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('TopChangesSection animation', () => {
  test('verdrahtet den gewählten Zeitraum mit dem animierten Kartenraster', () => {
    const dashboard = readSource('../FortschrittDashboard.tsx')
    const section = readSource('./TopChangesSection.tsx')

    expect(dashboard).toContain('animationKey={rangeChip}')
    expect(section).toContain('animationKey: string')
    expect(section).toContain('key={animationKey}')
  })

  test('staffelt die Karten und zeigt die Veränderung nach dem Karteninhalt', () => {
    const source = readSource('./TopChangesSection.tsx')

    expect(source).toContain('index={index}')
    expect(source).toContain("'--change-card-delay': `${index * 90}ms`")
    expect(source).toContain('fortschritt-change-card')
    expect(source).toContain('fortschritt-change-copy')
    expect(source).toContain('fortschritt-change-delta')
  })

  test('nutzt einen kompakten Refresh und respektiert reduzierte Bewegung', () => {
    const source = readSource('./TopChangesSection.tsx')

    expect(source).toContain('fortschritt-change-grid--refresh')
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    expect(source).toContain('animation: none !important')
  })
})
