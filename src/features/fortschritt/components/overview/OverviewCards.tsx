import type { ReactNode } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { ChevronRight, Scale, Activity, CheckCircle2, Droplets, Camera, CircleDot } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BloodworkEntry, DailyLogEntry, DateRange, ProgressPhotoEntry, WeightLogEntry, CycleSubstance, OngoingSubstance } from '../../types'
import {
  computeAdherence,
  computeDelta,
  sparklineValues,
  strongestWellnessField,
  wellnessAverage,
  wellnessFieldDelta,
  weightSeries,
  dailyFieldSeries,
} from '../../lib/metrics'
import { MIN_POINTS_FOR_DELTA, MIN_POINTS_FOR_SPARKLINE, WELLNESS_FIELDS } from '../../constants'
import { defaultFocusSubstanceId } from '../../lib/focusSummary'
import { panel, cardDelta, cardTitle } from '../../styles'
import type { DoseLogEntry } from '../../types'

interface Props {
  range: DateRange
  cycleSubstances: CycleSubstance[]
  ongoingSubstances: OngoingSubstance[]
  dailyLogs: DailyLogEntry[]
  weightLogs: WeightLogEntry[]
  bloodwork: BloodworkEntry[]
  photos: ProgressPhotoEntry[]
  doseLogs: DoseLogEntry[]
  peptideNames: Map<string, string>
  onNavigateVerlauf: (metric?: string, focusSubstanceId?: string) => void
  onNavigateTab: (tab: 'labs' | 'fotos') => void
}

