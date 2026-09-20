import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { PeptipediaView, PeptipediaSource } from '../content/types'
import { PEPTIPEDIA_UI_COPY } from '../content/uiCopy'
import type { PeptipediaLocale } from '../content/types'

function EvidenceRow({
  label,
  value,
  detail,
}: {
  label: string
  value: ReactNode
  detail?: string
}) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt
        className="text-[0.6rem] uppercase tracking-[0.12em] text-slate-500"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {label}
      </dt>
      <dd className="text-sm text-slate-300 leading-relaxed">
        <div>{value}</div>
        {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
      </dd>
    </div>
  )
}

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl p-5">
    <h2 className="text-[0.55rem] font-black uppercase tracking-[0.2em] text-sky-400/55 mb-3" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{label}</h2>
    {children}
  </div>
}

function SourceLinks({ sources, locale }: { sources: PeptipediaSource[]; locale: PeptipediaLocale }) {
  const copy = PEPTIPEDIA_UI_COPY[locale].sources
  return <ul className="space-y-3 mt-3">{sources.map(source => <li key={source.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1.5 text-xs text-sky-400 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 rounded-sm break-words">
      <span>{source.title}</span><ExternalLink size={12} className="shrink-0 mt-0.5" />
    </a>
    <div className="mt-2 flex flex-wrap gap-2 text-[0.62rem]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <span className="rounded-full border border-sky-500/20 bg-sky-500/[0.07] px-2 py-0.5 text-sky-300">{copy.kind[source.kind]}</span>
      <span className="px-1 py-0.5 text-slate-500">{source.year}</span>
    </div>
    <p className="mt-2 text-xs text-slate-400">{source.publisherOrAuthors}</p>
    <p className="mt-1 text-[0.65rem] text-slate-500">{copy.accessed}: <time dateTime={source.accessedAt}>{source.accessedAt}</time></p>
    {source.kind === 'catalog' && <p className="mt-2 text-[0.65rem] text-amber-300/70">{copy.catalogueNote}</p>}
  </li>)}</ul>
}

function TextList({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <ul className="space-y-2">{items.map(item => <li key={item} className="flex gap-2.5 text-sm text-slate-400 leading-relaxed"><span className="text-slate-600 shrink-0">·</span><span>{item}</span></li>)}</ul> : <p className="text-sm text-slate-400 leading-relaxed">{empty}</p>
}

export function OverviewPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  const matrix = copy.evidence
  const approvals = peptide.approvals?.filter(approval => approval.status === 'approved') ?? []
  return <div className="space-y-5">
    <SectionCard label={copy.headings.researchAreas}><div className="flex flex-wrap gap-2">{peptide.researchAreas.map(area => <span key={area} className="text-xs text-slate-300 bg-white/[0.05] border border-white/[0.08] px-3 py-1 rounded-full">{area}</span>)}</div></SectionCard>
    <SectionCard label={matrix.heading}>
      <dl className="divide-y divide-white/[0.05]">
        <EvidenceRow label={matrix.dimensions.identity} value={matrix.identity[peptide.identity.status]} detail={peptide.identity.description[peptide.locale]} />
        <EvidenceRow label={matrix.dimensions.human} value={matrix.human[peptide.evidenceMatrix.human]} />
        <EvidenceRow label={matrix.dimensions.replication} value={matrix.replication[peptide.evidenceMatrix.replication]} />
        <EvidenceRow label={matrix.dimensions.endpoints} value={matrix.endpoints[peptide.evidenceMatrix.endpoints]} />
        <EvidenceRow label={matrix.dimensions.safety} value={matrix.safety[peptide.evidenceMatrix.safety]} />
        <EvidenceRow label={matrix.dimensions.approval} value={approvals.length
          ? <div className="flex flex-wrap gap-2">{approvals.map(approval => <span key={`${approval.region}-${approval.product}`} title={`${approval.product}: ${approval.indication}`} className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">{approval.region} · {peptide.locale === 'de' ? 'Zugelassen' : 'Approved'}</span>)}</div>
          : matrix.noApproval} />
      </dl>
      <p className="mt-4 border-t border-white/[0.05] pt-3 text-xs text-slate-500">{matrix.note}</p>
    </SectionCard>
    {peptide.overviewFacts.map(fact => <SectionCard key={fact.id} label={fact.label}><p className="text-sm text-slate-300 leading-relaxed">{fact.value}</p><SourceLinks locale={peptide.locale} sources={peptide.sources.filter(source => fact.sourceIds.includes(source.id))} /></SectionCard>)}
    <SectionCard label={copy.headings.researchGaps}><TextList items={peptide.researchGaps} empty={copy.empty.list} /></SectionCard>
  </div>
}

export function MechanismPanel({ peptide }: { peptide: PeptipediaView }) {
  return <SectionCard label={PEPTIPEDIA_UI_COPY[peptide.locale].tabs.mechanism}><p className="text-sm text-slate-300 leading-relaxed">{peptide.mechanism}</p><SourceLinks locale={peptide.locale} sources={peptide.sources.filter(source => peptide.mechanismSourceIds.includes(source.id))} /></SectionCard>
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
    <SourceLinks locale={peptide.locale} sources={peptide.sources.filter(source => protocol.sourceIds.includes(source.id))} />
  </SectionCard>)}</div>
}

export function SafetyPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  return <div className="space-y-5">{(['sideEffects', 'contraindications', 'interactions'] as const).map(field => <SectionCard key={field} label={copy.headings[field]}><TextList items={peptide[field]} empty={copy.empty.list} /></SectionCard>)}
    <SectionCard label={copy.headings.researchGaps}><TextList items={peptide.researchGaps} empty={copy.empty.list} /><SourceLinks locale={peptide.locale} sources={peptide.sources.filter(source => peptide.safetySourceIds.includes(source.id))} /></SectionCard>
  </div>
}

export function SourcesPanel({ peptide }: { peptide: PeptipediaView }) {
  const copy = PEPTIPEDIA_UI_COPY[peptide.locale]
  const versionLabel = peptide.locale === 'de' ? 'Fassung' : 'Version'
  return <SectionCard label={copy.tabs.sources}><p className="text-xs text-slate-500">{copy.reviewed}: <time dateTime={peptide.reviewedAt}>{peptide.reviewedAt}</time> · {versionLabel} {peptide.contentVersion}</p><SourceLinks locale={peptide.locale} sources={peptide.sources} /></SectionCard>
}
