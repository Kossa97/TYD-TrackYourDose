import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Activity, CalendarDays, Droplets, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface BloodworkEntry {
  id: string
  user_id: string
  tested_at: string
  marker: string
  value: number | string
  unit: string
  notes: string | null
  created_at: string | null
}

interface BloodworkForm {
  tested_at: string
  marker: string
  value: string
  unit: string
  notes: string
}

interface MarkerOption {
  label: string
  units: string[]
}

const MARKERS = [
  { label: 'IGF-1', units: ['ng/mL', 'µg/L', 'nmol/L'] },
  { label: 'Testosteron', units: ['ng/dL', 'nmol/L', 'ng/mL', 'pg/mL'] },
  { label: 'Östradiol', units: ['pg/mL', 'pmol/L'] },
  { label: 'SHBG', units: ['nmol/L', 'µg/mL'] },
  { label: 'LH', units: ['mIU/mL', 'IU/L'] },
  { label: 'FSH', units: ['mIU/mL', 'IU/L'] },
  { label: 'TSH', units: ['mIU/mL', 'µIU/mL', 'mU/L'] },
  { label: 'CRP', units: ['mg/L', 'mg/dL'] },
  { label: 'Vitamin D', units: ['ng/mL', 'nmol/L'] },
  { label: 'Ferritin', units: ['ng/mL', 'µg/L', 'pmol/L'] },
  { label: 'Hämoglobin', units: ['g/dL', 'g/L', 'mmol/L'] },
  { label: 'Hematokrit', units: ['%', 'L/L'] },
  { label: 'GH', units: ['ng/mL', 'µg/L', 'mIU/L'] },
  { label: 'Kortisol', units: ['µg/dL', 'nmol/L', 'µg/L'] },
  { label: 'Insulin', units: ['µIU/mL', 'mIU/L', 'pmol/L'] },
] satisfies MarkerOption[]

const today = () => format(new Date(), 'yyyy-MM-dd')

const emptyForm = (): BloodworkForm => ({
  tested_at: today(),
  marker: '',
  value: '',
  unit: '',
  notes: '',
})

const formatDisplayDate = (date: string) => format(new Date(`${date}T00:00:00`), 'dd.MM.yyyy')

const formatNumber = (value: number | string) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(numeric)
}

