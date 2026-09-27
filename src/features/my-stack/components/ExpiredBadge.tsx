import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** So lange dauert der Alarm: vier Blinker zu je 0,7 s. */
const ALARM_MS = 2800

/** „seit heute", „seit 1 Tag", „seit 5 Tagen". */
function expiredSinceLabel(t: (key: string, options?: Record<string, unknown>) => unknown, daysSince: number): string {
  if (daysSince <= 0) return String(t('my_stack_expired_since_today'))
  if (daysSince === 1) return String(t('my_stack_expired_since_one'))
  return String(t('my_stack_expired_since_many', { n: daysSince }))
}

/**
 * Abgelaufen: erst ein Alarm, dann wie lange schon.
 *
 * Beim Erscheinen blinkt das Warnsymbol viermal, das Abzeichen glueht mit.
 * Danach geht „Abgelaufen!" weich in „seit 3 Tagen" ueber; das Symbol pulsiert
 * weiter, ruhig und selten — die Farbe sagt ohnehin, was los ist. Beide Texte
 * liegen uebereinander, damit das Abzeichen beim Wechsel nicht springt.
 * Vorgelesen wird immer beides zusammen.
 *
 * Neu starten (etwa fuer die naechste Substanz) per `key`.
 */
export function ExpiredBadge({ daysSince }: { daysSince: number }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'alarm' | 'seit'>('alarm')

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase('seit'), ALARM_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const since = expiredSinceLabel(t, daysSince)
  const alarm = phase === 'alarm'
  const text = 'col-start-1 row-start-1 whitespace-nowrap transition-[opacity,transform,filter] duration-500 ease-out motion-reduce:transition-none'

  return (
    <span
      data-expired-badge={phase}
      role="status"
      aria-label={String(t('my_stack_expired_aria', { since }))}
      className={`inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-1 font-semibold text-red-300 ${alarm ? 'tyd-expired-badge-alarm' : ''}`}
    >
      <AlertTriangle
        size={13}
        aria-hidden="true"
        className={`shrink-0 text-red-400 ${alarm ? 'tyd-expired-icon-alarm' : 'tyd-expired-icon-calm'}`}
      />
      <span aria-hidden="true" className="grid">
        <span className={`${text} ${alarm ? 'translate-y-0 opacity-100 blur-0' : '-translate-y-1.5 opacity-0 blur-[3px]'}`}>
          {String(t('my_stack_expired'))}
        </span>
        <span className={`${text} tabular-nums ${alarm ? 'translate-y-1.5 opacity-0 blur-[3px]' : 'translate-y-0 opacity-100 blur-0'}`}>
          {since}
        </span>
      </span>
    </span>
  )
}
