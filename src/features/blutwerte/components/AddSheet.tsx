/**
 * Auswahl hinter dem „+" der Blutwerte: Dokument oder Foto (Werte liest die
 * KI aus — der Import fragt vorher nach der Einwilligung) oder manuelle Eingabe.
 */
import { useTranslation } from 'react-i18next'
import { Camera, ChevronRight, FileText, PenLine, type LucideIcon } from 'lucide-react'
import { CYAN, MUTED, TEXT } from '../styles'

export type AddChoice = 'document' | 'photo' | 'manual'

interface Props {
  onPick: (choice: AddChoice) => void
  onClose: () => void
}

const OPTIONS: Array<{ key: AddChoice; icon: LucideIcon; title: string; desc: string }> = [
  { key: 'document', icon: FileText, title: 'bw_add_document', desc: 'bw_add_document_desc' },
  { key: 'photo', icon: Camera, title: 'bw_add_photo', desc: 'bw_add_photo_desc' },
  { key: 'manual', icon: PenLine, title: 'bw_add_manual_entry', desc: 'bw_add_manual_desc' },
]

export function AddSheet({ onPick, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" data-app-modal onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bw-add-title"
        className="w-full max-w-lg p-6 pb-8 space-y-2 rounded-t-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="bw-add-title" className="text-lg font-bold mb-2" style={{ color: TEXT }}>{t('bw_add_title')}</h2>
        {OPTIONS.map(({ key, icon: Icon, title, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--accent-weak)', color: CYAN }}>
              <Icon size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold" style={{ color: TEXT }}>{t(title)}</span>
              <span className="block text-xs leading-snug" style={{ color: MUTED }}>{t(desc)}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" style={{ color: MUTED }} />
          </button>
        ))}
        <button type="button" className="btn-secondary w-full !mt-4" data-app-back-close onClick={onClose}>{t('cancel')}</button>
      </div>
    </div>
  )
}
