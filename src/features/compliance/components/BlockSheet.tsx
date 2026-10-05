import { useTranslation } from 'react-i18next'
import { Ban } from 'lucide-react'
import { Sheet } from './Sheet'

/** Bestaetigung vor dem Blockieren; Fokus auf „Abbrechen". */
export function BlockSheet({ username, busy, onCancel, onConfirm }: {
  username: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet labelledBy="block-title" busy={busy} onClose={onCancel} role="alertdialog" data-block-sheet>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
          <Ban size={18} aria-hidden="true" />
        </span>
        <h2 id="block-title" className="min-w-0 break-words pt-2 text-lg font-bold text-white">{t('block_title', { name: username })}</h2>
      </div>
      <p className="mt-3 text-sm text-slate-400">{t('block_desc')}</p>
      <div className="mt-5 flex gap-2">
        <button type="button" autoFocus data-app-back-close disabled={busy} onClick={onCancel} className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 disabled:opacity-50">
          {t('cancel')}
        </button>
        <button type="button" data-block-confirm disabled={busy} onClick={onConfirm} className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">
          {t('block_action')}
        </button>
      </div>
    </Sheet>
  )
}
