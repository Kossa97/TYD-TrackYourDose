import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { flushQueue, QUEUE_EVENT, queueCounts, readQueue, type PendingEffect } from './offlineQueue'

/**
 * Sendet gemerkte Tagebuch-Einträge — beim Start und sobald das Netz zurück
 * ist, auf jeder Seite. Hängt einmal im Layout.
 */
export function useTagebuchOfflineSync(userId: string | undefined): void {
  const { t } = useTranslation()
  const running = useRef(false)

  const flush = useCallback(async () => {
    if (!userId || running.current || !navigator.onLine) return
    if (!readQueue(userId).some(row => !row.failed)) return
    running.current = true
    try {
      const { sent } = await flushQueue(userId, async row => {
        const fields: Omit<PendingEffect, 'failed'> & { failed?: true } = { ...row }
        delete fields.failed
        // ignoreDuplicates: kam der erste Versuch doch an, bleibt die Zeile, wie sie ist.
        const { error } = await supabase.from('effects').upsert(fields, { onConflict: 'id', ignoreDuplicates: true })
        return { error }
      })
      if (sent) toast.success(t('tagebuch_offline_gesendet', { count: sent }))
    } finally {
      running.current = false
    }
  }, [userId, t])

  useEffect(() => {
    void flush()
    const onOnline = () => { void flush() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [flush])
}

/** Wie viele Einträge warten bzw. endgültig gescheitert sind — auch über Tabs hinweg. */
export function useQueueCounts(userId: string): { waiting: number; failed: number } {
  const [counts, setCounts] = useState(() => queueCounts(userId))
  useEffect(() => {
    const update = () => setCounts(queueCounts(userId))
    update()
    window.addEventListener(QUEUE_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(QUEUE_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [userId])
  return counts
}
