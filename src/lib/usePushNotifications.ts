import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { showPageNotification, waitForServiceWorkerPush, TEST_BODY, TEST_TITLE } from './pushLocal'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function isIOSDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isInstalledPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(window.navigator as unknown as { standalone?: boolean }).standalone
  )
}

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(b64)
  const arr     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

export type PushState =
  | 'loading'
  | 'unsupported'
  | 'ios-needs-install'
  | 'ios-native-app'
  | 'denied'
  | 'default'
  | 'subscribed'

interface UsePushNotificationsReturn {
  state: PushState
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
  reconnect: () => Promise<boolean>
  sendTestPush: () => Promise<{ ok: boolean; error?: string; delivered?: boolean }>
}

export function usePushNotifications(user: User | null): UsePushNotificationsReturn {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    if (!user) return

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      setState('ios-native-app')
      return
    }

    if (isIOSDevice() && !isInstalledPWA()) {
      setState('ios-needs-install')
      return
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }

    if (Notification.permission === 'denied') { setState('denied'); return }

    navigator.serviceWorker.ready
      .then(async (reg) => {
        await reg.update().catch(() => {})
        const sub = await reg.pushManager.getSubscription()
        setState(sub ? 'subscribed' : 'default')
      })
      .catch(() => setState('default'))
  }, [user])

  const saveSubscription = useCallback(async (freshOnIos: boolean): Promise<boolean> => {
    if (!user || !VAPID_PUBLIC_KEY) {
      if (!VAPID_PUBLIC_KEY) console.warn('[Push] VITE_VAPID_PUBLIC_KEY not set')
      return false
    }
    if (!('PushManager' in window)) return false

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') { setState('denied'); return false }

    const reg = await navigator.serviceWorker.ready

    if (freshOnIos && isIOSDevice()) {
      const old = await reg.pushManager.getSubscription()
      if (old) await old.unsubscribe().catch(() => {})
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
    }

    let sub = await reg.pushManager.getSubscription()
    if (!sub || freshOnIos) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      })
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id:      user.id,
        endpoint:     sub.endpoint,
        subscription: sub.toJSON(),
        timezone,
      },
      { onConflict: 'user_id,endpoint' },
    )

    if (error) { console.error('[Push] save error:', error); return false }
    setState('subscribed')
    return true
  }, [user])

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      return await saveSubscription(isIOSDevice())
    } catch (err) {
      console.error('[Push] subscribe error:', err)
      return false
    }
  }, [saveSubscription])

  const reconnect = useCallback(async (): Promise<boolean> => {
    try {
      return await saveSubscription(true)
    } catch (err) {
      console.error('[Push] reconnect error:', err)
      return false
    }
  }, [saveSubscription])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
      }
      setState('default')
    } catch (err) {
      console.error('[Push] unsubscribe error:', err)
    }
  }, [user])

  const sendTestPush = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { ok: false, error: 'Nicht eingeloggt' }

      let endpoint: string | null = null
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        endpoint = (await reg.pushManager.getSubscription())?.endpoint ?? null
      }

      const res = await fetch('/api/test-push', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ endpoint }),
      })
      const raw = await res.text()
      let body: { hint?: string; error?: string } = {}
      try { body = raw ? JSON.parse(raw) : {} } catch { /* ignore */ }

      if (!res.ok) {
        return { ok: false, error: body.hint ?? body.error ?? `HTTP ${res.status}` }
      }

      const delivered = await waitForServiceWorkerPush(3500)
      if (!delivered) showPageNotification(TEST_TITLE, TEST_BODY)

      return { ok: true, delivered }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }, [])

  return { state, subscribe, unsubscribe, reconnect, sendTestPush }
}
