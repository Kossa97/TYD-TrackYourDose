import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, startOfWeek, endOfWeek,
  differenceInDays, parseISO,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Syringe, X, TrendingUp, Check, XCircle, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPeptideColor } from '../lib/peptideColors'

interface DoseLog {
  id: string
  peptide_id: string
  dose: number
  unit: string
  method: string
  logged_at: string
  notes: string | null
  taken: boolean | null
  peptides: { name: string }
}

interface Cycle {
  id: string
  name: string
  peptide_id: string
  dose: number
  unit: string
  method: string
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  start_date: string
  end_date: string | null
  active: boolean
  peptides: { name: string }
}

interface Peptide {
  id: string; name: string; default_unit: string
  default_dose: number | null; default_method: string
}

interface Escalation {
  id: string
  cycle_id: string
  increase_amount: number
  unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null
  start_after_days: number | null
}

const METHODS = ['Subkutan', 'Intramuskulär', 'Nasal', 'Oral', 'Transdermal', 'Intravenös', 'Andere']
const UNITS = ['mcg', 'mg', 'IU', 'ml', 'nmol']
const WEEKDAYS_DE: Record<number, string> = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 0: 'So' }
const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function cycleAppliesToDay(cycle: Cycle, day: Date): boolean {
  const start = parseISO(cycle.start_date)
  const end = cycle.end_date ? parseISO(cycle.end_date) : null
  if (day < start) return false
  if (end && day > end) return false

  const freq = cycle.frequency
  const dayOfWeek = WEEKDAYS_DE[day.getDay()]
  const diff = differenceInDays(day, start)

  if (freq === 'Täglich' || freq === '2x täglich') return true
  if (freq === 'Jeden 2. Tag') return diff % 2 === 0
  if (freq === 'Alle X Tage') return diff % (cycle.x_days_interval ?? 2) === 0
  if (freq === '5 Tage an / 2 aus') return diff % 7 < 5
  if (freq === 'Mo-Fr') return day.getDay() >= 1 && day.getDay() <= 5
  if (freq === 'Wöchentlich') return diff % 7 === 0
  if (freq === 'Wochentage wählen') return (cycle.schedule_days ?? []).includes(dayOfWeek)
  return false
}

function effectiveDose(cycle: Cycle, day: Date, escalations: Escalation[]): number {
  const cycleStart = parseISO(cycle.start_date)
  const daysFromStart = differenceInDays(day, cycleStart)
  let total = cycle.dose
  for (const esc of escalations.filter(e => e.cycle_id === cycle.id)) {
    if (esc.start_type === 'date' && esc.start_date) {
      if (day >= parseISO(esc.start_date)) total += esc.increase_amount
    } else if (esc.start_after_days != null) {
      if (daysFromStart >= esc.start_after_days) total += esc.increase_amount
    }
  }
  return total
}

