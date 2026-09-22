// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePushNotifications } from './usePushNotifications'

const pageMocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('./supabase', () => ({ supabase: { from: pageMocks.from } }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}))

const USER = { id: 'user-1' } as unknown as import('@supabase/supabase-js').User

/**
 * Baut ein `push_subscriptions`-Update nach, das ueber `eq(...).eq(...)`
 * verkettet wird -- dasselbe Muster wie `saveSubscription`s Upsert.
 *
 * Der PostgREST-Builder von supabase-js ist ein Thenable: `.update()`/
 * `.eq()` bauen die Anfrage nur zusammen und geben `this` synchron zurueck;
 * der eigentliche Fetch steckt in der eigenen `then()`-Methode
 * (nachgelesen in `@supabase/postgrest-js/src/PostgrestBuilder.ts`). Ein
 * `async () => {...}` an `eq2` haette das NICHT nachgebildet -- der wuerde
 * schon beim Aufruf von `eq(...)` "ausgeloest", nicht erst bei `.then()`,
 * und liesse ein `void ausdruck` ohne jedes `await` genauso gruen laufen
 * wie ein korrektes `await ausdruck`. Deshalb hier ein eigenes `then`,
 * dessen Aufruf separat geprueft wird.
 */
function updateSpy() {
  const then = vi.fn((resolve: (value: { data: null; error: null }) => void) => {
    resolve({ data: null, error: null })
  })
  const eq2 = vi.fn(() => ({ then }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const update = vi.fn(() => ({ eq: eq1 }))
  return { update, eq1, eq2, then }
}

function stubServiceWorker(getSubscription: () => Promise<{ endpoint: string } | null>) {
  const reg = {
    update: vi.fn(async () => undefined),
    pushManager: { getSubscription },
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(reg) },
    configurable: true,
  })
  ;(window as unknown as { PushManager?: unknown }).PushManager = function () {}
  ;(globalThis as unknown as { Notification?: unknown }).Notification = { permission: 'granted' }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  // @ts-expect-error -- Testaufraeumen, kein echtes DOM-Objekt
  delete navigator.serviceWorker
  // @ts-expect-error -- dito
  delete window.PushManager
  // @ts-expect-error -- dito
  delete globalThis.Notification
})

describe('usePushNotifications', () => {
  it('haelt die gespeicherte Zeitzone beim Start aktuell, wenn schon abonniert ist', async () => {
    // `api/send-reminders.js` fragt `push_subscriptions.timezone` ab -- eine
    // gespeicherte Spalte, kein Live-Wert. Ohne diesen Abgleich bliebe die
    // Erinnerung auf der Zeitzone von damals stehen, auch wenn das Geraet
    // seither verreist ist. Der Kalender selbst hat dieses Problem nicht --
    // der liest `Intl.DateTimeFormat()` bei jedem Rendern live.
    const echteZeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const { update, eq1, eq2, then } = updateSpy()
    pageMocks.from.mockReturnValue({ update })
    stubServiceWorker(async () => ({ endpoint: 'https://push.example/abc' }))

    const { result } = renderHook(() => usePushNotifications(USER))

    await waitFor(() => expect(result.current.state).toBe('subscribed'))
    await waitFor(() => expect(then).toHaveBeenCalled())
    expect(pageMocks.from).toHaveBeenCalledWith('push_subscriptions')
    expect(update).toHaveBeenCalledWith({ timezone: echteZeitzone })
    expect(eq1).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eq2).toHaveBeenCalledWith('endpoint', 'https://push.example/abc')
  })

  it('schreibt nichts, wenn (noch) kein Abonnement besteht', async () => {
    const { update } = updateSpy()
    pageMocks.from.mockReturnValue({ update })
    stubServiceWorker(async () => null)

    const { result } = renderHook(() => usePushNotifications(USER))

    await waitFor(() => expect(result.current.state).toBe('default'))
    expect(pageMocks.from).not.toHaveBeenCalled()
  })

  it('schreibt nichts ohne Nutzer', async () => {
    const { update } = updateSpy()
    pageMocks.from.mockReturnValue({ update })
    stubServiceWorker(async () => ({ endpoint: 'https://push.example/abc' }))

    renderHook(() => usePushNotifications(null))
    await act(async () => { await Promise.resolve() })

    expect(pageMocks.from).not.toHaveBeenCalled()
  })
})
