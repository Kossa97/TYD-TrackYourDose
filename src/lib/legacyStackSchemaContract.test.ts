import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const runtimeFiles = [
  '../pages/Peptide.tsx',
  '../pages/Dashboard.tsx',
  '../pages/Home.tsx',
  '../pages/Protokoll.tsx',
  '../pages/Bewertungen.tsx',
  '../pages/BlutspiegelSimulation.tsx',
  '../pages/PublicProfile.tsx',
  '../pages/Rechner.tsx',
  '../pages/Tagebuch.tsx',
  '../pages/InjektionsTracker.tsx',
  '../components/BlutspiegelCarousel.tsx',
  '../components/injection3d/InjectionHistorySheet.tsx',
  '../components/injection3d/InjectionLogSheet.tsx',
  '../components/injection3d/InjectionTrackerTabs.tsx',
  '../features/fortschritt/hooks/useFortschrittData.ts',
  './doseAdjustmentBackfill.ts',
  './injectionPersistence.ts',
  './insights.ts',
  './protocolPdf/loadProtocolData.ts',
  './peptideStock.ts',
  '../services/blutspiegelHistory.ts',
  '../services/liveBlutspiegelChart.ts',
]

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('legacy UI stack schema contract', () => {
  it.each(runtimeFiles)('%s no longer queries removed database names', path => {
    const file = source(path)

    expect(file).not.toMatch(/\.from\(['"]peptides['"]\)/)
    expect(file).not.toMatch(/\.eq\(['"]peptide_id['"]/)
    expect(file).not.toMatch(/peptides\s*\(\s*name/)
  })

  it('keeps the old My Stack presentation while using the new persistence boundary', () => {
    const file = source('../pages/Peptide.tsx')

    expect(file).toContain('PeptideVialVisual')
    expect(file).toContain('PeptideFormModal')
    expect(file).toContain("from('stack_items')")
    expect(file).toContain('name:display_name')
    expect(file).toContain("rpc('save_legacy_peptide'")
    expect(file).not.toContain('MyStackPage')
  })
})
