import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { format, parseISO, subDays, differenceInCalendarDays } from 'date-fns'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Link2,
  Scale,
  TestTube2,
  XCircle,
} from 'lucide-react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { jsPDF as JsPDFType } from 'jspdf'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  effectsByPeptide,
  reviewsByPeptide,
  topSideEffects,
  type EffectRow,
  type ReviewRow,
} from '../lib/insights'
import {
  isWellnessMarker,
  wellnessMarkersWithData,
  wellnessSeries,
  WELLNESS_MARKER_FIELD,
  type DailyLogRow,
} from '../lib/dailyLogs'
import { ResearchDisclaimer } from '../components/ui/DesignSystem'
import heroLogo from '../assets/hero.png'

interface DateRange {
  from: string
  to: string
}

interface WeightLog {
  id: string
  logged_at: string
  weight_kg: number | string
}

interface BloodworkEntry {
  id: string
  tested_at: string
  marker: string
  value: number | string
  unit: string
  notes: string | null
}

interface DoseLog {
  id: string
  peptide_id: string | null
  logged_at: string
  taken: boolean | null
}

interface Cycle {
  id: string
  peptide_id: string
  name: string
  start_date: string
  end_date: string | null
  active: boolean
  peptides: { name: string } | null
}

type SupabaseCycleRow = Omit<Cycle, 'peptides'> & {
  peptides: { name: string } | { name: string }[] | null
}

interface Profile {
  display_name: string | null
  username: string | null
}

interface ProtocolCopy {
  title: string
  subtitle: string
  currentCycle: string
  customRange: string
  from: string
  to: string
  period: string
  activeCycles: string
  noActiveCycle: string
  charts: string
  weightTitle: string
  bloodworkTitle: string
  adherenceTitle: string
  marker: string
  bloodworkTable: string
  previousCycles: string
  noPreviousCycles: string
  duration: string
  days: string
  adherenceRate: string
  generatePdf: string
  generatingPdf: string
  share: string
  copied: string
  exportError: string
  loading: string
  emptyChart: string
  takenDays: string
  missedDays: string
  user: string
  exportedAt: string
  coverTitle: string
  researchExportHint: string
}

const COPY: Record<'de' | 'en', ProtocolCopy> = {
  de: {
    title: 'Protokoll',
    subtitle: 'Deine Auswertungen',
    currentCycle: 'Aktueller Zyklus',
    customRange: 'Eigener Zeitraum',
    from: 'Von',
    to: 'Bis',
    period: 'Zeitraum',
    activeCycles: 'Aktive Zyklen',
    noActiveCycle: 'Kein aktiver Zyklus - die letzten 30 Tage werden angezeigt.',
    charts: 'Diagramme',
    weightTitle: 'Gewichtsverlauf',
    bloodworkTitle: 'Blutwerte',
    adherenceTitle: 'Einnahme-Adherence',
    marker: 'Marker',
    bloodworkTable: 'Tabelle der Blutwerte',
    previousCycles: 'Vergangene Zyklen',
    noPreviousCycles: 'Noch keine abgeschlossenen Zyklen.',
    duration: 'Dauer',
    days: 'Tage',
    adherenceRate: 'Adherence',
    generatePdf: 'PDF generieren',
    generatingPdf: 'PDF wird erstellt...',
    share: 'Share-Link',
    copied: 'Link kopiert!',
    exportError: 'PDF konnte nicht erstellt werden',
    loading: 'Daten werden geladen...',
    emptyChart: 'Keine Daten im gewählten Zeitraum.',
    takenDays: 'Tage mit ✓',
    missedDays: 'Tage mit ✗',
    user: 'Name',
    exportedAt: 'Datum',
    coverTitle: 'TYD Protokoll',
    researchExportHint: 'PDF-Export = Research-Protokoll für deine Dokumentation',
  },
  en: {
    title: 'Protocol',
    subtitle: 'Your analytics',
    currentCycle: 'Current cycle',
    customRange: 'Custom period',
    from: 'From',
    to: 'To',
    period: 'Period',
    activeCycles: 'Active cycles',
    noActiveCycle: 'No active cycle - showing the last 30 days.',
    charts: 'Charts',
    weightTitle: 'Weight trend',
    bloodworkTitle: 'Bloodwork',
    adherenceTitle: 'Dose adherence',
    marker: 'Marker',
    bloodworkTable: 'Bloodwork table',
    previousCycles: 'Previous cycles',
    noPreviousCycles: 'No completed cycles yet.',
    duration: 'Duration',
    days: 'days',
    adherenceRate: 'Adherence',
    generatePdf: 'Generate PDF',
    generatingPdf: 'Generating PDF...',
    share: 'Share link',
    copied: 'Link copied!',
    exportError: 'Could not create PDF',
    loading: 'Loading data...',
    emptyChart: 'No data in the selected period.',
    takenDays: 'Days with ✓',
    missedDays: 'Days with ✗',
    user: 'Name',
    exportedAt: 'Date',
    coverTitle: 'TYD Protocol',
    researchExportHint: 'PDF export = research protocol for your documentation',
  },
}

// ─── Design constants ────────────────────────────────────────────────────────

const NORMAL_RANGES: Record<string, { min: number | null; max: number | null }> = {
  'IGF-1':       { min: 100,  max: 300  },
  'Testosteron': { min: 264,  max: 916  },
  'Östradiol':   { min: 10,   max: 40   },
  'SHBG':        { min: 10,   max: 57   },
  'LH':          { min: 1.5,  max: 9.3  },
  'FSH':         { min: 1.5,  max: 12.4 },
  'TSH':         { min: 0.4,  max: 4.0  },
  'CRP':         { min: 0,    max: 5.0  },
  'Vitamin D':   { min: 30,   max: 100  },
  'Ferritin':    { min: 30,   max: 400  },
  'Hämoglobin':  { min: 13.5, max: 17.5 },
  'Hematokrit':  { min: 40,   max: 52   },
  'GH':          { min: 0,    max: 3.0  },
  'Kortisol':    { min: 6,    max: 23   },
  'Insulin':     { min: 2,    max: 25   },
  'Energie':     { min: 1,    max: 5    },
  'Schlaf':      { min: 1,    max: 5    },
  'Libido':      { min: 1,    max: 5    },
}

