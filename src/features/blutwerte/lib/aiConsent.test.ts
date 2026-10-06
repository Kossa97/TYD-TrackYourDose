import { describe, expect, it } from 'vitest'
import { ladeKiEinwilligung, setzeKiEinwilligung, type ConsentClient } from './aiConsent'

function nachbild(start: string | null, fehler: string | null = null) {
  const zeile = { ai_import_consent_at: start }
  const updates: (string | null)[] = []
  const client: ConsentClient = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: fehler ? null : zeile, error: fehler ? { message: fehler } : null }) }) }),
      update: values => ({
        eq: async () => {
          if (fehler) return { error: { message: fehler } }
          updates.push(values.ai_import_consent_at)
          zeile.ai_import_consent_at = values.ai_import_consent_at
          return { error: null }
        },
      }),
    }),
  }
  return { client, updates }
}

describe('KI-Einwilligung', () => {
  it('liest den Zeitpunkt oder null', async () => {
    expect(await ladeKiEinwilligung(nachbild(null).client, 'u1')).toBeNull()
    expect(await ladeKiEinwilligung(nachbild('2026-10-06T08:00:00.000Z').client, 'u1')).toBe('2026-10-06T08:00:00.000Z')
  })

  it('erteilt mit Zeitpunkt und widerruft mit null', async () => {
    const { client, updates } = nachbild(null)
    expect(await setzeKiEinwilligung(client, 'u1', new Date('2026-10-06T08:00:00Z'))).toBe('2026-10-06T08:00:00.000Z')
    expect(await setzeKiEinwilligung(client, 'u1', null)).toBeNull()
    expect(updates).toEqual(['2026-10-06T08:00:00.000Z', null])
  })

  it('wirft bei Fehlern statt still „nicht erteilt“ zu melden', async () => {
    await expect(ladeKiEinwilligung(nachbild(null, 'offline').client, 'u1')).rejects.toThrow('offline')
    await expect(setzeKiEinwilligung(nachbild(null, 'offline').client, 'u1', new Date())).rejects.toThrow('offline')
  })
})
