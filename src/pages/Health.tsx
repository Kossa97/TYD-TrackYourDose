import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import { Activity, BedDouble, ChevronRight, HeartPulse, Plus, Scale, Shield, Shoe } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getHeartRate, getSleep, getSteps, isNative, requestPermissions } from '../lib/health'

interface WeightLog {
  id: string
  user_id: string
  logged_at: string
  weight_kg: number | string
  created_at: string | null
}

interface WeightForm {
  logged_at: string
  weight_kg: string
}

interface DeviceMetric {
  key: string
  icon: typeof Shoe
  value: string
  label: string
  color: string
  loading?: boolean
}

const today = () => format(new Date(), 'yyyy-MM-dd')

const emptyForm = (): WeightForm => ({
  logged_at: today(),
  weight_kg: '',
})

const formatDisplayDate = (date: string) => format(new Date(`${date}T00:00:00`), 'dd.MM.yyyy')

const formatNumber = (value: number | string, maximumFractionDigits = 1) => {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits }).format(numeric)
}

const cardStyle = {
  background: 'rgba(10,14,30,0.85)',
  border: '1px solid rgba(255,255,255,0.06)',
}

function WeightSparkline({ entries }: { entries: WeightLog[] }) {
  const points = useMemo(() => {
    const values = entries
      .slice(0, 7)
      .reverse()
      .map(entry => Number(entry.weight_kg))
      .filter(Number.isFinite)

    if (values.length === 0) return ''
    if (values.length === 1) return `8,42 132,42`

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    return values
      .map((value, index) => {
        const x = 8 + (index / (values.length - 1)) * 124
        const y = 74 - ((value - min) / range) * 48
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [entries])

  if (!points) {
    return (
      <div className="h-20 rounded-2xl border border-white/[0.06] bg-white/[0.025] flex items-center justify-center text-xs text-slate-500">
        Noch keine Verlaufdaten
      </div>
    )
  }

  return (
    <svg viewBox="0 0 140 84" className="h-20 w-full overflow-visible" role="img" aria-label="Gewichtsverlauf">
      <defs>
        <linearGradient id="weightLine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#00ccf5" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <path d="M8 74 H132" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <path d="M8 50 H132" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path d="M8 26 H132" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <polyline points={points} fill="none" stroke="url(#weightLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(' ').map(point => {
        const [x, y] = point.split(',')
        return <circle key={point} cx={x} cy={y} r="3.5" fill="#07091a" stroke="#00ccf5" strokeWidth="2" />
      })}
    </svg>
  )
}

function DeviceCard({ metric }: { metric: DeviceMetric }) {
  return (
    <div className="rounded-2xl p-4 min-h-[128px] flex flex-col justify-between" style={cardStyle}>
      <div className="flex items-center justify-between gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${metric.color}1A`, border: `1px solid ${metric.color}33` }}
        >
          <metric.icon size={18} color={metric.color} />
        </div>
        {!isNative && <Shield size={14} className="text-slate-600" />}
      </div>
      <div>
        <p className="text-xl font-bold text-white leading-tight">
          {!isNative ? 'Nur in der App verfügbar' : metric.loading ? '...' : metric.value}
        </p>
        <p className="text-[0.68rem] uppercase tracking-[0.08em] text-slate-500 mt-1">{metric.label}</p>
      </div>
    </div>
  )
}

