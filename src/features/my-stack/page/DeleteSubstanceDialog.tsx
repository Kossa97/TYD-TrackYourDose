import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { Trash2, Archive, AlertTriangle } from 'lucide-react'
import { type Peptide } from './model'


/**
 * Substanz entfernen: archivieren (alle Daten bleiben) oder endgueltig loeschen.
 * Endgueltig nimmt die Bewertungen mit (die Datenbank loescht sie mit der
 * Substanz) — das steht dabei, mit Anzahl, statt still zu passieren.
 */
export function DeleteSubstanceDialog({
  deletePromptPeptide,
  deletePromptFromArchive,
  deletingPeptide,
  setDeletePromptFromArchive,
  setDeletePromptPeptide,
  archiveCloseButtonRef,
  archivePeptide,
  hardDeletePeptide,
}: {
  deletePromptPeptide: Peptide | null
  deletePromptFromArchive: boolean
  deletingPeptide: boolean
  setDeletePromptFromArchive: Dispatch<SetStateAction<boolean>>
  setDeletePromptPeptide: Dispatch<SetStateAction<Peptide | null>>
  archiveCloseButtonRef: RefObject<HTMLButtonElement | null>
  archivePeptide: (p: Peptide) => Promise<void>
  hardDeletePeptide: (p: Peptide) => Promise<void>
}) {
  const { t } = useTranslation()
  const bewertungen = useBewertungsZahl(deletePromptPeptide?.id ?? null)
  return (
    <>
      {deletePromptPeptide && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10"
          data-app-modal
          data-archive-delete-confirmation={deletePromptFromArchive ? '' : undefined}
          onClick={() => {
            if (deletingPeptide) return
            setDeletePromptFromArchive(false)
            setDeletePromptPeptide(null)
            window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-peptide-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h2 id="delete-peptide-title" className="text-lg font-bold text-white">{t('substanz_entfernen_title')}</h2>
                <p className="mt-0.5 truncate text-sm text-slate-400">{deletePromptPeptide.name}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {!deletePromptFromArchive && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-cyan-300">
                    <Archive size={15} /> {t('archivieren_behalten')}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{t('archivieren_behalten_desc')}</p>
                </div>
              )}
              <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-300">
                  <Trash2 size={15} /> {t('endgueltig_loeschen')}
                </p>
                <p className="mt-1 text-xs text-slate-400">{t('endgueltig_loeschen_desc')}</p>
                {bewertungen !== null && bewertungen > 0 && (
                  <p data-delete-reviews className="mt-1 text-xs font-semibold text-red-300">
                    {bewertungen === 1
                      ? t('review_substance_delete_one')
                      : t('review_substance_delete_many', { n: bewertungen })}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {!deletePromptFromArchive && (
                <button
                  type="button"
                  onClick={() => archivePeptide(deletePromptPeptide)}
                  disabled={deletingPeptide}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 text-sm font-bold text-cyan-200 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  <Archive size={16} /> {t('archivieren_behalten')}
                </button>
              )}
              <button
                type="button"
                autoFocus={deletePromptFromArchive}
                onClick={() => hardDeletePeptide(deletePromptPeptide)}
                disabled={deletingPeptide}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 text-sm font-bold text-red-200 transition-colors hover:border-red-400/60 hover:bg-red-500/25 disabled:opacity-50"
              >
                <Trash2 size={16} /> {t('endgueltig_loeschen')}
              </button>
              <button
                type="button"
                onClick={() => { setDeletePromptFromArchive(false); setDeletePromptPeptide(null); window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus()) }}
                data-app-back-close
                disabled={deletingPeptide}
                className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-50"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Wie viele Bewertungen an der Substanz haengen; null, solange unbekannt. */
function useBewertungsZahl(stackItemId: string | null): number | null {
  const [zahl, setZahl] = useState<{ id: string; n: number } | null>(null)
  useEffect(() => {
    if (!stackItemId) return
    let aktuell = true
    void supabase.from('reviews').select('id').eq('stack_item_id', stackItemId).then(({ data, error }) => {
      if (aktuell && !error) setZahl({ id: stackItemId, n: data?.length ?? 0 })
    })
    return () => { aktuell = false }
  }, [stackItemId])
  return zahl && zahl.id === stackItemId ? zahl.n : null
}
