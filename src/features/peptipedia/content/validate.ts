import type {
  EvidenceMatrix,
  EditorialReview,
  PeptipediaCopy,
  PeptipediaEntry,
  PeptipediaSource,
  StudyProtocol,
  SourcedOverviewFact,
} from './types'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SOURCE_KINDS = new Set([
  'approved_label', 'human_study', 'systematic_review', 'animal_study', 'laboratory_study',
  'regulator', 'registry', 'manufacturer', 'catalog', 'government_news',
])
const OFFICIAL_APPROVAL_SOURCE_KINDS = new Set<PeptipediaSource['kind']>([
  'approved_label', 'regulator', 'government_news',
])
const APPROVAL_REGIONS = new Set(['DE', 'EU', 'US', 'CN', 'JP'])
const APPROVAL_STATUSES = new Set(['approved', 'application_withdrawn'])

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
  if (!SOURCE_KINDS.has(source.kind)) throw new Error(`${slug}: source kind`)
  requireText(source.title, `${slug}: source ${source.id} title`)
  requireText(source.publisherOrAuthors, `${slug}: source ${source.id} publisherOrAuthors`)
  if (!Number.isInteger(source.year) || source.year < 1900 || source.year > 2100) {
    throw new Error(`${slug}: source ${source.id} year`)
  }
  if (!source.url.startsWith('https://')) {
    throw new Error(`${slug}: non-HTTPS source ${source.id}`)
  }
  if (!isCalendarDate(source.accessedAt)) {
    throw new Error(`${slug}: source ${source.id} accessedAt`)
  }
}

function validateEvidenceMatrix(matrix: EvidenceMatrix | undefined, slug: string): void {
  const valid = matrix
    && ['none', 'very_limited', 'limited', 'moderate', 'strong'].includes(matrix.human)
    && ['none', 'single_group', 'multiple_groups', 'systematic'].includes(matrix.replication)
    && ['none', 'surrogate', 'symptom_or_function', 'hard_outcome'].includes(matrix.endpoints)
    && ['insufficient', 'limited', 'characterized'].includes(matrix.safety)
  if (!valid) throw new Error(`${slug}: incomplete evidence matrix`)
}

function validateEditorialReview(review: EditorialReview | undefined, slug: string): void {
  if (!review || !['pending', 'approved'].includes(review.medical) || !['pending', 'approved'].includes(review.legal)) {
    throw new Error(`${slug}: editorial review`)
  }
  if (review.medical === 'approved') {
    requireText(review.medicalReviewerName, `${slug}: medical reviewer`)
    if (!review.medicalReviewedAt || !isCalendarDate(review.medicalReviewedAt)) {
      throw new Error(`${slug}: medical review date`)
    }
  }
  if (review.legal === 'approved') {
    requireText(review.legalReviewerName, `${slug}: legal reviewer`)
    if (!review.legalReviewedAt || !isCalendarDate(review.legalReviewedAt)) {
      throw new Error(`${slug}: legal review date`)
    }
  }
}

