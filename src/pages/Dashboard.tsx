import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, startOfWeek, endOfWeek,
  differenceInDays, parseISO,
} from 'date-fns'
import { de, enUS, es, fr, it, pt, ru, tr, ar, hi, id, zhCN, ja, ko } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { Activity, ChevronLeft, ChevronRight, CalendarDays, Syringe, X, TrendingUp, Check, XCircle, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPeptideColor } from '../lib/peptideColors'
import { GlassPanel, MetricCard, PageHero, PageShell, SectionHeader } from '../components/ui/DesignSystem'

const DATE_LOCALES: Record<string, Locale> = {
  de, en: enUS, es, fr, it, pt, ru, tr, ar, hi, id, zh: zhCN, ja, ko,
}

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
  intake_time: string | null
  intake_time_custom: string | null
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

const WEEKDAYS_DE: Record<number, string> = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 0: 'So' }

function cycleAppliesToDay(cycle: Cycle, day: Date): boolean {
  const start = parseISO(cycle.start_date)
  const end = cycle.end_date ? parseISO(cycle.end_date) : null
  if (day < start) return false
  if (end && day > end) return false

  const freq = cycle.frequency
  const dayOfWeek = WEEKDAYS_DE[day.getDay()]
  const diff = differenceInDays(day, start)

  // schedule_days override: applies to Wochentage wählen, Alle X Tage, and legacy 2x/3x täglich
  const hasDayFilter = (cycle.schedule_days ?? []).length > 0
  if (freq === 'Täglich' || freq === '2x täglich' || freq === '3x täglich')
    return hasDayFilter ? (cycle.schedule_days ?? []).includes(dayOfWeek) : true
  if (freq === 'Jeden 2. Tag') return diff % 2 === 0
  if (freq === 'Alle X Tage') {
    const intervalOk = diff % (cycle.x_days_interval ?? 2) === 0
    return intervalOk && (hasDayFilter ? (cycle.schedule_days ?? []).includes(dayOfWeek) : true)
  }
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

const INTAKE_MINUTES: Record<string, number> = {
  morgens: 8 * 60, mittags: 12 * 60, abends: 20 * 60,
}
function cycleIntakeMinutes(c: Cycle): number {
  // Sort by first intake time slot
  const firstKey = (c.intake_time ?? '').split(',').filter(Boolean)[0] ?? ''
  if (INTAKE_MINUTES[firstKey]) return INTAKE_MINUTES[firstKey]
  if (firstKey === 'custom' && c.intake_time_custom) {
    const firstCustom = c.intake_time_custom.split(',')[0]
    const [h, m] = firstCustom.split(':').map(Number)
    return h * 60 + m
  }
  return 25 * 60
}

function cycleTimeLabel(c: Cycle, t: (key: string) => string): { emoji: string; label: string } | null {
  if (!c.intake_time) return null
  const keys = c.intake_time.split(',').filter(Boolean)
  const customs = (c.intake_time_custom ?? '').split(',')
  const parts = keys.map((key, i) => {
    if (key === 'morgens') return { emoji: '🌅', label: t('morgens') }
    if (key === 'mittags') return { emoji: '☀️', label: t('mittags') }
    if (key === 'abends')  return { emoji: '🌙', label: t('abends') }
    if (key === 'custom' && customs[i]) return { emoji: '🕐', label: customs[i] }
    return null
  }).filter(Boolean) as { emoji: string; label: string }[]
  if (parts.length === 0) return null
  return {
    emoji: parts.map(p => p.emoji).join(''),
    label: parts.map(p => p.label).join(' · '),
  }
}

function timeLabel(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const date = new Date(dateStr)
  const h    = date.getHours()
  const time = format(date, 'HH:mm')
  if (h >= 5  && h < 12) return t('morgens_uhr', { time })
  if (h >= 12 && h < 18) return t('mittags_uhr', { time })
  if (h >= 18)            return t('abends_uhr', { time })
  return `${time} Uhr`
}

function cycleLogTimestamp(cycle: Cycle, day: Date): string {
  const date = new Date(day)
  const minutes = cycleIntakeMinutes(cycle)
  const safeMinutes = minutes >= 24 * 60 ? 12 * 60 : minutes
  date.setHours(Math.floor(safeMinutes / 60), safeMinutes % 60, 0, 0)
  return date.toISOString()
}

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const locale = DATE_LOCALES[i18n.language] ?? enUS
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [logs, setLogs] = useState<DoseLog[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [peptides, setPeptides] = useState<Peptide[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])

  // selectedDay steuert den Tages-Bereich unten — Standard = heute
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  const loadLogs = useCallback(async () => {
    if (!user) return
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('dose_logs')
      .select('*, peptides(name)')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lte('logged_at', end + 'T23:59:59')
      .order('logged_at', { ascending: true })
    if (data) setLogs(data as DoseLog[])
  }, [currentDate, user])

  const loadCycles = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('cycles')
      .select('*, peptides(name)')
      .eq('user_id', user.id)
      .eq('active', true)
    if (data) setCycles(data as Cycle[])
  }, [user])

  const loadPeptides = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('peptides').select('*').eq('user_id', user.id).order('name')
    if (data) setPeptides(data)
  }, [user])

  const loadEscalations = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('dose_escalations').select('*').eq('user_id', user.id)
    if (data) setEscalations(data as Escalation[])
  }, [user])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        void loadLogs()
        void loadCycles()
      }
    })
    return () => { cancelled = true }
  }, [loadCycles, loadLogs])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        void loadPeptides()
        void loadEscalations()
      }
    })
    return () => { cancelled = true }
  }, [loadEscalations, loadPeptides])

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
  })

  const logsForDay = (day: Date) => logs.filter(l => isSameDay(new Date(l.logged_at), day))
  const cyclesForDay = (day: Date) => cycles.filter(c => cycleAppliesToDay(c, day))

  // ── Tages-Ansicht (unten) ────────────────────────────────────────────────
  const selLogs     = logsForDay(selectedDay)
  const selCycles   = cyclesForDay(selectedDay)
  const isTodaySelected = isToday(selectedDay)
  const monthTitle = format(currentDate, 'MMMM yyyy', { locale })
  const selectedDayTitle = isTodaySelected
    ? t('heutiges_protokoll')
    : format(selectedDay, 'EEEE, d. MMMM', { locale })
  const pendingLogItems = selLogs.filter(log => log.taken === null)
  const pendingCycles = selCycles.filter(cycle =>
    !selLogs.some(log => log.peptide_id === cycle.peptide_id)
  )
  const pendingLogs = pendingLogItems.length
  const takenLogs = selLogs.filter(log => log.taken === true).length
  const openConfirmationCount = pendingLogs + pendingCycles.length
  const firstOpenConfirmationName = pendingLogItems[0]?.peptides?.name ?? pendingCycles[0]?.peptides?.name

  const deleteLog = async (id: string) => {
    if (!confirm(t('eintrag_loeschen'))) return
    await supabase.from('dose_logs').delete().eq('id', id)
    toast.success(t('deleted')); loadLogs()
  }

  const confirmDose = async (id: string, taken: boolean) => {
    await supabase.from('dose_logs').update({ taken }).eq('id', id)
    loadLogs()
    if (taken) toast.success(t('einnahme_bestaetigt'))
    else toast(t('einnahme_uebersp_toast'), { icon: '⏭️' })
  }

  const confirmCycleDose = async (cycle: Cycle, taken: boolean) => {
    if (!user) return
    const dose = effectiveDose(cycle, selectedDay, escalations)
    const { error } = await supabase.from('dose_logs').insert({
      user_id: user.id,
      peptide_id: cycle.peptide_id,
      dose,
      unit: cycle.unit,
      method: cycle.method,
      logged_at: cycleLogTimestamp(cycle, selectedDay),
      taken,
    })
    if (error) return toast.error(t('fehler_speichern'))
    loadLogs()
    if (taken) toast.success(t('einnahme_bestaetigt'))
    else toast(t('einnahme_uebersp_toast'), { icon: '⏭️' })
  }

  const snoozeDose = (log: DoseLog, minutes: number) => {
    const time = minutes < 60 ? `${minutes} min` : `${minutes / 60} h`
    toast(t('erinnerung_toast', { time }), { icon: '⏰' })
    setTimeout(() => {
      toast(
        t('dose_nicht_best', { name: log.peptides?.name, dose: log.dose, unit: log.unit }),
        { icon: '💉', duration: 10000 }
      )
    }, minutes * 60 * 1000)
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageShell>
      <PageHero
        kicker={t('nav_kalender')}
        title={monthTitle}
        subtitle={selectedDayTitle}
        icon={CalendarDays}
        accent="#00ccf5"
        action={(
          <div className="flex items-center gap-2">
            <button className="btn-secondary !px-3 !py-2"
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <ChevronLeft size={17} />
            </button>
            <button className="btn-secondary !px-3 !py-2"
              onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      >
        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            icon={Activity}
            label={t('zyklus')}
            value={cycles.length}
            hint={t('stat_active_cycles')}
            accent="#8b5cf6"
          />
          <MetricCard
            icon={Syringe}
            label={t('protokollierte_dosen')}
            value={selLogs.length}
            hint={`${takenLogs} ${t('eingenommen')}`}
            accent="#00ccf5"
          />
          <MetricCard
            icon={Bell}
            label={t('ausstehend')}
            value={openConfirmationCount}
            hint={openConfirmationCount > 0
              ? t('dose_confirm_open_short', { defaultValue: 'Bestätigung offen' })
              : `${selCycles.length} ${t('zyklus')}`}
            accent={openConfirmationCount > 0 ? '#f59e0b' : '#10b981'}
          />
        </div>
      </PageHero>

      {/* ── Kalender ──────────────────────────────────────────────────────── */}
      <div data-ob="calendar-main" data-ob-self>
      <GlassPanel accent="#00ccf5" padding="sm" style={{ padding: 0 }}>
        {/* Wochentag-Kopf */}
        <div className="grid grid-cols-7 border-b border-slate-800">
          {[t('mon'),t('tue'),t('wed'),t('thu'),t('fri'),t('sat'),t('sun')].map(d => (
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

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day)}
                className={`relative flex flex-col items-center justify-center py-2 transition-all duration-150
                  border-r border-b last:border-r-0
                  ${!inMonth ? 'opacity-20' : ''}
                `}
                style={{
                  borderColor: 'rgba(255,255,255,0.04)',
                  background: isSelected
                    ? 'linear-gradient(145deg, rgba(0,190,240,0.85), rgba(0,120,210,0.75))'
                    : hasCycle
                      ? 'rgba(120,80,255,0.07)'
                      : 'transparent',
                  boxShadow: isSelected
                    ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 16px rgba(0,200,240,0.25)'
                    : undefined,
                }}
              >
                {/* Heute-Ring */}
                {isToday(day) && !isSelected && (
                  <span className="absolute inset-1 rounded-md pointer-events-none"
                    style={{ boxShadow: '0 0 0 1px rgba(0,204,245,0.50), 0 0 6px rgba(0,204,245,0.15)' }} />
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
        <div className="flex gap-4 px-4 py-2.5" style={{
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(1,2,10,0.60)',
        }}>
          <div className="flex items-center gap-1.5" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)' }}>
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: getPeptideColor(i), boxShadow: `0 0 4px ${getPeptideColor(i)}88` }} />
              ))}
            </div>
            {t('per_dot_peptid')}
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)' }}>
            <span className="w-2 h-2 rounded-sm" style={{
              background: 'rgba(120,80,255,0.25)',
              border: '1px solid rgba(120,80,255,0.35)',
            }} /> {t('zyklus')}
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)' }}>
            <TrendingUp size={10} style={{ color: '#f59e0b' }} /> {t('erhoehung')}
          </div>
        </div>
      </GlassPanel>
      </div>

      {/* ── Tages-Panel (ausgewählter Tag / Standard = heute) ─────────────── */}
      <GlassPanel accent="#00ccf5" padding="md">
        {/* Header */}
        <div className="mb-3">
          <SectionHeader
            kicker={format(selectedDay, 'dd.MM.yyyy')}
            title={selectedDayTitle}
            icon={CalendarDays}
            accent="#00ccf5"
            action={!isTodaySelected && (
              <button
                onClick={() => { setSelectedDay(new Date()); setCurrentDate(new Date()) }}
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                {t('heute_link')}
              </button>
            )}
          />
        </div>

        {openConfirmationCount > 0 && (
          <div
            className="mb-3 rounded-2xl border px-3 py-3"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(8,12,30,0.82))',
              borderColor: 'rgba(245,158,11,0.42)',
              boxShadow: '0 0 22px rgba(245,158,11,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/25">
                <Bell size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-amber-200">
                  {openConfirmationCount === 1
                    ? t('dose_confirm_open_one', {
                        defaultValue: 'Einnahmebestätigung für {{name}} noch offen',
                        name: firstOpenConfirmationName ?? t('zyklus'),
                      })
                    : t('dose_confirm_open_many', {
                        defaultValue: '{{count}} Einnahmebestätigungen noch offen',
                        count: openConfirmationCount,
                      })}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/60">
                  {t('dose_confirm_open_hint', { defaultValue: 'Bitte bestätige manuell, ob die geplante Einnahme erfolgt ist oder übersprungen wurde.' })}
                </p>
              </div>
            </div>
          </div>
        )}

        {pendingCycles.length > 0 && (
          <div className="space-y-2 mb-3">
            {pendingCycles.sort((a, b) => cycleIntakeMinutes(a) - cycleIntakeMinutes(b)).map(c => {
              const dose = effectiveDose(c, selectedDay, escalations)
              const tl = cycleTimeLabel(c, t)
              return (
                <div
                  key={`pending-${c.id}`}
                  className="px-3 py-2.5 rounded-xl border"
                  style={{
                    backgroundColor: 'rgba(245,158,11,0.07)',
                    borderColor: 'rgba(245,158,11,0.24)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <Syringe size={14} className="mt-0.5 shrink-0 text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white text-sm">{c.peptides?.name}</span>
                        <span className="text-xs font-semibold text-amber-300">{dose} {c.unit}</span>
                        <span className="text-slate-500 text-xs">{c.method}</span>
                        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                          {t('dose_confirm_pending_badge', { defaultValue: 'Bestätigung offen' })}
                        </span>
                      </div>
                      {tl && (
                        <p className="mt-1 text-xs text-amber-400">{tl.emoji} {tl.label}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 ml-[26px] flex gap-2">
                    <button
                      onClick={() => confirmCycleDose(c, true)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors">
                      <Check size={11} /> {t('eingenommen')}
                    </button>
                    <button
                      onClick={() => confirmCycleDose(c, false)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors">
                      <XCircle size={11} /> {t('uebersprungen')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Aktive Zyklen für diesen Tag */}
        {selCycles.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {[...selCycles].sort((a, b) => cycleIntakeMinutes(a) - cycleIntakeMinutes(b)).map(c => {
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
              const pidx   = peptides.findIndex(p => p.id === c.peptide_id)
              const pcolor = getPeptideColor(pidx)
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
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
                          <TrendingUp size={11} /> {t('stufe_n', { n: activeEscCount })}
                        </span>
                      )}
                      <span className="text-slate-500 text-xs">{c.method}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(() => {
                        const tl = cycleTimeLabel(c, t)
                        return tl ? (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            {tl.emoji} {tl.label}
                          </span>
                        ) : null
                      })()}
                      {isEscalated && (
                        <span className="text-slate-600 text-xs">
                          {t('basis_label')} {c.dose} {c.unit} · +{dose - c.dose} {c.unit}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-600 text-xs shrink-0 hidden sm:block">{c.name}</span>
                </div>
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
                          <Check size={11} /> {t('eingenommen')}
                        </span>
                      )}
                      {log.taken === false && (
                        <span className="flex items-center gap-0.5 text-red-400 text-xs font-medium">
                          <XCircle size={11} /> {t('uebersprungen')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-500 text-xs">{timeLabel(log.logged_at, t)}</span>
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
                      <Check size={11} /> {t('eingenommen')}
                    </button>
                    <button
                      onClick={() => confirmDose(log.id, false)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors">
                      <XCircle size={11} /> {t('uebersprungen')}
                    </button>
                  </div>
                )}

                {/* Zeile 3: Snooze-Buttons (nur wenn übersprungen) */}
                {log.taken === false && (
                  <div className="mt-2 ml-[26px]">
                    <p className="text-slate-500 text-xs mb-1.5 flex items-center gap-1">
                      <Bell size={10} /> {t('erinnere_nochmal')}
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[15, 30, 60, 120].map(min => (
                        <button
                          key={min}
                          onClick={() => snoozeDose(log, min)}
                          className="text-xs px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60 transition-colors">
                          {min < 60 ? `${min} min` : `${min / 60} h`}
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
            {isTodaySelected ? t('noch_nichts_heute') : t('kein_eintrag_tag')}
          </p>
        ) : (
          <p className="text-slate-600 text-xs text-center py-2">
            {t('noch_keine_dosis_prot')}
          </p>
        )}
      </GlassPanel>

    </PageShell>
  )
}
