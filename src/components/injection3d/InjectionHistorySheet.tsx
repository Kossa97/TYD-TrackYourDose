// src/components/injection3d/InjectionHistorySheet.tsx
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { Check, History, MapPin } from 'lucide-react'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'

function groupLabel(date: Date) {
  if (isToday(date)) return 'Heute'
  if (isYesterday(date)) return 'Gestern'
  return format(date, 'dd.MM.yyyy')
}

export function InjectionHistorySheet({
  logs,
  showLast7Days,
  visibleLogIds,
  onToggleLast7Days,
  onToggleLog,
  onFocusLog,
}: {
  logs: InjectionLog3D[]
  showLast7Days: boolean
  visibleLogIds: Set<string>
  onToggleLast7Days: () => void
  onToggleLog: (id: string) => void
  onFocusLog: (log: InjectionLog3D) => void
}) {
  const groups = logs.reduce<Array<{ label: string; logs: InjectionLog3D[] }>>((acc, log) => {
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
        <button type="button" onClick={onToggleLast7Days} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${showLast7Days ? 'border-sky-400/40 bg-sky-400/15 text-sky-300' : 'border-white/10 text-slate-400'}`}>
          Letzte 7 Tage
        </button>
      </div>

      <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
        {groups.length === 0 && <p className="py-5 text-center text-sm text-slate-500">Noch keine Injektionen geloggt.</p>}
        {groups.map(group => (
          <div key={group.label}>
            <p className="mb-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
            <div className="space-y-2">
              {group.logs.map(log => {
                const visible = visibleLogIds.has(log.id)
                return (
                  <div key={log.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                    <button type="button" aria-label="Pin als Referenz anzeigen" onClick={() => onToggleLog(log.id)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${visible ? 'border-sky-400/40 bg-sky-400/15 text-sky-300' : 'border-white/10 text-slate-500'}`}>
                      {visible ? <Check size={14} /> : <MapPin size={14} />}
                    </button>
                    <button type="button" onClick={() => onFocusLog(log)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-bold text-white">{log.peptide_name ?? 'Injektion'} · {log.body_side} {log.body_region}</p>
                      <p className="text-xs text-slate-500">{format(parseISO(log.logged_at), 'dd.MM.yyyy HH:mm')} · {[log.dose, log.unit].filter(Boolean).join(' ')}</p>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
