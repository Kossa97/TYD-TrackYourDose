import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { ArrowLeft, Camera, ChevronRight, ImageOff, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Typen ─────────────────────────────────────────────────────────────────

interface ProgressPhoto {
  id: string
  photo_url: string
  taken_at: string
  weight_kg: number | null
  notes: string | null
}

interface DailyLog {
  log_date: string
  energie: number | null
  schlaf: number | null
  libido: number | null
  weight_kg: number | null
  body_fat_pct: number | null
}

interface BloodworkEntry {
  id: string
  user_id: string
  marker: string
  value: number | string
  unit: string
  tested_at: string
  notes: string | null
}

type TabKey = 'uebersicht' | 'verlauf' | 'blutwerte' | 'fotos'

// ── Konstanten ──────────────────────────────────────────────────────────

const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const fmtDate  = (d: string) => format(parseISO(`${d}T00:00:00`), 'dd.MM.yyyy')
const fmtShort = (d: string) => format(parseISO(`${d}T00:00:00`), 'dd.MM.')

const TABS: { key: TabKey; label: string }[] = [
  { key: 'uebersicht', label: 'Übersicht' },
  { key: 'verlauf',    label: 'Verlauf' },
  { key: 'blutwerte',  label: 'Blutwerte' },
  { key: 'fotos',      label: 'Fotos' },
]

const METRICS = [
  { key: 'weight_kg',    label: 'Gewicht',     color: '#f59e0b' },
  { key: 'body_fat_pct', label: 'Körperfett',  color: '#f87171' },
  { key: 'energie',      label: 'Energie',     color: '#00ccf5' },
  { key: 'schlaf',       label: 'Schlaf',      color: '#a855f7' },
  { key: 'wellbeing',    label: 'Wohlbefinden', color: '#10b981' },
  { key: 'libido',       label: 'Libido',      color: '#f472b6' },
] as const

type MetricKey = (typeof METRICS)[number]['key']

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: '7t',    label: '7T',    days: 7 },
  { key: '30t',   label: '30T',   days: 30 },
  { key: '90t',   label: '90T',   days: 90 },
  { key: '1j',    label: '1J',    days: 365 },
  { key: 'alles', label: 'Alles', days: null },
]

const MARKERS = [
  { key: 'igf1',        label: 'IGF-1',       unit: 'ng/mL',  ref: '100–300' },
  { key: 'testosteron', label: 'Testosteron', unit: 'ng/dL',  ref: '300–1000' },
  { key: 'oestradiol',  label: 'Östradiol',   unit: 'pg/mL',  ref: '10–40' },
  { key: 'shbg',        label: 'SHBG',        unit: 'nmol/L', ref: '10–57' },
  { key: 'lh',          label: 'LH',          unit: 'IU/L',   ref: '1.7–8.6' },
  { key: 'fsh',         label: 'FSH',         unit: 'IU/L',   ref: '1.5–12.4' },
  { key: 'tsh',         label: 'TSH',         unit: 'mIU/L',  ref: '0.4–4.0' },
  { key: 'crp',         label: 'CRP',         unit: 'mg/L',   ref: '<5' },
  { key: 'vitamin_d',   label: 'Vitamin D',   unit: 'ng/mL',  ref: '30–80' },
  { key: 'ferritin',    label: 'Ferritin',    unit: 'ng/mL',  ref: '30–400' },
  { key: 'haemoglobin', label: 'Hämoglobin',  unit: 'g/dL',   ref: '13.5–17.5' },
  { key: 'haematokrit', label: 'Hämatokrit',  unit: '%',      ref: '40–52' },
  { key: 'gh',          label: 'GH',          unit: 'ng/mL',  ref: '<5' },
  { key: 'kortisol',    label: 'Kortisol',    unit: 'µg/dL',  ref: '6–23' },
  { key: 'insulin',     label: 'Insulin',     unit: 'µU/mL',  ref: '2–25' },
]

// ── Styles ────────────────────────────────────────────────────────────────

const panel: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 20,
}

const sectionLabel: CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 800,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 14,
  background: 'var(--surface-input)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: '0.9rem',
  fontWeight: 700,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const fieldLabel: CSSProperties = {
  fontSize: '0.6rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: 6,
}

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--accent-border)', borderRadius: 12 }
const axisTick = { fill: 'var(--text-muted)', fontSize: 10 }

