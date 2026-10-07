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

// PK-Kurven aendern sich im Minuten- bis Stundentakt. Einmal pro Minute
// werden Eintraege und Einnahmen neu geladen und die Kurve bis „jetzt"
// neu gerechnet — oefter lohnt sich nicht.
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
    const run = () => {
      if (inFlight) return
      inFlight = true
      fetchAll(userId)
        .then(data => {
          if (cancelled) return
          setLoaded({ userId, ...data, asOf: Date.now() })
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
