import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { PeptipediaView, PeptipediaSource } from '../content/types'
import { PEPTIPEDIA_UI_COPY } from '../content/uiCopy'
import { peptipediaText } from '../content/legacyLabels'
import { CATEGORY_COLORS, EVIDENCE_BAR_WIDTH, EVIDENCE_LABEL_KEYS } from '../display'
import type { PeptipediaLocale, EvidenceLevel, ClinicalLevel } from '../content/types'

function EvidenceRow({
  locale,
  label,
  value,
  barColor,
}: {
  locale: PeptipediaLocale
  label: string
  value: EvidenceLevel | ClinicalLevel
  barColor: string
}) {
  const t = peptipediaText(locale)
  const width = EVIDENCE_BAR_WIDTH[value] ?? 'w-0'
  const text  = t(EVIDENCE_LABEL_KEYS[value] ?? 'plib_ev_none')

  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[0.6rem] text-slate-500 w-24 shrink-0"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {label}
      </span>
      <div className="flex-1 h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} ${width}`} />
      </div>
      <span
        className="text-[0.6rem] text-slate-500 w-20 text-right shrink-0"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {text}
      </span>
    </div>
  )
}

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl p-5">
    <h2 className="text-[0.55rem] font-black uppercase tracking-[0.2em] text-sky-400/55 mb-3" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{label}</h2>
    {children}
  </div>
}

function SourceLinks({ sources }: { sources: PeptipediaSource[] }) {
  return <ul className="space-y-2 mt-3">{sources.map(source => <li key={source.id}>
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 text-xs text-sky-400 hover:text-sky-300 break-words">
      <span>{source.title} ({source.year})</span><ExternalLink size={12} className="shrink-0 mt-0.5" />
    </a>
  </li>)}</ul>
}

function TextList({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <ul className="space-y-2">{items.map(item => <li key={item} className="flex gap-2.5 text-sm text-slate-400 leading-relaxed"><span className="text-slate-600 shrink-0">·</span><span>{item}</span></li>)}</ul> : <p className="text-sm text-slate-400 leading-relaxed">{empty}</p>
}

export function OverviewPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  const t = peptipediaText(peptide.locale)
  return <div className="space-y-5">
    <SectionCard label={copy.headings.researchAreas}><div className="flex flex-wrap gap-2">{peptide.researchAreas.map(area => <span key={area} className="text-xs text-slate-300 bg-white/[0.05] border border-white/[0.08] px-3 py-1 rounded-full">{area}</span>)}</div></SectionCard>
    <SectionCard label={t('plib_evidence')}>
      <div className="space-y-3 mb-4">
        <EvidenceRow locale={peptide.locale} label={t('plib_ev_human_long')} value={peptide.evidence.human} barColor="bg-emerald-500" />
        <EvidenceRow locale={peptide.locale} label={t('plib_ev_animal_long')} value={peptide.evidence.animal} barColor="bg-amber-500" />
        <EvidenceRow locale={peptide.locale} label={t('plib_ev_clinical_long')} value={peptide.evidence.clinical} barColor="bg-violet-500" />
      </div>
      <div className="border-t border-white/[0.05] pt-3 flex items-center justify-between">
        <div className="flex-1">
          <p className="text-[0.55rem] uppercase tracking-widest text-slate-600 mb-1" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t('plib_total_score')}</p>
          <div className="flex items-center gap-2">{Array.from({ length: 10 }).map((_, index) => <div key={index} className={`h-1.5 w-full rounded-full ${index < peptide.evidence.score ? CATEGORY_COLORS[peptide.category].scoreDot : 'bg-white/[0.05]'}`} />)}</div>
        </div>
        <span className={`ml-4 text-sm font-black ${CATEGORY_COLORS[peptide.category].text}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{peptide.evidence.score}/10</span>
      </div>
      <p className="text-xs text-slate-500 mt-2">{peptide.locale === 'de' ? 'Redaktionelle Einordnung der ausgewerteten Evidenz, kein validierter medizinischer Score.' : 'Editorial assessment of the reviewed evidence, not a validated medical score.'}</p>
    </SectionCard>
    {peptide.overviewFacts.map(fact => <SectionCard key={fact.id} label={fact.label}><p className="text-sm text-slate-300 leading-relaxed">{fact.value}</p><SourceLinks sources={peptide.sources.filter(source => fact.sourceIds.includes(source.id))} /></SectionCard>)}
    <SectionCard label={copy.headings.researchGaps}><TextList items={peptide.researchGaps} empty={copy.empty.list} /></SectionCard>
  </div>
}

export function MechanismPanel({ peptide }: { peptide: PeptipediaView }) {
  return <SectionCard label={PEPTIPEDIA_UI_COPY[peptide.locale].tabs.mechanism}><p className="text-sm text-slate-300 leading-relaxed">{peptide.mechanism}</p><SourceLinks sources={peptide.sources.filter(source => source.kind !== 'regulator')} /></SectionCard>
}

export function ProtocolsPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  const labels = peptide.locale === 'de'
    ? { populationOrModel: 'Population / Modell', route: 'Verabreichung', amount: 'Menge laut Quelle', frequency: 'Häufigkeit', duration: 'Dauer', objective: 'Fragestellung', outcome: 'Ergebnis / Einordnung' }
    : { populationOrModel: 'Population / model', route: 'Route', amount: 'Amount reported', frequency: 'Frequency', duration: 'Duration', objective: 'Objective', outcome: 'Outcome / context' }
  if (!peptide.protocols.length) return <SectionCard label={copy.tabs.protocols}><p className="text-sm text-slate-400">{copy.empty.protocols}</p></SectionCard>
  return <div className="space-y-5">{peptide.protocols.map(protocol => <SectionCard key={protocol.id} label={copy.protocolEvidence[protocol.evidenceType]}>
    <dl className="space-y-3">{(Object.keys(labels) as Array<keyof typeof labels>).map(field => <div key={field}>
      <dt className="text-xs text-slate-500 mb-1">{labels[field]}</dt><dd className="text-sm text-slate-300 leading-relaxed">{protocol[field]}</dd>
    </div>)}</dl>
    <SourceLinks sources={peptide.sources.filter(source => protocol.sourceIds.includes(source.id))} />
  </SectionCard>)}</div>
}

export function SafetyPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  return <div className="space-y-5">{(['sideEffects', 'contraindications', 'interactions'] as const).map(field => <SectionCard key={field} label={copy.headings[field]}><TextList items={peptide[field]} empty={copy.empty.list} /></SectionCard>)}
    <SectionCard label={copy.headings.researchGaps}><TextList items={peptide.researchGaps} empty={copy.empty.list} /><SourceLinks sources={peptide.sources} /></SectionCard>
  </div>
}

export function SourcesPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  return <SectionCard label={copy.tabs.sources}><p className="text-xs text-slate-500">{copy.reviewed}: <time dateTime={peptide.reviewedAt}>{peptide.reviewedAt}</time> · Version {peptide.contentVersion}</p><SourceLinks sources={peptide.sources} /></SectionCard>
}
