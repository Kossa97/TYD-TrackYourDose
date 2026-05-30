import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ArrowLeft, Minus, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
}

const REFERENCE_RANGES: Record<string, { min?: number; max?: number; unit: string; lowerIsBetter?: boolean }> = {
  'IGF-1':       { min: 100, max: 300,  unit: 'ng/mL' },
  'Testosteron': { min: 400, max: 900,  unit: 'ng/dL' },
  'Östradiol':   { min: 20,  max: 50,   unit: 'pg/mL' },
  'SHBG':        { min: 20,  max: 60,   unit: 'nmol/L' },
  'TSH':         { min: 0.4, max: 4.0,  unit: 'mIU/mL' },
  'CRP':         { max: 1.0, unit: 'mg/L',  lowerIsBetter: true },
  'Vitamin D':   { min: 40,  max: 80,   unit: 'ng/mL' },
  'Ferritin':    { min: 30,  max: 300,  unit: 'ng/mL' },
  'Hämoglobin':  { min: 13.5,max: 17.5, unit: 'g/dL' },
  'GH':          { max: 3.0, unit: 'ng/mL', lowerIsBetter: false },
  'Kortisol':    { min: 10,  max: 20,   unit: 'µg/dL' },
}

const ALL_MARKERS = [
  'IGF-1', 'Testosteron', 'Östradiol', 'SHBG', 'LH', 'FSH',
  'TSH', 'CRP', 'Vitamin D', 'Ferritin', 'Hämoglobin', 'Hämatokrit',
  'GH', 'Kortisol', 'Insulin',
]

const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 20,
}

const CYAN = 'var(--accent)'
const TEXT = 'var(--text)'
const MUTED = 'var(--text-muted)'

const today = () => format(new Date(), 'yyyy-MM-dd')

const emptyForm = (marker = ''): BloodworkForm => ({
  tested_at: today(),
  marker,
  value: '',
  unit: marker ? (REFERENCE_RANGES[marker]?.unit ?? '') : '',
})

const formatDisplayDate = (date: string) => format(new Date(`${date}T00:00:00`), 'dd.MM.yyyy')

const toNumber = (value: number | string) => (typeof value === 'number' ? value : Number(value))

const formatNumber = (value: number | string) => {
  const numeric = toNumber(value)
  if (!Number.isFinite(numeric)) return String(value)
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(numeric)
}

const isInRange = (value: number, marker: string) => {
  const range = REFERENCE_RANGES[marker]
  if (!range) return null
  if (range.min != null && value < range.min) return false
  if (range.max != null && value > range.max) return false
  return true
}

type Trend = 'up' | 'down' | 'same' | null

const computeTrend = (entries: BloodworkEntry[]): { trend: Trend; diff: number } => {
  if (entries.length < 2) return { trend: null, diff: 0 }
  const last = toNumber(entries[0].value)
  const prev = toNumber(entries[1].value)
  if (!Number.isFinite(last) || !Number.isFinite(prev)) return { trend: null, diff: 0 }
  const diff = last - prev
  if (diff > 0) return { trend: 'up', diff }
  if (diff < 0) return { trend: 'down', diff }
  return { trend: 'same', diff: 0 }
}

// good = green, bad = red, neutral = gray
const trendColor = (trend: Trend, marker: string): string => {
  if (trend === 'same' || trend === null) return MUTED
  const lowerIsBetter = REFERENCE_RANGES[marker]?.lowerIsBetter
  const good = lowerIsBetter ? trend === 'down' : trend === 'up'
  return good ? '#10b981' : '#ef4444'
}

const TrendIcon = ({ trend, size = 16 }: { trend: Trend; size?: number }) => {
  if (trend === 'up') return <TrendingUp size={size} />
  if (trend === 'down') return <TrendingDown size={size} />
  if (trend === 'same') return <Minus size={size} />
  return null
}

type RangeFilter = '3M' | '6M' | '1J' | 'ALL'

