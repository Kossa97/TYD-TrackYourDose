import { format, parseISO } from 'date-fns'
import { Activity, CalendarClock, CheckCircle2, ClipboardList, History, MapPin, Target } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { formatInjectionSite, type InjectionHistoryDays } from '../../lib/injectionHistory'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import { buildInjectionTrackerSummary, formatInjectionTrackerTabCount, INJECTION_TRACKER_TABS, type InjectionTrackerTab } from '../../lib/injectionTrackerTabs'
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
  const [activeTab, setActiveTab] = useState<InjectionTrackerTab>('overview')
  const summary = useMemo(() => buildInjectionTrackerSummary({
    logs,
    openIntakes,
    now: new Date(),
  }), [logs, openIntakes])

  const tabLabels: Record<InjectionTrackerTab, string> = {
    overview: String(t('injection_tab_overview', { defaultValue: 'Uebersicht' })),
    open: String(t('injection_tab_open', { defaultValue: 'Offen' })),
    history: String(t('injection_tab_history', { defaultValue: 'Historie' })),
  }
  const tabCounts: Partial<Record<InjectionTrackerTab, number>> = {
    open: summary.pendingSiteCount,
    history: logs.length,
  }

  return (
    <section className="rounded-3xl border border-white/10 p-4" style={{ background: 'var(--surface)' }}>
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
      <div role="tablist" aria-label={String(t('injection_tabs_label', { defaultValue: 'Injektionstracker Bereiche' }))} className="mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 p-1" style={{ background: 'var(--surface-input)' }}>
        {INJECTION_TRACKER_TABS.map(tab => {
          const selected = activeTab === tab
          const count = tabCounts[tab]
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab)}
              className={'min-h-11 min-w-0 cursor-pointer rounded-xl px-2 py-2 text-xs font-black transition-colors ' + (selected ? 'bg-sky-400/15 text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.14)]' : 'text-slate-400 hover:text-slate-200')}
            >
              <span className="block truncate">{tabLabels[tab]}</span>
              {count != null && count > 0 && <span className="mt-0.5 block text-[0.62rem] font-extrabold text-slate-500">{formatInjectionTrackerTabCount(count)}</span>}
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab summary={summary} openIntakes={openIntakes} onShowOpen={() => setActiveTab('open')} />
      )}
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

function OverviewTab({
  summary,
  openIntakes,
  onShowOpen,
}: {
  summary: ReturnType<typeof buildInjectionTrackerSummary>
  openIntakes: OpenInjectionIntake[]
  onShowOpen: () => void
}) {
  const { t } = useTranslation()
  const latest = summary.latestLog
  const latestName = latest?.peptide_name ?? latest?.substance_label ?? t('injection_default_label', { defaultValue: 'Injektion' })
  const lastUsedLabel = summary.lastUsedDaysAgo == null
    ? t('injection_overview_never', { defaultValue: 'Noch keine Stelle' })
    : summary.lastUsedDaysAgo === 0
      ? t('injection_history_today', { defaultValue: 'Heute' })
      : summary.lastUsedDaysAgo === 1
        ? t('injection_history_yesterday', { defaultValue: 'Gestern' })
        : t('inj_days_ago', { days: summary.lastUsedDaysAgo, defaultValue: 'vor ' + summary.lastUsedDaysAgo + ' Tagen' })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <SummaryMetric icon={<ClipboardList size={16} />} label={String(t('injection_overview_pending', { defaultValue: 'Offen' }))} value={String(summary.pendingSiteCount)} tone="sky" />
        <SummaryMetric icon={<Activity size={16} />} label={String(t('injection_last_7_days', { defaultValue: '7 Tage' }))} value={String(summary.recentLogCount)} tone="emerald" />
        <SummaryMetric icon={<History size={16} />} label={String(t('injection_overview_last', { defaultValue: 'Letzte' }))} value={String(lastUsedLabel)} tone="slate" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-sky-300" aria-hidden="true" />
          <h2 className="text-sm font-black text-white">{t('injection_overview_last_site', { defaultValue: 'Letzte Injektionsstelle' })}</h2>
        </div>
        {latest ? (
          <div>
            <p className="text-sm font-black text-white">{latestName}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{formatInjectionSite(latest)}</p>
            <p className="mt-2 text-[0.68rem] text-slate-500">{format(parseISO(latest.logged_at), 'dd.MM.yyyy HH:mm')}</p>
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-400">{t('injection_overview_empty_last', { defaultValue: 'Sobald du eine Stelle speicherst, erscheint hier der letzte Standort.' })}</p>
        )}
      </div>

      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07] p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-200">
            <Target size={17} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-white">{t('injection_overview_next_step', { defaultValue: 'Naechste Stelle markieren' })}</h2>
            <p className="mt-1 text-xs leading-5 text-cyan-100/75">{t('injection_overview_next_step_body', { defaultValue: 'Halte eine Stelle auf dem 3D-Koerper gedrueckt. Danach waehlst du im Sheet die passende Einnahme oder speicherst manuell.' })}</p>
          </div>
        </div>
        {openIntakes.length > 0 && (
          <button type="button" onClick={onShowOpen} className="mt-3 min-h-11 w-full cursor-pointer rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 text-sm font-black text-cyan-100 transition-colors hover:bg-cyan-300/15">
            {t('injection_overview_show_open', { count: openIntakes.length, defaultValue: String(openIntakes.length) + ' offene Einnahmen ansehen' })}
          </button>
        )}
      </div>
    </div>
  )
}

function SummaryMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'sky' | 'emerald' | 'slate'
}) {
  const toneClass = tone === 'sky'
    ? 'border-sky-400/20 bg-sky-400/[0.08] text-sky-300'
    : tone === 'emerald'
      ? 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300'
      : 'border-white/10 bg-white/[0.04] text-slate-300'

  return (
    <div className={'min-w-0 rounded-2xl border p-3 ' + toneClass}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span aria-hidden="true">{icon}</span>
      </div>
      <p className="truncate text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
    </div>
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
      <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
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
