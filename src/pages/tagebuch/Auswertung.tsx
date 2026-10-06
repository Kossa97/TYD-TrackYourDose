import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, addDays } from 'date-fns'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, BarChart3, Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getDateLocale } from '../../i18n/dateLocales'
import { bySubstance, gapBins, rangeStart, timeline, weekNumber, type RangeKey, type StatsRow } from './stats'

/** Supabase liefert höchstens 1000 Zeilen pro Anfrage — „Alles" lädt seitenweise. */
const FETCH_PAGE = 1000
const RANGES: RangeKey[] = ['4w', '12w', 'all']
const RANGE_LABEL: Record<RangeKey, string> = { '4w': 'tagebuch_zeitraum_4w', '12w': 'tagebuch_zeitraum_12w', all: 'tagebuch_zeitraum_alles' }

const COLOR = { effects: 'var(--chart-effect)', sideEffects: 'var(--chart-side-effect)' } as const

interface ChartDatum {
  label: string
  /** Langform für Tooltip und Tabelle. */
  title: string
  effects: number
  sideEffects: number
  avgSeverity?: number | null
}

async function loadRows(userId: string, from: Date | null): Promise<StatsRow[]> {
  const rows: StatsRow[] = []
  for (let offset = 0; ; offset += FETCH_PAGE) {
    let query = supabase
      .from('effects')
      .select('type, severity, description, occurred_at, stack_item_id, stack_items(display_name), dose_logs(logged_at)')
      .eq('user_id', userId)
    if (from) query = query.gte('occurred_at', from.toISOString())
    const { data, error } = await query
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + FETCH_PAGE - 1)
    if (error) throw error
    rows.push(...((data ?? []) as unknown as StatsRow[]))
    if (!data || data.length < FETCH_PAGE) return rows
  }
}

function Legend() {
  const { t } = useTranslation()
  return (
    <div className="flex gap-4 text-xs text-slate-400" aria-hidden="true">
      {(['effects', 'sideEffects'] as const).map(key => (
        <span key={key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[key] }} />
          {t(key === 'effects' ? 'wirkungen' : 'nebenwirkungen')}
        </span>
      ))}
    </div>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDatum }> }) {
  const { t, i18n } = useTranslation()
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-lg">
      <p className="mb-1 font-semibold">{datum.title}</p>
      {(['effects', 'sideEffects'] as const).map(key => (
        <p key={key} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: COLOR[key] }} />
          {t(key === 'effects' ? 'wirkungen' : 'nebenwirkungen')}: <span className="tabular-nums">{datum[key]}</span>
        </p>
      ))}
      {datum.avgSeverity != null && (
        <p className="mt-1 text-slate-400">{t('tagebuch_avg_intensitaet')}: {datum.avgSeverity.toLocaleString(i18n.language, { minimumFractionDigits: 1 })}</p>
      )}
    </div>
  )
}