export function Blutwerte() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<BloodworkEntry[]>([])
  const [search, setSearch] = useState('')
  const [markerFilter, setMarkerFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BloodworkForm>(emptyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  const markers = useMemo(
    () => Array.from(new Set(entries.map(entry => entry.marker))).sort((a, b) => a.localeCompare(b)),
    [entries],
  )

  const markerOptions = useMemo(() => {
    const presetLabels = new Set(MARKERS.map(marker => marker.label))
    const customMarkers = markers
      .filter(marker => !presetLabels.has(marker))
      .map(marker => ({
        label: marker,
        units: Array.from(new Set(entries
          .filter(entry => entry.marker === marker)
          .map(entry => entry.unit)
          .filter(Boolean))),
      }))
    return [...MARKERS, ...customMarkers]
  }, [entries, markers])

  const unitOptions = useMemo(() => {
    const selectedMarker = markerOptions.find(option => option.label === form.marker)
    const units = selectedMarker?.units ?? []
    return form.unit && !units.includes(form.unit) ? [...units, form.unit] : units
  }, [form.marker, form.unit, markerOptions])

  const filteredEntries = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return entries.filter(entry => {
      const matchesMarker = markerFilter === 'all' || entry.marker === markerFilter
      const matchesSearch = !needle
        || entry.marker.toLowerCase().includes(needle)
        || entry.unit.toLowerCase().includes(needle)
        || (entry.notes ?? '').toLowerCase().includes(needle)
      return matchesMarker && matchesSearch
    })
  }, [entries, markerFilter, search])

  const latestEntry = entries[0]

  const resetForm = () => {
    setForm(emptyForm())
    setEditingId(null)
  }

  const openNew = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (entry: BloodworkEntry) => {
    setEditingId(entry.id)
    setForm({
      tested_at: entry.tested_at,
      marker: entry.marker,
      value: String(entry.value),
      unit: entry.unit,
      notes: entry.notes ?? '',
    })
    setShowForm(true)
  }

  const setMarker = (label: string) => {
    const marker = markerOptions.find(option => option.label === label)
    setForm(current => ({
      ...current,
      marker: label,
      unit: marker?.units[0] ?? '',
    }))
  }

  const save = async () => {
    const marker = form.marker.trim()
    const unit = form.unit.trim()
    const parsedValue = Number(form.value.replace(',', '.'))

    if (!form.tested_at) return toast.error('Bitte ein Testdatum eintragen')
    if (!marker) return toast.error('Bitte einen Marker eintragen')
    if (!Number.isFinite(parsedValue)) return toast.error('Bitte einen gültigen Wert eintragen')
    if (!unit) return toast.error('Bitte eine Einheit eintragen')
    if (!user) return

    setSaving(true)
    const payload = {
      user_id: user.id,
      tested_at: form.tested_at,
      marker,
      value: parsedValue,
      unit,
      notes: form.notes.trim() || null,
    }

    const { error } = editingId
      ? await supabase.from('bloodwork').update(payload).eq('id', editingId).eq('user_id', user.id)
      : await supabase.from('bloodwork').insert(payload)

    if (error) toast.error('Blutwert konnte nicht gespeichert werden')
    else {
      toast.success(editingId ? 'Blutwert aktualisiert' : 'Blutwert gespeichert')
      setShowForm(false)
      resetForm()
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-400/70 mb-1">Laborwerte</p>
          <h1 className="text-xl font-bold">Blutwerte</h1>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}>
          <Plus size={16} /> Neu
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="card py-3 px-3">
          <Activity size={16} className="text-sky-400 mb-2" />
          <p className="text-lg font-bold text-white">{entries.length}</p>
          <p className="text-[0.65rem] text-slate-500 uppercase tracking-wide">Einträge</p>
        </div>
        <div className="card py-3 px-3">
          <Droplets size={16} className="text-rose-400 mb-2" />
          <p className="text-lg font-bold text-white">{markers.length}</p>
          <p className="text-[0.65rem] text-slate-500 uppercase tracking-wide">Marker</p>
        </div>
        <div className="card py-3 px-3">
          <CalendarDays size={16} className="text-emerald-400 mb-2" />
          <p className="text-sm font-bold text-white leading-tight">
            {latestEntry ? formatDisplayDate(latestEntry.tested_at) : '-'}
          </p>
          <p className="text-[0.65rem] text-slate-500 uppercase tracking-wide">Letzter Test</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className="input pl-9 text-sm"
            placeholder="Marker, Einheit oder Notiz suchen"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select text-sm shrink-0 w-auto pr-8"
          value={markerFilter}
          onChange={e => setMarkerFilter(e.target.value)}
        >
          <option value="all">Alle</option>
          {markers.map(marker => <option key={marker} value={marker}>{marker}</option>)}
        </select>
      </div>

      {loading && (
        <div className="card text-center py-10 text-slate-500">
          Blutwerte werden geladen...
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <Droplets size={32} className="mx-auto mb-2 opacity-40" />
          <p>Noch keine Blutwerte eingetragen.</p>
          <p className="text-xs text-slate-600 mt-1">Erfasse Marker wie Vitamin D, Ferritin oder HbA1c.</p>
        </div>
      )}

      {!loading && entries.length > 0 && filteredEntries.length === 0 && (
        <div className="card text-center py-8 text-slate-500 text-sm">
          Keine passenden Blutwerte gefunden.
        </div>
      )}

      <div className="space-y-3">
        {filteredEntries.map(entry => (
          <div key={entry.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="badge bg-sky-500/10 text-sky-400">{formatDisplayDate(entry.tested_at)}</span>
                  <span className="text-xs text-slate-600">Labor</span>
                </div>
                <p className="text-white font-semibold">{entry.marker}</p>
                <p className="text-2xl font-bold text-sky-400 mt-1">
                  {formatNumber(entry.value)} <span className="text-sm text-slate-400 font-semibold">{entry.unit}</span>
                </p>
                {entry.notes && <p className="text-slate-500 text-xs mt-2">{entry.notes}</p>}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                  onClick={() => openEdit(entry)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                  onClick={() => remove(entry)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">{editingId ? 'Blutwert bearbeiten' : 'Neuer Blutwert'}</h2>

            <div>
              <label className="label">Testdatum</label>
              <input
                className="input"
                type="date"
                value={form.tested_at}
                onChange={e => setForm(f => ({ ...f, tested_at: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Marker</label>
              <select
                className="select"
                value={form.marker}
                onChange={e => setMarker(e.target.value)}
              >
                <option value="">Marker auswählen</option>
                {markerOptions.map(marker => (
                  <option key={marker.label} value={marker.label}>
                    {marker.label}
                  </option>
                ))}
              </select>
              <p className="text-slate-600 text-xs mt-1">
                Nach der Auswahl kannst du alle gängigen Einheiten für diesen Marker wählen.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Wert</label>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="42.5"
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Einheit</label>
                <select
                  className="select"
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  disabled={!form.marker}
                >
                  <option value="">Einheit auswählen</option>
                  {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Notizen</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Optional: Labor, Referenzbereich oder Kontext"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={save} disabled={saving}>
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
