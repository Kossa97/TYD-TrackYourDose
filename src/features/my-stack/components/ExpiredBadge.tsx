import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type Translate = (key: string, options?: Record<string, unknown>) => unknown

/** „seit heute", „seit 1 Tag", „seit 5 Tagen" — in Kalendertagen. */
function expiredSinceLabel(t: Translate, daysSince: number): string {
  if (daysSince <= 0) return String(t('my_stack_expired_since_today'))
  if (daysSince === 1) return String(t('my_stack_expired_since_day'))
  return String(t('my_stack_expired_since_days', { n: daysSince }))
}

function magBewegung(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Abgelaufen: erst ein Alarm, dann wie lange schon.
 *
 * Beim Erscheinen blinkt das Warnsymbol, das Abzeichen glueht mit. Ist der
 * Alarm durch (`animationend` — wie lange er dauert, sagt allein das CSS),
 * geht „Abgelaufen!" weich in „seit 3 Tagen" ueber; das Warnsymbol bleibt und
 * pulsiert ruhig weiter, damit es nicht nur die Farbe ist, die warnt. Beide
 * Texte liegen uebereinander, damit das Abzeichen beim Wechsel nicht springt.
 * Vorgelesen wird immer beides zusammen. Wer weniger Bewegung will, sieht
 * gleich den Endstand.
 *
 * Neu starten (etwa fuer die naechste Substanz) per `key`.
 */
export function ExpiredBadge({ daysSince }: { daysSince: number }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'alarm' | 'seit'>(() => (magBewegung() ? 'alarm' : 'seit'))

  const since = expiredSinceLabel(t, daysSince)
  const alarm = phase === 'alarm'
  const text = 'col-start-1 row-start-1 whitespace-nowrap transition-[opacity,transform,filter] duration-500 ease-out motion-reduce:transition-none'

  return (
    <span
      data-expired-badge={phase}
      className={`inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-1 font-semibold text-red-300 ${alarm ? 'tyd-expired-badge-alarm' : ''}`}
    >
      <AlertTriangle
        size={13}
        aria-hidden="true"
        onAnimationEnd={() => { if (alarm) setPhase('seit') }}
        className={`shrink-0 text-red-400 ${alarm ? 'tyd-expired-icon-alarm' : 'tyd-expired-icon-calm'}`}
      />
      <span className="sr-only">{String(t('my_stack_expired_aria', { since }))}</span>
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
