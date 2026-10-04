import { useTranslation } from 'react-i18next'
import { ExpiredBadge } from '../components/ExpiredBadge'
import { ABLAUF_BALD_TAGE } from '../lib/listRow'
import { expiryText } from './model'

/**
 * Die Haltbarkeit als Abzeichen — dasselbe im Karussell und in der Liste:
 * gruen „Haltbar noch n Tage", ab sieben Tagen gelb, heute „Läuft heute ab",
 * abgelaufen das wechselnde Alarm-Abzeichen. Ohne Angabe „Nicht gesetzt".
 *
 * `tage` kommt aus `haltbarkeitFuer` (Kalendertage, negativ = abgelaufen).
 * `substanzId` laesst den Alarm-Takt je Substanz neu beginnen.
 * Die Farben fuer das helle Design stehen in index.css (`data-haltbarkeit`).
 */
export function HaltbarkeitChip({ tage, substanzId }: { tage: number | null; substanzId: string }) {
  const { t } = useTranslation()
  if (tage !== null && tage < 0) return <ExpiredBadge key={substanzId} daysSince={-tage} />

  const ton = tage === null ? 'leer' : tage > ABLAUF_BALD_TAGE ? 'gut' : 'bald'
  const klasse = {
    leer: 'border-slate-700 bg-slate-900 text-slate-300',
    gut: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    bald: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  }[ton]
  return (
    <span data-haltbarkeit={ton} className={`whitespace-nowrap rounded-full border px-2.5 py-1 font-semibold ${klasse}`}>
      {tage === null
        ? t('peptide_form_not_set', { defaultValue: 'Nicht gesetzt' })
        : expiryText(t, tage)}
    </span>
  )
}
