import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./WerteCard.tsx', import.meta.url), 'utf8')

describe('WerteCard', () => {
  it('zeigt die freigegebene Überschrift und den Halbzeitraum-Kontext', () => {
    expect(source).toContain('Deine Werte')
    expect(source).toContain('Ø zweite Hälfte')
    expect(source).toContain('buildValueOverview(dailyLogs, range)')
  })

  it('nutzt ausschließlich die vier Statusfarben für die Veränderung', () => {
    expect(source).toContain("positive: '#10b981'")
    expect(source).toContain("warning: '#f59e0b'")
    expect(source).toContain("negative: '#ef4444'")
    expect(source).toContain("neutral: 'var(--text-muted)'")
    expect(source).toContain('color: TONE_COLORS[row.tone]')
  })

  it('zeigt definierte Leer- und Vergleichszustände', () => {
    expect(source).toContain('Keine Daten')
    expect(source).toContain('Noch kein Vergleich')
    expect(source).not.toContain('Gewicht')
    expect(source).not.toContain('Blutwerte')
  })
})
