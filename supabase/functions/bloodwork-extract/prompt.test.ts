import { describe, expect, it } from 'vitest'
import {
  ALLOWED_MIME_TYPES,
  IMPORT_LIMIT,
  MAX_UPLOAD_BYTES,
  base64Bytes,
  buildPrompt,
  extractJson,
  resetsAt,
} from './prompt'

describe('buildPrompt', () => {
  it('enthält die Katalog-Marker', () => {
    const prompt = buildPrompt(['Testosteron', 'CRP'])
    expect(prompt).toContain('Testosteron')
    expect(prompt).toContain('CRP')
  })

  it('weist an, unleserliche Werte wegzulassen statt zu raten', () => {
    const prompt = buildPrompt(['CRP']).toLowerCase()
    expect(prompt).toContain('lasse ihn weg')
    expect(prompt).toContain('raten')
  })

  it('legt das JSON-Antwortformat fest', () => {
    expect(buildPrompt(['CRP'])).toContain('"tested_at"')
  })
})

describe('extractJson', () => {
  it('liest reines JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('liest JSON aus einem Markdown-Codeblock', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('liest JSON mit umgebendem Text', () => {
    expect(extractJson('Hier das Ergebnis:\n{"a":1}\nFertig.')).toEqual({ a: 1 })
  })

  it('gibt null bei fehlendem JSON zurück', () => {
    expect(extractJson('kein json hier')).toBeNull()
  })

  it('gibt null bei kaputtem JSON zurück', () => {
    expect(extractJson('{"a":')).toBeNull()
  })

  it('gibt null bei leerer Antwort zurück', () => {
    expect(extractJson('')).toBeNull()
  })
})

describe('resetsAt', () => {
  it('liegt 30 Tage nach dem ältesten Import im Fenster', () => {
    expect(resetsAt('2026-07-01T10:00:00.000Z')).toBe('2026-07-31T10:00:00.000Z')
  })

  it('gibt null ohne ältesten Import zurück', () => {
    expect(resetsAt(null)).toBeNull()
  })

  it('gibt null bei einem unlesbaren Datum zurück', () => {
    expect(resetsAt('kein datum')).toBeNull()
  })
})

describe('Konstanten', () => {
  it('erlaubt gängige Bildformate und PDF', () => {
    expect(ALLOWED_MIME_TYPES).toEqual(
      expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    )
  })

  it('begrenzt Importe pro Monat', () => {
    expect(IMPORT_LIMIT).toBe(10)
  })

  it('begrenzt die Upload-Größe auf 10 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024)
  })
})

describe('base64Bytes', () => {
  it('gibt 0 für einen leeren String zurück', () => {
    expect(base64Bytes('')).toBe(0)
  })

  it('schätzt die dekodierte Größe ohne Padding', () => {
    // "AAAA" (4 Zeichen, kein Padding) -> 3 Bytes
    expect(base64Bytes('AAAA')).toBe(3)
  })

  it('berücksichtigt Padding', () => {
    // "AA==" -> 1 Byte, "AAA=" -> 2 Bytes
    expect(base64Bytes('AA==')).toBe(1)
    expect(base64Bytes('AAA=')).toBe(2)
  })

  it('erkennt eine Datei über dem Limit', () => {
    // base64 ist ~4/3 der Rohgröße; ein String über MAX*4/3 überschreitet das Limit
    const tooBig = 'A'.repeat(Math.ceil((MAX_UPLOAD_BYTES + 1) * 4 / 3))
    expect(base64Bytes(tooBig)).toBeGreaterThan(MAX_UPLOAD_BYTES)
  })
})
