// src/components/injection3d/InjectionIntroSheet.tsx
import { Hand, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const INJECTION_INTRO_VERSION = 1

export function InjectionIntroSheet({
  onClose,
  onDontShowAgain,
}: {
  onClose: () => void
  onDontShowAgain: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl border border-white/10 p-5 pb-8" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hand size={17} color="var(--accent)" aria-hidden="true" />
            <h2 className="text-base font-black text-white">{t('injection_intro_title', { defaultValue: 'Markierung setzen' })}</h2>
          </div>
          <button
            type="button"
            aria-label={String(t('injection_close_hint', { defaultValue: 'Hinweis schliessen' }))}
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-slate-400"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-slate-400">
          {t('injection_intro_body', { defaultValue: 'Halte eine Stelle auf dem 3D-Torso gedrueckt, um einen Pin zu setzen. Danach kannst du die Position feinjustieren.' })}
        </p>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary min-h-11 flex-1" onClick={onDontShowAgain}>
            {t('injection_intro_dont_show', { defaultValue: 'Nicht mehr anzeigen' })}
          </button>
          <button type="button" className="btn-primary min-h-11 flex-1" onClick={onClose}>
            {t('injection_intro_understood', { defaultValue: 'Verstanden' })}
          </button>
        </div>
      </div>
    </>
  )
}
