import { useState } from 'react'
import type { FortschrittTab, VerlaufNavigation } from './types'
import { useFortschrittData } from './hooks/useFortschrittData'
import { FortschrittHeader, formatRangeSubtitle } from './components/FortschrittHeader'
import { FortschrittTabs } from './components/FortschrittTabs'
import { OverviewTab } from './components/overview/OverviewTab'
import { TodayLogSheet } from './components/TodayLogSheet'
import { PlaceholderTab } from './components/PlaceholderTab'

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
            <PlaceholderTab
              title="Verlauf"
              description={
                pendingVerlauf?.metric || pendingVerlauf?.focusSubstanceId
                  ? 'Phase 2: Substanz-Schiene und Chart werden hier implementiert. Deine Auswahl wurde vorgemerkt.'
                  : 'Phase 2: Timeline mit Substanz-Schiene, Metrik-Chart und Fokus-Modus.'
              }
            />
          )}
          {tab === 'fotos' && (
            <PlaceholderTab
              title="Fotos"
              description="Phase 2: Foto-Timeline und Vorher/Nachher-Vergleich."
            />
          )}
          {tab === 'labs' && (
            <PlaceholderTab
              title="Labs"
              description="Phase 2: Kompakte Lab-Übersicht. Bis dahin: Blutwerte unter /blutwerte."
            />
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
