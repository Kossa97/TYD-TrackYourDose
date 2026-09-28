import type { ReactNode } from 'react'
import type { SloshEngine } from '../../../components/sloshEngine'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Pencil, RefreshCw } from 'lucide-react'
import { SloshProvider } from '../../../components/SloshContext'
import { StageDetailSheet } from '../components/StageDetailSheet'
import { type BestandEditorArt } from '../components/Bestand'
import { anbruchArt, vorratTeile } from '../lib/bestand'
import { StackStage } from '../components/StackStage'
import { denyProps } from '../../../lib/denyFeedback'
import { getStableStackItemColor } from '../lib/colors'
import { type Peptide, getVialFillPct } from './model'

/**
 * Das Vollbild hinter einem Objekt: Plan, Bestand, Angaben — geoeffnet per FLIP aus dem Karussell.
 */
export function StageDetailView({
  detailUrsprung,
  activePeptide,
  detailHistoryPeptideId,
  closeStageDetail,
  sloshEngine,
  openEditPeptide,
  removePeptide,
  setBestandEdit,
  eintragDetails,
}: {
  detailUrsprung: DOMRect | null
  activePeptide: Peptide
  detailHistoryPeptideId: string | null
  closeStageDetail: () => void
  sloshEngine: SloshEngine
  openEditPeptide: (p: Peptide) => void
  removePeptide: (id: string) => void
  setBestandEdit: Dispatch<SetStateAction<{ peptideId: string; editor: BestandEditorArt; } | null>>
  eintragDetails: () => ReactNode
}) {
  const { t } = useTranslation()
  return (
    <>
      {detailUrsprung && activePeptide && detailHistoryPeptideId === activePeptide.id && (
        <StageDetailSheet
          originRect={detailUrsprung}
          onClose={closeStageDetail}
          onFlightChange={imFlug => sloshEngine.setEnabled(!imFlug)}
          title={activePeptide.name}
          sideActions={(
            <>
              {/* Nur Symbole: was ein Stift und ein Papierkorb tun, liest
                  man ohne Text. Loeschen fragt ohnehin noch einmal nach. */}
              <button
                type="button"
                onClick={() => openEditPeptide(activePeptide)}
                aria-label={String(t('bearbeiten'))}
                title={String(t('bearbeiten'))}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-200 transition-colors hover:border-sky-400/40 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <Pencil size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => removePeptide(activePeptide.id)}
                aria-label={String(t('loeschen'))}
                title={String(t('loeschen'))}
                className="grid h-11 w-11 place-items-center rounded-full border border-red-500/20 bg-red-500/5 text-red-300 transition-colors hover:border-red-400/40 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </>
          )}
          belowTitle={(() => {
            // Ein neues Vial anmischen, einen neuen Pen oder eine neue Flasche
            // anbrechen: setzt Datum und Fluessigkeit neu und verwirft auf
            // Wunsch den Rest im alten. Nur mit Bestand und vollem Behaelter.
            const art = anbruchArt(activePeptide.dosage_form)
            if (!art || !activePeptide.inventory?.enabled) return null
            const nichtsZuOeffnen = vorratTeile(activePeptide.inventory).voll < 1
            return (
              <button
                type="button"
                onClick={() => {
                  if (!nichtsZuOeffnen) setBestandEdit({ peptideId: activePeptide.id, editor: 'open_new' })
                }}
                {...denyProps(nichtsZuOeffnen, String(t('my_stack_open_new_locked', {
                  defaultValue: 'Nichts Ungeöffnetes mehr im Bestand.',
                })))}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 text-sm font-semibold text-cyan-200 transition-colors hover:border-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 aria-disabled:border-slate-800 aria-disabled:bg-slate-900/60 aria-disabled:text-slate-600"
              >
                <RefreshCw size={15} aria-hidden="true" />
                {String(t(art === 'vial' ? 'my_stack_stock_mix_new' : art === 'pen' ? 'my_stack_stock_open_new_pen' : 'my_stack_stock_open_new_bottle'))}
              </button>
            )
          })()}
          stage={(
            <SloshProvider engine={sloshEngine}>
              <div style={{ width: 'min(9rem, 38vw)' }}>
                <StackStage
                  item={{ ...activePeptide, color_hex: activePeptide.color_hex ?? getStableStackItemColor(activePeptide.id) }}
                  fillPct={Math.round(getVialFillPct(activePeptide) ?? 100)}
                  isActive
                  size="carousel"
                />
              </div>
            </SloshProvider>
          )}
        >
          {eintragDetails()}
        </StageDetailSheet>
      )}
    </>
  )
}
