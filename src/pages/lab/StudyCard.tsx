// src/pages/lab/StudyCard.tsx
import { ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PubMedArticle } from './pubmed'
import {
  getEvidenceScore,
  getStudyType,
  getStudyTypeLabel,
  getEvidenceLabel,
  getKeyFindings,
} from './labUtils'

interface StudyCardProps {
  article: PubMedArticle
  variant: 'featured' | 'compact'
}

const STUDY_TYPE_STYLES: Record<string, string> = {
  clinical: 'bg-violet-500/15 text-violet-400',
  meta:     'bg-blue-500/15 text-blue-400',
  human:    'bg-emerald-500/15 text-emerald-400',
  animal:   'bg-orange-500/15 text-orange-400',
  study:    'bg-slate-700/40 text-slate-400',
}

const EVIDENCE_STYLES: Record<string, string> = {
  strong:      'bg-emerald-500/15 text-emerald-400',
  moderate:    'bg-yellow-500/15 text-yellow-400',
  preclinical: 'bg-red-500/15 text-red-400',
  unknown:     'bg-slate-700/40 text-slate-400',
}

const PEPTIDE_ACCENTS: Record<string, string> = {
  'BPC-157':    'border-l-sky-500',
  'TB-500':     'border-l-violet-500',
  'Ipamorelin': 'border-l-emerald-500',
  'CJC-1295':   'border-l-orange-500',
  'Semaglutide':'border-l-teal-500',
  'Tirzepatide':'border-l-indigo-500',
  'Selank':     'border-l-pink-500',
  'Epithalon':  'border-l-amber-500',
}

function detectAccent(title: string): string {
  const found = Object.keys(PEPTIDE_ACCENTS).find(p =>
    title.toUpperCase().includes(p.toUpperCase())
  )
  return PEPTIDE_ACCENTS[found ?? ''] ?? 'border-l-slate-600'
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return authors[0]
  return `${authors[0]} et al.`
}

function BadgeRow({ article }: { article: PubMedArticle }) {
  const studyType    = getStudyType(article.title, article.abstract)
  const evidenceScore = getEvidenceScore(article.title, article.abstract)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-md ${STUDY_TYPE_STYLES[studyType]}`}
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {getStudyTypeLabel(studyType)}
      </span>
      <span
        className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-full ${EVIDENCE_STYLES[evidenceScore]}`}
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {getEvidenceLabel(evidenceScore)}
      </span>
    </div>
  )
}

export function StudyCard({ article, variant }: StudyCardProps) {
  const navigate     = useNavigate()
  const keyFindings  = getKeyFindings(article.abstract)
  const accent       = detectAccent(article.title)

  const openDetail = () => {
    navigate(`/lab/study/${article.id}`, { state: { article } })
  }

  if (variant === 'featured') {
    const snippet = article.abstract
      ? article.abstract.length > 350
        ? `${article.abstract.slice(0, 350).trim()}…`
        : article.abstract
      : 'Kein Abstract verfügbar.'

    return (
      <article className={`bg-[#0B1220] border border-white/[0.06] border-l-4 ${accent} rounded-2xl p-5 mb-4`}>
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <BadgeRow article={article} />
          {article.pubdate && (
            <span
              className="text-[0.6rem] text-slate-600 shrink-0"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {article.pubdate}
            </span>
          )}
        </div>

        {/* Title */}
        <h2
          className="text-base font-black text-white leading-snug mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {article.title}
        </h2>

        {/* Meta */}
        {(article.authors.length > 0 || article.journal) && (
          <div className="flex flex-wrap gap-x-2 text-xs text-slate-500 mb-3">
            {article.authors.length > 0 && <span>{formatAuthors(article.authors)}</span>}
            {article.journal && <span className="text-sky-400/60">{article.journal}</span>}
          </div>
        )}

        {/* Summary divider */}
        <div className="flex items-center gap-3 mb-2">
          <span
            className="text-[0.58rem] uppercase tracking-widest text-sky-400/60 shrink-0"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Zusammenfassung
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        <p className="text-sm text-slate-400 leading-relaxed mb-3">{snippet}</p>

        {/* Key findings */}
        {keyFindings.length > 0 && (
          <ul className="space-y-1 mb-4">
            {keyFindings.slice(0, 2).map((f, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-500">
                <span className="text-sky-400/50 shrink-0">•</span>
                <span>{f.endsWith('.') ? f : `${f}.`}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button type="button" onClick={openDetail} className="btn-primary text-xs flex-1">
            Zusammenfassung lesen
          </button>
          {article.link && (
            <a
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-xs px-3"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </article>
    )
  }

  // Compact variant
  return (
    <article
      className="bg-[#0B1220] border border-white/[0.06] rounded-xl p-4 hover:bg-[#111827] transition-colors duration-150 cursor-pointer"
      onClick={openDetail}
    >
      {/* Top row */}
      <div
        className="flex items-start justify-between gap-2 mb-2"
        onClick={e => e.stopPropagation()}
      >
        <BadgeRow article={article} />
        {article.pubdate && (
          <span
            className="text-[0.6rem] text-slate-600 shrink-0"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {article.pubdate}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-1.5">
        {article.title}
      </h2>

      {/* Snippet */}
      {article.abstract && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-2">
          {article.abstract.length > 120
            ? `${article.abstract.slice(0, 120).trim()}…`
            : article.abstract}
        </p>
      )}

      {/* Key findings */}
      {keyFindings.length > 0 && (
        <ul className="space-y-0.5 mb-3">
          {keyFindings.slice(0, 2).map((f, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-slate-600">
              <span className="text-sky-400/40 shrink-0">•</span>
              <span className="line-clamp-1">{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Bottom row */}
      <div
        className="flex items-center justify-between"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-xs text-slate-700 cursor-not-allowed" title="Coming soon">
          ♡ Speichern
        </span>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="text-slate-600 hover:text-sky-400 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </article>
  )
}