// ── Cyan slider styling ────────────────────────────────────────────────────

const SLIDER_CSS = `
  input.tyd-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px;
    border-radius: 99px; background: var(--border); outline: none; }
  input.tyd-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
    width: 20px; height: 20px; border-radius: 50%; background: #00ccf5; cursor: pointer;
    border: 2px solid var(--surface); box-shadow: 0 0 10px rgba(0,204,245,0.5); }
  input.tyd-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%;
    background: #00ccf5; cursor: pointer; border: 2px solid var(--surface);
    box-shadow: 0 0 10px rgba(0,204,245,0.5); }
`

// ── Komponente ──────────────────────────────────────────────────────────────

export function Progress() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabKey>('uebersicht')

  // daily_logs (Übersicht + Verlauf)
  const [logs, setLogs] = useState<DailyLog[]>([])

  // Fotos
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])

  const loadLogs = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('daily_logs')
      .select('log_date, energie, schlaf, libido, weight_kg, body_fat_pct')
      .eq('user_id', user.id)
      .order('log_date', { ascending: true })
    setLogs((data as DailyLog[]) ?? [])
  }, [user])

  const loadPhotos = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('progress_photos')
      .select('id, photo_url, taken_at, weight_kg, notes')
      .eq('user_id', user.id)
      .order('taken_at', { ascending: false })
    setPhotos((data as ProgressPhoto[]) ?? [])
  }, [user])

  useEffect(() => { void loadLogs() }, [loadLogs])
  useEffect(() => { void loadPhotos() }, [loadPhotos])

  return (
    <>
      <style>{SLIDER_CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>

        {/* Tab-Navigation */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flexShrink: 0,
                  padding: '9px 16px',
                  borderRadius: 14,
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  background: active ? 'var(--accent-weak)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  border: active ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'uebersicht' && (
          <UebersichtTab logs={logs} photos={photos} onSaved={loadLogs} onPhotoTap={() => setTab('fotos')} />
        )}
        {tab === 'verlauf'   && <VerlaufTab logs={logs} />}
        {tab === 'blutwerte' && <BlutwerteTab />}
        {tab === 'fotos'     && <FotosTab photos={photos} onChange={loadPhotos} />}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Tab 1: Übersicht
// ════════════════════════════════════════════════════════════════════════════

function wellbeing(log: DailyLog): number | null {
  return log.libido
}

function UebersichtTab({
  logs, photos, onSaved, onPhotoTap,
}: {
  logs: DailyLog[]
  photos: ProgressPhoto[]
  onSaved: () => void
  onPhotoTap: () => void
}) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const last30 = useMemo(() => {
    const cutoff = subDays(new Date(), 30)
    return logs.filter(l => parseISO(`${l.log_date}T00:00:00`) >= cutoff)
  }, [logs])

  const cards: { key: MetricKey; label: string; color: string; get: (l: DailyLog) => number | null }[] = [
    { key: 'weight_kg', label: 'Gewicht',      color: '#f59e0b', get: l => l.weight_kg },
    { key: 'energie',   label: 'Energie',      color: '#00ccf5', get: l => l.energie },
    { key: 'schlaf',    label: 'Schlaf',       color: '#a855f7', get: l => l.schlaf },
    { key: 'wellbeing', label: 'Wohlbefinden', color: '#10b981', get: wellbeing },
  ]

  const lastPhoto = photos[0]

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text)' }}>
          Fortschritt
        </h1>
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            width: 44, height: 44, borderRadius: 16, flexShrink: 0,
            background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
            color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0,204,245,0.16)',
          }}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* 2×2 Mini-Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {cards.map(card => {
          const series = last30
            .map(l => ({ date: l.log_date, value: card.get(l) }))
            .filter(p => p.value != null)
          const lastVal = series.length ? series[series.length - 1].value : null
          return (
            <div key={card.key} style={{ ...panel, padding: 14 }}>
              <p style={{ ...sectionLabel, marginBottom: 4 }}>{card.label}</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-dim)', lineHeight: 1.1 }}>
                {lastVal != null ? lastVal : '–'}
              </p>
              <div style={{ marginTop: 6 }}>
                {series.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={50}>
                    <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${card.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={card.color} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" stroke={card.color} strokeWidth={2}
                        fill={`url(#grad-${card.key})`} dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 50 }} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Letztes Foto */}
      {lastPhoto && (
        <button
          onClick={onPhotoTap}
          style={{
            ...panel, padding: 12, display: 'flex', alignItems: 'center', gap: 14,
            textAlign: 'left', cursor: 'pointer',
          }}
        >
          <img src={lastPhoto.photo_url} alt={lastPhoto.taken_at}
            style={{ width: 56, height: 72, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...sectionLabel, marginBottom: 4 }}>Letztes Foto</p>
            <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-dim)' }}>{fmtDate(lastPhoto.taken_at)}</p>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </button>
      )}

      {sheetOpen && <EntrySheet onClose={() => setSheetOpen(false)} onSaved={onSaved} />}
    </>
  )
}