const SERIES_COLORS: Record<string, string> = {
  'Gewicht':     '#00ccf5',
  'IGF-1':       '#8b5cf6',
  'CRP':         '#10b981',
  'Testosteron': '#f59e0b',
  'Insulin':     '#f43f5e',
  'Vitamin D':   '#38bdf8',
  'Östradiol':   '#a78bfa',
  'TSH':         '#34d399',
  'Hämoglobin':  '#fb923c',
  'Hematokrit':  '#e879f9',
  'GH':          '#67e8f9',
  'Kortisol':    '#fde68a',
  'Ferritin':    '#86efac',
  'SHBG':        '#c084fc',
  'LH':          '#f472b6',
  'FSH':         '#94a3b8',
  'Energie':     '#00ccf5',
  'Schlaf':      '#6366f1',
  'Libido':      '#f43f5e',
}

const PRESETS: { key: string; label: string; markers: string[] }[] = [
  { key: 'weight-igf1',  label: '⚖️ Gewicht + IGF-1',  markers: ['Gewicht', 'IGF-1'] },
  { key: 'gh-panel',     label: '💉 GH-Panel',          markers: ['Gewicht', 'IGF-1', 'Vitamin D'] },
  { key: 'inflammation', label: '🔥 Entzündung',        markers: ['Gewicht', 'CRP'] },
  { key: 'metabolismus', label: '🧬 Metabolismus',      markers: ['Gewicht', 'Insulin'] },
  { key: 'hormone',      label: '⚗️ Hormone',           markers: ['Testosteron', 'IGF-1', 'Insulin'] },
  { key: 'wellness',     label: '⚡ Befinden',           markers: ['Energie', 'Schlaf', 'Libido'] },
  { key: 'full',         label: '📊 Alle Marker',       markers: [] },
]

const CYCLE_COLORS = ['#00ccf5', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#38bdf8']

function getSeriesColor(marker: string): string {
  return SERIES_COLORS[marker] ?? '#00ccf5'
}

function getNormalRange(marker: string): { min: number | null; max: number | null } {
  return NORMAL_RANGES[marker] ?? { min: null, max: null }
}

function toPercentChange(entries: { date: string; value: number }[]): { date: string; pct: number }[] {
  if (entries.length === 0) return []
  const first = entries[0].value
  if (first === 0) return entries.map(e => ({ date: e.date, pct: 0 }))
  return entries.map(e => ({
    date: e.date,
    pct: Math.round(((e.value - first) / Math.abs(first)) * 1000) / 10,
  }))
}

function interpolatePct(date: string, anchors: { date: string; pct: number }[]): number | undefined {
  if (anchors.length === 0) return undefined
  if (date <= anchors[0].date) return anchors[0].pct
  if (date >= anchors[anchors.length - 1].date) return anchors[anchors.length - 1].pct
  for (let i = 0; i < anchors.length - 1; i++) {
    if (date >= anchors[i].date && date <= anchors[i + 1].date) {
      const span = anchors[i + 1].date.localeCompare(anchors[i].date)
      const t = span > 0 ? date.localeCompare(anchors[i].date) / span : 0
      return Math.round((anchors[i].pct + t * (anchors[i + 1].pct - anchors[i].pct)) * 10) / 10
    }
  }
  return undefined
}

function gradId(marker: string): string {
  return `grad-${marker.replace(/[^a-zA-Z0-9]/g, '')}`
}

const FOOTER_TEXT = 'Track Your Dose · tyd-track-your-dose.vercel.app'
const SHARE_URL = 'https://tyd-track-your-dose.vercel.app/protokoll?ref=share'

type JsPdfWithGState = JsPDFType & {
  GState?: new (options: { opacity: number }) => unknown
  setGState?: (state: unknown) => JsPDFType
  saveGraphicsState?: () => JsPDFType
  restoreGraphicsState?: () => JsPDFType
}

function copyFor(language: string): ProtocolCopy {
  return language.toLowerCase().startsWith('en') ? COPY.en : COPY.de
}

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd')
}

function defaultRange(): DateRange {
  return {
    from: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    to: todayIso(),
  }
}

