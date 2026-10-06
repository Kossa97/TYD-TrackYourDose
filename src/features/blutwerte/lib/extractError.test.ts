import { describe, expect, it } from 'vitest'
import { beschreibeExtraktionsFehler } from './extractError'

const antwort = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

describe('Fehler der Befund-Auswertung', () => {
  it('erkennt die fehlende Einwilligung', async () => {
    expect(await beschreibeExtraktionsFehler(antwort(403, { error: 'consent_required' }))).toEqual({ code: 'consent_required', text: '' })
  })

  it('nennt Limit, Groesse und „kein Befund"', async () => {
    expect((await beschreibeExtraktionsFehler(antwort(429, { error: 'rate_limit' }))).text).toContain('Import-Limit')
    expect((await beschreibeExtraktionsFehler(antwort(413, {}))).text).toContain('zu groß')
    expect((await beschreibeExtraktionsFehler(antwort(422, { error: 'no_bloodwork_found' }))).text).toContain('kein Laborbefund')
  })

  it('faellt ohne Antwort oder bei Unbekanntem auf den allgemeinen Text zurueck', async () => {
    expect((await beschreibeExtraktionsFehler(undefined)).code).toBeNull()
    expect((await beschreibeExtraktionsFehler(antwort(500, 'kaputt'))).text).toContain('nicht ausgelesen')
  })
})
