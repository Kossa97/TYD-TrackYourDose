import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * „Kein Medizinprodukt, ersetzt keinen aerztlichen Rat" — an Rechnern,
 * Simulation, Registrierung und im Profil (Apple 1.4.1/1.4.2, Google
 * „Health apps"). Bewusst unaufdringlich, aber immer sichtbar.
 */
export function MedicalNotice({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <p data-medical-notice className={`flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs leading-relaxed text-slate-400 ${className}`}>
      <Info size={14} aria-hidden="true" className="mt-px shrink-0 text-slate-500" />
      <span>{t('medical_notice')}</span>
    </p>
  )
}
