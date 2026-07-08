import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { useFortschrittData } from './hooks/useFortschrittData'
import { FortschrittHeader, formatRangeSubtitle } from './components/FortschrittHeader'
import { FortschrittDashboard } from './components/FortschrittDashboard'
import { StickyRangeBar } from './components/StickyRangeBar'
import { TodayLogSheet } from './components/TodayLogSheet'
import { hasLogForDate } from './lib/metricDefaults'
import { DEFAULT_RANGE_CHIP, type RangeChipKey } from './lib/verlaufRange'

export function FortschrittPage() {
  const { state, reload } = useFortschrittData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [logOpen, setLogOpen] = useState(false)
  const [rangeChip, setRangeChip] = useState<RangeChipKey>(DEFAULT_RANGE_CHIP)
  const [rangeLocked, setRangeLocked] = useState(false)

  const handleRangeLockedChange = useCallback((locked: boolean) => setRangeLocked(locked), [])

  useEffect(() => {
    if (searchParams.get('tab')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const subtitle = formatRangeSubtitle(
    state.range.from,
    state.cycleSubstances.filter(c => c.active).length,
    state.ongoingSubstances.length,
  )

  const hasTodayEntry = useMemo(
    () => hasLogForDate(state.dailyLogs, state.weightLogs, format(new Date(), 'yyyy-MM-dd')),
    [state.dailyLogs, state.weightLogs],
  )

  return (
    <div className="space-y-4" style={{ marginTop: '-1rem' }}>
      <StickyRangeBar
        value={rangeChip}
        onChange={setRangeChip}
        disabled={rangeLocked}
      />

      <FortschrittHeader
        subtitle={subtitle}
        onLogToday={() => setLogOpen(true)}
        hasTodayEntry={hasTodayEntry}
      />

      {state.loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
          Laden…
        </div>
      ) : (
        <FortschrittDashboard
          state={state}
          rangeChip={rangeChip}
          onLogToday={() => setLogOpen(true)}
          onReload={() => void reload()}
          onRangeLockedChange={handleRangeLockedChange}
        />
      )}

      <TodayLogSheet
        logs={state.dailyLogs}
        weightLogs={state.weightLogs}
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={() => reload()}
      />
    </div>
  )
}
