import { describe, expect, it } from 'vitest'
import { intakeDose, intakeGap } from './intake'

const t = (key: string, options?: Record<string, unknown>) => `${key}:${options?.n}`

describe('Tagebuch – Bezug zur Einnahme', () => {
  it('Abstand in Minuten, Stunden, ab 72 h in Tagen', () => {
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-01T08:45:00Z', t)).toBe('tagebuch_abstand_min:45')
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-01T10:20:00Z', t)).toBe('tagebuch_abstand_h:2')
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-03T23:00:00Z', t)).toBe('tagebuch_abstand_h:63')
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-05T08:00:00Z', t)).toBe('tagebuch_abstand_tage:4')
  })

  it('kein Abstand, wenn der Eintrag vor der Einnahme liegt', () => {
    expect(intakeGap('2026-09-01T08:00:00Z', '2026-09-01T07:00:00Z', t)).toBeNull()
  })

  it('Einnahme in derselben Minute: Abstand 0', () => {
    expect(intakeGap('2026-09-01T08:00:40Z', '2026-09-01T08:00:00Z', t)).toBe('tagebuch_abstand_min:0')
  })

  it('Menge mit Einheit, ohne Menge leer', () => {
    expect(intakeDose({ dose: 250, unit: 'mcg' }, 'de')).toBe('250 mcg')
    expect(intakeDose({ dose: 0.25, unit: 'mg' }, 'de')).toBe('0,25 mg')
    expect(intakeDose({ dose: null, unit: null }, 'de')).toBe('')
  })
})