export function OverviewCards({
  range,
  cycleSubstances,
  ongoingSubstances,
  dailyLogs,
  weightLogs,
  bloodwork,
  photos,
  doseLogs,
  peptideNames,
  onNavigateVerlauf,
  onNavigateTab,
}: Props) {
  const cards: ReactNode[] = []

  const weights = weightSeries(weightLogs, range)
  const weightDelta = computeDelta(weights)
  if (weights.length > 0) {
    const latest = weights[weights.length - 1]
    cards.push(
      <OverviewCard
        key="weight"
        label="Gewicht"
        icon={Scale}
        iconColor="#f59e0b"
        title={`${latest.value} kg`}
        delta={weightDelta && weights.length >= MIN_POINTS_FOR_DELTA
          ? `${weightDelta.delta > 0 ? '+' : ''}${weightDelta.delta} kg im Zeitraum`
          : undefined}
        sparkline={weights.length >= MIN_POINTS_FOR_SPARKLINE ? sparklineValues(weights) : undefined}
        sparkColor="#f59e0b"
        onClick={() => onNavigateVerlauf('weight')}
      />,
    )
  }

  const wellnessAvg = wellnessAverage(dailyLogs, range)
  if (wellnessAvg != null) {
    const strongest = strongestWellnessField(dailyLogs, range)
    const wellnessDelta = strongest ? wellnessFieldDelta(dailyLogs, range, strongest) : null
    const hints = WELLNESS_FIELDS
      .map(field => {
        const d = wellnessFieldDelta(dailyLogs, range, field)
        if (d == null || Math.abs(d) < 0.3) return null
        const arrow = d > 0 ? '↑' : d < 0 ? '↓' : '→'
        const labels: Record<string, string> = { energie: 'Energie', schlaf: 'Schlaf', wohlbefinden: 'Wohlbefinden', libido: 'Libido' }
        return `${labels[field]} ${arrow}`
      })
      .filter(Boolean)
      .slice(0, 3)
      .join('  ')

    cards.push(
      <OverviewCard
        key="wellness"
        label="Wellness"
        icon={Activity}
        iconColor="#00ccf5"
        title={`Ø ${wellnessAvg} / 10`}
        delta={wellnessDelta != null ? `${wellnessDelta > 0 ? '+' : ''}${wellnessDelta} im Zeitraum` : undefined}
        sub={hints || 'Substanz im Verlauf antippen'}
        onClick={() => onNavigateVerlauf(undefined, defaultFocusSubstanceId(cycleSubstances, ongoingSubstances) ?? undefined)}
      />,
    )
  }

  const adherence = computeAdherence(doseLogs, range, peptideNames)
  if (adherence.overall != null) {
    const top = adherence.byPeptide.slice(0, 2).map(p => `${p.name} ${p.pct}%`).join(' · ')
    const more = adherence.byPeptide.length > 2 ? ` · +${adherence.byPeptide.length - 2} weitere` : ''
    cards.push(
      <OverviewCard
        key="adherence"
        label="Adherence"
        icon={CheckCircle2}
        iconColor="#10b981"
        title={`${adherence.overall}%`}
        delta={`im Zeitraum · ${adherence.taken} von ${adherence.total} Dosen`}
        sub={top ? `${top}${more}` : undefined}
        onClick={() => onNavigateVerlauf('weight')}
      />,
    )
  }

  if (bloodwork.length > 0) {
    const latest = bloodwork[0]
    const daysAgo = differenceInCalendarDays(new Date(), parseISO(`${latest.tested_at}T00:00:00`))
    const testsInRange = bloodwork.length
    cards.push(
      <OverviewCard
        key="labs"
        label="Labs"
        icon={Droplets}
        iconColor="#8b5cf6"
        title={`${latest.marker} · ${latest.value} ${latest.unit}`}
        delta={daysAgo === 0 ? 'heute' : `vor ${daysAgo} Tagen`}
        sub={`${testsInRange} ${testsInRange === 1 ? 'Test' : 'Tests'} im Zeitraum`}
        onClick={() => onNavigateTab('labs')}
      />,
    )
  }

  if (photos.length > 0) {
    const latest = photos[0]
    const daysAgo = differenceInCalendarDays(new Date(), parseISO(`${latest.taken_at}T00:00:00`))
    cards.push(
      <OverviewCard
        key="photos"
        label="Fotos"
        icon={Camera}
        iconColor="#10b981"
        title="Letztes Foto"
        delta={daysAgo === 0 ? 'heute' : `vor ${daysAgo} Tagen`}
        sub={`${photos.length} ${photos.length === 1 ? 'Foto' : 'Fotos'} im Zeitraum`}
        thumbnail={latest.photo_url}
        onClick={() => onNavigateTab('fotos')}
      />,
    )
  }

  const kfa = dailyFieldSeries(dailyLogs, range, 'body_fat_pct')
  const kfaDelta = computeDelta(kfa)
  if (kfa.length > 0) {
    const latest = kfa[kfa.length - 1]
    cards.push(
      <OverviewCard
        key="kfa"
        label="Körperfett"
        icon={CircleDot}
        iconColor="#f87171"
        title={`${latest.value}%`}
        delta={kfaDelta && kfa.length >= MIN_POINTS_FOR_DELTA
          ? `${kfaDelta.delta > 0 ? '+' : ''}${kfaDelta.delta}% im Zeitraum`
          : undefined}
        onClick={() => onNavigateVerlauf('body_fat')}
      />,
    )
  }

  if (cards.length === 0) return null

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{cards}</div>
}

function OverviewCard({
  label,
  icon: Icon,
  iconColor,
  title,
  delta,
  sub,
  sparkline,
  sparkColor,
  thumbnail,
  onClick,
}: {
  label: string
  icon: LucideIcon
  iconColor: string
  title: string
  delta?: string
  sub?: string
  sparkline?: number[]
  sparkColor?: string
  thumbnail?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...panel,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        width: '100%',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          background: `${iconColor}18`,
          border: `1px solid ${iconColor}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color={iconColor} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </p>
        <p style={cardTitle}>{title}</p>
        {delta && <p style={cardDelta}>{delta}</p>}
        {sub && <p style={{ ...cardDelta, marginTop: 2 }}>{sub}</p>}
        {sparkline && sparkline.length > 1 && (
          <Sparkline values={sparkline} color={sparkColor ?? '#f59e0b'} />
        )}
      </div>
      <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
    </button>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const w = 80
  const h = 24
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / span) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} style={{ marginTop: 8, display: 'block' }}>
      <polyline fill="none" stroke={color} strokeWidth={2} points={points} />
    </svg>
  )
}
