// src/pages/lab/StudyCard.tsx
import { ExternalLink, Bookmark, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { PubMedArticle } from './pubmed'
import {
  getEvidenceScore,
  getStudyType,
  getStudyTypeLabel,
  getEvidenceLabel,
  getKeyFindings,
} from './labUtils'
import type { EvidenceScore, StudyType } from './labUtils'

// ─── Style Configs ────────────────────────────────────────────────────────────

interface StudyTypeConfig {
  badge:     string
  topBorder: string
  hoverGlow: string
}

const STUDY_TYPE_CONFIG: Record<StudyType, StudyTypeConfig> = {
  clinical: {
    badge:     'bg-violet-500/15 text-violet-300 border border-violet-500/25',
    topBorder: 'border-t-violet-500',
    hoverGlow: 'hover:shadow-[0_16px_48px_rgba(139,92,246,0.10)]',
  },
  meta: {
    badge:     'bg-blue-500/15 text-blue-300 border border-blue-500/25',
    topBorder: 'border-t-blue-500',
    hoverGlow: 'hover:shadow-[0_16px_48px_rgba(59,130,246,0.10)]',
  },
  human: {
    badge:     'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
    topBorder: 'border-t-emerald-500',
    hoverGlow: 'hover:shadow-[0_16px_48px_rgba(16,185,129,0.10)]',
  },
  animal: {
    badge:     'bg-orange-500/15 text-orange-300 border border-orange-500/25',
    topBorder: 'border-t-orange-500',
    hoverGlow: 'hover:shadow-[0_16px_48px_rgba(249,115,22,0.10)]',
  },
  study: {
    badge:     'bg-slate-700/50 text-slate-400 border border-slate-600/30',
    topBorder: 'border-t-slate-600',
    hoverGlow: 'hover:shadow-[0_16px_48px_rgba(0,0,0,0.25)]',
  },
}

interface EvidenceConfig {
  badge:     string
  textColor: string
  barColor:  string
  barWidth:  string
  dotGlow:   string
}

const EVIDENCE_CONFIG: Record<EvidenceScore, EvidenceConfig> = {
  strong: {
    badge:     'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
    textColor: 'text-emerald-300',
    barColor:  'bg-emerald-500',
    barWidth:  'w-full',
    dotGlow:   'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
  },
  moderate: {
    badge:     'bg-amber-500/15 text-amber-300 border border-amber-500/25',
    textColor: 'text-amber-300',
    barColor:  'bg-amber-500',
    barWidth:  'w-2/3',
    dotGlow:   'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
  },
  preclinical: {
    badge:     'bg-rose-500/15 text-rose-300 border border-rose-500/25',
    textColor: 'text-rose-300',
    barColor:  'bg-rose-500',
    barWidth:  'w-1/3',
    dotGlow:   'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
  },
  unknown: {
    badge:     'bg-slate-700/40 text-slate-500 border border-slate-600/25',
    textColor: 'text-slate-500',
    barColor:  'bg-slate-600',
    barWidth:  'w-1/4',
    dotGlow:   'bg-slate-500',
  },
}

// Peptide left-border accent
const PEPTIDE_LEFT_BORDER: Record<string, string> = {
  'BPC-157':    'border-l-sky-500',
  'TB-500':     'border-l-violet-500',
  'Ipamorelin': 'border-l-emerald-500',
  'CJC-1295':   'border-l-orange-500',
  'Semaglutide':'border-l-teal-500',
  'Tirzepatide':'border-l-indigo-500',
  'Selank':     'border-l-pink-500',
  'Epithalon':  'border-l-amber-500',
}

// Peptide pill tag colors
const PEPTIDE_TAG_COLORS: Record<string, string> = {
  'BPC-157':    'bg-sky-500/10 text-sky-300 border-sky-500/20',
  'TB-500':     'bg-violet-500/10 text-violet-300 border-violet-500/20',
  'Ipamorelin': 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  'CJC-1295':   'bg-orange-500/10 text-orange-300 border-orange-500/20',
  'Semaglutide':'bg-teal-500/10 text-teal-300 border-teal-500/20',
  'Tirzepatide':'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  'Selank':     'bg-pink-500/10 text-pink-300 border-pink-500/20',
  'Epithalon':  'bg-amber-500/10 text-amber-300 border-amber-500/20',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectLeftBorder(title: string): string {
  const found = Object.keys(PEPTIDE_LEFT_BORDER).find(p =>
    title.toUpperCase().includes(p.toUpperCase())
  )
  return PEPTIDE_LEFT_BORDER[found ?? ''] ?? 'border-l-slate-700/50'
}

function detectTags(title: string): string[] {
  return Object.keys(PEPTIDE_LEFT_BORDER).filter(p =>
    title.toUpperCase().includes(p.toUpperCase())
  )
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return ''
  return authors.length === 1 ? authors[0] : `${authors[0]} et al.`
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function StudyTypeBadge({ type }: { type: StudyType }) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex items-center text-[0.58rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${STUDY_TYPE_CONFIG[type].badge}`}
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {t(getStudyTypeLabel(type))}
    </span>
  )
}

function EvidencePill({ score }: { score: EvidenceScore }) {
  const { t } = useTranslation()
  const c = EVIDENCE_CONFIG[score]
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[0.58rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${c.badge}`}
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <span className={`w-1 h-1 rounded-full shrink-0 ${c.dotGlow}`} />
      {t(getEvidenceLabel(score))}
    </span>
  )
}

function EvidenceBar({ score }: { score: EvidenceScore }) {
  const { t } = useTranslation()
  const c = EVIDENCE_CONFIG[score]
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[0.52rem] uppercase tracking-[0.18em] text-slate-600 shrink-0"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {t('lab_evidence_bar_label')}
      </span>
      <div className="flex-1 h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${c.barColor} ${c.barWidth}`} />
      </div>
      <div className={`flex items-center gap-1.5 ${c.textColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dotGlow}`} />
        <span
          className="text-[0.58rem] font-black uppercase tracking-wider"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {t(getEvidenceLabel(score))}
        </span>
      </div>
    </div>
  )
}

function PeptideTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map(tag => (
        <span
          key={tag}
          className={`text-[0.6rem] font-semibold px-2 py-0.5 rounded-full border ${
            PEPTIDE_TAG_COLORS[tag] ?? 'bg-slate-700/40 text-slate-400 border-slate-600/25'
          }`}
        >
          {tag}
        </span>
      ))}
    </div>
  )
}

function SectionDivider({ label, suffix }: { label: string; suffix?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[0.52rem] font-black uppercase tracking-[0.2em] text-sky-400/55 shrink-0"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.05]" />
      {suffix && (
        <span
          className="text-[0.48rem] text-slate-700 uppercase tracking-[0.15em] shrink-0"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {suffix}
        </span>
      )}
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────

interface StudyCardProps {
  article: PubMedArticle
  variant: 'featured' | 'compact'
}

export function StudyCard({ article, variant }: StudyCardProps) {
  const { t }         = useTranslation()
  const navigate      = useNavigate()
  const studyType     = getStudyType(article.title, article.abstract)
  const evidenceScore = getEvidenceScore(article.title, article.abstract)
  const keyFindings   = getKeyFindings(article.abstract)
  const leftBorder    = detectLeftBorder(article.title)
  const tags          = detectTags(article.title)
  const typeConfig    = STUDY_TYPE_CONFIG[studyType]

  const openDetail = () => navigate(`/lab/study/${article.id}`, { state: { article } })

  // ── Featured Card ─────────────────────────────────────────────────────────
  if (variant === 'featured') {
    const snippet = article.abstract
      ? article.abstract.length > 400
        ? `${article.abstract.slice(0, 400).trim()}…`
        : article.abstract
      : t('lab_no_abstract')

    return (
      <article
        className={[
          'group relative bg-[#0B1220] rounded-2xl overflow-hidden mb-5',
          'border border-white/[0.07]',
          `border-t-2 ${typeConfig.topBorder}`,
          `border-l-2 ${leftBorder}`,
          'cursor-pointer transition-all duration-300',
          `hover:border-white/[0.14] ${typeConfig.hoverGlow}`,
        ].join(' ')}
        onClick={openDetail}
      >
        {/* Subtle inner gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.018] via-transparent to-transparent pointer-events-none" />

        <div className="relative p-5 space-y-4">

          {/* ── Badges + Date ─────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StudyTypeBadge type={studyType} />
              <EvidencePill score={evidenceScore} />
            </div>
            {article.pubdate && (
              <span
                className="text-[0.58rem] text-slate-700 shrink-0 mt-0.5"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {article.pubdate}
              </span>
            )}
          </div>

          {/* ── Title + Authors ───────────────────────────────────────────── */}
          <div>
            <h2
              className="text-lg font-black text-white leading-snug mb-1.5 group-hover:text-sky-50 transition-colors duration-200"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {article.title}
            </h2>
            {(article.authors.length > 0 || article.journal) && (
              <p className="text-xs text-slate-500">
                {article.authors.length > 0 && formatAuthors(article.authors)}
                {article.journal && (
                  <span className="text-sky-400/50"> · {article.journal}</span>
                )}
              </p>
            )}
          </div>

          {/* ── AI Summary ───────────────────────────────────────────────── */}
          <div>
            <SectionDivider label={t('lab_summary')} suffix="AI" />
            <p className="text-sm text-slate-300 leading-relaxed mt-2">{snippet}</p>
          </div>

          {/* ── Key Findings ─────────────────────────────────────────────── */}
          {keyFindings.length > 0 && (
            <div>
              <SectionDivider label={t('lab_key_findings')} />
              <ul className="space-y-2 mt-2">
                {keyFindings.slice(0, 3).map((f, i) => (
                  <li key={i} className="flex gap-2.5 text-xs text-slate-400 leading-relaxed">
                    <ArrowRight size={11} className="text-sky-400/40 shrink-0 mt-0.5" />
                    <span>{f.endsWith('.') ? f : `${f}.`}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Evidence Strength Bar ─────────────────────────────────────── */}
          <EvidenceBar score={evidenceScore} />

          {/* ── Peptide Tags ─────────────────────────────────────────────── */}
          {tags.length > 0 && <PeptideTags tags={tags} />}

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={openDetail}
              className="btn-primary text-sm flex-1 flex items-center justify-center gap-2 group/btn"
            >
              {t('lab_read_summary')}
              <ArrowRight
                size={14}
                className="opacity-60 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all duration-200"
              />
            </button>
            {article.link && (
              <a
                href={article.link}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary flex items-center justify-center px-3 hover:text-sky-400 transition-colors"
                title="PubMed"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </article>
    )
  }

  // ── Compact Card ──────────────────────────────────────────────────────────
  return (
    <article
      className="group bg-[#0B1220] border border-white/[0.06] rounded-xl p-4 cursor-pointer
        hover:bg-[#0d1525] hover:border-white/[0.12]
        hover:shadow-[0_4px_24px_rgba(0,0,0,0.45)]
        transition-all duration-200"
      onClick={openDetail}
    >
      {/* Badges + Date */}
      <div
        className="flex items-start justify-between gap-2 mb-2.5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <StudyTypeBadge type={studyType} />
          <EvidencePill score={evidenceScore} />
        </div>
        {article.pubdate && (
          <span
            className="text-[0.56rem] text-slate-700 shrink-0"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {article.pubdate}
          </span>
        )}
      </div>

      {/* Title */}
      <h2
        className="text-sm font-bold text-white leading-snug line-clamp-2 mb-2
          group-hover:text-sky-50 transition-colors duration-200"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {article.title}
      </h2>

      {/* Abstract snippet */}
      {article.abstract && (
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2.5">
          {article.abstract.length > 130
            ? `${article.abstract.slice(0, 130).trim()}…`
            : article.abstract}
        </p>
      )}

      {/* Key findings */}
      {keyFindings.length > 0 && (
        <ul className="space-y-1 mb-3">
          {keyFindings.slice(0, 2).map((f, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-slate-600 leading-snug">
              <ArrowRight size={9} className="text-sky-400/35 shrink-0 mt-0.5" />
              <span className="line-clamp-1">{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Peptide tags */}
      {tags.length > 0 && (
        <div className="mb-3">
          <PeptideTags tags={tags} />
        </div>
      )}

      {/* Footer: Save + PubMed */}
      <div
        className="flex items-center justify-between pt-2.5 border-t border-white/[0.05]"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-400 transition-colors cursor-not-allowed"
          title="Coming soon"
        >
          <Bookmark size={11} />
          {t('lab_save')}
        </button>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-slate-600 hover:text-sky-400 transition-colors duration-150"
          >
            <ExternalLink size={12} />
            <span
              className="text-[0.56rem] opacity-0 group-hover:opacity-60 transition-opacity duration-200"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              PubMed
            </span>
          </a>
        )}
      </div>
    </article>
  )
}
