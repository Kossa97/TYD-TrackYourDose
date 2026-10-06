import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Camera, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { BloodworkEntry, BloodworkReport } from './types'
import { auffaelligeWerte, buildMarkerSummaries, filterByKategorie, sortSummaries, type SortMode } from './lib/bloodwork'
import { formatDisplayDate } from './lib/format'
import type { KategorieFilter } from './lib/markerCatalog'
import { SONSTIGE } from './lib/markerCatalog'
import { CYAN, PANEL_STYLE, TEXT, MUTED } from './styles'
import { markerName } from './lib/markerCatalog.en'
import { Sheet } from '../compliance/components/Sheet'
import { MarkerGrid } from './components/MarkerGrid'
import { MarkerDetail } from './components/MarkerDetail'
import { GridControls } from './components/GridControls'
import { AuffaelligeWerte } from './components/AuffaelligeWerte'
import { BefundListe } from './components/BefundListe'
import { EntryModal, emptyDraft, type EntryDraft } from './components/EntryModal'
import { ImportFlow } from './components/import/ImportFlow'

export function BlutwertePage() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const [loeschen, setLoeschen] = useState<BloodworkEntry | null>(null)
  const [loescht, setLoescht] = useState(false)
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

    // i18n.t statt t: sonst wuerde jeder Sprachwechsel alles neu laden.
    if (entriesResult.error) toast.error(i18n.t('bw_load_error'))
    else setEntries((entriesResult.data ?? []) as BloodworkEntry[])

    // Die Tabelle existiert erst nach der separat auszuführenden Migration —
    // bis dahin bleibt die Befunde-Ansicht einfach leer, kein Fehler-Toast.
    if (!reportsResult.error) setReports((reportsResult.data ?? []) as BloodworkReport[])

    setLoading(false)
  }, [user, i18n])

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

    if (error) toast.error(t('bw_save_error'))
    else {
      toast.success(t('bw_saved'))
      setShowForm(false)
      setDraft(emptyDraft())
      load()
    }
    setSaving(false)
  }

  // Loeschen ueber ein eigenes Sheet statt des Browser-Fensters.
  const remove = (entry: BloodworkEntry) => setLoeschen(entry)

  const loeschenBestaetigt = async () => {
    if (!loeschen || !user) return
    setLoescht(true)
    const { error } = await supabase.from('bloodwork').delete().eq('id', loeschen.id).eq('user_id', user.id)
    setLoescht(false)
    if (error) return toast.error(t('bw_delete_error'))
    toast.success(t('bw_deleted'))
    setLoeschen(null)
    void load()
  }

  const loeschenSheet = loeschen && (
    <Sheet labelledBy="bw-delete-title" busy={loescht} onClose={() => setLoeschen(null)} role="alertdialog" data-bw-delete-sheet>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
          <Trash2 size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="bw-delete-title" className="text-lg font-bold text-white">{t('bw_delete_title')}</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {t('bw_delete_desc', { marker: markerName(loeschen.marker, sprache), date: formatDisplayDate(loeschen.tested_at) })}
          </p>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" autoFocus data-app-back-close disabled={loescht} onClick={() => setLoeschen(null)} className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 disabled:opacity-50">
          {t('cancel')}
        </button>
        <button type="button" data-bw-delete-confirm disabled={loescht} onClick={() => void loeschenBestaetigt()} className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">
          {t('delete')}
        </button>
      </div>
    </Sheet>
  )

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
          {loeschenSheet}
        </div>
      )
    }
  }

  // ---------- View 1: Marker grid ----------
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold" style={{ color: TEXT }}>{t('bw_title')}</h1>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-1.5 text-sm" onClick={() => setShowImport(true)}>
            <Camera size={15} /> {t('bw_import')}
          </button>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => openNew()}>
            <Plus size={15} /> {t('bw_new')}
          </button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="flex mb-4 p-4" style={PANEL_STYLE}>
        <div className="flex-1 text-center" style={{ borderRight: '1px solid var(--border)' }}>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>{t('bw_stat_entries')}</p>
          <p className="text-lg font-bold" style={{ color: TEXT }}>{entries.length}</p>
        </div>
        <div className="flex-1 text-center" style={{ borderRight: '1px solid var(--border)' }}>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>{t('bw_stat_markers')}</p>
          <p className="text-lg font-bold" style={{ color: TEXT }}>{markersTested}</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>{t('bw_stat_last')}</p>
          <p className="text-sm font-bold leading-tight pt-1" style={{ color: TEXT }}>
            {latestDate ? formatDisplayDate(latestDate) : '–'}
          </p>
        </div>
      </div>

      {/* Ansicht: Marker / Befunde */}
      <div className="flex gap-2 mb-4">
        {([['marker', t('bw_view_markers')], ['befunde', t('bw_view_reports')]] as [typeof view, string][]).map(([key, label]) => (
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
          {t('bw_loading')}
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

          <p className="text-xs text-center mt-5" style={{ color: MUTED }}>{t('bw_disclaimer')}</p>
        </>
      )}

      {modal}
      {loeschenSheet}
      {showImport && <ImportFlow onClose={() => setShowImport(false)} onSaved={load} />}
    </div>
  )
}
