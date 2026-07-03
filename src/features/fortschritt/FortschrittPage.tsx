import { useCallback, useState } from 'react'
import type { FortschrittTab, VerlaufNavigation } from './types'
import { useFortschrittData } from './hooks/useFortschrittData'
import { FortschrittHeader, formatRangeSubtitle } from './components/FortschrittHeader'
import { FortschrittTabs } from './components/FortschrittTabs'
import { OverviewTab } from './components/overview/OverviewTab'
import { VerlaufTab } from './components/verlauf/VerlaufTab'
import { FotosTab } from './components/fotos/FotosTab'
import { LabsTab } from './components/labs/LabsTab'
import { TodayLogSheet } from './components/TodayLogSheet'

export function FortschrittPage() {
  const { state, reload } = useFortschrittData()
  const [tab, setTab] = useState<FortschrittTab>('uebersicht')
  const [logOpen, setLogOpen] = useState(false)
  const [pendingVerlauf, setPendingVerlauf] = useState<VerlaufNavigation | null>(null)

  const subtitle = formatRangeSubtitle(
    state.range.from,
    state.cycleSubstances.length,
    state.ongoingSubstances.length,
  )

  const handleNavigate = (nav: VerlaufNavigation | { tab: 'labs' | 'fotos' }) => {
    if (nav.tab === 'verlauf') {
      setPendingVerlauf(nav)
      setTab('verlauf')
      return
    }
    setTab(nav.tab)
  }

  return (
    <div className="space-y-4">
      <FortschrittHeader subtitle={subtitle} onLogToday={() => setLogOpen(true)} />
      <FortschrittTabs active={tab} onChange={setTab} />

      {state.loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
          Laden…
        </div>
      ) : (
        <>
          {tab === 'uebersicht' && (
            <OverviewTab
              state={state}
              onLogToday={() => setLogOpen(true)}
              onNavigate={handleNavigate}
            />
          )}
          {tab === 'verlauf' && (
            <VerlaufTab
              state={state}
              pendingNav={pendingVerlauf}
              onPendingConsumed={() => setPendingVerlauf(null)}
            />
          )}
          {tab === 'fotos' && (
            <FotosTab photos={state.photos} onChange={() => void reload()} />
          )}
          {tab === 'labs' && (
            <LabsTab bloodwork={state.bloodwork} />
          )}
        </>
      )}

      <TodayLogSheet
        logs={state.dailyLogs}
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSaved={() => void reload()}
      />
    </div>
  )
}
