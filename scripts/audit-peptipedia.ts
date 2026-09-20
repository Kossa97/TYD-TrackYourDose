import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertValidPeptipedia } from '../src/features/peptipedia/content/validate'
import type { PeptipediaEntry, PeptipediaSource } from '../src/features/peptipedia/content/types'

const DAY_IN_MS = 24 * 60 * 60 * 1000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
type AuditCode =
  | 'invalid-entry'
  | 'invalid-review-date'
  | 'invalid-source-date'
  | 'stale-review'
  | 'stale-source'
  | 'stale-approved-review'
  | 'stale-approved-source'
  | 'recommendation-language'

export type AuditFinding = {
  slug: string
  code: AuditCode
  severity: 'error'
  sourceId?: string
  detail?: string
}

function parseCalendarDate(value: unknown): number | null {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return null
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isNaN(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value
    ? null
    : timestamp
}

function referenceDay(today: Date): number {
  if (Number.isNaN(today.getTime())) throw new TypeError('Audit reference date must be valid')
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
}

function isApproved(entry: PeptipediaEntry): boolean {
  return entry.researchStatus === 'approved'
    || Boolean(entry.approvals?.some(approval => approval.status === 'approved'))
}

function sourceId(source: Partial<PeptipediaSource>, index: number): string {
  return typeof source.id === 'string' && source.id.trim() ? source.id : `#${index + 1}`
}

function missingSourceMetadata(
  entry: PeptipediaEntry,
  source: Partial<PeptipediaSource>,
  index: number,
): AuditFinding[] {
  const id = sourceId(source, index)
  const missing: string[] = []
  if (typeof source.id !== 'string' || !source.id.trim()) missing.push('id')
  if (typeof source.title !== 'string' || !source.title.trim()) missing.push('title')
  if (typeof source.publisherOrAuthors !== 'string' || !source.publisherOrAuthors.trim()) missing.push('publisherOrAuthors')
  if (typeof source.kind !== 'string' || !source.kind.trim()) missing.push('kind')
  if (!Number.isInteger(source.year) || Number(source.year) < 1900 || Number(source.year) > 2100) missing.push('year')
  if (typeof source.url !== 'string' || !source.url.startsWith('https://')) missing.push('url')

  return missing.map(field => ({
    slug: entry.slug,
    code: 'invalid-entry' as const,
    severity: 'error' as const,
    detail: `${entry.slug}: source ${id} ${field}`,
    sourceId: id,
  }))
}

function validatorFindings(entries: readonly PeptipediaEntry[]): AuditFinding[] {
  const findings: AuditFinding[] = []

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const rotated = [entry, ...entries.slice(0, index), ...entries.slice(index + 1)]
    try {
      assertValidPeptipedia(rotated)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      const belongsToEntry = detail.startsWith(`${entry.slug}:`)
        || detail.endsWith(` in ${entry.slug}`)
        || detail === `Duplicate slug: ${entry.slug}`
      if (!belongsToEntry) continue
      const matchedSourceId = detail.match(/(?:source|Unknown source) ([^ ]+)/)?.[1]
      findings.push({
        slug: entry.slug,
        code: 'invalid-entry',
        severity: 'error',
        detail,
        ...(matchedSourceId ? { sourceId: matchedSourceId } : {}),
      })
    }
  }

  return findings
}

function uniqueFindings(findings: AuditFinding[]): AuditFinding[] {
  const seen = new Set<string>()
  return findings.filter(finding => {
    const key = JSON.stringify(finding)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const RECOMMENDATION_PATTERNS = [
  /\b(?:should|recommended to|take|inject|administer)\b.{0,60}\b(?:daily|weekly|dose|cycle|mg|mcg|µg)\b/i,
  /\b(?:sollte|empfohlen|nimm|nehmen Sie|injiziere|verabreiche)\b.{0,60}\b(?:täglich|wöchentlich|Dosis|Zyklus|mg|mcg|µg)\b/i,
]

function recommendationFindings(entry: PeptipediaEntry): AuditFinding[] {
  const findings: AuditFinding[] = []
  for (const locale of ['de', 'en'] as const) {
    const copy = entry.copy[locale]
    const fields: Array<[string, string]> = [
      ['tldr', copy.tldr],
      ['mechanism', copy.mechanism],
      ...copy.researchAreas.map((text, index) => [`researchAreas[${index}]`, text] as [string, string]),
      ...copy.overviewFacts.flatMap((fact, index) => [
        [`overviewFacts[${index}].label`, fact.label] as [string, string],
        [`overviewFacts[${index}].value`, fact.value] as [string, string],
      ]),
      ...copy.researchGaps.map((text, index) => [`researchGaps[${index}]`, text] as [string, string]),
      ...copy.sideEffects.map((text, index) => [`sideEffects[${index}]`, text] as [string, string]),
      ...copy.contraindications.map((text, index) => [`contraindications[${index}]`, text] as [string, string]),
      ...copy.interactions.map((text, index) => [`interactions[${index}]`, text] as [string, string]),
    ]
    for (const [field, text] of fields) {
      if (RECOMMENDATION_PATTERNS.some(pattern => pattern.test(text))) {
        findings.push({ slug: entry.slug, code: 'recommendation-language', severity: 'error', detail: `${locale}.${field}` })
      }
    }
  }
  return findings
}

export function auditPeptipedia(entries: readonly PeptipediaEntry[], today: Date): AuditFinding[] {
  const todayTimestamp = referenceDay(today)
  const findings = validatorFindings(entries)

  for (const entry of entries) {
    findings.push(...recommendationFindings(entry))
    const approved = isApproved(entry)
    const threshold = approved ? 90 : 180
    const reviewedAt = parseCalendarDate(entry.reviewedAt)
    if (reviewedAt === null) {
      findings.push({ slug: entry.slug, code: 'invalid-review-date', severity: 'error' })
    } else if ((todayTimestamp - reviewedAt) / DAY_IN_MS > threshold) {
      findings.push({ slug: entry.slug, code: approved ? 'stale-approved-review' : 'stale-review', severity: 'error' })
    }

    entry.sources.forEach((source, index) => {
      findings.push(...missingSourceMetadata(entry, source, index))
      const accessedAt = parseCalendarDate(source.accessedAt)
      const id = sourceId(source, index)
      if (accessedAt === null) {
        findings.push({ slug: entry.slug, sourceId: id, code: 'invalid-source-date', severity: 'error' })
      } else if ((todayTimestamp - accessedAt) / DAY_IN_MS > threshold) {
        findings.push({ slug: entry.slug, sourceId: id, code: approved ? 'stale-approved-source' : 'stale-source', severity: 'error' })
      }
    })
  }

  return uniqueFindings(findings)
}

export function formatAuditFinding(finding: AuditFinding): string {
  const source = finding.sourceId ? ` source=${finding.sourceId}` : ''
  const detail = finding.detail ? ` ${finding.detail}` : ''
  return `[${finding.severity}] ${finding.code} profile=${finding.slug}${source}${detail}`
}

async function runAudit(): Promise<void> {
  const { PUBLISHED_PEPTIDES } = await import('../src/features/peptipedia/content/index')
  const findings = auditPeptipedia(PUBLISHED_PEPTIDES, new Date())
  if (findings.length === 0) {
    console.log(`Peptipedia audit passed for ${PUBLISHED_PEPTIDES.length} profiles.`)
    return
  }

  findings.forEach(finding => console.error(formatAuditFinding(finding)))
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runAudit()
}
