import { useTranslation } from 'react-i18next'
import type { ZyklusZeile } from '../lib/zyklusZeilen'
import { formatDisplayDate } from '../lib/format'
import { MUTED, TEXT } from '../styles'

/** Linker Rand der Plotflaeche im Verlauf (Breite der y-Achse) und rechter Rand. */
export const PLOT_LINKS = 40
export const PLOT_RECHTS = 8

/**
 * Die Zyklen aus My Stack unter dem Verlauf eines Markers — je Substanz eine
 * Zeile mit Namen, die Abschnitte auf derselben Zeitachse wie das Diagramm.
 * Der Name steht an jeder Zeile: Farbe ist nie das einzige Merkmal.
 */
export function ZyklusStreifen({ zeilen, weitere }: { zeilen: ZyklusZeile[]; weitere: number }) {
  const { t } = useTranslation()
  if (zeilen.length === 0) return null

  const zeitraum = (von: string, bis: string | null) =>
    t('bw_cycles_period', { from: formatDisplayDate(von), to: bis ? formatDisplayDate(bis) : t('bw_cycles_running') })

  return (
    <div data-cycle-strip className="mt-3" style={{ marginLeft: PLOT_LINKS, marginRight: PLOT_RECHTS }}>
      <p className="text-[0.65rem] uppercase tracking-wide mb-2" style={{ color: MUTED }}>{t('bw_cycles_title')}</p>
      <ul className="flex flex-col gap-2">
        {zeilen.map(zeile => (
          <li key={zeile.stackItemId} data-cycle-row={zeile.substanz}>
            <p className="text-xs font-semibold mb-1 truncate" style={{ color: TEXT }}>{zeile.substanz}</p>
            <div className="relative h-2.5 rounded-full" style={{ background: 'var(--border)' }}>
              {zeile.abschnitte.map(abschnitt => (
                <span
                  key={abschnitt.cycleId}
                  role="img"
                  aria-label={`${zeile.substanz}: ${zeitraum(abschnitt.von, abschnitt.bis)}`}
                  title={`${zeile.substanz}: ${zeitraum(abschnitt.von, abschnitt.bis)}`}
                  className="absolute inset-y-0"
                  style={{
                    left: `${abschnitt.start * 100}%`,
                    // Mindestens sichtbar, auch bei einem einzelnen Tag in einem Jahr.
                    width: `max(${(abschnitt.ende - abschnitt.start) * 100}%, 4px)`,
                    background: zeile.farbe != null ? `var(--cycle-${zeile.farbe + 1})` : 'var(--text-muted)',
                    // Laufender Zyklus: rechts offen statt abgerundet.
                    borderRadius: abschnitt.bis ? 4 : '4px 0 0 4px',
                  }}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      {weitere > 0 && <p className="text-xs mt-2" style={{ color: MUTED }}>{t('bw_cycles_more', { count: weitere })}</p>}
      <p className="text-[0.7rem] mt-2 leading-snug" style={{ color: MUTED }}>{t('bw_cycles_hint')}</p>
    </div>
  )
}
