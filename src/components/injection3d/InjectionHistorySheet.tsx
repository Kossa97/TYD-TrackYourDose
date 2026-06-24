import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { Eye, EyeOff, History, LocateFixed } from 'lucide-react'
import {
  filterInjectionHistory,
  formatInjectionSite,
  hasExactInjectionPosition,
  type InjectionHistoryDays,
} from '../../lib/injectionHistory'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'

function groupLabel(date: Date) {
  if (isToday(date)) return 'Heute'
  if (isYesterday(date)) return 'Gestern'
  return format(date, 'dd.MM.yyyy')
}

export function InjectionHistorySheet({
  logs,
  historyDays,
  visibleLogIds,
  onHistoryDaysChange,
  onToggleLog,
  onFocusLog,
}: {
  logs: InjectionLog3D[]
  historyDays: InjectionHistoryDays
  visibleLogIds: Set<string>
  onHistoryDaysChange: (days: InjectionHistoryDays) => void
  onToggleLog: (id: string) => void
  onFocusLog: (log: InjectionLog3D) => void
}) {
  const filteredLogs = filterInjectionHistory(logs, new Date(), historyDays)
  const groups = filteredLogs.reduce<Array<{ label: string; logs: InjectionLog3D[] }>>((acc, log) => {
    const label = groupLabel(parseISO(log.logged_at))
    const group = acc.find(item => item.label === label)
    if (group) group.logs.push(log)
    else acc.push({ label, logs: [log] })
    return acc
  }, [])

  return (
    <section className="rounded-3xl border border-white/10 p-4" style={{ background: 'var(--surface)' }}>
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History size={16} color="var(--accent)" />
          <h2 className="text-sm font-black text-white">Historie</h2>
        </div>
        <label>
          <span className="sr-only">Historienzeitraum</span>
          <select
            className="rounded-xl border border-white/10 bg-transparent px-3 py-2 text-xs font-bold text-slate-300"
            value={historyDays}
            onChange={event => {
              const value = event.target.value
              onHistoryDaysChange(value === 'all' ? 'all' : Number(value) as InjectionHistoryDays)
            }}
          >
            {[7, 14, 30, 60, 90].map(days => <option key={days} value={days}>{days} Tage</option>)}
            <option value="all">Alle</option>
          </select>
        </label>
      </div>

      <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
        {groups.length === 0 && <p className="py-5 text-center text-sm text-slate-500">Keine Injektionen in diesem Zeitraum.</p>}
        {groups.map(group => (
          <div key={group.label}>
            <p className="mb-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
            <div className="space-y-2">
              {group.logs.map(log => {
                const visible = visibleLogIds.has(log.id)
                const exactPosition = hasExactInjectionPosition(log)
                const substance = log.peptide_name ?? log.substance_label ?? 'Injektion'
                const dose = [log.dose, log.unit].filter(value => value != null && value !== '').join(' ')
                const metadata = [format(parseISO(log.logged_at), 'HH:mm'), dose, log.method].filter(Boolean).join(' · ')

                return (
                  <article key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start gap-2.5">
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          aria-label={visible ? 'Pin ausblenden' : 'Pin dauerhaft anzeigen'}
                          title={visible ? 'Pin ausblenden' : 'Pin dauerhaft anzeigen'}
                          onClick={() => onToggleLog(log.id)}
                          className={`grid h-11 w-11 place-items-center rounded-xl border ${visible ? 'border-sky-400/40 bg-sky-400/15 text-sky-300' : 'border-white/10 text-slate-500'}`}
                        >
                          {visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          type="button"
                          aria-label="Kamera zur Injektionsstelle bewegen"
                          title={exactPosition ? 'Zur Injektionsstelle' : 'Keine genaue Position gespeichert'}
                          disabled={!exactPosition}
                          onClick={() => onFocusLog(log)}
                          className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-slate-400 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <LocateFixed size={16} />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{substance}</p>
                        <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-300">{formatInjectionSite(log)}</p>
                        <p className="mt-1 text-[0.68rem] text-slate-500">{metadata}</p>
                      </div>
                    </div>
                    {log.notes?.trim() && (
                      <p className="mt-2 border-t border-white/10 pt-2 text-xs leading-5 text-slate-400">
                        Notiz: {log.notes.trim()}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
