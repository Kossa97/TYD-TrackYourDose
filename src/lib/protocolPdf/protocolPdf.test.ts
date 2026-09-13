import { beforeEach, describe, expect, it } from 'vitest'
import { visibleSections, defaultSelection, resolveSubject } from './sections'
import { applyPreset, matchPreset } from './presets'
import { loadPdfExportPrefs, savePdfExportPrefs } from './persistence'
import { buildProtocolPdf } from './renderProtocolPdf'
import type { ProtocolData, PdfBuildOptions } from './types'

function makeData(overrides: Partial<ProtocolData> = {}): ProtocolData {
  return {
    profile: { display_name: 'Max Muster', username: 'max', age: 32, gender: 'männlich', height_cm: 182, weight_kg: 84 },
    cycles: [
      { id: 'c1', name: 'Zyklus', stack_item_name: 'BPC-157', dose: 250, unit: 'mcg', method: 'SC', frequency: 'Täglich', start_date: '2026-01-01', end_date: null, active: true },
    ],
    doseLogs: [
      { stack_item_id: 'p1', logged_at: '2026-06-01T08:00:00Z', taken: true },
      { stack_item_id: 'p1', logged_at: '2026-06-02T08:00:00Z', taken: false },
      { stack_item_id: 'p1', logged_at: '2026-06-03T08:00:00Z', taken: true },
    ],
    weightLogs: [
      { logged_at: '2026-06-01T08:00:00Z', weight_kg: 84 },
      { logged_at: '2026-06-15T08:00:00Z', weight_kg: 82.5 },
      { logged_at: '2026-06-29T08:00:00Z', weight_kg: 81.2 },
    ],
    bloodwork: [
      { tested_at: '2026-06-01', marker: 'IGF-1', value: 180, unit: 'ng/ml' },
      { tested_at: '2026-06-28', marker: 'IGF-1', value: 240, unit: 'ng/ml' },
    ],
    effects: [
      { type: 'effect', description: 'Bessere Regeneration', severity: 4, stack_item_name: 'BPC-157', occurred_at: '2026-06-10T08:00:00Z' },
    ],
    reviews: [
      { stack_item_name: 'BPC-157', rating: 5, experience: 'gut' },
    ],
    dailyLogs: [
      { log_date: '2026-06-01', energie: 6, schlaf: 7, libido: 5 },
      { log_date: '2026-06-15', energie: 8, schlaf: 8, libido: 7 },
    ],
    stackItemNames: new Map([['p1', 'BPC-157']]),
    ...overrides,
  }
}

const ALL_SECTIONS = ['personal', 'summary', 'cycles', 'adherence', 'bloodwork', 'weight', 'wellness', 'effects', 'reviews', 'notes'] as const

describe('resolveSubject', () => {
  it('nutzt den Namen, wenn persönliche Angaben enthalten sind', () => {
    expect(resolveSubject(makeData(), true, 'de')).toBe('Max Muster')
  })
  it('anonymisiert, wenn persönliche Angaben abgewählt sind', () => {
    expect(resolveSubject(makeData(), false, 'de')).toBe('Anonym')
    expect(resolveSubject(makeData(), false, 'en')).toBe('Anonymous')
  })
  it('fällt auf Anonym zurück, wenn kein Name vorhanden', () => {
    const d = makeData({ profile: { display_name: null, username: null, age: null, gender: null, height_cm: null, weight_kg: null } })
    expect(resolveSubject(d, true, 'de')).toBe('Anonym')
  })
})

describe('visibleSections', () => {
  it('filtert leere Sektionen heraus, behält Notizen immer', () => {
    const empty: ProtocolData = {
      profile: null, cycles: [], doseLogs: [], weightLogs: [], bloodwork: [],
      effects: [], reviews: [], dailyLogs: [], stackItemNames: new Map(),
    }
    const vis = visibleSections([...ALL_SECTIONS], empty)
    expect(vis).toEqual(['notes'])
  })
  it('behält die feste PDF-Reihenfolge unabhängig von der Auswahl-Reihenfolge', () => {
    const vis = visibleSections(['reviews', 'personal', 'cycles'], makeData())
    expect(vis).toEqual(['personal', 'cycles', 'reviews'])
  })
  it('ignoriert nicht gewählte Sektionen', () => {
    const vis = visibleSections(['weight'], makeData())
    expect(vis).toEqual(['weight'])
  })
})

