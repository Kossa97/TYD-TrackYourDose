import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Translate = (key: string, options?: Record<string, unknown>) => unknown

/** „seit heute", „seit 1 Tag", „seit 5 Tagen" — in Kalendertagen. */
function expiredSinceLabel(t: Translate, daysSince: number): string {
  if (daysSince <= 0) return String(t('my_stack_expired_since_today'))
  if (daysSince === 1) return String(t('my_stack_expired_since_day'))
  return String(t('my_stack_expired_since_days', { n: daysSince }))
}

/**
 * Abgelaufen: Alarm und „seit X Tagen" im gleichmaessigen Wechsel.
 *
 * Endlos im 6-Sekunden-Takt: 3 s „Abgelaufen!" mit blinkendem Warnsymbol und
 * gluehendem Abzeichen, dann 3 s „seit 3 Tagen" mit ruhigem Symbol. Der Takt
 * steht allein im CSS (`.tyd-expired-*` in `index.css`); alle Teile laufen mit
 * derselben Dauer und bleiben so zusammen. Beide Texte liegen uebereinander,
 * das Abzeichen springt beim Wechsel nicht. Vorgelesen wird beides zusammen.
 * Bei „weniger Bewegung" steht still „seit X Tagen".
 *
 * Mit Alarm beginnen (etwa fuer die naechste Substanz) per `key`.
 */
export function ExpiredBadge({ daysSince }: { daysSince: number }) {
  const { t } = useTranslation()
  const since = expiredSinceLabel(t, daysSince)
  const text = 'col-start-1 row-start-1 whitespace-nowrap'

  return (
    <span
      data-expired-badge
      className="tyd-expired-badge inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-1 font-semibold text-red-300"
    >
      <AlertTriangle size={13} aria-hidden="true" className="tyd-expired-icon shrink-0 text-red-400" />
      <span className="sr-only">{String(t('my_stack_expired_aria', { since }))}</span>
      <span aria-hidden="true" className="grid">
        <span className={`${text} tyd-expired-text-alarm`}>{String(t('my_stack_expired'))}</span>
        <span className={`${text} tyd-expired-text-since tabular-nums`}>{since}</span>
      </span>
    </span>
  )
}
