// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllQueues, discardFailed, enqueue, flushQueue, isNetworkError, queueCounts, readQueue, type PendingEffect } from './offlineQueue'

const row = (id: string, felder: Partial<PendingEffect> = {}): PendingEffect => ({
  id, user_id: 'u1', type: 'effect', description: id, severity: 3, duration: null,
  occurred_at: '2026-10-06T08:00:00.000Z', stack_item_id: null, dose_log_id: null, notes: null,
  status: 'eingetreten', ...felder,
})
const netz = { message: 'TypeError: Failed to fetch' }

describe('Tagebuch offline', () => {
  beforeEach(() => localStorage.clear())

  it('erkennt Netzfehler, nicht aber Datenbankfehler', () => {
    expect(isNetworkError(netz, true)).toBe(true)
    expect(isNetworkError({ message: 'Load failed' }, true)).toBe(true)
    expect(isNetworkError({ message: 'Failed to fetch dynamically imported module: x.js' }, true)).toBe(false)
    expect(isNetworkError({ message: 'effect_stack_item_not_owned' }, true)).toBe(false)
    expect(isNetworkError({ message: 'irgendwas' }, false)).toBe(true)
  })

  it('haelt Eintraege je Nutzer, ohne Doppelte', () => {
    enqueue(row('a')); enqueue(row('a', { description: 'neu' })); enqueue(row('b', { user_id: 'u2' }))
    expect(readQueue('u1').map(r => r.description)).toEqual(['neu'])
    expect(readQueue('u2')).toHaveLength(1)
  })

  it('sendet der Reihe nach und bricht beim Netzfehler ab', async () => {
    enqueue(row('a')); enqueue(row('b')); enqueue(row('c'))
    const gesendet: string[] = []
    const result = await flushQueue('u1', async r => {
      if (r.id === 'b') return { error: netz }
      gesendet.push(r.id); return { error: null }
    })
    expect(gesendet).toEqual(['a'])
    expect(result).toEqual({ sent: 1, waiting: 2, failed: 0 })
    expect(readQueue('u1').map(r => r.id)).toEqual(['b', 'c'])
  })

  it('passt ein Verweis nicht mehr, geht der Eintrag nur ohne diesen Verweis raus', async () => {
    enqueue(row('a', { stack_item_id: 's', dose_log_id: 'd' }))
    const versuche: Array<[string | null, string | null]> = []
    const result = await flushQueue('u1', async r => {
      versuche.push([r.stack_item_id, r.dose_log_id])
      return { error: r.dose_log_id ? { message: 'effect_dose_log_other_substance', code: '23514' } : null }
    })
    // Die Substanz bleibt, nur die Einnahme faellt weg.
    expect(versuche).toEqual([['s', 'd'], ['s', null]])
    expect(result).toEqual({ sent: 1, waiting: 0, failed: 0 })
  })

  it('vorübergehender Serverfehler: Eintrag bleibt unveraendert, Lauf stoppt', async () => {
    enqueue(row('a', { stack_item_id: 's' })); enqueue(row('b'))
    const result = await flushQueue('u1', async () => ({ error: { message: 'upstream request timeout' } }))
    expect(result).toEqual({ sent: 0, waiting: 2, failed: 0 })
    expect(readQueue('u1')[0]).toMatchObject({ id: 'a', stack_item_id: 's' })
  })

  it('endgueltig gescheitert: wird markiert, nie still verworfen, nicht erneut gesendet', async () => {
    enqueue(row('a')); enqueue(row('b'))
    const gesendet: string[] = []
    const send = async (r: PendingEffect) => {
      gesendet.push(r.id)
      return { error: r.id === 'a' ? { message: 'new row violates check constraint', code: '23514' } : null }
    }
    expect(await flushQueue('u1', send)).toEqual({ sent: 1, waiting: 0, failed: 1 })
    expect(queueCounts('u1')).toEqual({ waiting: 0, failed: 1 })
    await flushQueue('u1', send)
    expect(gesendet).toEqual(['a', 'b'])
    discardFailed('u1')
    expect(readQueue('u1')).toEqual([])
  })

  it('Abmelden loescht alle gemerkten Eintraege des Geraets', () => {
    enqueue(row('a')); enqueue(row('b', { user_id: 'u2' }))
    localStorage.setItem('anderes', 'bleibt')
    clearAllQueues()
    expect(readQueue('u1')).toEqual([])
    expect(readQueue('u2')).toEqual([])
    expect(localStorage.getItem('anderes')).toBe('bleibt')
  })
})