export function Dashboard() {
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [logs, setLogs] = useState<DoseLog[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [peptides, setPeptides] = useState<Peptide[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])

  // selectedDay steuert den Tages-Bereich unten — Standard = heute
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  // Formular für einen bestimmten Tag (öffnet als Modal)
  const [showLogForm, setShowLogForm] = useState(false)
  const [logDay, setLogDay] = useState<Date>(new Date())
  const [form, setForm] = useState({
    peptide_id: '', dose: '', unit: 'mcg', method: 'Subkutan', notes: '',
    logged_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  })
  const [saving, setSaving] = useState(false)

  const loadLogs = async () => {
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('dose_logs')
      .select('*, peptides(name)')
      .eq('user_id', user!.id)
      .gte('logged_at', start)
      .lte('logged_at', end + 'T23:59:59')
      .order('logged_at', { ascending: false })
    if (data) setLogs(data as DoseLog[])
  }

  const loadCycles = async () => {
    const { data } = await supabase
      .from('cycles')
      .select('*, peptides(name)')
      .eq('user_id', user!.id)
      .eq('active', true)
    if (data) setCycles(data as Cycle[])
  }

  const loadPeptides = async () => {
    const { data } = await supabase.from('peptides').select('*').eq('user_id', user!.id).order('name')
    if (data) setPeptides(data)
  }

  const loadEscalations = async () => {
    const { data } = await supabase.from('dose_escalations').select('*').eq('user_id', user!.id)
    if (data) setEscalations(data as Escalation[])
  }

  useEffect(() => { loadLogs(); loadCycles() }, [currentDate])
  useEffect(() => { loadPeptides(); loadEscalations() }, [])

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
  })

  const logsForDay = (day: Date) => logs.filter(l => isSameDay(new Date(l.logged_at), day))
  const cyclesForDay = (day: Date) => cycles.filter(c => cycleAppliesToDay(c, day))

  // ── Tages-Ansicht (unten) ────────────────────────────────────────────────
  const todayLogs   = logsForDay(new Date())
  const todayCycles = cyclesForDay(new Date())
  const selLogs     = logsForDay(selectedDay)
  const selCycles   = cyclesForDay(selectedDay)
  const isTodaySelected = isToday(selectedDay)

  // ── Protokollieren ───────────────────────────────────────────────────────
  const openLogForm = (day: Date, prefillCycle?: Cycle) => {
    if (peptides.length === 0) return toast.error('Zuerst ein Peptid anlegen!')
    setLogDay(day)

    // Zyklus für diesen Tag bevorzugen (entweder per Klick übergeben oder erster aktiver)
    const cycle = prefillCycle ?? cyclesForDay(day)[0]
    if (cycle) {
      const dose = effectiveDose(cycle, day, escalations)
      const pep = peptides.find(x => x.id === cycle.peptide_id) ?? peptides[0]
      setForm({
        peptide_id: pep.id,
        dose: dose.toString(),
        unit: cycle.unit,
        method: cycle.method,
        notes: '',
        logged_at: format(day, "yyyy-MM-dd'T'") + format(new Date(), 'HH:mm'),
      })
    } else {
      const p = peptides[0]
      setForm({
        peptide_id: p.id,
        dose: p.default_dose?.toString() ?? '',
        unit: p.default_unit,
        method: p.default_method,
        notes: '',
        logged_at: format(day, "yyyy-MM-dd'T'") + format(new Date(), 'HH:mm'),
      })
    }
    setShowLogForm(true)
  }

  const onPeptideChange = (id: string) => {
    const p = peptides.find(x => x.id === id)
    if (p) setForm(f => ({ ...f, peptide_id: id, dose: p.default_dose?.toString() ?? '', unit: p.default_unit, method: p.default_method }))
  }

  const saveLog = async () => {
    if (!form.dose) return toast.error('Dosis eingeben')
    setSaving(true)
    const { error } = await supabase.from('dose_logs').insert({
      user_id: user!.id,
      peptide_id: form.peptide_id,
      dose: parseFloat(form.dose),
      unit: form.unit,
      method: form.method,
      notes: form.notes || null,
      logged_at: new Date(form.logged_at).toISOString(),
    })
    if (error) toast.error('Fehler beim Speichern')
    else { toast.success('Dosis protokolliert!'); setShowLogForm(false); loadLogs() }
    setSaving(false)
  }

  const deleteLog = async (id: string) => {
    if (!confirm('Eintrag löschen?')) return
    await supabase.from('dose_logs').delete().eq('id', id)
    toast.success('Gelöscht'); loadLogs()
  }

  const confirmDose = async (id: string, taken: boolean) => {
    await supabase.from('dose_logs').update({ taken }).eq('id', id)
    loadLogs()
    if (taken) toast.success('Einnahme bestätigt ✓')
    else toast('Einnahme übersprungen', { icon: '⏭️' })
  }

  const snoozeDose = (log: DoseLog, minutes: number) => {
    toast(`Erinnerung in ${minutes < 60 ? minutes + ' Min.' : minutes / 60 + ' Std.'}`, { icon: '⏰' })
    setTimeout(() => {
      toast(
        `Erinnerung: ${log.peptides?.name} ${log.dose} ${log.unit} noch nicht bestätigt!`,
        { icon: '💉', duration: 10000 }
      )
    }, minutes * 60 * 1000)
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Monats-Navigation ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <button className="p-2 text-slate-400 hover:text-white transition-colors"
          onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: de })}
        </h1>
        <button className="p-2 text-slate-400 hover:text-white transition-colors"
          onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* ── Kalender ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden mb-4">
        {/* Wochentag-Kopf */}
        <div className="grid grid-cols-7 border-b border-slate-800">
          {WEEKDAY_LABELS.map(d => (
            <div key={d} className="text-center text-slate-500 text-xs font-medium py-2">{d}</div>
          ))}
        </div>

        {/* Tage */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dayLogs    = logsForDay(day)
            const dayCycles  = cyclesForDay(day)
            const inMonth    = day.getMonth() === currentDate.getMonth()
            const isSelected = isSameDay(day, selectedDay)
            const hasCycle   = dayCycles.length > 0
            const hasLog     = dayLogs.length > 0

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day)}
                className={`
                  relative flex flex-col items-center justify-center py-2 transition-colors
                  border-r border-b border-slate-800/50 last:border-r-0
                  ${!inMonth ? 'opacity-25' : ''}
                  ${isSelected
                    ? 'bg-sky-500'
                    : hasCycle
                      ? 'bg-violet-500/10 hover:bg-violet-500/20'
                      : 'hover:bg-slate-800'}
                `}
              >
                {/* Heute-Ring */}
                {isToday(day) && !isSelected && (
                  <span className="absolute inset-1 rounded-lg ring-1 ring-sky-500 pointer-events-none" />
                )}

                <span className={`text-sm font-semibold leading-none ${
                  isSelected ? 'text-white' :
                  isToday(day) ? 'text-sky-400' :
                  inMonth ? 'text-slate-200' : 'text-slate-600'
                }`}>
                  {format(day, 'd')}
                </span>

                {/* Indikatoren – je Punkt ein Peptid */}
                {(() => {
                  const logIds   = dayLogs.map(l => l.peptide_id)
                  const cycleIds = dayCycles.map(c => c.peptide_id)
                  const unique   = [...new Set([...logIds, ...cycleIds])].slice(0, 4)
                  if (unique.length === 0) return <div className="h-1.5 mt-1" />
                  return (
                    <div className="flex gap-0.5 mt-1 h-1.5">
                      {unique.map(pid => {
                        const idx   = peptides.findIndex(p => p.id === pid)
                        const color = isSelected ? '#ffffff' : getPeptideColor(idx)
                        return (
                          <span key={pid} className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }} />
                        )
                      })}
                    </div>
                  )
                })()}
              </button>
            )
          })}
        </div>

        {/* Legende */}
        <div className="flex gap-4 px-4 py-2.5 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getPeptideColor(i) }} />
              ))}
            </div>
            je Punkt = ein Peptid
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded bg-violet-500/30 border border-violet-500/40" /> Zyklus aktiv
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <TrendingUp size={10} className="text-orange-400" /> Erhöhung
          </div>
        </div>
      </div>

      {/* ── Tages-Panel (ausgewählter Tag / Standard = heute) ─────────────── */}
      <div className="card">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={15} className="text-slate-400" />
          <h2 className="font-semibold text-slate-200 text-sm">
            {isTodaySelected
              ? 'Heutiges Protokoll'
              : format(selectedDay, 'EEEE, d. MMMM', { locale: de })}
          </h2>
          {!isTodaySelected && (
            <button
              onClick={() => { setSelectedDay(new Date()); setCurrentDate(new Date()) }}
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
              → Heute
            </button>
          )}
        </div>

        {/* Aktive Zyklen für diesen Tag */}
        {selCycles.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {selCycles.map(c => {
              const dose = effectiveDose(c, selectedDay, escalations)
              const isEscalated = dose !== c.dose
              const cycleEscs = escalations.filter(e => e.cycle_id === c.id)
              const activeEscCount = cycleEscs.filter(e => {
                if (e.start_type === 'date' && e.start_date)
                  return selectedDay >= parseISO(e.start_date)
                if (e.start_after_days != null)
                  return differenceInDays(selectedDay, parseISO(c.start_date)) >= e.start_after_days
                return false
              }).length
              const pidx  = peptides.findIndex(p => p.id === c.peptide_id)
              const pcolor = getPeptideColor(pidx)
              return (
                <button
                  key={c.id}
                  onClick={() => openLogForm(selectedDay, c)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors text-left hover:opacity-90"
                  style={{
                    backgroundColor: pcolor + '10',
                    borderColor:      pcolor + '30',
                  }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pcolor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: pcolor }}>{c.peptides?.name}</span>
                      <span className={`text-xs font-semibold ${isEscalated ? 'text-orange-400' : 'text-slate-300'}`}>
                        {dose} {c.unit}
                      </span>
                      {isEscalated && (
                        <span className="flex items-center gap-0.5 text-orange-400 text-xs">
                          <TrendingUp size={11} /> Stufe {activeEscCount}
                        </span>
                      )}
                      <span className="text-slate-500 text-xs">{c.method}</span>
                    </div>
                    {isEscalated && (
                      <p className="text-slate-600 text-xs mt-0.5">
                        Basis: {c.dose} {c.unit} · +{dose - c.dose} {c.unit} Erhöhung
                      </p>
                    )}
                  </div>
                  <span className="text-slate-600 text-xs shrink-0 hidden sm:block">{c.name}</span>
                  <Plus size={13} className="shrink-0 opacity-70" style={{ color: pcolor }} />
                </button>
              )
            })}
          </div>
        )}

        {/* Protokollierte Dosen */}
        {selLogs.length > 0 ? (
          <div className="space-y-2">
            {selLogs.map(log => (
              <div key={log.id} className={`px-3 py-2.5 border rounded-xl transition-colors ${
                log.taken === true
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : log.taken === false
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-sky-500/5 border-sky-500/15'
              }`}>
                {/* Zeile 1: Icon + Name + Dosis + Löschen */}
                <div className="flex items-center gap-3">
                  <Syringe size={14} className={`shrink-0 ${
                    log.taken === true ? 'text-emerald-400' :
                    log.taken === false ? 'text-red-400' : 'text-sky-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{log.peptides?.name}</span>
                      <span className={`text-xs font-semibold ${
                        log.taken === true ? 'text-emerald-400' :
                        log.taken === false ? 'text-red-400' : 'text-sky-400'
                      }`}>{log.dose} {log.unit}</span>
                      <span className="text-slate-500 text-xs">{log.method}</span>
                      {log.taken === true && (
                        <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-medium">
                          <Check size={11} /> Eingenommen
                        </span>
                      )}
                      {log.taken === false && (
                        <span className="flex items-center gap-0.5 text-red-400 text-xs font-medium">
                          <XCircle size={11} /> Übersprungen
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-500 text-xs">{format(new Date(log.logged_at), 'HH:mm')} Uhr</span>
                      {log.notes && <span className="text-slate-600 text-xs truncate">· {log.notes}</span>}
                    </div>
                  </div>
                  <button className="p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
                    onClick={() => deleteLog(log.id)}>
                    <X size={13} />
                  </button>
                </div>

                {/* Zeile 2: Bestätigungs-Buttons (nur wenn noch nicht bestätigt) */}
                {log.taken === null && (
                  <div className="flex gap-2 mt-2 ml-[26px]">
                    <button
                      onClick={() => confirmDose(log.id, true)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors">
                      <Check size={11} /> Eingenommen
                    </button>
                    <button
                      onClick={() => confirmDose(log.id, false)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors">
                      <XCircle size={11} /> Nicht eingenommen
                    </button>
                  </div>
                )}

                {/* Zeile 3: Snooze-Buttons (nur wenn übersprungen) */}
                {log.taken === false && (
                  <div className="mt-2 ml-[26px]">
                    <p className="text-slate-500 text-xs mb-1.5 flex items-center gap-1">
                      <Bell size={10} /> Erinnere mich nochmal in:
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[15, 30, 60, 120].map(min => (
                        <button
                          key={min}
                          onClick={() => snoozeDose(log, min)}
                          className="text-xs px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60 transition-colors">
                          {min < 60 ? `${min} Min` : `${min / 60} Std`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : selCycles.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">
            {isTodaySelected ? 'Noch nichts für heute protokolliert' : 'Kein Eintrag für diesen Tag'}
          </p>
        ) : (
          <p className="text-slate-600 text-xs text-center py-2">
            Noch keine Dosis protokolliert
          </p>
        )}
      </div>

      {/* ── Protokoll-Formular (Modal) ─────────────────────────────────────── */}
      {showLogForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
          onClick={() => setShowLogForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4"
            onClick={e => e.stopPropagation()}>

            <div>
              <h2 className="text-lg font-bold">Dosis protokollieren</h2>
              <p className="text-sky-400 text-sm mt-0.5">
                {format(logDay, 'EEEE, d. MMMM yyyy', { locale: de })}
              </p>
            </div>

            <div>
              <label className="label">Peptid</label>
              <select className="select" value={form.peptide_id}
                onChange={e => onPeptideChange(e.target.value)}>
                {peptides.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Dosis</label>
                <input className="input" type="number" value={form.dose}
                  onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} />
              </div>
              <div>
                <label className="label">Einheit</label>
                <select className="select" value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Applikationsart</label>
              <select className="select" value={form.method}
                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Uhrzeit</label>
              <input className="input" type="datetime-local" value={form.logged_at}
                onChange={e => setForm(f => ({ ...f, logged_at: e.target.value }))} />
            </div>

            <div>
              <label className="label">Notizen (optional)</label>
              <input className="input" placeholder="z.B. nach dem Training" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1"
                onClick={() => setShowLogForm(false)}>Abbrechen</button>
              <button className="btn-primary flex-1"
                onClick={saveLog} disabled={saving}>
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
