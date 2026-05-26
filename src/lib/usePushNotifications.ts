import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

// VAPID public key (set VITE_VAPID_PUBLIC_KEY in .env / Vercel env vars)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  const arr     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

export type PushState = 'unsupported' | 'denied' | 'default' | 'subscribed'

interface UsePushNotificationsReturn {
  state: PushState
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
}

export function usePushNotifications(user: User | null): UsePushNotificationsReturn {
  const [state, setState] = useState<PushState>('unsupported')

  // Detect initial state
  useEffect(() => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported')
      return
    }
    const perm = Notification.permission
    if (perm === 'denied') { setState('denied'); return }

    // Check if already subscribed
    navigator.serviceWorker.ready
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription()
        setState(sub ? 'subscribed' : perm === 'granted' ? 'default' : 'default')
      })
      .catch(() => setState('default'))
  }, [user])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) return false
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VITE_VAPID_PUBLIC_KEY is not set')
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return false
      }

      const reg = await navigator.serviceWorker.ready
      let subscription = await reg.pushManager.getSubscription()

      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id:      user.id,
          endpoint:     subscription.endpoint,
          subscription: subscription.toJSON(),
          timezone,
        },
        { onConflict: 'user_id,endpoint' }
      )

      if (error) {
        console.error('[Push] Failed to save subscription:', error)
        return false
      }

      setState('subscribed')
      return true
    } catch (err) {
      console.error('[Push] subscribe error:', err)
      return false
    }
  }, [user])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()

      if (sub) {
        await sub.unsubscribe()
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint)
      }
      setState('default')
    } catch (err) {
      console.error('[Push] unsubscribe error:', err)
    }
  }, [user])

  return { state, subscribe, unsubscribe }
}
