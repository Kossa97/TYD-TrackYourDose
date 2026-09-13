import { describe, expect, it } from 'vitest'
import { visibleSections, defaultSelection, resolveSubject } from './sections'
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
      { log_date: '2026-06-01', energie: 6, schlaf: 7, wohlbefinden: 6, libido: 5 },
      { log_date: '2026-06-15', energie: 8, schlaf: 8, wohlbefinden: 7, libido: 7 },
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

/** Ein Jahr taeglicher Wohlbefinden-Eintraege, wie auf dem Testaccount. */
function jahrDailyLogs(): ProtocolData['dailyLogs'] {
  const basis = Date.UTC(2026, 0, 1)
  return Array.from({ length: 365 }, (_, i) => ({
    log_date: new Date(basis + i * 86_400_000).toISOString().slice(0, 10),
    energie: 4 + (i % 7),
    schlaf: 3 + (i % 8),
    wohlbefinden: 5 + (i % 6),
    libido: 2 + (i % 9),
  }))
}

describe('Wohlbefinden ueber einen langen Zeitraum', () => {
  const opts: PdfBuildOptions = {
    lang: 'de',
    range: { from: '2026-01-01', to: '2026-12-31' },
    sections: ['wellness'],
    note: '',
  }

  it('rendert ein Jahr ohne Fehler und ohne aus dem Blatt zu laufen', async () => {
    // Vorher wurden 365 Punkte je Metrik roh in einen 42-mm-Kasten gezeichnet.
    // Jetzt fasst der Renderer zu Monaten zusammen — die Datenmenge darf die
    // Seitenzahl nicht mehr treiben.
    const doc = await buildProtocolPdf(makeData({ dailyLogs: jahrDailyLogs() }), opts)
    const kurz = await buildProtocolPdf(makeData(), opts)
    expect(doc.getNumberOfPages()).toBe(kurz.getNumberOfPages())
  })

  it('zeichnet vier getrennte Charts, auch wenn nur eine Metrik gefuellt ist', async () => {
    // Der Schwarzweiss-Grund: eine Linie je Chart, damit die Ueberschrift die
    // Zuordnung traegt und nicht die Farbe. Eine leere Metrik bekommt keinen
    // leeren Kasten.
    const nurSchlaf = jahrDailyLogs().map(l => ({
      ...l, energie: null, wohlbefinden: null, libido: null,
    }))
    const doc = await buildProtocolPdf(makeData({ dailyLogs: nurSchlaf }), opts)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it('kommt mit einem einzigen Eintrag zurecht', async () => {
    // Ein Punkt ist kein Verlauf. Er darf trotzdem nicht zum Absturz fuehren.
    const einer = [{ log_date: '2026-06-01', energie: 7, schlaf: null, wohlbefinden: null, libido: null }]
    const doc = await buildProtocolPdf(makeData({ dailyLogs: einer }), opts)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })

  it('rendert das Jahr auch auf Englisch', async () => {
    const doc = await buildProtocolPdf(makeData({ dailyLogs: jahrDailyLogs() }), { ...opts, lang: 'en' })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
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
