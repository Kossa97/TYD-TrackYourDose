import { format, parseISO } from 'date-fns'
import { CalendarClock, CheckCircle2, ClipboardList, History } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type InjectionHistoryDays } from '../../lib/injectionHistory'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import { INJECTION_TRACKER_TABS, type InjectionTrackerTab } from '../../lib/injectionTrackerTabs'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'
import { InjectionHistorySheet } from './InjectionHistorySheet'

export function InjectionTrackerTabs({
  logs,
  openIntakes,
  historyDays,
  visibleLogIds,
  onHistoryDaysChange,
  onToggleLog,
  onFocusLog,
}: {
  logs: InjectionLog3D[]
  openIntakes: OpenInjectionIntake[]
  historyDays: InjectionHistoryDays
  visibleLogIds: Set<string>
  onHistoryDaysChange: (days: InjectionHistoryDays) => void
  onToggleLog: (id: string) => void
  onFocusLog: (log: InjectionLog3D) => void
}) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<InjectionTrackerTab>('open')

  const tabLabels: Record<InjectionTrackerTab, string> = {
    open: String(t('injection_tab_open', { defaultValue: 'Offen' })),
    history: String(t('injection_tab_history', { defaultValue: 'Historie' })),
  }

  return (
    <section className="shrink-0 border-t border-white/10 p-3" style={{ background: 'linear-gradient(180deg, rgba(7, 11, 24, 0.96), var(--surface))' }}>
      <div className="mx-auto mb-3 h-1 w-14 rounded-full bg-white/20" aria-hidden="true" />
      <div role="tablist" aria-label={String(t('injection_tabs_label', { defaultValue: 'Injektionstracker Bereiche' }))} className="mb-3 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 p-1" style={{ background: 'var(--surface-input)' }}>
        {INJECTION_TRACKER_TABS.map(tab => {
          const selected = activeTab === tab
          const Icon = tab === 'open' ? ClipboardList : History
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab)}
              className={'flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition-colors ' + (selected ? 'bg-sky-400/15 text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.14)]' : 'text-slate-400 hover:text-slate-200')}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="truncate">{tabLabels[tab]}</span>
            </button>
          )
        })}
      </div>

      {activeTab === 'open' && <OpenIntakesTab openIntakes={openIntakes} />}
      {activeTab === 'history' && (
        <InjectionHistorySheet
          embedded
          logs={logs}
          historyDays={historyDays}
          visibleLogIds={visibleLogIds}
          onHistoryDaysChange={onHistoryDaysChange}
          onToggleLog={onToggleLog}
          onFocusLog={onFocusLog}
        />
      )}
    </section>
  )
}

function OpenIntakesTab({ openIntakes }: { openIntakes: OpenInjectionIntake[] }) {
  const { t } = useTranslation()
  const sortedIntakes = useMemo(() => [...openIntakes].sort((a, b) => (
    parseISO(b.scheduledAt).getTime() - parseISO(a.scheduledAt).getTime()
  )), [openIntakes])

  if (sortedIntakes.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-300" aria-hidden="true" />
        <p className="text-sm font-black text-white">{t('injection_open_empty_title', { defaultValue: 'Keine offenen Stellen' })}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{t('injection_open_empty_body', { defaultValue: 'Alle passenden Einnahmen haben bereits eine Injektionsstelle oder es ist nichts faellig.' })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
        {t('injection_open_hint', { defaultValue: 'Markiere zuerst eine Stelle auf der 3D-Karte. Im Speichern-Sheet kannst du dann eine dieser Einnahmen auswaehlen.' })}
      </div>
      <div className="max-h-[34vh] space-y-2 overflow-y-auto pr-1">
        {sortedIntakes.map(intake => {
          const key = intake.doseLogId ?? String(intake.cycleId) + '|' + intake.scheduledAt
          return <OpenIntakeRow key={key} intake={intake} />
        })}
      </div>
    </div>
  )
}

function OpenIntakeRow({ intake }: { intake: OpenInjectionIntake }) {
  const { t } = useTranslation()
  const statusLabel = intake.status === 'confirmed'
    ? t('injection_already_confirmed', { defaultValue: 'Bereits bestaetigt' })
    : t('injection_status_open', { defaultValue: 'Offen' })
  const statusClass = intake.status === 'confirmed' ? 'text-emerald-300' : 'text-amber-300'

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-400">
          {intake.status === 'confirmed' ? <CheckCircle2 size={16} aria-hidden="true" /> : <CalendarClock size={16} aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">{intake.peptideName}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            <span className={statusClass}>{statusLabel}</span>
            {' - '}{format(parseISO(intake.scheduledAt), 'dd.MM. HH:mm')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black text-sky-300">{intake.dose} {intake.unit}</p>
          <p className="text-[0.62rem] text-slate-500">{intake.method}</p>
        </div>
      </div>
    </article>
  )
}