describe('defaultSelection', () => {
  it('wählt alle Sektionen mit Daten, aber nicht Notizen (Freitext)', () => {
    const sel = defaultSelection(makeData())
    expect(sel).toContain('bloodwork')
    expect(sel).toContain('weight')
    expect(sel).not.toContain('notes')
  })
})

describe('buildProtocolPdf (Runtime-Smoke)', () => {
  const opts: PdfBuildOptions = {
    lang: 'de',
    range: { from: '2026-06-01', to: '2026-06-30' },
    sections: [...ALL_SECTIONS],
    note: 'Frage an den Arzt: IGF-1 weiter beobachten?',
  }

  it('erzeugt ein mehrseitiges PDF ohne Fehler', async () => {
    const doc = await buildProtocolPdf(makeData(), opts)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
    const bytes = doc.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(3000)
  })

  it('rendert auch bei komplett leeren Daten (nur Deckblatt + Notizen + Disclaimer)', async () => {
    const empty: ProtocolData = {
      profile: null, cycles: [], doseLogs: [], weightLogs: [], bloodwork: [],
      effects: [], reviews: [], dailyLogs: [], stackItemNames: new Map(),
    }
    const doc = await buildProtocolPdf(empty, { ...opts, note: '' })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it('funktioniert auf Englisch', async () => {
    const doc = await buildProtocolPdf(makeData(), { ...opts, lang: 'en' })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })
})

describe('presets', () => {
  it('Arzt enthält Blutwerte und persönliche Angaben, kein Forum-Stil', () => {
    const sel = applyPreset('arzt', makeData())
    expect(sel).toContain('personal')
    expect(sel).toContain('bloodwork')
    expect(sel).toContain('effects')
    expect(sel).not.toContain('reviews')
    expect(sel).not.toContain('wellness')
  })

  it('Coach lässt Blutwerte weg und behält Wellness/Reviews', () => {
    const sel = applyPreset('coach', makeData())
    expect(sel).toContain('personal')
    expect(sel).toContain('wellness')
    expect(sel).toContain('reviews')
    expect(sel).not.toContain('bloodwork')
  })

  it('Forum anonymisiert (kein personal), ohne Labor und Notizen', () => {
    const sel = applyPreset('forum', makeData())
    expect(sel).not.toContain('personal')
    expect(sel).not.toContain('bloodwork')
    expect(sel).not.toContain('notes')
    expect(sel).toContain('summary')
    expect(sel).toContain('wellness')
  })

  it('filtert Sektionen ohne Daten heraus, behält Notizen im Arzt-Muster', () => {
    const empty: ProtocolData = {
      profile: null, cycles: [], doseLogs: [], weightLogs: [], bloodwork: [],
      effects: [], reviews: [], dailyLogs: [], stackItemNames: new Map(),
    }
    expect(applyPreset('arzt', empty)).toEqual(['notes'])
  })

  it('matchPreset erkennt Muster und Custom', () => {
    const data = makeData()
    const arzt = applyPreset('arzt', data)
    expect(matchPreset(arzt, data)).toBe('arzt')
    const withReviews = [...arzt, 'reviews' as const]
    expect(matchPreset(withReviews, data)).toBe('custom')
    const withoutBloodwork = arzt.filter(id => id !== 'bloodwork')
    expect(matchPreset(withoutBloodwork, data)).toBe('custom')
  })
})

describe('persistence', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
        removeItem: (k: string) => { store.delete(k) },
      },
    })
  })

  it('speichert und lädt die letzte Auswahl', () => {
    const prefs = {
      preset: 'coach' as const,
      sections: applyPreset('coach', makeData()),
      lang: 'en' as const,
    }
    savePdfExportPrefs('user-1', prefs)
    expect(loadPdfExportPrefs('user-1')).toEqual(prefs)
  })

  it('verwirft kaputte localStorage-Einträge', () => {
    localStorage.setItem('tyd_pdf_export_prefs_user-2', '{not-json')
    expect(loadPdfExportPrefs('user-2')).toBeNull()
  })
})


describe('Arzt-Befund Theme', () => {
  it('erzeugt ein medizinisches PDF mit preset arzt', async () => {
    const doc = await buildProtocolPdf(makeData(), {
      lang: 'de',
      range: { from: '2026-06-01', to: '2026-06-30' },
      sections: ['personal', 'summary', 'cycles', 'adherence', 'bloodwork', 'weight', 'effects', 'notes'],
      note: 'Frage an den Arzt',
      preset: 'arzt',
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
    const bytes = doc.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(3000)
  })
})
