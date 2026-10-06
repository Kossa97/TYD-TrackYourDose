import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { ladeKiEinwilligung, setzeKiEinwilligung, type ConsentClient } from '../lib/aiConsent'

const client = supabase as unknown as ConsentClient

/**
 * Stand der KI-Einwilligung: `undefined` solange geladen wird, sonst der
 * Zeitpunkt oder null. Bei einem Lesefehler gilt sie als nicht erteilt —
 * lieber einmal zu oft fragen als ohne Einwilligung senden.
 */
export function useKiEinwilligung() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [stand, setStand] = useState<{ fuer: string; wert: string | null } | null>(null)

  useEffect(() => {
    if (!userId) return
    let aktuell = true
    ladeKiEinwilligung(client, userId)
      .then(wert => { if (aktuell) setStand({ fuer: userId, wert }) })
      .catch(() => { if (aktuell) setStand({ fuer: userId, wert: null }) })
    return () => { aktuell = false }
  }, [userId])

  const setze = useCallback(async (erteilt: boolean) => {
    if (!userId) return
    const wert = await setzeKiEinwilligung(client, userId, erteilt ? new Date() : null)
    setStand({ fuer: userId, wert })
  }, [userId])

  const gilt = stand && stand.fuer === userId ? stand.wert : undefined
  return { einwilligung: gilt, setze }
}
