import { describe, expect, it } from 'vitest'
import type { ErrorEvent } from '@sentry/react'
import { initMonitoring, reportError, scrubBreadcrumb, scrubEvent, scrubMessage, scrubUrl } from './monitoring'

describe('Monitoring — nur Bekanntes geht raus', () => {
  it('lässt nur Meldungen mit bekanntem, datenfreiem Wortlaut durch', () => {
    expect(scrubMessage('Invalid stack item setup draft: plan.method, inventory')).toBe('Invalid stack item setup draft: plan.method, inventory')
    expect(scrubMessage('Failed to fetch')).toBe('Failed to fetch')
    expect(scrubMessage("Cannot read properties of undefined (reading 'id')")).toBe("Cannot read properties of undefined (reading 'id')")
    // Alles Unbekannte — auch Postgres-Meldungen mit Zeilen oder Namen — nicht.
    expect(scrubMessage('new row violates check constraint. Failing row contains (a1, Testosteron, 250)')).toBe('[entfernt]')
    expect(scrubMessage('Non-Error promise rejection captured with value: BPC-157 250 mcg')).toBe('[entfernt]')
  })

  it('lässt Typfehler der Browser durch — der Ausdruck darin ist Quelltext, kein Wert', () => {
    for (const meldung of [
      "undefined is not an object (evaluating 'e.find(t=>t.id===n).name')",
      "null is not an object (evaluating 'a.slots.length')",
      "e.map is not a function. (In 'e.map(r=>r.x)', 'e.map' is undefined)",
      "Cannot destructure property 'dose' of 'n.slots[0]' as it is undefined.",
      'e is undefined',
      'can\'t access property "length", e is null',
      'e is not iterable',
    ]) {
      expect(scrubMessage(meldung), meldung).toBe(meldung)
    }
    // Nichts darf hinter einer erlaubten Form weiterlaufen.
    expect(scrubMessage('e is not iterable: BPC-157 250 mcg, Blutwert 4.2')).toBe('[entfernt]')
  })

  it('ersetzt gelesene oder gesetzte Schlüssel, die nicht wie Quelltext aussehen', () => {
    // Quelltext-Namen bleiben — damit findet man die Stelle.
    expect(scrubMessage("Cannot read properties of undefined (reading 'length')")).toBe("Cannot read properties of undefined (reading 'length')")
    // Laufzeitwerte (Substanz, Menge) werden zu „…".
    for (const [meldung, erwartet] of [
      ["Cannot read properties of undefined (reading 'Semaglutide')", "Cannot read properties of undefined (reading '…')"],
      ["Cannot set properties of undefined (setting '250')", "Cannot set properties of undefined (setting '…')"],
      ["Cannot read properties of null (reading 'BPC-157 250 mcg')", "Cannot read properties of null (reading '…')"],
      ['can\'t access property "Testosteron", e is undefined', 'can\'t access property "…", e is undefined'],
      ["Cannot destructure property '4.2' of 'n.werte' as it is undefined.", "Cannot destructure property '…' of 'n.werte' as it is undefined."],
    ]) {
      expect(scrubMessage(meldung), meldung).toBe(erwartet)
    }
  })

  it('kürzt URLs auf den Pfad ohne Parameter, IDs und Storage-Objekte', () => {
    expect(scrubUrl('https://x.supabase.co/rest/v1/dose_logs?select=dose&user_id=eq.123')).toBe('https://x.supabase.co/rest/v1/dose_logs')
    expect(scrubUrl('https://app/my-stack/0b5a2c1e-1111-4a2b-9c3d-123456789abc#x')).toBe('https://app/my-stack/:id')
    expect(scrubUrl('https://x.supabase.co/storage/v1/object/batch-files/0b5a2c1e-1111-4a2b-9c3d-123456789abc/171.pdf'))
      .toBe('https://x.supabase.co/storage/v1/object/batch-files/…')
    expect(scrubUrl('https://x.supabase.co/storage/v1/object/public/batch-files/u/171.pdf'))
      .toBe('https://x.supabase.co/storage/v1/object/public/batch-files/…')
  })

  it('behält nur Seitenwechsel und Netzwerkaufrufe — keine Klicks, keine Konsole', () => {
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'svg[aria-label="BPC-157, 5 mg, 80%"]' })).toBeNull()
    expect(scrubBreadcrumb({ category: 'ui.input', message: 'input#dose' })).toBeNull()
    expect(scrubBreadcrumb({ category: 'console', message: '{"dose": 250}' })).toBeNull()
    expect(scrubBreadcrumb({ category: 'fetch', data: { url: 'https://x/rest/v1/stack_items?user_id=eq.1', method: 'GET', status_code: 200, request_body_size: 10 } }))
      .toMatchObject({ category: 'fetch', data: { url: 'https://x/rest/v1/stack_items', method: 'GET', status_code: 200 } })
    expect(scrubBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b#y' } }))
      .toMatchObject({ data: { from: '/a', to: '/b' } })
  })

  it('räumt ein ganzes Ereignis auf', () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: 'u1', email: 'a@b.c' },
      extra: { draft: { dose: 250 } },
      contexts: { state: { dose: 250 } },
      request: { url: 'https://app/my-stack?x=1', data: '{"dose":250}', cookies: { a: 'b' }, headers: { authorization: 'x' } },
      exception: { values: [{ type: 'Error', value: 'Failing row contains (1, 2)' }] },
      breadcrumbs: [{ category: 'ui.click', message: 'x' }, { category: 'navigation', data: { from: '/a?x=1', to: '/b' } }],
    } as unknown as ErrorEvent)

    expect(event.user).toBeUndefined()
    expect(event.extra).toBeUndefined()
    expect(event.contexts).toBeUndefined()
    expect(event.request).toEqual({ url: 'https://app/my-stack' })
    expect(event.exception?.values?.[0]).toMatchObject({ type: 'Error', value: '[entfernt]' })
    expect(event.breadcrumbs).toHaveLength(1)
  })

  it('filtert auch die Rahmen des Stapels und jeden Fehler der Kette', () => {
    const event = scrubEvent({
      type: undefined,
      exception: { values: [
        { type: 'React ErrorBoundary TypeError', value: 'Wert: Testosteron 250 mg', stacktrace: { frames: [{ filename: 'https://app/my-stack/0b9f3c1e-8f2a-4c55-9d11-2b6f1b0e7a44?x=1#access_token=abc' }] } },
        { type: 'TypeError', value: 'Wert: Testosteron 250 mg' },
      ] },
    } as ErrorEvent)
    expect(event.exception?.values?.map(value => value.value)).toEqual(['[entfernt]', '[entfernt]'])
    expect(event.exception?.values?.[0].stacktrace?.frames?.[0].filename).toBe('https://app/my-stack/:id')
  })

  it('lädt ohne DSN nichts und meldet nichts', async () => {
    expect(await initMonitoring('')).toBe(false)
    expect(() => reportError(new Error('x'), 'test')).not.toThrow()
  })
})

describe('Monitoring — Geräteangabe', () => {
  it('nennt nur Browser und System mit Hauptversion', async () => {
    const { platformTags } = await import('./monitoring')
    expect(platformTags('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'))
      .toEqual({ browser: 'Safari 18', os: 'iOS 18' })
    expect(platformTags('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36'))
      .toEqual({ browser: 'Chrome 129', os: 'Android 14' })
    expect(platformTags('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0'))
      .toEqual({ browser: 'Firefox 131', os: 'Windows' })
    // Eingefrorene Kennungen: lieber keine Version als eine falsche.
    expect(platformTags('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'))
      .toEqual({ browser: 'Chrome 140', os: 'Android' })
    expect(platformTags('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'))
      .toEqual({ browser: 'Safari 26', os: 'iOS 26' })
    expect(platformTags('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', 5))
      .toEqual({ browser: 'Safari 26', os: 'iPadOS 26' })
  })
})