export function Health() {
  const { user } = useAuth()
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [loadingWeights, setLoadingWeights] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<WeightForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [loadingDevice, setLoadingDevice] = useState(isNative)
  const [stepsToday, setStepsToday] = useState<string>('—')
  const [heartRate, setHeartRate] = useState<string>('—')
  const [sleepLastNight, setSleepLastNight] = useState<string>('—')

  const loadWeights = useCallback(async () => {
    if (!user) return
    setLoadingWeights(true)

    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) toast.error('Gewichtseinträge konnten nicht geladen werden')
    else setWeightLogs((data ?? []) as WeightLog[])

    setLoadingWeights(false)
  }, [user])

  useEffect(() => {
    loadWeights()
  }, [loadWeights])

  useEffect(() => {
    if (!isNative) return

    let cancelled = false

    async function loadDeviceMetrics() {
      setLoadingDevice(true)
      try {
        const permissions = await requestPermissions()
        if (!permissions.granted) {
          if (!cancelled) {
            setStepsToday('—')
            setHeartRate('—')
            setSleepLastNight('—')
          }
          return
        }

        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const lastNightStart = subDays(todayStart, 1)
        lastNightStart.setHours(18, 0, 0, 0)

        const [steps, heartRates, sleep] = await Promise.all([
          getSteps({ startDate: todayStart, endDate: new Date() }),
          getHeartRate({ startDate: subDays(new Date(), 1), endDate: new Date(), limit: 20 }),
          getSleep({ startDate: lastNightStart, endDate: new Date() }),
        ])

        if (cancelled) return

        setStepsToday(steps ? formatNumber(steps.count, 0) : '—')
        setHeartRate(heartRates[0] ? `${formatNumber(heartRates[0].bpm, 0)} bpm` : '—')

        const totalSleepHours = sleep
          .filter(entry => entry.state !== 'InBed')
          .reduce((sum, entry) => sum + entry.durationHours, 0)
        setSleepLastNight(totalSleepHours > 0 ? `${formatNumber(totalSleepHours, 1)} h` : '—')
      } catch (error) {
        if (!cancelled) toast.error('Device-Gesundheitsdaten konnten nicht geladen werden')
      } finally {
        if (!cancelled) setLoadingDevice(false)
      }
    }

    loadDeviceMetrics()

    return () => {
      cancelled = true
    }
  }, [])

  const latestWeight = weightLogs[0]

  const deviceMetrics: DeviceMetric[] = [
    { key: 'steps', icon: Shoe, value: stepsToday, label: 'Schritte heute', color: '#00ccf5', loading: loadingDevice },
    { key: 'heart', icon: HeartPulse, value: heartRate, label: 'Herzrate', color: '#f43f5e', loading: loadingDevice },
    { key: 'sleep', icon: BedDouble, value: sleepLastNight, label: 'Schlaf letzte Nacht', color: '#8b5cf6', loading: loadingDevice },
    { key: 'hrv', icon: Activity, value: '—', label: 'HRV', color: '#10b981', loading: false },
  ]

  const openNew = () => {
    setForm({
      logged_at: today(),
      weight_kg: latestWeight ? String(latestWeight.weight_kg) : '',
    })
    setShowForm(true)
  }

  const save = async () => {
    const parsedWeight = Number(form.weight_kg.replace(',', '.'))

    if (!form.logged_at) return toast.error('Bitte ein Datum eintragen')
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) return toast.error('Bitte ein gültiges Gewicht eintragen')
    if (!user) return

    setSaving(true)
    const { error } = await supabase.from('weight_logs').insert({
      user_id: user.id,
      logged_at: form.logged_at,
      weight_kg: parsedWeight,
    })

    if (error) toast.error('Gewicht konnte nicht gespeichert werden')
    else {
      toast.success('Gewicht gespeichert')
      setShowForm(false)
      setForm(emptyForm())
      loadWeights()
    }

    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-400/70 mb-1">Deine Körperdaten</p>
        <h1 className="text-2xl font-black tracking-tight text-white">Health</h1>
      </header>

      <section className="rounded-[1.5rem] p-5 overflow-hidden relative" style={cardStyle}>
        <div className="absolute -right-12 -top-12 w-36 h-36 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between gap-4 mb-5 relative">
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-[0.12em] mb-2">
              <Scale size={15} className="text-sky-400" />
              Gewicht
            </div>
            {loadingWeights ? (
              <p className="text-3xl font-black text-white">...</p>
            ) : latestWeight ? (
              <>
                <p className="text-5xl font-black tracking-[-0.06em] text-white leading-none">
                  {formatNumber(latestWeight.weight_kg)} <span className="text-lg text-slate-400 tracking-normal">kg</span>
                </p>
                <p className="text-xs text-slate-500 mt-2">Letzter Eintrag am {formatDisplayDate(latestWeight.logged_at)}</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-black text-slate-500">Noch kein Wert</p>
                <p className="text-xs text-slate-500 mt-2">Trage dein Gewicht ein, um den Verlauf zu sehen.</p>
              </>
            )}
          </div>

          <button
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: '#00ccf5', color: '#00111f', boxShadow: '0 0 24px rgba(0,204,245,0.25)' }}
            onClick={openNew}
            aria-label="Neues Gewicht eintragen"
          >
            <Plus size={22} strokeWidth={3} />
          </button>
        </div>

        <WeightSparkline entries={weightLogs} />
      </section>

      <section>
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500 mb-3">Device Health</p>
        <div className="grid grid-cols-2 gap-3">
          {deviceMetrics.map(metric => <DeviceCard key={metric.key} metric={metric} />)}
        </div>
      </section>

      <section>
        <Link
          to="/blutwerte"
          className="rounded-2xl p-4 flex items-center justify-between gap-3 transition-opacity hover:opacity-85"
          style={cardStyle}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-400/70 mb-1">Schnellzugriff</p>
            <p className="text-white font-bold">Zu den Blutwerten</p>
            <p className="text-xs text-slate-500 mt-1">Laborwerte und Marker ansehen</p>
          </div>
          <ChevronRight size={20} className="text-sky-400" />
        </Link>
      </section>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4"
            onClick={event => event.stopPropagation()}
          >
            <h2 className="text-lg font-bold">Neues Gewicht</h2>

            <div>
              <label className="label">Datum</label>
              <input
                className="input"
                type="date"
                value={form.logged_at}
                onChange={event => setForm(current => ({ ...current, logged_at: event.target.value }))}
              />
            </div>

            <div>
              <label className="label">Gewicht (kg)</label>
              <input
                className="input"
                inputMode="decimal"
                placeholder="82,5"
                value={form.weight_kg}
                onChange={event => setForm(current => ({ ...current, weight_kg: event.target.value }))}
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