// ── Eintrag-Modal ───────────────────────────────────────────────────────────

function EntrySheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth()
  const [date, setDate]           = useState(todayStr())
  const [energie, setEnergie]     = useState(7)
  const [schlaf, setSchlaf]       = useState(7)
  const [wohl, setWohl]           = useState(7)
  const [libido, setLibido]       = useState(7)
  const [weight, setWeight]       = useState('')
  const [bodyFat, setBodyFat]     = useState('')
  const [saving, setSaving]       = useState(false)

  const save = async () => {
    if (!user) return
    setSaving(true)
    const payload = {
      user_id: user.id,
      log_date: date,
      energie,
      schlaf,
      libido: wohl, // Wohlbefinden → libido-Feld
      weight_kg: weight ? Number(weight) : null,
      body_fat_pct: bodyFat ? Number(bodyFat) : null,
    }
    const { error } = await supabase
      .from('daily_logs')
      .upsert(payload, { onConflict: 'user_id,log_date' })
    setSaving(false)
    if (error) { toast.error('Konnte nicht gespeichert werden'); return }
    toast.success('Fortschritt gespeichert')
    onSaved()
    onClose()
  }

  const sliders: { label: string; value: number; set: (v: number) => void }[] = [
    { label: 'Energie',        value: energie, set: setEnergie },
    { label: 'Schlafqualität', value: schlaf,  set: setSchlaf },
    { label: 'Wohlbefinden',   value: wohl,    set: setWohl },
    { label: 'Libido',         value: libido,  set: setLibido },
  ]

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 49 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
        padding: '0 18px 40px', maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ position: 'sticky', top: 0, paddingTop: 16, paddingBottom: 14, background: 'inherit', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 18px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)' }}>Fortschritt eintragen</h2>
            <button onClick={onClose} style={{ color: 'var(--text-muted)', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabel}>Datum</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>

        {sliders.map(s => (
          <div key={s.label} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ ...fieldLabel, marginBottom: 0 }}>{s.label}</label>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent)' }}>{s.value}/10</span>
            </div>
            <input
              className="tyd-slider" type="range" min={1} max={10} step={1}
              value={s.value} onChange={e => s.set(Number(e.target.value))}
            />
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={fieldLabel}>Gewicht (kg)</label>
            <input type="number" inputMode="decimal" placeholder="82.5" value={weight}
              onChange={e => setWeight(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabel}>Körperfett (%)</label>
            <input type="number" inputMode="decimal" placeholder="18" value={bodyFat}
              onChange={e => setBodyFat(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onClose}>Abbrechen</button>
          <button className="btn-primary flex-1" onClick={() => void save()} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Tab 2: Verlauf
// ════════════════════════════════════════════════════════════════════════════

function VerlaufTab({ logs }: { logs: DailyLog[] }) {
  const [active, setActive] = useState<MetricKey[]>(['weight_kg', 'energie'])
  const [range, setRange]   = useState('30t')

  const toggle = (key: MetricKey) =>
    setActive(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const data = useMemo(() => {
    const days = RANGES.find(r => r.key === range)?.days ?? null
    const cutoff = days != null ? subDays(new Date(), days) : null
    return logs
      .filter(l => !cutoff || parseISO(`${l.log_date}T00:00:00`) >= cutoff)
      .map(l => ({
        date: fmtShort(l.log_date),
        weight_kg: l.weight_kg,
        body_fat_pct: l.body_fat_pct,
        energie: l.energie,
        schlaf: l.schlaf,
        wellbeing: l.libido,
        libido: l.libido,
      }))
  }, [logs, range])

  return (
    <>
      {/* Metric-Pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {METRICS.map(m => {
          const on = active.includes(m.key)
          return (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              style={{
                flexShrink: 0, padding: '7px 13px', borderRadius: 99, fontSize: '0.76rem',
                fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer',
                background: on ? `${m.color}22` : 'transparent',
                color: on ? m.color : 'var(--text-muted)',
                border: `1px solid ${on ? `${m.color}55` : 'var(--border)'}`,
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Range-Filter */}
      <div style={{ display: 'flex', gap: 8 }}>
        {RANGES.map(r => {
          const on = range === r.key
          return (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 12, fontSize: '0.76rem', fontWeight: 800,
                cursor: 'pointer',
                background: on ? 'var(--accent-weak)' : 'transparent',
                color: on ? 'var(--accent)' : 'var(--text-muted)',
                border: on ? '1px solid var(--accent-border)' : '1px solid var(--border)',
              }}
            >
              {r.label}
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <div style={{ ...panel, padding: '16px 8px 8px 0' }}>
        {data.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '40px 0' }}>
            Keine Daten im gewählten Zeitraum
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={axisTick} />
              <YAxis tick={axisTick} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              {METRICS.filter(m => active.includes(m.key)).map(m => (
                <Line key={m.key} type="monotone" dataKey={m.key} name={m.label}
                  stroke={m.color} strokeWidth={2} dot={false} connectNulls
                  isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Tab 3: Blutwerte
// ════════════════════════════════════════════════════════════════════════════

function BlutwerteTab() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<BloodworkEntry[]>([])
  const [selected, setSelected] = useState<typeof MARKERS[number] | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('bloodwork')
      .select('*')
      .eq('user_id', user.id)
      .order('tested_at', { ascending: false })
    setEntries((data as BloodworkEntry[]) ?? [])
  }, [user])

  useEffect(() => { void load() }, [load])

  const byMarker = useMemo(() => {
    const map = new Map<string, BloodworkEntry[]>()
    for (const e of entries) {
      const arr = map.get(e.marker) ?? []
      arr.push(e)
      map.set(e.marker, arr)
    }
    return map
  }, [entries])

  if (selected) {
    return (
      <MarkerDetail
        marker={selected}
        entries={(byMarker.get(selected.label) ?? []).slice().sort((a, b) => a.tested_at.localeCompare(b.tested_at))}
        onBack={() => setSelected(null)}
        onChange={load}
      />
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {MARKERS.map(m => {
        const list = byMarker.get(m.label) ?? []
        const has = list.length > 0
        const latest = has ? list[0] : null // entries are desc-sorted from load
        return (
          <button
            key={m.key}
            onClick={() => setSelected(m)}
            style={{
              ...panel, padding: 14, textAlign: 'left', cursor: 'pointer',
              border: has ? '1px solid var(--accent-border)' : '1px solid var(--border)',
              opacity: has ? 1 : 0.6,
            }}
          >
            <p style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 6 }}>{m.label}</p>
            {latest ? (
              <>
                <p style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1.1 }}>
                  {latest.value} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{latest.unit}</span>
                </p>
                <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4 }}>{fmtDate(latest.tested_at)}</p>
              </>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Kein Eintrag</p>
            )}
          </button>
        )
      })}
    </div>
  )
}

function MarkerDetail({
  marker, entries, onBack, onChange,
}: {
  marker: typeof MARKERS[number]
  entries: BloodworkEntry[]
  onBack: () => void
  onChange: () => void
}) {
  const { user } = useAuth()
  const [date, setDate]   = useState(todayStr())
  const [value, setValue] = useState('')
  const [unit, setUnit]   = useState(marker.unit)
  const [showForm, setShowForm] = useState(false)

  const chartData = entries.map(e => ({ date: fmtShort(e.tested_at), value: Number(e.value) }))

  const add = async () => {
    if (!user) return
    const num = Number(value.replace(',', '.'))
    if (!Number.isFinite(num)) { toast.error('Bitte einen gültigen Wert eintragen'); return }
    const { error } = await supabase.from('bloodwork').insert({
      user_id: user.id,
      marker: marker.label,
      value: num,
      unit: unit || marker.unit,
      tested_at: date,
      notes: null,
    })
    if (error) { toast.error('Konnte nicht gespeichert werden'); return }
    toast.success('Wert gespeichert')
    setValue(''); setDate(todayStr()); setUnit(marker.unit); setShowForm(false)
    onChange()
  }

  const del = async (entry: BloodworkEntry) => {
    if (!confirm('Eintrag wirklich löschen?')) return
    const { error } = await supabase.from('bloodwork').delete().eq('id', entry.id).eq('user_id', user!.id)
    if (error) { toast.error('Fehler beim Löschen'); return }
    toast.success('Gelöscht')
    onChange()
  }

  const sorted = entries.slice().reverse() // newest first for list

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
          <ArrowLeft size={18} /> Zurück
        </button>
        <button
          onClick={() => setShowForm(s => !s)}
          style={{
            width: 38, height: 38, borderRadius: 12, background: 'var(--accent-weak)',
            border: '1px solid var(--accent-border)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <Plus size={18} />
        </button>
      </div>

      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)' }}>{marker.label}</h2>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
          Referenz: {marker.ref} {marker.unit}
        </p>
      </div>

      {showForm && (
        <div style={{ ...panel, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={fieldLabel}>Datum</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Wert</label>
              <input type="number" inputMode="decimal" placeholder="0" value={value}
                onChange={e => setValue(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={fieldLabel}>Einheit</label>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <button className="btn-primary" onClick={() => void add()}>Speichern</button>
        </div>
      )}

      {/* Chart */}
      <div style={{ ...panel, padding: '16px 8px 8px 0' }}>
        {chartData.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '40px 0' }}>
            Noch keine Einträge
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={axisTick} />
              <YAxis tick={axisTick} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" name={marker.label} stroke="#00ccf5"
                strokeWidth={2} dot={{ r: 3, fill: '#00ccf5' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(e => (
          <div key={e.id} style={{ ...panel, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-dim)' }}>
                {e.value} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{e.unit}</span>
              </p>
              <p style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 2 }}>{fmtDate(e.tested_at)}</p>
            </div>
            <button
              onClick={() => void del(e)}
              style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.22)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Tab 4: Fotos  (Logik aus altem Progress.tsx übernommen)
// ════════════════════════════════════════════════════════════════════════════

function FotosTab({ photos, onChange }: { photos: ProgressPhoto[]; onChange: () => void }) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)

  const [sheetOpen, setSheetOpen]       = useState(false)
  const [date, setDate]                 = useState(todayStr())
  const [weight, setWeight]             = useState('')
  const [notes, setNotes]               = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activePhoto, setActivePhoto] = useState<ProgressPhoto | null>(null)

  const openSheet = () => {
    setDate(todayStr()); setWeight(''); setNotes('')
    setSelectedFile(null); setPreviewUrl(null); setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null); setSelectedFile(null)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleUpload = async () => {
    if (!user || !selectedFile) { toast.error('Bitte zuerst ein Foto auswählen'); return }
    setUploading(true)
    try {
      const ext  = selectedFile.name.split('.').pop() ?? 'jpg'
      const path = `progress/${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('batch-files')
        .upload(path, selectedFile, { contentType: selectedFile.type, upsert: false })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('batch-files').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('progress_photos').insert({
        user_id: user.id,
        photo_url: publicUrl,
        taken_at: date,
        weight_kg: weight ? Number(weight) : null,
        notes: notes || null,
      })
      if (dbErr) throw dbErr
      toast.success('Foto gespeichert')
      closeSheet()
      onChange()
    } catch {
      toast.error('Fehler beim Hochladen')
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async (photo: ProgressPhoto) => {
    if (!confirm('Foto wirklich löschen?')) return
    const parts = photo.photo_url.split('/batch-files/')
    if (parts.length > 1) {
      await supabase.storage.from('batch-files').remove([parts[1]])
    }
    const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id)
    if (error) { toast.error('Fehler beim Löschen'); return }
    toast.success('Foto gelöscht')
    setActivePhoto(null)
    onChange()
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)' }}>Fotos</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'} gespeichert
          </p>
        </div>
        <button
          onClick={openSheet}
          style={{
            width: 44, height: 44, borderRadius: 16, flexShrink: 0,
            background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
            color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0,204,245,0.16)',
          }}
        >
          <Plus size={20} />
        </button>
      </div>

      {photos.length === 0 ? (
        <div style={{ ...panel, padding: '52px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: 22, background: 'var(--accent-weak)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageOff size={30} color="var(--accent)" />
          </div>
          <div>
            <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 6 }}>Noch keine Fotos</p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Füge dein erstes Fortschrittsfoto hinzu und verfolge deine Entwicklung.
            </p>
          </div>
          <button
            onClick={openSheet}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 14,
              background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
              color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer',
            }}
          >
            <Camera size={15} /> Foto hinzufügen
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {photos.map(photo => (
            <button
              key={photo.id}
              onClick={() => setActivePhoto(photo)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 18, overflow: 'hidden', padding: 0, textAlign: 'left', cursor: 'pointer',
              }}
            >
              <div style={{ aspectRatio: '3/4', overflow: 'hidden', position: 'relative' }}>
                <img src={photo.photo_url} alt={photo.taken_at}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '9px 11px' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 2 }}>{fmtDate(photo.taken_at)}</p>
                {photo.weight_kg != null && (
                  <p style={{ fontSize: '0.62rem', color: 'var(--accent)', fontWeight: 700 }}>{photo.weight_kg} kg</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Vollbild-Overlay */}
      {activePhoto && (
        <div onClick={() => setActivePhoto(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.93)', display: 'flex', flexDirection: 'column' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)' }}>{fmtDate(activePhoto.taken_at)}</p>
              {activePhoto.weight_kg != null && (
                <p style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{activePhoto.weight_kg} kg</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={e => { e.stopPropagation(); void deletePhoto(activePhoto) }}
                style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(244,63,94,0.14)', border: '1px solid rgba(244,63,94,0.24)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={16} />
              </button>
              <button onClick={e => { e.stopPropagation(); setActivePhoto(null) }}
                style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--surface-input)', border: '1px solid var(--border)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <img src={activePhoto.photo_url} alt={activePhoto.taken_at} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          {activePhoto.notes && (
            <div onClick={e => e.stopPropagation()}
              style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>{activePhoto.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Upload Bottom-Sheet */}
      {sheetOpen && (
        <div onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }} />
      )}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
        padding: '0 18px 40px',
        transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.30s cubic-bezier(0.4,0,0.2,1)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ position: 'sticky', top: 0, paddingTop: 16, paddingBottom: 14, background: 'inherit', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 18px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)' }}>Foto hinzufügen</h2>
            <button onClick={closeSheet} style={{ color: 'var(--text-muted)', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={handleFileChange} />

        {previewUrl ? (
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <img src={previewUrl} alt="Vorschau" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 16, display: 'block' }} />
            <button
              onClick={() => { setSelectedFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
              style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 10, background: 'rgba(0,0,0,0.72)', border: '1px solid var(--border)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', padding: '30px 0', borderRadius: 18, marginBottom: 16, border: '2px dashed var(--accent-border)', background: 'var(--accent-weak)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--accent)', cursor: 'pointer' }}>
            <Camera size={30} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>Foto aufnehmen oder aus Galerie wählen</span>
          </button>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Datum</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Gewicht in kg (optional)</label>
          <input type="number" inputMode="decimal" placeholder="z.B. 82.5" value={weight}
            onChange={e => setWeight(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={fieldLabel}>Notizen (optional)</label>
          <textarea placeholder="Wie fühlst du dich? Besondere Beobachtungen…" value={notes}
            onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
        </div>

        <button
          onClick={() => void handleUpload()}
          disabled={!selectedFile || uploading}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 16,
            background: (!selectedFile || uploading) ? 'var(--surface-input)' : 'var(--accent-weak)',
            border: (!selectedFile || uploading) ? '1px solid var(--border)' : '1px solid var(--accent-border)',
            color: (!selectedFile || uploading) ? 'var(--text-muted)' : 'var(--accent)',
            fontSize: '0.92rem', fontWeight: 900,
            cursor: (!selectedFile || uploading) ? 'not-allowed' : 'pointer',
            transition: 'all 0.18s',
          }}>
          {uploading ? 'Wird hochgeladen…' : 'Foto speichern'}
        </button>
      </div>
    </>
  )
}