function validatePublicRecommendations(entry: PeptipediaEntry): void {
  const recommendations = entry.publicRecommendations
  if (!recommendations) return
  const hasGuidance = [recommendations.dosage, recommendations.cycle]
    .some(value => typeof value === 'string' && value.trim().length > 0)
  if (!hasGuidance) return

  const review = entry.editorialReview
  const fullyDocumented = review.medical === 'approved'
    && review.legal === 'approved'
    && Boolean(review.medicalReviewerName?.trim())
    && Boolean(review.legalReviewerName?.trim())
    && Boolean(review.medicalReviewedAt && isCalendarDate(review.medicalReviewedAt))
    && Boolean(review.legalReviewedAt && isCalendarDate(review.legalReviewedAt))
  if (!fullyDocumented) {
    throw new Error(`${entry.slug}: public dosage or cycle recommendation requires documented medical and legal approval`)
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

function validateEntrySourceReferences(
  sourceIds: string[] | undefined,
  availableSourceIds: ReadonlySet<string>,
  slug: string,
  field: 'mechanismSourceIds' | 'safetySourceIds',
): void {
  if (!sourceIds?.length) throw new Error(`${slug}: ${field} has no source`)
  for (const sourceId of sourceIds) {
    if (!availableSourceIds.has(sourceId)) throw new Error(`Unknown source ${sourceId} in ${slug}`)
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
  if (copy.researchGaps.length === 0) throw new Error(`${slug}: ${locale}.researchGaps`)
  requireStringList(copy.researchGaps, `${slug}: ${locale}.researchGaps`)
  if (copy.sideEffects.length === 0) throw new Error(`${slug}: ${locale} safety context`)
  requireStringList(copy.sideEffects, `${slug}: ${locale} safety context`)
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
    if (!entry.identity || !['confirmed', 'ambiguous', 'brand_or_blend', 'complex_mixture'].includes(entry.identity.status)) {
      throw new Error(`${entry.slug}: identity status`)
    }
    requireText(entry.identity.description.de, `${entry.slug}: identity warning`)
    requireText(entry.identity.description.en, `${entry.slug}: identity warning`)
    validateEvidenceMatrix(entry.evidenceMatrix, entry.slug)
    validateEditorialReview(entry.editorialReview, entry.slug)
    validatePublicRecommendations(entry)
    if (!isCalendarDate(entry.reviewedAt)) throw new Error(`${entry.slug}: reviewedAt`)
    if (!Number.isInteger(entry.contentVersion) || entry.contentVersion < 1) {
      throw new Error(`${entry.slug}: contentVersion`)
    }

    if (entry.sources.length === 0) throw new Error(`${entry.slug}: source`)
    const sourceIds = new Set(entry.sources.map(source => source.id))
    if (sourceIds.size !== entry.sources.length) throw new Error(`${entry.slug}: duplicate source id`)
    entry.sources.forEach(source => validateSource(source, entry.slug))
    validateEntrySourceReferences(entry.mechanismSourceIds, sourceIds, entry.slug, 'mechanismSourceIds')
    validateEntrySourceReferences(entry.safetySourceIds, sourceIds, entry.slug, 'safetySourceIds')
    if (entry.researchStatus === 'approved' && !entry.approvals?.some(approval => approval.status === 'approved')) {
      throw new Error(`${entry.slug}: approved status requires a regional approval`)
    }
    for (const approval of entry.approvals ?? []) {
      if (!APPROVAL_REGIONS.has(approval.region)) throw new Error(`${entry.slug}: approval region`)
      if (!APPROVAL_STATUSES.has(approval.status)) throw new Error(`${entry.slug}: approval status`)
      requireText(approval.product, `${entry.slug}: approval product`)
      requireText(approval.indication, `${entry.slug}: approval indication`)
      if (!approval.sourceIds.length) throw new Error(`${entry.slug}: approval has no source`)
      for (const id of approval.sourceIds) {
        if (!sourceIds.has(id)) throw new Error(`Unknown source ${id} in ${entry.slug}`)
      }
      if (!entry.sources.some(source => approval.sourceIds.includes(source.id) && OFFICIAL_APPROVAL_SOURCE_KINDS.has(source.kind))) {
        throw new Error(`${entry.slug}: approval requires an official source`)
      }
    }
    if (entry.blend) {
      if (entry.blend.components.length < 2) throw new Error(`${entry.slug}: blend requires at least two components`)
      const componentKeys = new Set<string>()
      for (const component of entry.blend.components) {
        requireText(component.name, `${entry.slug}: component name`)
        if (component.slug && !entries.some(candidate => candidate.slug === component.slug && !candidate.blend)) {
          throw new Error(`Unknown component ${component.slug} in ${entry.slug}`)
        }
        const key = component.slug ?? component.name.toLowerCase()
        if (component.slug === entry.slug || componentKeys.has(key)) throw new Error(`${entry.slug}: duplicate or self component`)
        componentKeys.add(key)
      }
      if (!entry.blend.sourceIds.length) throw new Error(`${entry.slug}: blend has no composition source`)
      for (const id of entry.blend.sourceIds) {
        if (!sourceIds.has(id)) throw new Error(`Unknown source ${id} in ${entry.slug}`)
      }
    }
    validateCopy(entry.copy.de, 'de', entry.slug, sourceIds, entry.sources)
    validateCopy(entry.copy.en, 'en', entry.slug, sourceIds, entry.sources)
  }
}