function toDate(value: string) {
  return value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`)
}

function dateKey(value: string) {
  return format(toDate(value), 'yyyy-MM-dd')
}

function numericValue(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function isValidRange(range: DateRange) {
  return Boolean(range.from && range.to && range.from <= range.to)
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(toDate(value))
}

function formatNumber(value: number, language: string, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(language, { maximumFractionDigits }).format(value)
}

function formatTooltipValue(value: unknown, language: string, unit: string, maximumFractionDigits = 1) {
  const number = typeof value === 'number' ? value : Number(value)
  return `${Number.isFinite(number) ? formatNumber(number, language, maximumFractionDigits) : String(value)}${unit ? ` ${unit}` : ''}`
}

function cycleEnd(cycle: Cycle) {
  return cycle.end_date ?? todayIso()
}

function normalizeCycles(rows: SupabaseCycleRow[] | null | undefined): Cycle[] {
  return (rows ?? []).map(row => ({
    ...row,
    peptides: Array.isArray(row.peptides) ? row.peptides[0] ?? null : row.peptides,
  }))
}

function rangeFromActiveCycles(cycles: Cycle[]): DateRange {
  if (cycles.length === 0) return defaultRange()
  const starts = cycles.map(cycle => cycle.start_date).sort()
  const ends = cycles.map(cycle => cycle.end_date ?? todayIso()).sort()
  return { from: starts[0], to: ends[ends.length - 1] }
}

function cycleDuration(cycle: Cycle) {
  return differenceInCalendarDays(parseISO(cycleEnd(cycle)), parseISO(cycle.start_date)) + 1
}

function isLogWithinRange(log: DoseLog, range: DateRange) {
  const key = dateKey(log.logged_at)
  return key >= range.from && key <= range.to
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-56 rounded-2xl border border-white/[0.06] bg-white/[0.025] flex items-center justify-center text-sm text-slate-500">
      {label}
    </div>
  )
}

function ChartCard({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-sky-400/10 border border-sky-400/20 flex items-center justify-center text-sky-400">
            {icon}
          </div>
          <h2 className="text-base font-bold text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image failed to load'))
    image.src = src
  })
}

function withOpacity(doc: JsPDFType, opacity: number, draw: () => void) {
  const pdf = doc as JsPdfWithGState
  if (pdf.GState && pdf.setGState) {
    const state = new pdf.GState({ opacity })
    pdf.saveGraphicsState?.()
    pdf.setGState(state)
    draw()
    pdf.restoreGraphicsState?.()
    return
  }
  draw()
}

function decoratePdf(doc: JsPDFType, logo: HTMLImageElement) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageCount = doc.getNumberOfPages()

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    withOpacity(doc, 0.07, () => {
      doc.addImage(logo, 'PNG', pageWidth / 2 - 55, pageHeight / 2 - 55, 110, 110, undefined, 'FAST', -35)
    })
    doc.setFontSize(9)
    doc.setTextColor(120, 134, 156)
    doc.text(FOOTER_TEXT, pageWidth / 2, pageHeight - 8, { align: 'center' })
  }
}

function addCoverPage(doc: JsPDFType, logo: HTMLImageElement, copy: ProtocolCopy, userName: string, range: DateRange, language: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFillColor(7, 9, 26)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')
  doc.addImage(logo, 'PNG', pageWidth / 2 - 24, 42, 48, 48)
  doc.setTextColor(234, 238, 252)
  doc.setFontSize(28)
  doc.text(copy.coverTitle, pageWidth / 2, 108, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor(0, 204, 245)
  doc.text('Track Your Dose', pageWidth / 2, 118, { align: 'center' })

  const rows = [
    [copy.user, userName],
    [copy.period, `${formatDate(range.from, language)} - ${formatDate(range.to, language)}`],
    [copy.exportedAt, new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date())],
  ]

  doc.setFontSize(11)
  rows.forEach(([label, value], index) => {
    const y = 150 + index * 13
    doc.setTextColor(120, 134, 156)
    doc.text(label, 42, y)
    doc.setTextColor(234, 238, 252)
    doc.text(value, 88, y)
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: 'rgba(8,11,26,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.7 }} />
      <p style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em', color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: '#475569', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function NormalizedChartDefs({ markers }: { markers: string[] }) {
  return (
    <defs>
      {markers.map(marker => {
        const color = getSeriesColor(marker)
        const id = gradId(marker)
        return (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.22} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        )
      })}
    </defs>
  )
}

function NormalizedTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const visible = payload.filter(p => p.value != null && !p.name.endsWith('-glow') && !p.name.endsWith('-area'))
  if (!visible.length) return null
  return (
    <div style={{ background: 'rgba(8,11,26,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', fontSize: 11 }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569', marginBottom: 6 }}>{label}</p>
      {visible.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontWeight: 700, color: p.color }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span>{p.name}: {p.value > 0 ? '+' : ''}{p.value}%</span>
        </div>
      ))}
    </div>
  )
}

interface SmallMultipleSeriesProps {
  marker: string; unit: string; color: string
  normalMin: number | null; normalMax: number | null
  yDomain: [number, number]
  data: { date: string; label: string; value: number | null }[]
  lastValue: number | null
}

function SmallMultipleRow({ series, isLast, language }: { series: SmallMultipleSeriesProps; isLast: boolean; language: string }) {
  const { marker, unit, color, normalMin, normalMax, yDomain, data, lastValue } = series
  return (
    <div style={{ marginBottom: isLast ? 0 : 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2, paddingLeft: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color }}>{marker}</span>
          <span style={{ fontSize: 9, color: '#334155', fontWeight: 600 }}>{unit}</span>
          {normalMin != null && normalMax != null && (
            <span style={{ fontSize: 8, color: '#334155' }}>Norm: {normalMin}–{normalMax}</span>
          )}
        </div>
        {lastValue != null && (
          <span style={{ fontSize: 12, fontWeight: 900, color, letterSpacing: '-0.02em' }}>
            {formatNumber(lastValue, language, 2)} {unit}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={isLast ? 75 : 65}>
        <LineChart data={data} margin={{ top: 4, right: 50, bottom: 0, left: 0 }} syncId="protokoll-small">
          {normalMin != null && normalMax != null && (
            <ReferenceArea y1={normalMin} y2={normalMax} fill={color} fillOpacity={0.08} strokeOpacity={0} />
          )}
          {normalMax != null && <ReferenceLine y={normalMax} stroke={color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="2 3" />}
          {normalMin != null && normalMin > 0 && <ReferenceLine y={normalMin} stroke={color} strokeOpacity={0.2} strokeWidth={1} strokeDasharray="2 3" />}
          <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
          <YAxis domain={yDomain} tick={{ fill: '#334155', fontSize: 9, fontWeight: 600 }} tickLine={false} axisLine={false} width={38} tickCount={3} />
          {isLast && <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 9, fontWeight: 600 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />}
          <Tooltip contentStyle={{ background: 'rgba(8,11,26,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 11 }} labelStyle={{ color: '#475569', fontSize: 9 }}
            formatter={(value: unknown) => [`${typeof value === 'number' ? formatNumber(value, language, 2) : value} ${unit}`, marker]} />
          <Line dataKey="value" stroke={color} strokeWidth={6} strokeOpacity={0.12} dot={false} activeDot={false} connectNulls isAnimationActive={false} legendType="none" name="glow" />
          <Line dataKey="value" stroke={color} strokeWidth={2.5} strokeLinecap="round" connectNulls isAnimationActive={false} name={marker}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dot={(props: any) => props.payload?.value != null
              ? <circle key={`${props.cx}-${props.cy}`} cx={props.cx} cy={props.cy} r={4} fill="#07091a" stroke={color} strokeWidth={2} />
              : <g key="empty" />}
            activeDot={{ r: 6, fill: color, stroke: '#07091a', strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
      {!isLast && <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />}
    </div>
  )
}

export function Protokoll() {
  const { user } = useAuth()
  const { i18n, t } = useTranslation()
  const language = i18n.language || 'de'
  const copy = useMemo(() => copyFor(language), [language])
  const reportRef = useRef<HTMLDivElement>(null)

  const [selectorMode, setSelectorMode] = useState<'current' | 'custom'>('current')
  const [range, setRange] = useState<DateRange>(defaultRange)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeCycles, setActiveCycles] = useState<Cycle[]>([])
  const [completedCycles, setCompletedCycles] = useState<Cycle[]>([])
  const [cycleDoseLogs, setCycleDoseLogs] = useState<DoseLog[]>([])
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [bloodwork, setBloodwork] = useState<BloodworkEntry[]>([])
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [activeMarkers, setActiveMarkers] = useState<string[]>(['Gewicht', 'IGF-1'])
  const [selectedPreset, setSelectedPreset] = useState<string>('weight-igf1')
  const [loadingBase, setLoadingBase] = useState(true)
  const [loadingCharts, setLoadingCharts] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [effects, setEffects] = useState<EffectRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [dailyLogs, setDailyLogs] = useState<DailyLogRow[]>([])

  const userName = useMemo(() => (
    profile?.display_name
      || profile?.username
      || user?.user_metadata?.full_name
      || user?.email
      || 'TYD User'
  ), [profile, user])

  const currentCycleRange = useMemo<DateRange>(() => {
    return rangeFromActiveCycles(activeCycles)
  }, [activeCycles])

  // ─── New derived data ──────────────────────────────────────────────────────

  const availableMarkers = useMemo(() => {
    const blood = Array.from(new Set(bloodwork.map(e => e.marker))).sort()
    const wellness = wellnessMarkersWithData(dailyLogs)
    return ['Gewicht', ...wellness, ...blood]
  }, [bloodwork, dailyLogs])

  const bloodTestDates = useMemo(
    () => Array.from(new Set(bloodwork.map(e => e.tested_at))).sort(),
    [bloodwork],
  )

  const cycleBands = useMemo(() => (
    [...activeCycles, ...completedCycles].map((c, i) => ({
      x1: c.start_date,
      x2: cycleEnd(c),
      name: c.peptides?.name ?? c.name,
      color: CYCLE_COLORS[i % CYCLE_COLORS.length],
    }))
  ), [activeCycles, completedCycles])

  const kpiValues = useMemo(() => {
    const logsWithValue = doseLogs.filter(l => l.taken != null)
    const takenCount = logsWithValue.filter(l => l.taken).length
    const adherencePct = logsWithValue.length > 0
      ? Math.round((takenCount / logsWithValue.length) * 100)
      : null

    const sortedWeights = [...weightLogs]
      .map(l => ({ date: dateKey(l.logged_at), value: numericValue(l.weight_kg) }))
      .filter((e): e is { date: string; value: number } => e.value != null)
      .sort((a, b) => a.date.localeCompare(b.date))
    const firstWeight = sortedWeights[0]?.value ?? null
    const lastWeight  = sortedWeights[sortedWeights.length - 1]?.value ?? null
    const weightDelta = firstWeight != null && lastWeight != null
      ? Math.round((lastWeight - firstWeight) * 10) / 10 : null

    function markerDelta(marker: string): number | null {
      const entries = bloodwork
        .filter(e => e.marker === marker)
        .map(e => ({ date: e.tested_at, value: numericValue(e.value) }))
        .filter((e): e is { date: string; value: number } => e.value != null)
        .sort((a, b) => a.date.localeCompare(b.date))
      if (entries.length < 2) return null
      const first = entries[0].value
      if (first === 0) return null
      return Math.round(((entries[entries.length - 1].value - first) / Math.abs(first)) * 1000) / 10
    }

    return {
      adherencePct,
      weightDelta,
      igf1Delta: markerDelta('IGF-1'),
      crpDelta:  markerDelta('CRP'),
    }
  }, [doseLogs, weightLogs, bloodwork])

  const normalizedChartData = useMemo(() => {
    const weightSorted = [...weightLogs]
      .map(l => ({ date: dateKey(l.logged_at), value: numericValue(l.weight_kg) }))
      .filter((e): e is { date: string; value: number } => e.value != null)
      .sort((a, b) => a.date.localeCompare(b.date))
    const weightPcts = toPercentChange(weightSorted)

    const bloodPcts = new Map<string, { date: string; pct: number }[]>()
    const wellnessPcts = new Map<string, { date: string; pct: number }[]>()
    for (const marker of activeMarkers) {
      if (marker === 'Gewicht' || isWellnessMarker(marker)) continue
      const entries = bloodwork
        .filter(e => e.marker === marker)
        .map(e => ({ date: e.tested_at, value: numericValue(e.value) }))
        .filter((e): e is { date: string; value: number } => e.value != null)
        .sort((a, b) => a.date.localeCompare(b.date))
      bloodPcts.set(marker, toPercentChange(entries))
    }
    for (const marker of activeMarkers) {
      if (!isWellnessMarker(marker)) continue
      wellnessPcts.set(marker, toPercentChange(wellnessSeries(dailyLogs, marker)))
    }

    const allDates = new Set<string>()
    if (activeMarkers.includes('Gewicht')) weightSorted.forEach(e => allDates.add(e.date))
    bloodPcts.forEach(arr => arr.forEach(p => allDates.add(p.date)))
    wellnessPcts.forEach(arr => arr.forEach(p => allDates.add(p.date)))
    const sortedDates = Array.from(allDates).sort()

    return sortedDates.map(date => {
      const row: Record<string, string | number | null> = {
        date,
        label: formatDate(date, language),
      }
      if (activeMarkers.includes('Gewicht')) {
        const exact = weightPcts.find(p => p.date === date)
        row['Gewicht'] = exact ? exact.pct : (interpolatePct(date, weightPcts) ?? null)
      }
      for (const [marker, pcts] of bloodPcts) {
        const exact = pcts.find(p => p.date === date)
        row[marker] = exact ? exact.pct : null
      }
      for (const [marker, pcts] of wellnessPcts) {
        const exact = pcts.find(p => p.date === date)
        row[marker] = exact ? exact.pct : (interpolatePct(date, pcts) ?? null)
      }
      return row
    })
  }, [activeMarkers, weightLogs, bloodwork, dailyLogs, language])

  interface SmallMultipleSeries {
    marker: string
    unit: string
    color: string
    normalMin: number | null
    normalMax: number | null
    yDomain: [number, number]
    data: { date: string; label: string; value: number | null }[]
    lastValue: number | null
  }

  const smallMultiplesData = useMemo((): SmallMultipleSeries[] => (
    activeMarkers.map(marker => {
      const color = getSeriesColor(marker)
      const { min: normalMin, max: normalMax } = getNormalRange(marker)
      let data: { date: string; label: string; value: number | null }[]
      let unit = ''

      if (marker === 'Gewicht') {
        data = [...weightLogs]
          .sort((a, b) => dateKey(a.logged_at).localeCompare(dateKey(b.logged_at)))
          .map(l => ({ date: dateKey(l.logged_at), label: formatDate(dateKey(l.logged_at), language), value: numericValue(l.weight_kg) }))
        unit = 'kg'
      } else if (isWellnessMarker(marker)) {
        const entries = wellnessSeries(dailyLogs, marker)
        unit = '/5'
        data = entries.map(e => ({ date: e.date, label: formatDate(e.date, language), value: e.value }))
      } else {
        const entries = bloodwork.filter(e => e.marker === marker).sort((a, b) => a.tested_at.localeCompare(b.tested_at))
        unit = entries[0]?.unit ?? ''
        data = entries.map(e => ({ date: e.tested_at, label: formatDate(e.tested_at, language), value: numericValue(e.value) }))
      }

      const nums = data.map(d => d.value).filter((v): v is number => v != null)
      const dataMin = nums.length > 0 ? Math.min(...nums) : 0
      const dataMax = nums.length > 0 ? Math.max(...nums) : 1
      const pad = (dataMax - dataMin) * 0.2 || dataMax * 0.2 || 1
      const yMin = normalMin != null ? Math.min(normalMin, dataMin - pad) : dataMin - pad
      const yMax = normalMax != null ? Math.max(normalMax, dataMax + pad) : dataMax + pad
      const lastValue = [...data].reverse().find(d => d.value != null)?.value ?? null

      return { marker, unit, color, normalMin, normalMax, yDomain: [Math.round(yMin * 10) / 10, Math.round(yMax * 10) / 10], data, lastValue }
    })
  ), [activeMarkers, weightLogs, bloodwork, dailyLogs, language])

  const adherencePerPeptide = useMemo(() => {
    const nameMap = new Map<string, string>()
    ;[...activeCycles, ...completedCycles].forEach(c => {
      if (c.peptide_id && c.peptides?.name) nameMap.set(c.peptide_id, c.peptides.name)
    })
    const grouped = new Map<string, { taken: number; total: number }>()
    doseLogs.forEach(log => {
      if (log.taken == null || !log.peptide_id) return
      const name = nameMap.get(log.peptide_id) ?? log.peptide_id
      const existing = grouped.get(name) ?? { taken: 0, total: 0 }
      existing.total++
      if (log.taken) existing.taken++
      grouped.set(name, existing)
    })
    return Array.from(grouped.entries())
      .map(([name, stats], i) => ({ name, pct: Math.round((stats.taken / stats.total) * 100), color: CYCLE_COLORS[i % CYCLE_COLORS.length] }))
      .sort((a, b) => b.pct - a.pct)
  }, [doseLogs, activeCycles, completedCycles])

  const sideEffectStats = useMemo(() => topSideEffects(effects), [effects])
  const peptideEffectStats = useMemo(() => effectsByPeptide(effects), [effects])
  const peptideReviewStats = useMemo(() => reviewsByPeptide(reviews), [reviews])

  const loadBaseData = useCallback(async () => {
    if (!user) return
    setLoadingBase(true)

    const [{ data: activeData }, { data: completedData }, { data: profileData }] = await Promise.all([
      supabase
        .from('cycles')
        .select('id, peptide_id, name, start_date, end_date, active, peptides(name)')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('start_date', { ascending: false }),
      supabase
        .from('cycles')
        .select('id, peptide_id, name, start_date, end_date, active, peptides(name)')
        .eq('user_id', user.id)
        .eq('active', false)
        .order('start_date', { ascending: false }),
      supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', user.id)
        .maybeSingle(),
    ])

    const active = normalizeCycles(activeData as unknown as SupabaseCycleRow[])
    const completed = normalizeCycles(completedData as unknown as SupabaseCycleRow[])
    setActiveCycles(active)
    setCompletedCycles(completed)
    setProfile((profileData ?? null) as Profile | null)
    setRange(current => selectorMode === 'current' ? rangeFromActiveCycles(active) : current)
    setSelectedCycleId(current => selectorMode === 'current' ? null : current)

    if (completed.length > 0) {
      const from = completed.map(cycle => cycle.start_date).sort()[0]
      const to = completed.map(cycle => cycleEnd(cycle)).sort().at(-1) ?? todayIso()
      const { data } = await supabase
        .from('dose_logs')
        .select('id, peptide_id, logged_at, taken')
        .eq('user_id', user.id)
        .gte('logged_at', from)
        .lte('logged_at', `${to}T23:59:59`)
      setCycleDoseLogs((data ?? []) as DoseLog[])
    } else {
      setCycleDoseLogs([])
    }

    setLoadingBase(false)
  }, [selectorMode, user])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBaseData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadBaseData])

  const loadRangeData = useCallback(async () => {
    if (!user || !isValidRange(range)) return
    setLoadingCharts(true)

    const [{ data: weights }, { data: blood }, { data: doses }, { data: effectRows }, { data: reviewRows }, { data: daily }] = await Promise.all([
      supabase
        .from('weight_logs')
        .select('id, logged_at, weight_kg')
        .eq('user_id', user.id)
        .gte('logged_at', range.from)
        .lte('logged_at', `${range.to}T23:59:59`)
        .order('logged_at', { ascending: true }),
      supabase
        .from('bloodwork')
        .select('id, tested_at, marker, value, unit, notes')
        .eq('user_id', user.id)
        .gte('tested_at', range.from)
        .lte('tested_at', range.to)
        .order('tested_at', { ascending: true })
        .order('marker', { ascending: true }),
      supabase
        .from('dose_logs')
        .select('id, peptide_id, logged_at, taken')
        .eq('user_id', user.id)
        .gte('logged_at', range.from)
        .lte('logged_at', `${range.to}T23:59:59`)
        .order('logged_at', { ascending: true }),
      supabase
        .from('effects')
        .select('id, type, description, severity, peptide_id, occurred_at, peptides(name)')
        .eq('user_id', user.id)
        .gte('occurred_at', `${range.from}T00:00:00`)
        .lte('occurred_at', `${range.to}T23:59:59`)
        .order('occurred_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('id, peptide_id, rating, experience, peptides(name)')
        .eq('user_id', user.id)
        .gte('created_at', `${range.from}T00:00:00`)
        .lte('created_at', `${range.to}T23:59:59`),
      supabase
        .from('daily_logs')
        .select('id, log_date, energie, schlaf, libido, notes')
        .eq('user_id', user.id)
        .gte('log_date', range.from)
        .lte('log_date', range.to)
        .order('log_date', { ascending: true }),
    ])

    const bloodEntries = (blood ?? []) as BloodworkEntry[]
    const nextMarkers = Array.from(new Set(bloodEntries.map(entry => entry.marker))).sort((a, b) => a.localeCompare(b))

    setWeightLogs((weights ?? []) as WeightLog[])
    setBloodwork(bloodEntries)
    setDoseLogs((doses ?? []) as DoseLog[])
    setEffects((effectRows ?? []).map(row => ({
      ...row,
      peptides: Array.isArray(row.peptides) ? row.peptides[0] ?? null : row.peptides,
    })) as EffectRow[])
    setReviews((reviewRows ?? []).map(row => ({
      ...row,
      peptides: Array.isArray(row.peptides) ? row.peptides[0] ?? { name: '—' } : row.peptides,
    })) as ReviewRow[])
    const dailyEntries = (daily ?? []) as DailyLogRow[]
    setDailyLogs(dailyEntries)
    const wellnessAvailable = wellnessMarkersWithData(dailyEntries)
    // auto-apply preset if current activeMarkers have no data
    setActiveMarkers(prev => {
      const hasBlood = nextMarkers.length > 0
      const hasWellness = wellnessAvailable.length > 0
      if (!hasBlood && !hasWellness) return ['Gewicht']
      const valid = prev.filter(m => {
        if (m === 'Gewicht') return true
        if (isWellnessMarker(m)) return wellnessAvailable.includes(m)
        return nextMarkers.includes(m)
      })
      if (valid.length > 0) return valid
      if (hasWellness) return [...wellnessAvailable]
      return ['Gewicht', nextMarkers[0]]
    })
    setLoadingCharts(false)
  }, [range, user])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRangeData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadRangeData])


  const adherenceForCycle = useCallback((cycle: Cycle) => {
    const cycleRange = { from: cycle.start_date, to: cycleEnd(cycle) }
    const logs = cycleDoseLogs.filter(log => (
      log.peptide_id === cycle.peptide_id
      && log.taken != null
      && isLogWithinRange(log, cycleRange)
    ))
    if (logs.length === 0) return null
    const taken = logs.filter(log => log.taken).length
    return Math.round((taken / logs.length) * 100)
  }, [cycleDoseLogs])

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS.find(p => p.key === presetKey)
    if (!preset) return
    const candidates = preset.key === 'full' ? availableMarkers : preset.markers
    const valid = candidates.filter(m => {
      if (m === 'Gewicht') return true
      if (isWellnessMarker(m)) return dailyLogs.some(row => row[WELLNESS_MARKER_FIELD[m]] != null)
      return bloodwork.some(e => e.marker === m)
    })
    setActiveMarkers(valid.length > 0 ? valid : ['Gewicht'])
    setSelectedPreset(presetKey)
  }

  const toggleMarker = (marker: string) => {
    setSelectedPreset('')
    setActiveMarkers(prev =>
      prev.includes(marker)
        ? prev.length > 1 ? prev.filter(m => m !== marker) : prev
        : prev.length < 5 ? [...prev, marker] : prev,
    )
  }

  const selectCycle = (cycle: Cycle) => {
    setSelectorMode('custom')
    setSelectedCycleId(cycle.id)
    setRange({ from: cycle.start_date, to: cycleEnd(cycle) })
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: copy.title, text: copy.subtitle, url: SHARE_URL })
      } else {
        await navigator.clipboard.writeText(SHARE_URL)
      }
      toast.success(copy.copied)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') toast.error(copy.exportError)
    }
  }

  const exportPdf = async () => {
    if (!reportRef.current || !isValidRange(range)) return
    setExporting(true)

    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const logo = await loadImage(heroLogo)

      addCoverPage(doc, logo, copy, userName, range, language)
      doc.addPage()
      doc.setFillColor(7, 9, 26)
      doc.rect(0, 0, pageWidth, pageHeight, 'F')

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#07091a',
        scale: Math.min(2, window.devicePixelRatio || 2),
        useCORS: true,
      })
      const imageData = canvas.toDataURL('image/png')
      const imageWidth = pageWidth - 20
      const imageHeight = (canvas.height * imageWidth) / canvas.width
      const topMargin = 14
      const contentHeight = pageHeight - 28

      doc.addImage(imageData, 'PNG', 10, topMargin, imageWidth, imageHeight)
      let heightLeft = imageHeight - contentHeight

      while (heightLeft > 0) {
        doc.addPage()
        doc.setFillColor(7, 9, 26)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')
        const y = topMargin - (imageHeight - heightLeft)
        doc.addImage(imageData, 'PNG', 10, y, imageWidth, imageHeight)
        heightLeft -= contentHeight
      }

      decoratePdf(doc, logo)
      doc.save(`TYD-Protokoll-${todayIso()}.pdf`)
    } catch {
      toast.error(copy.exportError)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-400/70 mb-1">{copy.subtitle}</p>
          <h1 className="text-2xl font-black tracking-tight text-white">{copy.title}</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1 sm:flex-none" onClick={handleShare}>
            <Link2 size={16} /> {copy.share}
          </button>
          <button className="btn-primary flex-1 sm:flex-none" onClick={exportPdf} disabled={exporting || loadingCharts}>
            <Download size={16} /> {exporting ? copy.generatingPdf : copy.generatePdf}
          </button>
        </div>
      </header>

      <ResearchDisclaimer
        compact
        title={t('safety_banner_title')}
        body={t('protokoll_research_export_hint')}
        accent="#00ccf5"
      />

      {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        <KpiCard label="Adherence" color="#10b981"
          value={kpiValues.adherencePct != null ? `${kpiValues.adherencePct}%` : '—'}
          sub={kpiValues.adherencePct != null && kpiValues.adherencePct >= 80 ? '↑ gut' : undefined} />
        <KpiCard label="Gewicht Δ" color="#00ccf5"
          value={kpiValues.weightDelta != null ? `${kpiValues.weightDelta > 0 ? '+' : ''}${formatNumber(kpiValues.weightDelta, language, 1)} kg` : '—'} />
        <KpiCard label="IGF-1 Δ" color="#8b5cf6"
          value={kpiValues.igf1Delta != null ? `${kpiValues.igf1Delta > 0 ? '+' : ''}${kpiValues.igf1Delta}%` : '—'} />
        <KpiCard label="CRP Δ" color={kpiValues.crpDelta != null && kpiValues.crpDelta < 0 ? '#10b981' : '#f43f5e'}
          value={kpiValues.crpDelta != null ? `${kpiValues.crpDelta > 0 ? '+' : ''}${kpiValues.crpDelta}%` : '—'} />
      </div>

      <section className="card">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${selectorMode === 'current' ? 'bg-sky-400 text-slate-950' : 'bg-white/[0.04] text-slate-400 hover:text-white'}`}
            onClick={() => {
              setSelectorMode('current')
              setRange(currentCycleRange)
              setSelectedCycleId(null)
            }}
          >
            {copy.currentCycle}
          </button>
          <button
            className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${selectorMode === 'custom' ? 'bg-sky-400 text-slate-950' : 'bg-white/[0.04] text-slate-400 hover:text-white'}`}
            onClick={() => setSelectorMode('custom')}
          >
            {copy.customRange}
          </button>
        </div>

        {selectorMode === 'custom' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{copy.from}</label>
              <input
                className="input"
                type="date"
                value={range.from}
                onChange={event => setRange(current => ({ ...current, from: event.target.value }))}
              />
            </div>
            <div>
              <label className="label">{copy.to}</label>
              <input
                className="input"
                type="date"
                value={range.to}
                onChange={event => setRange(current => ({ ...current, to: event.target.value }))}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">{copy.activeCycles}</p>
            {activeCycles.length > 0 ? (
              <div className="space-y-2">
                {activeCycles.map(cycle => (
                  <div key={cycle.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white font-semibold">{cycle.peptides?.name ?? cycle.name}</span>
                    <span className="text-slate-500 text-xs">
                      {formatDate(cycle.start_date, language)} - {formatDate(cycleEnd(cycle), language)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{copy.noActiveCycle}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <CalendarDays size={15} className="text-sky-400" />
          <span>
            {copy.period}: <span className="text-white font-semibold">{formatDate(range.from, language)} - {formatDate(range.to, language)}</span>
          </span>
        </div>
      </section>

      {(loadingBase || loadingCharts) && (
        <div className="card text-center py-6 text-slate-500">
          {copy.loading}
        </div>
      )}

      <div ref={reportRef} className="space-y-4 rounded-[1.5rem] bg-[#07091a]">

        {/* ── Schnell-Ansichten ── */}
        <div>
          <p style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#334155', marginBottom: 8 }}>Schnell-Ansichten</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => applyPreset(p.key)} style={{
                padding: '5px 13px', borderRadius: 100, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
                cursor: 'pointer', whiteSpace: 'nowrap',
                border: selectedPreset === p.key ? '1px solid rgba(0,204,245,0.45)' : '1px solid rgba(255,255,255,0.08)',
                background: selectedPreset === p.key ? 'rgba(0,204,245,0.12)' : 'rgba(255,255,255,0.03)',
                color: selectedPreset === p.key ? '#00ccf5' : '#64748b',
                boxShadow: selectedPreset === p.key ? '0 0 14px rgba(0,204,245,0.15)' : 'none',
                transition: 'all 0.18s',
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* ── Marker-Toggles ── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          {availableMarkers.map(marker => {
            const on = activeMarkers.includes(marker)
            const color = getSeriesColor(marker)
            return (
              <button key={marker} onClick={() => toggleMarker(marker)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 10,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', cursor: 'pointer',
                border: on ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.07)',
                background: on ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                color: on ? '#eaeefc' : '#475569', transition: 'all 0.18s',
              }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: color, opacity: on ? 1 : 0.3, flexShrink: 0 }} />
                {marker}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500">{copy.period}</p>
            <p className="text-white font-bold">{formatDate(range.from, language)} - {formatDate(range.to, language)}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-sky-400/10 border border-sky-400/20 flex items-center justify-center">
            <FileText size={18} className="text-sky-400" />
          </div>
        </div>

        {/* ── Chart 1: % Veränderung ── */}
        <section style={{ background: 'rgba(8,11,26,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#eaeefc' }}>Verlauf — % Veränderung</p>
              <p style={{ fontSize: 9, color: '#334155', marginTop: 2, fontWeight: 600, letterSpacing: '0.04em' }}>Normalisiert ab Start · Zyklusphasen im Hintergrund</p>
            </div>
            <span style={{ background: 'rgba(0,204,245,0.08)', border: '1px solid rgba(0,204,245,0.15)', borderRadius: 8, padding: '4px 9px', fontSize: 9, fontWeight: 700, color: 'rgba(0,204,245,0.7)' }}>% Δ ab Start</span>
          </div>
          {normalizedChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={normalizedChartData} margin={{ top: 10, right: 50, bottom: 0, left: -10 }}>
                <NormalizedChartDefs markers={activeMarkers} />
                {cycleBands.map((band, i) => (
                  <ReferenceArea key={i} x1={band.x1} x2={band.x2} fill={band.color} fillOpacity={0.06} strokeOpacity={0}
                    label={{ value: band.name, position: 'insideTopLeft', fontSize: 8, fill: band.color, opacity: 0.55, fontWeight: 700 }} />
                ))}
                {bloodTestDates.map((date, i) => (
                  <ReferenceLine key={date} x={date} stroke="rgba(0,204,245,0.25)" strokeWidth={1} strokeDasharray="2 5"
                    label={i === 0 ? { value: 'Bluttest', position: 'top', fontSize: 8, fill: 'rgba(0,204,245,0.55)', fontWeight: 700 } : undefined} />
                ))}
                <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#334155', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} tick={{ fill: '#334155', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<NormalizedTooltip />} />
                {activeMarkers.map(marker => {
                  const color = getSeriesColor(marker)
                  return [
                    <Line key={`${marker}-glow`} dataKey={marker} stroke={color} strokeWidth={7} strokeOpacity={0.12} dot={false} activeDot={false} connectNulls legendType="none" name={`${marker}-glow`} isAnimationActive={false} />,
                    <Area key={`${marker}-area`} dataKey={marker} stroke="none" fill={`url(#${gradId(marker)})`} connectNulls legendType="none" name={`${marker}-area`} isAnimationActive={false} activeDot={false} />,
                    <Line key={marker} dataKey={marker} stroke={color} strokeWidth={2.5} strokeLinecap="round" connectNulls name={marker} isAnimationActive={false}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      dot={(props: any) => props.payload?.[marker] != null && props.cx != null
                        ? <circle key={`${props.cx}-${props.cy}`} cx={props.cx} cy={props.cy} r={4} fill="#07091a" stroke={color} strokeWidth={2} />
                        : <g key="empty" />}
                      activeDot={{ r: 6, fill: color, stroke: '#07091a', strokeWidth: 2 }} />,
                  ]
                })}
                <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label={copy.emptyChart} />
          )}
        </section>

        {/* ── Chart 2: Small Multiples ── */}
        {smallMultiplesData.length > 0 && (
          <section style={{ background: 'rgba(8,11,26,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#eaeefc' }}>Detailansicht — echte Einheiten</p>
                <p style={{ fontSize: 9, color: '#334155', marginTop: 2, fontWeight: 600, letterSpacing: '0.04em' }}>Absolute Werte · Farbband = Normalbereich</p>
              </div>
            </div>
            {smallMultiplesData.map((series, i) => (
              <SmallMultipleRow key={series.marker} series={series} isLast={i === smallMultiplesData.length - 1} language={language} />
            ))}
          </section>
        )}

        {/* ── Persönliche Insights ── */}
        {(sideEffectStats.length > 0 || peptideEffectStats.length > 0 || peptideReviewStats.length > 0) && (
          <section style={{ background: 'rgba(8,11,26,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#eaeefc', marginBottom: 4 }}>{t('protokoll_insights_title')}</p>
            <p style={{ fontSize: 9, color: '#334155', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 16 }}>{t('protokoll_insights_sub')}</p>

            {sideEffectStats.length > 0 ? (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {t('protokoll_side_effects_title')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sideEffectStats.map(item => (
                    <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ flex: 1, fontSize: 11, color: '#cbd5e1', lineHeight: 1.35 }}>{item.text}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: 8 }}>
                        ×{item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 10, color: '#475569', marginBottom: 14 }}>{t('protokoll_side_effects_empty')}</p>
            )}

            {peptideEffectStats.length > 0 && (
              <div style={{ marginBottom: peptideReviewStats.length > 0 ? 18 : 0 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#8b5cf6', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {t('protokoll_effects_by_peptide')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {peptideEffectStats.map(row => (
                    <div key={row.name}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#eaeefc', marginBottom: 4 }}>{row.name}</p>
                      <p style={{ fontSize: 10, color: '#64748b' }}>
                        {t('protokoll_effect_count', { effects: row.effects, side: row.sideEffects, severity: row.avgSeverity })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {peptideReviewStats.length > 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, color: '#10b981', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  {t('protokoll_reviews_by_peptide')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {peptideReviewStats.map(row => (
                    <div key={row.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#eaeefc' }}>{row.name}</span>
                      <span style={{ fontSize: 10, color: '#64748b', textAlign: 'right' }}>
                        {t('protokoll_review_stat', { rating: row.avgRating, count: row.count })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Adherence je Peptid ── */}
        {adherencePerPeptide.length > 0 && (
          <section style={{ background: 'rgba(8,11,26,0.95)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#eaeefc', marginBottom: 4 }}>{copy.adherenceTitle}</p>
            <p style={{ fontSize: 9, color: '#334155', fontWeight: 600, letterSpacing: '0.04em', marginBottom: 14 }}>Anteil eingenommener Dosen im Zeitraum je Peptid</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {adherencePerPeptide.map(({ name, pct, color }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', width: 96, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: `linear-gradient(90deg,${color},${color}aa)`, transition: 'width 0.5s cubic-bezier(.4,0,.2,1)' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, width: 36, textAlign: 'right', flexShrink: 0, color }}>{pct}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      <section>
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500 mb-3">{copy.previousCycles}</p>
        {completedCycles.length === 0 ? (
          <div className="card text-center py-8 text-slate-500">
            {copy.noPreviousCycles}
          </div>
        ) : (
          <div className="space-y-3">
            {completedCycles.map(cycle => {
              const adherence = adherenceForCycle(cycle)
              const selected = selectedCycleId === cycle.id
              return (
                <button
                  key={cycle.id}
                  className={`card w-full text-left transition-colors ${selected ? 'border-sky-400/40 bg-sky-400/[0.06]' : 'hover:border-sky-400/20'}`}
                  onClick={() => selectCycle(cycle)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-bold truncate">{cycle.peptides?.name ?? cycle.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDate(cycle.start_date, language)} - {formatDate(cycleEnd(cycle), language)}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="badge bg-sky-500/10 text-sky-400">
                          {copy.duration}: {cycleDuration(cycle)} {copy.days}
                        </span>
                        <span className="badge bg-emerald-500/10 text-emerald-400 inline-flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          {copy.adherenceRate}: {adherence == null ? '-' : `${adherence}%`}
                        </span>
                        <span className="badge bg-rose-500/10 text-rose-400 inline-flex items-center gap-1">
                          <XCircle size={12} />
                          inactive
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-sky-400 shrink-0 mt-1" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
