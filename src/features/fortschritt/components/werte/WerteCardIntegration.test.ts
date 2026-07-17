import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('WerteCard im Fortschritt-Dashboard', () => {
  test('ersetzt nur die Fortschritt-Blutwertekarte durch Deine Werte', () => {
    const dashboard = readSource('../FortschrittDashboard.tsx')

    expect(dashboard).toContain("import { WerteCard } from './werte/WerteCard'")
    expect(dashboard).toContain('<WerteCard dailyLogs={dailyLogs} range={pageRange} />')
    expect(dashboard).not.toContain('BlutwerteCard')
    expect(dashboard).toContain('computeTopChanges(pageRange, weightLogs, dailyLogs, bloodwork)')
  })
})
