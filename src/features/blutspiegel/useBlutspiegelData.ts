import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  buildEntryCurve,
  loadBlutspiegelEntries,
  loadEntryHistories,
  type BlutspiegelEntry,
  type EntryCurve,
  type EntryHistory,
  type ReadyEntry,
} from './entries'

// PK-Kurven aendern sich im Minuten- bis Stundentakt. Die Datenbank wird
// deshalb hoechstens einmal pro Minute gefragt; dazwischen waechst die Kurve
// nur lokal bis „jetzt" weiter.
export const BLUTSPIEGEL_REFRESH_MS = 60_000

export interface BlutspiegelData {
  loading: boolean
  error: boolean
  entries: BlutspiegelEntry[]
  ready: ReadyEntry[]
  curves: Map<string, EntryCurve>
  /** Zeitpunkt des letzten Abrufs (Unix ms) — „jetzt" fuer die Ansicht. */
  asOf: number
}

interface Loaded {
  userId: string
  entries: BlutspiegelEntry[]
  histories: Map<string, EntryHistory>
  tick: number
  asOf: number
}

async function fetchAll(userId: string) {
  const entries = await loadBlutspiegelEntries(userId)
  const histories = await loadEntryHistories(entries)
  return { entries, histories }
}

export function useBlutspiegelData(): BlutspiegelData {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    let inFlight = false
    let tick = 0
    const run = () => {
      if (inFlight) return
      inFlight = true
      const thisTick = tick++
      fetchAll(userId)
        .then(data => {
          if (cancelled) return
          setLoaded({ userId, ...data, tick: thisTick, asOf: Date.now() })
          setError(false)
        })
        .catch(() => { if (!cancelled) setError(true) })
        .finally(() => { inFlight = false })
    }
    run()
    const id = window.setInterval(run, BLUTSPIEGEL_REFRESH_MS)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [userId])

  const current = loaded && loaded.userId === userId ? loaded : null
  const entries = useMemo(() => current?.entries ?? [], [current])
  const ready = useMemo(() => entries.filter((e): e is ReadyEntry => e.kind === 'ready'), [entries])
  // Jeder Abruf (auch ohne neue Einnahmen) rechnet die Kurve bis „jetzt" neu.
  const curves = useMemo(
    () => new Map(ready.map(entry => [entry.key, buildEntryCurve(entry, current?.histories.get(entry.cycleId))])),
    [ready, current],
  )

  return {
    loading: Boolean(userId) && !current && !error,
    error,
    entries,
    ready,
    curves,
    asOf: current?.asOf ?? 0,
  }
}
