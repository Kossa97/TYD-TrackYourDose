import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'

/**
 * Loeschen einer Bewertung — ein eigenes Sheet statt des Browser-Fensters.
 * Nennt, was verschwindet (Substanz und Zyklus); der Fokus liegt auf
 * „Abbrechen", damit ein Druck auf Enter nichts loescht.
 */
export function ReviewDeleteSheet({ name, zyklus, busy, onCancel, onConfirm }: {
  name: string
  zyklus: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      data-app-modal
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10"
      onClick={() => { if (!busy) onCancel() }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="review-delete-title"
        aria-describedby="review-delete-desc"
        data-review-delete
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key !== 'Escape' || busy) return
          event.stopPropagation()
          onCancel()
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <Trash2 size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="review-delete-title" className="text-lg font-bold text-white">{t('review_delete_title')}</h2>
            <p id="review-delete-desc" className="mt-0.5 text-sm text-slate-400">
              {name} · {zyklus}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-400">{t('review_delete_desc')}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            autoFocus
            data-app-back-close
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? t('review_deleting') : t('loeschen')}
          </button>
        </div>
      </div>
    </div>
  )
}
