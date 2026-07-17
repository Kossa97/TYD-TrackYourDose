import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'

export interface ProgressYearOptions {
  userId: string
  startDate: string
  endDate: string
}

export interface ProgressDailyRow {
  user_id: string
  log_date: string
  energie: number
  schlaf: number
  wohlbefinden: number
  libido: number
  body_fat_pct: number
}

export interface ProgressWeightRow {
  user_id: string
  logged_at: string
  weight_kg: number
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value)))
}

function wellnessScore(index: number, progress: number, from: number, to: number, phase: number): number {
  const envelope = Math.sin(Math.PI * progress)
  const variation = envelope * (
    0.7 * Math.sin((index + phase) / 8)
    + 0.35 * Math.sin((index + phase * 3) / 27)
  )
  return clampScore(from + (to - from) * progress + variation)
}

export function generateProgressYear({ userId, startDate, endDate }: ProgressYearOptions): {
  dailyRows: ProgressDailyRow[]
  weightRows: ProgressWeightRow[]
} {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const dayDistance = differenceInCalendarDays(end, start)
  if (!userId || dayDistance < 1) throw new Error('Ungültiger Simulationszeitraum')

  const dailyRows: ProgressDailyRow[] = []
  const weightRows: ProgressWeightRow[] = []

  for (let index = 0; index <= dayDistance; index++) {
    const date = format(addDays(start, index), 'yyyy-MM-dd')
    const progress = index / dayDistance
    const envelope = Math.sin(Math.PI * progress)
    const lossProgress = 1 - Math.pow(1 - progress, 1.08)

    const weightVariation = envelope * (
      0.5 * Math.sin(index / 6.5)
      + 0.22 * Math.sin(index / 24)
    )
    const bodyFatVariation = envelope * (
      0.28 * Math.sin((index + 4) / 11)
      + 0.12 * Math.sin(index / 37)
    )

    weightRows.push({
      user_id: userId,
      logged_at: `${date}T12:00:00.000Z`,
      weight_kg: round1(115 - 27 * lossProgress + weightVariation),
    })
    dailyRows.push({
      user_id: userId,
      log_date: date,
      energie: wellnessScore(index, progress, 4, 8, 2),
      schlaf: wellnessScore(index, progress, 5, 8, 11),
      wohlbefinden: wellnessScore(index, progress, 4, 9, 19),
      libido: wellnessScore(index, progress, 5, 8, 29),
      body_fat_pct: round1(34.5 - 15.5 * lossProgress + bodyFatVariation),
    })
  }

  return { dailyRows, weightRows }
}
