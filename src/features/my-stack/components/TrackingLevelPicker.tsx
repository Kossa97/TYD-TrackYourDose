import { useId } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TrackingLevel } from '../types'

export interface TrackingLevelPickerProps {
  value: TrackingLevel | null
  substanceName: string
  pkProfileAvailable: boolean
  error?: boolean
  onChange: (value: TrackingLevel) => void
}

const LEVELS: readonly TrackingLevel[] = ['intake_only', 'with_amount', 'complete']

// Zwei Dosen, schematisch: Anstieg, Abfall, und die zweite Dosis setzt auf
// einem Spiegel auf, der noch nicht bei null ist — deshalb der hoehere zweite
// Gipfel. Die Punkte sitzen auf der Kurve dort, wo die Dosis faellt.
const KURVE = 'M 8,56 L 30,56 C 44,56 54,26 70,24 C 92,22 118,36 140,41 C 154,40 162,14 180,12 C 206,10 250,26 292,33'
const EINNAHMEN: ReadonlyArray<readonly [number, number]> = [[30, 56], [140, 41]]

// Drei Stufen nebeneinander statt drei Kaesten untereinander: so ist die
// Steigerung raeumlich sichtbar — links wenig, rechts viel —, und der Schritt
// belegt keinen ganzen Bildschirm mehr fuer eine Wahl, die man jederzeit
// aendern kann.
//
// Darunter steht nicht noch mehr Prosa, sondern das Ergebnis: ein Eintrag, wie
// er nachher aussieht. Das ist dieselbe Sprache, die das Formular ueberall
// sonst spricht (die Buehnenform ueber dem Formular, das Farbfeld) — und der
// Unterschied zwischen den Stufen ist in drei Zeilen gezeigt statt in zwoelf
// erklaert.
export function TrackingLevelPicker({
  value,
  substanceName,
  pkProfileAvailable,
  error = false,
  onChange,
}: TrackingLevelPickerProps) {
  const { t } = useTranslation()
  // Eigene Kennung fuer den Verlauf: eine feste id kollidiert, sobald zwei
  // Picker gleichzeitig im Dokument stehen — dann faerbt der eine den anderen.
  const uid = useId()
  const name = substanceName.trim() || String(t('my_stack_this_substance', { defaultValue: 'diese Substanz' }))

  const content = {
    intake_only: {
      title: t('my_stack_tracking_intake_only_title', { defaultValue: 'Einfach' }),
      subtitle: t('my_stack_tracking_intake_only_subtitle', { defaultValue: 'Nur Einnahme' }),
      recorded: t('my_stack_tracking_intake_only_recorded', {
        defaultValue: 'Du hakst ab, dass du {{substanceName}} genommen hast. Mehr wird nicht gefragt.',
        substanceName: name,
      }),
      // Kein Detail — genau das ist die Aussage dieser Stufe.
      entry: '',
    },
    with_amount: {
      title: t('my_stack_tracking_with_amount_title', { defaultValue: 'Genau' }),
      subtitle: t('my_stack_tracking_with_amount_subtitle', { defaultValue: 'Mit Menge' }),
      recorded: t('my_stack_tracking_with_amount_recorded', {
        defaultValue: 'Zusätzlich, wie viel du genommen hast. Damit lässt sich der Verlauf deiner Dosis auswerten.',
      }),
      entry: t('my_stack_tracking_with_amount_entry', { defaultValue: '1 Kapsel' }),
    },
    complete: {
      title: t('my_stack_tracking_complete_title', { defaultValue: 'Gründlich' }),
      subtitle: t('my_stack_tracking_complete_subtitle', { defaultValue: 'Mit Wirkstärke' }),
      recorded: t('my_stack_tracking_complete_recorded', {
        defaultValue: 'Zusätzlich, wie viel Wirkstoff in einer Einheit steckt. Damit rechnet die App in Milligramm statt in Kapseln — und weiß, wie viel davon zu jeder Stunde noch in dir ist.',
      }),
      entry: t('my_stack_tracking_complete_entry', { defaultValue: '1 Kapsel · 5.000 IU' }),
    },
  } as const

  const caption = t('my_stack_tracking_entry_caption', { defaultValue: 'So sähe eine Einnahme aus' })

  // Ein Eintrag, wie ihn der Stack zeigt: Haken, Name, und was die Stufe
  // zusaetzlich festhaelt.
  const eintrag = (level: TrackingLevel, gedaempft: boolean) => (
    <span
      data-tracking-entry={level}
      className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors duration-200 motion-reduce:transition-none ${gedaempft
        ? 'border-slate-400/20 bg-slate-400/[0.07] text-slate-400'
        : 'border-[color:var(--accent-border)] bg-[color:var(--accent-weak)] text-slate-100'
      }`}
    >
      <Check
        aria-hidden="true"
        size={14}
        className={`shrink-0 ${gedaempft ? 'text-slate-500' : 'text-[color:var(--accent)]'}`}
      />
      <span className="min-w-0 truncate font-medium">{name}</span>
      {content[level].entry && (
        <>
          <span aria-hidden="true" className="text-slate-500">·</span>
          <span className="min-w-0 truncate">{content[level].entry}</span>
        </>
      )}
    </span>
  )

  // Was die tiefste Stufe eintraegt, sieht man oben im Beispieleintrag. Was
  // sie einem dafuer gibt, sah man bisher nirgends — es stand nur als Wort da
  // („Blutspiegel-Kurve"). Hier ist es als Bild: zwei Einnahmen, dazwischen
  // der gerechnete Verlauf. Schematisch und als Beispiel ausgewiesen, keine
  // Zahlen — es ist die Form der Aussage, nicht eine Vorhersage.
  //
  // Dieselbe Bildsprache wie der echte Live-Spiegel (`LiveBlutspiegelChart`):
  // Akzentlinie ueber einer nach unten auslaufenden Flaeche, gruene Punkte auf
  // den Einnahmen.
  const kurve = (
    <figure data-tracking-curve className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <figcaption className="flex items-baseline justify-between gap-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span>{t('my_stack_tracking_curve_caption', { defaultValue: 'So entsteht der Live-Spiegel' })}</span>
        <span className="shrink-0">{t('my_stack_tracking_curve_example', { defaultValue: 'Beispiel' })}</span>
      </figcaption>
      {/* Gleichmaessig skaliert (kein `preserveAspectRatio="none"`): sonst
          zieht die Breite die Einnahme-Punkte zu Ellipsen. Das Seitenverhaeltnis
          steht als Klasse da, damit die Hoehe nicht vom Browser geraten wird. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 300 64"
        className="mt-2 block aspect-[300/64] w-full"
      >
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grundlinie: ohne sie schwebt die Kurve im Nichts. */}
        <line x1="8" y1="56" x2="292" y2="56" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        <path
          d={`${KURVE} L 292,56 L 8,56 Z`}
          fill={`url(#${uid}-fill)`}
        />
        <path
          d={KURVE}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Die zwei Einnahmen. Die zweite faellt auf einen Spiegel, der noch
            nicht bei null ist — genau das ist die Aussage der Kurve. */}
        {EINNAHMEN.map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="3.5" fill="#10b981" stroke="#0b1017" strokeWidth="1.5" />
        ))}
      </svg>
      <p data-tracking-card="curve-explained" className="mt-2 text-[13px] leading-snug text-slate-300">
        {t('my_stack_tracking_curve_explained', {
          defaultValue: 'Aus Wirkstärke, Uhrzeit und dem PK-Profil der Substanz — ihrer hinterlegten Aufnahme- und Abbaugeschwindigkeit — rechnet die App den Verlauf zwischen den Einnahmen.',
        })}
      </p>
    </figure>
  )

  return (
    <fieldset
      data-field="trackingLevel"
      tabIndex={-1}
      aria-invalid={error || undefined}
      aria-describedby={error ? 'stack-tracking-level-error' : undefined}
      className="min-w-0"
    >
      <legend className="text-base font-semibold text-white">
        {t('my_stack_tracking_question', { defaultValue: 'Wie genau möchtest du tracken?' })}
      </legend>
      <p className="mt-1 text-[13px] leading-snug text-slate-400">
        {t('my_stack_tracking_intro', {
          defaultValue: 'Wähle nur die Tiefe, die du im Alltag zuverlässig pflegen möchtest.',
        })}
      </p>

      {/* Die Reihe. Echte Radios darunter, nur unsichtbar: die Tastatur und
          der Screenreader bekommen dieselbe Gruppe wie vorher, das Auge eine
          Skala statt eines Stapels. */}
      <div
        data-tracking-segments
        className={`mt-3 grid grid-cols-3 gap-1 rounded-xl border p-1 ${error
          ? 'border-rose-400/50 bg-rose-400/[0.06]'
          : 'border-white/10 bg-white/[0.035]'
        }`}
      >
        {LEVELS.map(level => {
          const selected = value === level
          return (
            <label
              key={level}
              className={`flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-lg px-1 text-center text-[13px] font-semibold transition-colors duration-200 focus-within:ring-2 focus-within:ring-sky-400 motion-reduce:transition-none ${selected
                ? 'border border-[color:var(--accent-border)] bg-[color:var(--accent-weak)] text-[color:var(--accent)] shadow-[0_0_18px_rgba(0,204,245,0.10)]'
                : 'border border-transparent text-slate-400 hover:bg-slate-400/[0.08]'
              }`}
            >
              <input
                type="radio"
                name="stack-tracking-level"
                value={level}
                checked={selected}
                onChange={() => onChange(level)}
                required
                className="sr-only"
              />
              <span className="min-w-0 break-words">{content[level].title}</span>
            </label>
          )
        })}
      </div>

      {/* Vor der Wahl der Vergleich, danach die eine Stufe. Beides zeigt
          dasselbe: was am Ende im Stack steht. Ein leerer Kasten mit der
          Aufforderung „waehle etwas“ wuerde nichts erklaeren. */}
      <div data-tracking-preview className="mt-3">
        <p className="flex items-baseline justify-between gap-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <span>{caption}</span>
          {value !== null && (
            <span data-tracking-card="subtitle" className="shrink-0 text-slate-400">
              {content[value].subtitle}
            </span>
          )}
        </p>

        {value === null ? (
          <div className="mt-2 grid gap-1.5">
            {LEVELS.map(level => (
              <span key={level} className="flex min-w-0 items-center gap-2.5">
                <span className="w-[68px] shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  {content[level].title}
                </span>
                {eintrag(level, true)}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {eintrag(value, false)}
            <p data-tracking-card="recorded" className="text-[13px] leading-snug text-slate-300">
              {content[value].recorded}
            </p>
            {value === 'complete' && kurve}
            {value === 'complete' && (
              <p data-tracking-card="pk" className="text-[13px] leading-snug text-[color:var(--accent)]">
                {pkProfileAvailable
                  ? t('my_stack_tracking_pk_available', {
                      defaultValue: 'Für {{substanceName}} ist ein PK-Profil verfügbar. Eine Kurve erscheint nur bei vollständigen Pflichtangaben.',
                      substanceName: name,
                    })
                  : t('my_stack_tracking_pk_unavailable', {
                      defaultValue: 'Für {{substanceName}} ist derzeit kein PK-Profil verknüpft; die Stufe lässt sich trotzdem wählen.',
                      substanceName: name,
                    })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Beide Saetze einmal unter der Gruppe: sie gelten der Wahl, nicht
          einer einzelnen Stufe. */}
      <p className="mt-3 text-xs text-slate-500">
        {t('my_stack_tracking_promise', {
          defaultValue: 'Was eine Stufe nicht erfasst, fragt die App auch später nicht ab.',
        })}
        {' '}
        {t('my_stack_tracking_change_later', {
          defaultValue: 'Du kannst diese Auswahl später jederzeit ändern.',
        })}
      </p>

      {error && (
        <p id="stack-tracking-level-error" role="alert" className="mt-3 text-sm text-rose-300">
          {t('my_stack_tracking_level_required', {
            defaultValue: 'Bitte wähle eine Tracking-Tiefe.',
          })}
        </p>
      )}
    </fieldset>
  )
}
