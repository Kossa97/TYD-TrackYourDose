import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Translate = (key: string, options?: Record<string, unknown>) => unknown

/** „Seit heute abgelaufen!", „Seit 1 Tag abgelaufen!", „Seit 5 Tagen abgelaufen!" — in Kalendertagen. */
export function expiredLabel(t: Translate, daysSince: number): string {
  if (daysSince <= 0) return String(t('my_stack_expired_full_today'))
  if (daysSince === 1) return String(t('my_stack_expired_full_day'))
  return String(t('my_stack_expired_full_days', { n: daysSince }))
}

/**
 * Abgelaufen: ein blinkendes Warnsymbol und dahinter der ganze Satz.
 *
 * Kein Rahmen, kein Gluehen, kein Textwechsel — alarmieren tut allein das
 * Symbol (Takt in `index.css`, `.tyd-expired-icon`); der Text steht still
 * und sagt alles auf einmal. Bei „weniger Bewegung" steht auch das Symbol.
 *
 * Der Aufrufer setzt einen `key` je Substanz, damit das Blinken bei der
 * naechsten von vorn beginnt.
 */
export function ExpiredBadge({ daysSince }: { daysSince: number }) {
  const { t } = useTranslation()
  return (
    <span
      data-expired-badge
      className="inline-flex items-center gap-1.5 whitespace-nowrap py-1 font-semibold text-red-300"
    >
      <AlertTriangle size={14} aria-hidden="true" className="tyd-expired-icon shrink-0 text-red-400" />
      {expiredLabel(t, daysSince)}
    </span>
  )
}
