export interface EffectRow {
  id: string
  type: 'effect' | 'side_effect'
  description: string
  severity: number
  peptide_id: string | null
  occurred_at: string
  peptides: { name: string } | null
}

export interface ReviewRow {
  id: string
  peptide_id: string
  rating: number
  experience: 'gut' | 'mittel' | 'schlecht'
  peptides: { name: string }
}

export interface SideEffectStat {
  text: string
  count: number
}

export interface PeptideEffectStat {
  name: string
  effects: number
  sideEffects: number
  avgSeverity: number
}

export interface PeptideReviewStat {
  name: string
  avgRating: number
  count: number
  good: number
  bad: number
}

function normalizeDescription(text: string) {
  return text.trim().toLowerCase()
}

export function topSideEffects(effects: EffectRow[], limit = 5): SideEffectStat[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (const row of effects) {
    if (row.type !== 'side_effect') continue
    const key = normalizeDescription(row.description)
    if (!key) continue
    const existing = counts.get(key)
    if (existing) existing.count += 1
    else counts.set(key, { label: row.description.trim(), count: 1 })
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ label, count }) => ({ text: label, count }))
}

export function effectsByPeptide(effects: EffectRow[]): PeptideEffectStat[] {
  const grouped = new Map<string, { name: string; effects: number; sideEffects: number; severities: number[] }>()
  for (const row of effects) {
    const name = row.peptides?.name?.trim() || '—'
    const entry = grouped.get(name) ?? { name, effects: 0, sideEffects: 0, severities: [] }
    if (row.type === 'effect') entry.effects += 1
    else entry.sideEffects += 1
    entry.severities.push(row.severity)
    grouped.set(name, entry)
  }
  return [...grouped.values()]
    .map(entry => ({
      name: entry.name,
      effects: entry.effects,
      sideEffects: entry.sideEffects,
      avgSeverity: entry.severities.length > 0
        ? Math.round((entry.severities.reduce((sum, value) => sum + value, 0) / entry.severities.length) * 10) / 10
        : 0,
    }))
    .sort((a, b) => (b.effects + b.sideEffects) - (a.effects + a.sideEffects))
}

export function reviewsByPeptide(reviews: ReviewRow[]): PeptideReviewStat[] {
  const grouped = new Map<string, { name: string; ratings: number[]; good: number; bad: number }>()
  for (const row of reviews) {
    const name = row.peptides?.name?.trim() || '—'
    const entry = grouped.get(name) ?? { name, ratings: [], good: 0, bad: 0 }
    entry.ratings.push(row.rating)
    if (row.experience === 'gut') entry.good += 1
    else if (row.experience === 'schlecht') entry.bad += 1
    grouped.set(name, entry)
  }
  return [...grouped.values()]
    .map(entry => ({
      name: entry.name,
      avgRating: entry.ratings.length > 0
        ? Math.round((entry.ratings.reduce((sum, value) => sum + value, 0) / entry.ratings.length) * 10) / 10
        : 0,
      count: entry.ratings.length,
      good: entry.good,
      bad: entry.bad,
    }))
    .sort((a, b) => b.count - a.count)
}
