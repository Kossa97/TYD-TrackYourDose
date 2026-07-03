import { MIN_POINTS_FOR_TREND, isWellnessMetricKey } from '../../constants'
import {
  computeTopChanges,
  weightSeries,
  dailyFieldSeries,
} from '../../lib/metrics'
import { countLoggedDays } from '../../lib/substances'
import { defaultFocusSubstanceId } from '../../lib/focusSummary'
import type { FortschrittOverviewState, VerlaufNavigation } from '../../types'
import { ActiveSubstancesSection } from './ActiveSubstancesSection'
import { TopChangesSection } from './TopChangesSection'
import { OverviewCards } from './OverviewCards'
import { EmptyOverview, NoSubstancesBanner } from './EmptyOverview'

interface Props {
  state: FortschrittOverviewState
  onLogToday: () => void
  onNavigate: (nav: VerlaufNavigation | { tab: 'labs' | 'fotos' }) => void
}

export function OverviewTab({ state, onLogToday, onNavigate }: Props) {
  const {
    range,
    cycleSubstances,
    ongoingSubstances,
    dailyLogs,
    weightLogs,
    bloodwork,
    photos,
    doseLogs,
    peptideNames,
  } = state

  const hasSubstances = cycleSubstances.length + ongoingSubstances.length > 0
  const hasAnyLogs =
    dailyLogs.length > 0 ||
    weightLogs.length > 0 ||
    bloodwork.length > 0 ||
    photos.length > 0

  const completelyEmpty = !hasSubstances && !hasAnyLogs

  if (completelyEmpty) {
    return <EmptyOverview onLogToday={onLogToday} />
  }

  const topChanges = computeTopChanges(range, weightLogs, dailyLogs, bloodwork)

  const trendCandidates = [
    weightSeries(weightLogs, range),
    ...(['energie', 'schlaf', 'wohlbefinden', 'libido'] as const).map(f => dailyFieldSeries(dailyLogs, range, f)),
    ...[...new Set(bloodwork.map(b => b.marker))].map(m =>
      bloodwork.filter(b => b.marker === m).map(b => ({ date: b.tested_at, value: b.value })),
    ),
  ]
  const hasEnoughForTrend = trendCandidates.some(series => series.length >= MIN_POINTS_FOR_TREND)

  const loggedDays = countLoggedDays(dailyLogs.map(l => l.log_date))
  const hasMetricForVerlauf = weightLogs.length > 0 || dailyLogs.length > 0 || bloodwork.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!hasSubstances && <NoSubstancesBanner />}

      {hasSubstances && (
        <ActiveSubstancesSection
          cycles={cycleSubstances}
          ongoing={ongoingSubstances}
          onSelect={id => onNavigate({ tab: 'verlauf', focusSubstanceId: id })}
        />
      )}

      <TopChangesSection
        changes={topChanges}
        hasAnyData={hasAnyLogs}
        hasEnoughForTrend={hasEnoughForTrend}
        onSelect={key => {
          if (isWellnessMetricKey(key)) {
            onNavigate({
              tab: 'verlauf',
              focusSubstanceId: defaultFocusSubstanceId(cycleSubstances, ongoingSubstances) ?? undefined,
            })
            return
          }
          onNavigate({ tab: 'verlauf', metric: key })
        }}
      />

      {loggedDays > 0 && loggedDays < 7 && (
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>
          · {loggedDays} {loggedDays === 1 ? 'Tag' : 'Tage'} geloggt
        </p>
      )}

      <OverviewCards
        range={range}
        cycleSubstances={cycleSubstances}
        ongoingSubstances={ongoingSubstances}
        dailyLogs={dailyLogs}
        weightLogs={weightLogs}
        bloodwork={bloodwork}
        photos={photos}
        doseLogs={doseLogs}
        peptideNames={peptideNames}
        onNavigateVerlauf={(metric, focusSubstanceId) =>
          onNavigate({ tab: 'verlauf', metric, focusSubstanceId })
        }
        onNavigateTab={tab => onNavigate({ tab })}
      />

      <button
        type="button"
        className="btn-secondary"
        disabled={!hasMetricForVerlauf}
        onClick={() => onNavigate({ tab: 'verlauf', metric: 'weight' })}
        style={{
          width: '100%',
          opacity: hasMetricForVerlauf ? 1 : 0.45,
          cursor: hasMetricForVerlauf ? 'pointer' : 'not-allowed',
        }}
      >
        Verlauf ansehen →
      </button>
    </div>
  )
}
