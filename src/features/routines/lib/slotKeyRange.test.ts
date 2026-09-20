import { describe, expect, it } from 'vitest'
import { imBereich, slotKeyBereiche } from './slotKeyRange'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const fenster = (von: string, bis: string) => ({ start: new Date(von), end: new Date(bis) })

/** So baut `intakeSchedule.ts` den Schluessel. */
const schluessel = (cycleId: string, zeit: string) => `${cycleId}@${new Date(zeit).toISOString()}`

describe('slotKeyBereiche', () => {
  const september = fenster('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')

  it('trifft genau die Schluessel des Zyklus im Fenster', () => {
    // Das ist die Aussage, auf die es ankommt: die Bereichsbedingung ist
    // gleichwertig zur Aufzaehlung. `toISOString()` hat feste Breite, also ist
    // der Zeitteil lexikografisch chronologisch.
    const drin = [
      schluessel(A, '2026-09-01T00:00:00Z'), // Anfang gehoert dazu
      schluessel(A, '2026-09-15T08:00:00Z'),
      schluessel(A, '2026-09-30T23:59:59.999Z'),
    ]
    const draussen = [
      schluessel(A, '2026-08-31T23:59:59.999Z'),
      schluessel(A, '2026-10-01T00:00:00Z'), // Ende gehoert nicht dazu
    ]

    for (const s of drin) expect(imBereich(s, A, september), s).toBe(true)
    for (const s of draussen) expect(imBereich(s, A, september), s).toBe(false)
  })

  it('laesst keinen fremden Zyklus in den Bereich', () => {
    // Anfang und Ende tragen denselben UUID-Praefix. Ein Schluessel mit
    // anderer id unterscheidet sich schon dort und liegt damit ganz
    // ausserhalb -- unabhaengig davon, wie seine Zeit aussieht.
    for (const zeit of ['2026-09-15T08:00:00Z', '2026-01-01T00:00:00Z', '2099-01-01T00:00:00Z']) {
      expect(imBereich(schluessel(B, zeit), A, september), zeit).toBe(false)
    }
  })

  it('formuliert die Bedingung so, dass PostgREST sie lesen kann', () => {
    const [ausdruck] = slotKeyBereiche([A], [september])

    // Die Werte tragen `:` und `.`; ohne Anfuehrungszeichen liest PostgREST
    // den Punkt als Trennzeichen und der Ausdruck zerfaellt.
    expect(ausdruck).toBe(
      'and(routine_slot_key.gte."11111111-1111-4111-8111-111111111111@2026-09-01T00:00:00.000Z",'
      + 'routine_slot_key.lt."11111111-1111-4111-8111-111111111111@2026-10-01T00:00:00.000Z")',
    )
  })

  it('ergibt dieselbe Adresse, egal in welcher Reihenfolge die Zyklen kommen', () => {
    // Der Punkt der ganzen Uebung: eine stabile Adresse. Kaeme sie bei jedem
    // Aufruf anders heraus, muesste der Browser jedes Mal neu verhandeln --
    // genau der Zustand, den wir loswerden wollen.
    expect(slotKeyBereiche([A, B], [september]))
      .toEqual(slotKeyBereiche([B, A], [september]))
    // Dubletten aendern nichts.
    expect(slotKeyBereiche([A, B, A], [september]))
      .toEqual(slotKeyBereiche([A, B], [september]))
  })

  it('buendelt viele Zyklen, statt die Adresse ins Unermessliche wachsen zu lassen', () => {
    const viele = Array.from({ length: 90 }, (_, i) => (
      `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`
    ))
    const abfragen = slotKeyBereiche(viele, [september], 40)

    expect(abfragen).toHaveLength(3) // 40 + 40 + 10
    // Jede Bedingung kommt genau einmal vor, keine faellt hinten runter.
    const alle = abfragen.flatMap(a => a.split('),and(')).length
    expect(alle).toBe(90)
  })

  it('nimmt mehrere Fenster auf -- der gewaehlte Tag kann ausserhalb des Monats liegen', () => {
    const extra = fenster('2026-11-05T00:00:00Z', '2026-11-06T00:00:00Z')
    const [ausdruck] = slotKeyBereiche([A], [september, extra])

    expect(ausdruck).toContain('2026-09-01T00:00:00.000Z')
    expect(ausdruck).toContain('2026-11-05T00:00:00.000Z')
    // Nach Startzeit sortiert, damit auch hier die Adresse stabil bleibt.
    expect(ausdruck.indexOf('2026-09-01')).toBeLessThan(ausdruck.indexOf('2026-11-05'))
  })

  it('ueberspringt leere und verkehrte Fenster', () => {
    expect(slotKeyBereiche([A], [fenster('2026-09-10T00:00:00Z', '2026-09-10T00:00:00Z')]))
      .toEqual([])
    expect(slotKeyBereiche([A], [fenster('2026-09-10T00:00:00Z', '2026-09-01T00:00:00Z')]))
      .toEqual([])
    expect(slotKeyBereiche([], [september])).toEqual([])
  })

  it('weist nur zurueck, was aus den Anfuehrungszeichen ausbricht', () => {
    // Ein Anfuehrungszeichen wuerde den Ausdruck sprengen und im schlimmsten
    // Fall die Bedingung veraendern.
    expect(() => slotKeyBereiche(['a"b'], [september])).toThrow(/Unzulaessige Zyklus-id/)
    expect(() => slotKeyBereiche(['a\\b'], [september])).toThrow(/Unzulaessige Zyklus-id/)

    // Alles andere traegt das Zitat. Hier stand erst eine UUID-Pruefung --
    // die war zu streng am falschen Ort und riss bei einer unerwarteten id
    // den ganzen Ladevorgang mit. Eine Seite, die nichts mehr anzeigt, ist
    // schlimmer als eine Abfrage, die nichts findet.
    expect(slotKeyBereiche(['cycle-1'], [september])[0])
      .toContain('routine_slot_key.gte."cycle-1@2026-09-01T00:00:00.000Z"')
  })
})