/** Gestapelte Balken Wirkung/Nebenwirkung, dazu eine Tabelle für Screenreader. */
function StackedBars({ data, caption }: { data: ChartDatum[]; caption: string }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="h-44" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--c-border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--c-border)' }}
              tick={{ fill: 'var(--c-text-muted)', fontSize: 11 }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40}
              tick={{ fill: 'var(--c-text-muted)', fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'var(--c-border)' }} content={<ChartTooltip />} isAnimationActive={false} />
            <Bar dataKey="effects" stackId="s" fill={COLOR.effects} stroke="var(--c-surface)" strokeWidth={2} maxBarSize={24} />
            <Bar dataKey="sideEffects" stackId="s" fill={COLOR.sideEffects} stroke="var(--c-surface)" strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('tagebuch_tabelle_zeitraum')}</th>
            <th scope="col">{t('wirkungen')}</th>
            <th scope="col">{t('nebenwirkungen')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map(datum => (
            <tr key={datum.title}>
              <th scope="row">{datum.title}</th>
              <td>{datum.effects}</td>
              <td>{datum.sideEffects}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/** `refreshKey` ändert sich, wenn ein Eintrag gespeichert oder gelöscht wurde. */
export function Auswertung({ userId, refreshKey }: { userId: string; refreshKey: number }) {
  const { t, i18n } = useTranslation()
  const locale = getDateLocale()
  const [range, setRange] = useState<RangeKey>('4w')
  // Ein Ergebnis gehört zu genau einem Zeitraum und Stand; alles andere gilt als „lädt".
  // „Jetzt" wird bei jedem Laden neu bestimmt — ein offener Reiter veraltet nicht.
  const [result, setResult] = useState<{
    range: RangeKey; refreshKey: number; rows: StatsRow[] | null; error: boolean; now: Date; from: Date | null
  } | null>(null)
  const current = result?.range === range && result.refreshKey === refreshKey ? result : null
  const rows = current?.rows ?? null
  const error = current?.error ?? false
  const now = current?.now
  const from = current?.from ?? null

  useEffect(() => {
    let cancelled = false
    const loadedAt = new Date()
    const start = rangeStart(range, loadedAt)
    const done = (loaded: StatsRow[] | null) => {
      if (!cancelled) setResult({ range, refreshKey, rows: loaded, error: !loaded, now: loadedAt, from: start })
    }
    loadRows(userId, start).then(done).catch(() => done(null))
    return () => { cancelled = true }
  }, [userId, range, refreshKey])

  const verlauf = useMemo(() => {
    if (!rows || !now) return null
    // Einträge mit Datum in der Zukunft zählen mit: der Verlauf reicht bis zum spätesten.
    const latest = rows.reduce((max, row) => Math.max(max, new Date(row.occurred_at).getTime()), now.getTime())
    const { unit, buckets } = timeline(rows, from, new Date(latest))
    return {
      unit,
      data: buckets.map<ChartDatum>(bucket => unit === 'week'
        ? {
          label: t('tagebuch_woche_label', { kw: weekNumber(bucket.start) }),
          title: `${t('tagebuch_woche_label', { kw: weekNumber(bucket.start) })} · ${format(bucket.start, 'dd.MM.', { locale })}–${format(addDays(bucket.start, 6), 'dd.MM.yyyy', { locale })}`,
          effects: bucket.effects, sideEffects: bucket.sideEffects, avgSeverity: bucket.avgSeverity,
        }
        : {
          label: format(bucket.start, 'MMM yy', { locale }),
          title: format(bucket.start, 'MMMM yyyy', { locale }),
          effects: bucket.effects, sideEffects: bucket.sideEffects, avgSeverity: bucket.avgSeverity,
        }),
    }
  }, [rows, from, now, t, locale])

  const abstand = useMemo(() => {
    if (!rows) return null
    const { bins, linked } = gapBins(rows)
    return { linked, data: bins.map<ChartDatum>(bin => ({ label: t(bin.key), title: t(bin.key), effects: bin.effects, sideEffects: bin.sideEffects })) }
  }, [rows, t])

  const substanzen = useMemo(() => (rows ? bySubstance(rows) : []), [rows])

  return (
    <div className="space-y-4" data-tagebuch-auswertung>
      <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1" role="group" aria-label={t('tagebuch_zeitraum')}>
        {RANGES.map(key => (
          <button key={key} type="button" aria-pressed={range === key} onClick={() => setRange(key)}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              range === key ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}>
            {t(RANGE_LABEL[key])}
          </button>
        ))}
      </div>

      <p className="flex gap-2 text-xs text-slate-500">
        <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        {t('tagebuch_hinweis')}
      </p>

      {error ? (
        <div className="card text-center py-10 text-slate-500" role="alert">
          <AlertTriangle size={32} aria-hidden="true" className="mx-auto mb-2 text-amber-400 opacity-70" />
          <p>{t('tagebuch_auswertung_fehler')}</p>
        </div>
      ) : rows === null ? (
        <div className="card h-44 animate-pulse" aria-busy="true" />
      ) : rows.length === 0 ? (
        <div className="card text-center py-10 text-slate-500">
          <BarChart3 size={32} aria-hidden="true" className="mx-auto mb-2 opacity-40" />
          <p>{t('tagebuch_auswertung_leer')}</p>
        </div>
      ) : (
        <>
          <section className="card space-y-3" aria-labelledby="tagebuch-verlauf-titel">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="tagebuch-verlauf-titel" className="font-semibold">
                {t(verlauf!.unit === 'week' ? 'tagebuch_verlauf_titel' : 'tagebuch_verlauf_titel_monat')}
              </h2>
              <Legend />
            </div>
            <StackedBars data={verlauf!.data} caption={t(verlauf!.unit === 'week' ? 'tagebuch_verlauf_titel' : 'tagebuch_verlauf_titel_monat')} />
          </section>

          <section className="card space-y-3" aria-labelledby="tagebuch-abstand-titel">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 id="tagebuch-abstand-titel" className="font-semibold">{t('tagebuch_abstand_titel')}</h2>
                <p className="text-xs text-slate-500">{t('tagebuch_abstand_untertitel', { n: abstand!.linked })}</p>
              </div>
              {abstand!.linked > 0 && <Legend />}
            </div>
            {abstand!.linked > 0
              ? <StackedBars data={abstand!.data} caption={t('tagebuch_abstand_titel')} />
              : <p className="text-sm text-slate-500">{t('tagebuch_abstand_leer')}</p>}
          </section>

          <section className="card" aria-labelledby="tagebuch-substanz-titel">
            <h2 id="tagebuch-substanz-titel" className="font-semibold mb-2">{t('tagebuch_substanz_titel')}</h2>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm" data-tagebuch-substanzen>
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th scope="col" className="px-1 py-1.5 font-medium">{t('tagebuch_spalte_substanz')}</th>
                    {(['effects', 'sideEffects'] as const).map(key => (
                      <th key={key} scope="col" className="px-1 py-1.5 font-medium text-right whitespace-nowrap">
                        <span className="sr-only">{t(key === 'effects' ? 'wirkungen' : 'nebenwirkungen')}</span>
                        <span aria-hidden="true" className="inline-flex flex-col items-end gap-1">
                          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[key] }} />
                          {t(key === 'effects' ? 'tagebuch_spalte_wirkung_kurz' : 'tagebuch_spalte_neben_kurz')}
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="px-1 py-1.5 font-medium text-right">{t('tagebuch_avg_intensitaet')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {substanzen.map(stat => (
                    <Fragment key={stat.id ?? '-'}>
                      <tr className="border-t border-slate-800 align-top">
                        <th scope="row" id={`tagebuch-substanz-${stat.id ?? 'ohne'}`} className={`px-1 text-left font-medium text-slate-200 ${stat.topSideEffect ? 'pt-2' : 'py-2'}`}>
                          {stat.name ?? t('tagebuch_ohne_substanz')}
                        </th>
                        <td className="px-1 pt-2 text-right">{stat.effects}</td>
                        <td className="px-1 pt-2 text-right">{stat.sideEffects}</td>
                        <td className="px-1 pt-2 text-right">{stat.avgSeverity.toLocaleString(i18n.language, { minimumFractionDigits: 1 })}</td>
                      </tr>
                      {/* Häufigste Nebenwirkung über die volle Breite — als eigene Spalte passte sie auf kleinen Handys nicht */}
                      {stat.topSideEffect && (
                        <tr>
                          <td colSpan={4} headers={`tagebuch-substanz-${stat.id ?? 'ohne'}`} className="px-1 pb-2 text-xs text-slate-400 break-words">
                            {t('tagebuch_haeufigste_zeile', { text: stat.topSideEffect.text, count: stat.topSideEffect.count })}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