export function Blutwerte() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<BloodworkEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<BloodworkForm>(emptyForm())
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('1J')

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

  const entriesByMarker = useMemo(() => {
    const grouped: Record<string, BloodworkEntry[]> = {}
    ALL_MARKERS.forEach(m => { grouped[m] = [] })
    entries.forEach(e => {
      if (grouped[e.marker] !== undefined) {
        grouped[e.marker].push(e)
      }
    })
    Object.values(grouped).forEach(arr => arr.sort((a, b) => b.tested_at.localeCompare(a.tested_at)))
    return grouped
  }, [entries])

  const markersTested = useMemo(
    () => ALL_MARKERS.filter(m => entriesByMarker[m].length > 0).length,
    [entriesByMarker],
  )

  const latestDate = useMemo(() => {
    if (entries.length === 0) return null
    return entries.reduce((max, e) => (e.tested_at > max ? e.tested_at : max), entries[0].tested_at)
  }, [entries])

  const openNew = (marker?: string) => {
    setForm(emptyForm(marker))
    setShowForm(true)
  }

  const save = async () => {
    const marker = form.marker.trim()
    const unit = form.unit.trim()
    const parsedValue = Number(form.value.replace(',', '.'))

    if (!form.tested_at) return toast.error('Bitte ein Testdatum eintragen')
    if (!marker) return toast.error('Bitte einen Marker auswählen')
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
      notes: null,
    }

    const { error } = await supabase.from('bloodwork').insert(payload)

    if (error) toast.error('Blutwert konnte nicht gespeichert werden')
    else {
      toast.success('Blutwert gespeichert')
      setShowForm(false)
      setForm(emptyForm())
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

  const setFormMarker = (marker: string) => {
    setForm(current => ({
      ...current,
      marker,
      unit: REFERENCE_RANGES[marker]?.unit ?? '',
    }))
  }

  // ---------- Quick-entry modal ----------
  const renderModal = () => {
    if (!showForm) return null
    const locked = !!form.marker && selectedMarker === form.marker
    return (
      <div
        className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
        onClick={() => setShowForm(false)}
      >
        <div
          className="w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh] rounded-t-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          onClick={e => e.stopPropagation()}
        >
          <h2 className="text-lg font-bold" style={{ color: TEXT }}>Neuer Eintrag</h2>

          <div>
            <label className="label">Marker</label>
            {locked ? (
              <div
                className="rounded-2xl px-4 py-3 font-semibold"
                style={{ border: '1px solid var(--accent-border)', color: CYAN }}
              >
                {form.marker}
              </div>
            ) : (
              <select
                className="select"
                value={form.marker}
                onChange={e => setFormMarker(e.target.value)}
              >
                <option value="">Marker auswählen</option>
                {ALL_MARKERS.map(marker => (
                  <option key={marker} value={marker}>{marker}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label">Datum</label>
            <input
              className="input"
              type="date"
              value={form.tested_at}
              onChange={e => setForm(f => ({ ...f, tested_at: e.target.value }))}
            />
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
              <input
                className="input"
                placeholder="ng/mL"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Abbrechen</button>
            <button className="btn-primary flex-1" onClick={save} disabled={saving}>
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- View 2: Marker detail ----------
  if (selectedMarker) {
    const markerEntries = entriesByMarker[selectedMarker] ?? []
    const range = REFERENCE_RANGES[selectedMarker]
    const last = markerEntries[0]
    const { trend, diff } = computeTrend(markerEntries)
    const lastValue = last ? toNumber(last.value) : null
    const inRange = lastValue != null ? isInRange(lastValue, selectedMarker) : null

    const now = new Date()
    const cutoff = (() => {
      const d = new Date(now)
      if (rangeFilter === '3M') d.setMonth(d.getMonth() - 3)
      else if (rangeFilter === '6M') d.setMonth(d.getMonth() - 6)
      else if (rangeFilter === '1J') d.setFullYear(d.getFullYear() - 1)
      else return null
      return format(d, 'yyyy-MM-dd')
    })()

    // oldest -> newest for the chart
    const chartData = markerEntries
      .filter(e => (cutoff ? e.tested_at >= cutoff : true))
      .slice()
      .sort((a, b) => a.tested_at.localeCompare(b.tested_at))
      .map(e => ({
        date_label: format(new Date(`${e.tested_at}T00:00:00`), 'dd.MM.yy'),
        value: toNumber(e.value),
      }))

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            className="p-2 -ml-2 transition-colors"
            style={{ color: MUTED }}
            onClick={() => { setSelectedMarker(null); setRangeFilter('1J') }}
            aria-label="Zurück"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold" style={{ color: TEXT }}>{selectedMarker}</h1>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => openNew(selectedMarker)}>
            <Plus size={15} /> Eintrag
          </button>
        </div>

        {/* Hero */}
        <div className="p-5 mb-4" style={PANEL_STYLE}>
          {last ? (
            <>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold" style={{ color: inRange === false ? '#ef4444' : CYAN }}>
                  {formatNumber(last.value)}
                  <span className="text-base font-semibold ml-1.5" style={{ color: MUTED }}>{last.unit}</span>
                </p>
                {trend && (
                  <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: trendColor(trend, selectedMarker) }}>
                    <TrendIcon trend={trend} />
                    {trend === 'same' ? 'gleich' : formatNumber(Math.abs(diff))}
                  </div>
                )}
              </div>
              <p className="text-xs mt-2" style={{ color: MUTED }}>
                {range && (range.min != null || range.max != null)
                  ? `Referenz: ${range.min != null ? range.min : '0'}–${range.max != null ? range.max : '∞'} ${range.unit}`
                  : 'Kein Referenzbereich'}
              </p>
              <div className="mt-3">
                {inRange === true && (
                  <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Im Normalbereich</span>
                )}
                {inRange === false && (
                  <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Außerhalb</span>
                )}
                {inRange === null && (
                  <span className="badge" style={{ background: 'var(--border)', color: MUTED }}>Kein Referenzbereich</span>
                )}
              </div>
            </>
          ) : (
            <p style={{ color: MUTED }}>Noch kein Test für {selectedMarker}.</p>
          )}
        </div>

        {/* Range filter */}
        <div className="flex gap-2 mb-4">
          {([['3M', '3M'], ['6M', '6M'], ['1J', '1J'], ['ALL', 'Alles']] as [RangeFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRangeFilter(key)}
              className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
              style={
                rangeFilter === key
                  ? { background: 'var(--accent-weak)', color: CYAN, border: '1px solid var(--accent-border)' }
                  : { color: MUTED, border: '1px solid var(--border)' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="p-4 mb-4" style={PANEL_STYLE}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date_label" tick={{ fill: 'rgba(154,170,191,0.55)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(154,170,191,0.55)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--accent-border)', borderRadius: 12, color: 'var(--text)' }} />
                {range?.min != null && range?.max != null && (
                  <ReferenceArea y1={range.min} y2={range.max} fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.2)" />
                )}
                <Line type="monotone" dataKey="value" stroke="#00ccf5" strokeWidth={2} dot={{ fill: '#00ccf5', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-6 mb-4 text-center text-sm" style={{ ...PANEL_STYLE, color: MUTED }}>
            Keine Werte im gewählten Zeitraum.
          </div>
        )}

        {/* Entry list */}
        <div style={PANEL_STYLE}>
          {markerEntries.length === 0 && (
            <p className="p-5 text-sm text-center" style={{ color: MUTED }}>Noch keine Einträge.</p>
          )}
          {markerEntries.map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-5 py-3.5"
              style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
            >
              <span className="text-sm" style={{ color: MUTED }}>{formatDisplayDate(entry.tested_at)}</span>
              <span className="text-sm font-semibold flex-1 text-right mr-3" style={{ color: TEXT }}>
                {formatNumber(entry.value)} {entry.unit}
              </span>
              <button
                className="p-1.5 transition-colors hover:text-red-400"
                style={{ color: MUTED }}
                onClick={() => remove(entry)}
                aria-label="Löschen"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {renderModal()}
      </div>
    )
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
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {ALL_MARKERS.map(marker => {
            const list = entriesByMarker[marker]
            const last = list[0]
            const hasData = !!last
            const range = REFERENCE_RANGES[marker]
            const lastValue = hasData ? toNumber(last.value) : null
            const inRange = lastValue != null ? isInRange(lastValue, marker) : null
            const { trend } = computeTrend(list)

            return (
              <button
                key={marker}
                onClick={() => setSelectedMarker(marker)}
                className="text-left"
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: 'var(--surface)',
                  border: hasData ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  opacity: hasData ? 1 : 0.55,
                }}
              >
                <p className="font-bold text-sm" style={{ color: TEXT }}>{marker}</p>
                {hasData ? (
                  <>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-base font-bold" style={{ color: inRange === false ? '#ef4444' : CYAN }}>
                        {formatNumber(last.value)} <span className="text-xs font-semibold" style={{ color: MUTED }}>{last.unit}</span>
                      </span>
                      <span style={{ color: trendColor(trend, marker) }}>
                        <TrendIcon trend={trend} size={15} />
                      </span>
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: MUTED }}>{formatDisplayDate(last.tested_at)}</p>
                  </>
                ) : (
                  <p className="text-xs mt-3" style={{ color: MUTED }}>– Noch kein Test</p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {renderModal()}
    </div>
  )
}
