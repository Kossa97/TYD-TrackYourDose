import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { BloodworkEntry } from './types'
import { auffaelligeWerte, buildMarkerSummaries, filterByKategorie, sortSummaries, type SortMode } from './lib/bloodwork'
import { formatDisplayDate } from './lib/format'
import type { KategorieFilter } from './lib/markerCatalog'
import { SONSTIGE } from './lib/markerCatalog'
import { DISCLAIMER, PANEL_STYLE, TEXT, MUTED } from './styles'
import { MarkerGrid } from './components/MarkerGrid'
import { MarkerDetail } from './components/MarkerDetail'
import { GridControls } from './components/GridControls'
import { AuffaelligeWerte } from './components/AuffaelligeWerte'
import { EntryModal, emptyDraft, type EntryDraft } from './components/EntryModal'

export function BlutwertePage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<BloodworkEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft())
  const [kategorie, setKategorie] = useState<KategorieFilter | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('kategorie')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('tested_at', { ascending: false })
      .order('marker', { ascending: true })

    if (error) toast.error('Blutwerte konnten nicht geladen werden')
    else setEntries((data ?? []) as BloodworkEntry[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void load()
    })
    return () => { cancelled = true }
  }, [load])

  const summaries = useMemo(() => buildMarkerSummaries(entries), [entries])

  const showSonstige = useMemo(() => summaries.some(s => s.kategorie === SONSTIGE), [summaries])

  const visibleSummaries = useMemo(
    () => sortSummaries(filterByKategorie(summaries, kategorie), sortMode),
    [summaries, kategorie, sortMode],
  )

  const auffaellig = useMemo(() => auffaelligeWerte(summaries), [summaries])

  const markersTested = useMemo(
    () => summaries.filter(s => s.latest !== null).length,
    [summaries],
  )

  const latestDate = useMemo(() => {
    if (entries.length === 0) return null
    return entries.reduce((max, e) => (e.tested_at > max ? e.tested_at : max), entries[0].tested_at)
  }, [entries])

  const openNew = (marker?: string) => {
    setDraft(emptyDraft(marker))
    setShowForm(true)
  }

  const save = async (parsed: { tested_at: string; marker: string; value: number; unit: string }) => {
    if (!user) return

    setSaving(true)
    const payload = {
      user_id: user.id,
      tested_at: parsed.tested_at,
      marker: parsed.marker,
      value: parsed.value,
      unit: parsed.unit,
      notes: null,
    }

    const { error } = await supabase.from('bloodwork').insert(payload)

    if (error) toast.error('Blutwert konnte nicht gespeichert werden')
    else {
      toast.success('Blutwert gespeichert')
      setShowForm(false)
      setDraft(emptyDraft())
      load()
    }
    setSaving(false)
  }

  const remove = async (entry: BloodworkEntry) => {
    if (!confirm(`${entry.marker} vom ${formatDisplayDate(entry.tested_at)} löschen?`)) return
    const { error } = await supabase.from('bloodwork').delete().eq('id', entry.id).eq('user_id', user!.id)
    if (error) toast.error('Blutwert konnte nicht gelöscht werden')
    else {
      toast.success('Blutwert gelöscht')
      load()
    }
  }

  const modal = showForm && (
    <EntryModal
      draft={draft}
      markerLocked={!!draft.marker && selectedMarker === draft.marker}
      saving={saving}
      onChange={setDraft}
      onCancel={() => setShowForm(false)}
      onSave={save}
    />
  )

  // ---------- View 2: Marker detail ----------
  if (selectedMarker) {
    const summary = summaries.find(s => s.name === selectedMarker)
    if (summary) {
      return (
        <div>
          <MarkerDetail
            summary={summary}
            onBack={() => setSelectedMarker(null)}
            onAdd={() => openNew(selectedMarker)}
            onDelete={remove}
          />
          {modal}
        </div>
      )
    }
  }

  // ---------- View 1: Marker grid ----------
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold" style={{ color: TEXT }}>Blutwerte</h1>
        <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => openNew()}>
          <Plus size={15} /> Neu
        </button>
      </div>

      {/* Mini stats */}
      <div className="flex mb-4 p-4" style={PANEL_STYLE}>
        <div className="flex-1 text-center" style={{ borderRight: '1px solid var(--border)' }}>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>Einträge gesamt</p>
          <p className="text-lg font-bold" style={{ color: TEXT }}>{entries.length}</p>
        </div>
        <div className="flex-1 text-center" style={{ borderRight: '1px solid var(--border)' }}>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>Marker getestet</p>
          <p className="text-lg font-bold" style={{ color: TEXT }}>{markersTested}</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>Letzter Test</p>
          <p className="text-sm font-bold leading-tight pt-1" style={{ color: TEXT }}>
            {latestDate ? formatDisplayDate(latestDate) : '–'}
          </p>
        </div>
      </div>

      {loading && (
        <div className="p-10 text-center" style={{ ...PANEL_STYLE, color: MUTED }}>
          Blutwerte werden geladen...
        </div>
      )}

      {!loading && (
        <>
          <AuffaelligeWerte summaries={auffaellig} onSelect={setSelectedMarker} />

          <GridControls
            kategorie={kategorie}
            sortMode={sortMode}
            showSonstige={showSonstige}
            onKategorie={setKategorie}
            onSortMode={setSortMode}
          />

          <MarkerGrid
            summaries={visibleSummaries}
            grouped={sortMode === 'kategorie' && kategorie === null}
            onSelect={setSelectedMarker}
          />

          <p className="text-xs text-center mt-5" style={{ color: MUTED }}>{DISCLAIMER}</p>
        </>
      )}

      {modal}
    </div>
  )
}
