import type {
  PeptipediaCopy,
  PeptipediaEntry,
  PeptipediaSource,
  StudyProtocol,
  SourcedOverviewFact,
} from './types'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function requireText(value: string | null | undefined, field: string): void {
  if (!value?.trim()) throw new Error(field)
}

function requireStringList(values: string[], field: string): void {
  if (values.some(value => !value.trim())) throw new Error(field)
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validateSource(source: PeptipediaSource, slug: string): void {
  requireText(source.id, `${slug}: source.id`)
  requireText(source.title, `${slug}: source ${source.id} title`)
  if (!Number.isInteger(source.year) || source.year < 1900 || source.year > 2100) {
    throw new Error(`${slug}: source ${source.id} year`)
  }
  if (!source.url.startsWith('https://')) {
    throw new Error(`${slug}: non-HTTPS source ${source.id}`)
  }
}

function validateSourceReferences(
  owner: SourcedOverviewFact | StudyProtocol,
  sourceIds: ReadonlySet<string>,
  slug: string,
  kind: 'overview fact' | 'protocol',
): void {
  requireText(owner.id, `${slug}: ${kind}.id`)
  if (owner.sourceIds.length === 0) throw new Error(`${slug}: ${kind} ${owner.id} has no source`)
  for (const sourceId of owner.sourceIds) {
    if (!sourceIds.has(sourceId)) throw new Error(`Unknown source ${sourceId} in ${slug}`)
  }
}

function validateCopy(
  copy: PeptipediaCopy | undefined,
  locale: 'de' | 'en',
  slug: string,
  sourceIds: ReadonlySet<string>,
  sources: PeptipediaSource[],
): void {
  if (!copy) throw new Error(`${slug}: incomplete ${locale} copy`)
  requireText(copy.tldr, `${slug}: incomplete ${locale} copy`)
  requireText(copy.mechanism, `${slug}: incomplete ${locale} copy`)
  requireStringList(copy.researchAreas, `${slug}: ${locale}.researchAreas`)
  requireStringList(copy.researchGaps, `${slug}: ${locale}.researchGaps`)
  requireStringList(copy.sideEffects, `${slug}: ${locale}.sideEffects`)
  requireStringList(copy.contraindications, `${slug}: ${locale}.contraindications`)
  requireStringList(copy.interactions, `${slug}: ${locale}.interactions`)

  for (const fact of copy.overviewFacts) {
    requireText(fact.label, `${slug}: overview fact ${fact.id} label`)
    requireText(fact.value, `${slug}: overview fact ${fact.id} value`)
    validateSourceReferences(fact, sourceIds, slug, 'overview fact')
  }

  for (const protocol of copy.protocols) {
    requireText(protocol.populationOrModel, `${slug}: protocol ${protocol.id} populationOrModel`)
    requireText(protocol.route, `${slug}: protocol ${protocol.id} route`)
    requireText(protocol.amount, `${slug}: protocol ${protocol.id} amount`)
    requireText(protocol.frequency, `${slug}: protocol ${protocol.id} frequency`)
    requireText(protocol.duration, `${slug}: protocol ${protocol.id} duration`)
    requireText(protocol.objective, `${slug}: protocol ${protocol.id} objective`)
    requireText(protocol.outcome, `${slug}: protocol ${protocol.id} outcome`)
    validateSourceReferences(protocol, sourceIds, slug, 'protocol')
    const expectedKind = { human: 'human_study', animal: 'animal_study', laboratory: 'laboratory_study', approved_label: 'approved_label' }[protocol.evidenceType]
    if (!sources.some(source => protocol.sourceIds.includes(source.id) && source.kind === expectedKind)) {
      throw new Error(`${slug}: protocol ${protocol.id} requires a matching primary source`)
    }
  }
}

export function assertValidPeptipedia(entries: PeptipediaEntry[]): void {
  const slugs = new Set<string>()

  for (const entry of entries) {
    if (slugs.has(entry.slug)) throw new Error(`Duplicate slug: ${entry.slug}`)
    slugs.add(entry.slug)

    if (!SLUG_PATTERN.test(entry.slug)) throw new Error(`${entry.slug}: invalid slug`)
    requireText(entry.name, `${entry.slug}: name`)
    if (entry.fullName !== null) requireText(entry.fullName, `${entry.slug}: fullName`)
    if (!Number.isInteger(entry.evidence.score) || entry.evidence.score < 1 || entry.evidence.score > 10) {
      throw new Error(`${entry.slug}: evidence.score`)
    }
    if (!isCalendarDate(entry.reviewedAt)) throw new Error(`${entry.slug}: reviewedAt`)
    if (!Number.isInteger(entry.contentVersion) || entry.contentVersion < 1) {
      throw new Error(`${entry.slug}: contentVersion`)
    }

    const sourceIds = new Set(entry.sources.map(source => source.id))
    if (sourceIds.size !== entry.sources.length) throw new Error(`${entry.slug}: duplicate source id`)
    entry.sources.forEach(source => validateSource(source, entry.slug))
    validateCopy(entry.copy.de, 'de', entry.slug, sourceIds, entry.sources)
    validateCopy(entry.copy.en, 'en', entry.slug, sourceIds, entry.sources)
  }
}
