import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

// ── iOS detection ─────────────────────────────────────────────────────────────

function isIOSDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad on iPadOS 13+ reports as Mac
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isInstalledPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(window.navigator as unknown as { standalone?: boolean }).standalone
  )
}

// ── VAPID helper ──────────────────────────────────────────────────────────────

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(b64)
  const arr     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PushState =
  | 'loading'
  | 'unsupported'      // Browser doesn't support Push API
  | 'ios-needs-install'// iOS Safari – must install PWA first
  | 'denied'           // User blocked notifications
  | 'default'          // Supported, not yet asked
  | 'subscribed'       // Active subscription in DB

interface UsePushNotificationsReturn {
  state: PushState
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
  sendTestPush: () => Promise<{ ok: boolean; error?: string }>
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePushNotifications(user: User | null): UsePushNotificationsReturn {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    if (!user) return

    // iOS Safari (not installed) – push only works in installed PWA
    if (isIOSDevice() && !isInstalledPWA()) {
      setState('ios-needs-install')
      return
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }

    const perm = Notification.permission
    if (perm === 'denied') { setState('denied'); return }

    navigator.serviceWorker.ready
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription()
        setState(sub ? 'subscribed' : 'default')
      })
      .catch(() => setState('default'))
  }, [user])

  // ── Subscribe ──────────────────────────────────────────────────────────────
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !VAPID_PUBLIC_KEY) {
      if (!VAPID_PUBLIC_KEY) console.warn('[Push] VITE_VAPID_PUBLIC_KEY not set')
      return false
    }
    if (!('PushManager' in window)) return false

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState('denied'); return false }

      const reg = await navigator.serviceWorker.ready
      let sub   = await reg.pushManager.getSubscription()

      if (!sub) {
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
    } catch (err) {
      console.error('[Push] subscribe error:', err)
      return false
    }
  }, [user])

  // ── Unsubscribe ────────────────────────────────────────────────────────────
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

  // ── Test push (calls /api/test-push with user JWT) ─────────────────────────
  const sendTestPush = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { ok: false, error: 'Nicht eingeloggt' }

      const res  = await fetch('/api/test-push', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))

      if (res.ok) return { ok: true }
      // Surface the specific server error
      const msg = body.hint ?? body.error ?? `HTTP ${res.status}`
      return { ok: false, error: msg }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }, [])

  return { state, subscribe, unsubscribe, sendTestPush }
}
