import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { BloodworkEntry, BloodworkReport } from './types'
import { auffaelligeWerte, buildMarkerSummaries, filterByKategorie, sortSummaries, type SortMode } from './lib/bloodwork'
import { formatDisplayDate } from './lib/format'
import type { KategorieFilter } from './lib/markerCatalog'
import { SONSTIGE } from './lib/markerCatalog'
import { CYAN, DISCLAIMER, PANEL_STYLE, TEXT, MUTED } from './styles'
import { MarkerGrid } from './components/MarkerGrid'
import { MarkerDetail } from './components/MarkerDetail'
import { GridControls } from './components/GridControls'
import { AuffaelligeWerte } from './components/AuffaelligeWerte'
import { BefundListe } from './components/BefundListe'
import { EntryModal, emptyDraft, type EntryDraft } from './components/EntryModal'
import { ImportFlow } from './components/import/ImportFlow'

export function BlutwertePage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<BloodworkEntry[]>([])
  const [reports, setReports] = useState<BloodworkReport[]>([])
  const [view, setView] = useState<'marker' | 'befunde'>('marker')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft())
  const [kategorie, setKategorie] = useState<KategorieFilter | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('kategorie')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [entriesResult, reportsResult] = await Promise.all([
      supabase
        .from('bloodwork')
        .select('*')
        .eq('user_id', user.id)
        .order('tested_at', { ascending: false })
        .order('marker', { ascending: true }),
      supabase
        .from('bloodwork_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('tested_at', { ascending: false }),
    ])

    if (entriesResult.error) toast.error('Blutwerte konnten nicht geladen werden')
    else setEntries((entriesResult.data ?? []) as BloodworkEntry[])

    // Die Tabelle existiert erst nach der separat auszuführenden Migration —
    // bis dahin bleibt die Befunde-Ansicht einfach leer, kein Fehler-Toast.
    if (!reportsResult.error) setReports((reportsResult.data ?? []) as BloodworkReport[])

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
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={() => setShowImport(true)}>
            <Camera size={15} /> Import
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => openNew()}>
            <Plus size={15} /> Neu
          </button>
        </div>
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

      {/* Ansicht: Marker / Befunde */}
      <div className="flex gap-2 mb-4">
        {([['marker', 'Marker'], ['befunde', 'Befunde']] as [typeof view, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="flex-1 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
            style={
              view === key
                ? { background: 'var(--accent-weak)', color: CYAN, border: '1px solid var(--accent-border)' }
                : { color: MUTED, border: '1px solid var(--border)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="p-10 text-center" style={{ ...PANEL_STYLE, color: MUTED }}>
          Blutwerte werden geladen...
        </div>
      )}

      {!loading && view === 'befunde' && (
        <BefundListe reports={reports} entries={entries} onChanged={load} />
      )}

      {!loading && view === 'marker' && (
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
      {showImport && <ImportFlow onClose={() => setShowImport(false)} onSaved={load} />}
    </div>
  )
}
