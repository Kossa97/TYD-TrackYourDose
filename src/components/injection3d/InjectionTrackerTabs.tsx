import { format, parseISO } from 'date-fns'
import { CalendarClock, CheckCircle2, ClipboardList, History, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type InjectionHistoryDays } from '../../lib/injectionHistory'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import type { InjectionTrackerTab } from '../../lib/injectionTrackerTabs'
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
  onSheetOpenChange,
}: {
  logs: InjectionLog3D[]
  openIntakes: OpenInjectionIntake[]
  historyDays: InjectionHistoryDays
  visibleLogIds: Set<string>
  onHistoryDaysChange: (days: InjectionHistoryDays) => void
  onToggleLog: (id: string) => void
  onFocusLog: (log: InjectionLog3D) => void
  onSheetOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [activeSheet, setActiveSheet] = useState<InjectionTrackerTab | null>(null)

  const labels: Record<InjectionTrackerTab, string> = {
    open: String(t('injection_tab_open', { defaultValue: 'Offen' })),
    history: String(t('injection_tab_history', { defaultValue: 'Historie' })),
  }
  const activeLabel = activeSheet ? labels[activeSheet] : ''

  const openSheet = (sheet: InjectionTrackerTab) => setActiveSheet(sheet)

  useEffect(() => {
    onSheetOpenChange(activeSheet !== null)
  }, [activeSheet, onSheetOpenChange])

  return (
    <>
      <div
        className="injection-floating-actions pointer-events-none absolute bottom-4 left-4 right-4 z-30 flex items-center justify-between gap-3"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <FloatingActionButton
          icon={<ClipboardList size={18} aria-hidden="true" />}
          label={labels.open}
          active={activeSheet === 'open'}
          onClick={() => openSheet('open')}
        />
        <FloatingActionButton
          icon={<History size={18} aria-hidden="true" />}
          label={labels.history}
          active={activeSheet === 'history'}
          onClick={() => openSheet('history')}
        />
      </div>

      {activeSheet && (
        <section
          className="absolute bottom-0 left-0 right-0 z-40 max-h-[48dvh] overflow-hidden border-t border-white/10 px-4 pt-3"
          style={{
            background: 'linear-gradient(180deg, rgba(7, 11, 24, 0.92), var(--surface))',
            paddingBottom: 'calc(0.85rem + env(safe-area-inset-bottom))',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 -18px 46px rgba(0,0,0,0.45)',
          }}
        >
          <div className="mb-3 flex items-center gap-3">
            <button
              type="button"
              aria-label={String(t('close', { defaultValue: 'Schließen' }))}
              onClick={() => setActiveSheet(null)}
              className="grid min-h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:text-white"
            >
              <X size={17} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[0.66rem] font-black uppercase text-sky-300">3D Injektionskarte</p>
              <h2 className="truncate text-lg font-black text-white">{activeLabel}</h2>
            </div>
          </div>

          <div className="max-h-[34dvh] overflow-y-auto pr-1">
            {activeSheet === 'open' && <OpenIntakesTab openIntakes={openIntakes} />}
            {activeSheet === 'history' && (
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
          </div>
        </section>
      )}
    </>
  )
}

function FloatingActionButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={'pointer-events-auto flex min-h-12 min-w-[8.5rem] cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black shadow-[0_10px_26px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-colors ' + (active ? 'border-sky-300/35 bg-sky-400/20 text-sky-200' : 'border-white/10 bg-black/50 text-slate-200 hover:text-white')}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
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
        <p className="mt-1 text-xs leading-5 text-slate-400">{t('injection_open_empty_body', { defaultValue: 'Alle passenden Einnahmen haben bereits eine Injektionsstelle oder es ist nichts fällig.' })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
        {t('injection_open_hint', { defaultValue: 'Markiere zuerst eine Stelle auf der 3D-Karte. Im Speichern-Sheet kannst du dann eine dieser Einnahmen auswählen.' })}
      </div>
      <div className="space-y-2">
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
    ? t('injection_already_confirmed', { defaultValue: 'Bereits bestätigt' })
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
