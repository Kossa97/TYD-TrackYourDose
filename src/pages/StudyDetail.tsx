// src/pages/StudyDetail.tsx
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PubMedArticle } from './lab/pubmed'
import {
  getEvidenceScore,
  getStudyType,
  getStudyTypeLabel,
  getEvidenceLabel,
  getEvidenceContext,
  getKeyFindings,
  getLimitationsAndRisks,
  getDefaultLimitationKey,
} from './lab/labUtils'
import { ResearchDisclaimer } from '../components/ui/DesignSystem'

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

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl p-5">
      <p
        className="text-[0.58rem] font-black uppercase tracking-widest text-sky-400/60 mb-3"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

export function StudyDetail() {
  const { t }     = useTranslation()
  const navigate  = useNavigate()
  const location  = useLocation()
  const article   = (location.state as { article?: PubMedArticle } | null)?.article
  const [abstractOpen, setAbstractOpen] = useState(false)

  if (!article) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-sm mb-4">{t('lab_study_not_found')}</p>
        <button type="button" onClick={() => navigate('/lab')} className="btn-secondary text-sm">
          ← {t('lab_back_to_research')}
        </button>
      </div>
    )
  }

  const studyType     = getStudyType(article.title, article.abstract)
  const evidenceScore = getEvidenceScore(article.title, article.abstract)
  const keyFindings   = getKeyFindings(article.abstract)
  const limitations   = getLimitationsAndRisks(article.abstract)
  const fallbackLimitationKey = getDefaultLimitationKey(studyType, evidenceScore)

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <ResearchDisclaimer
        compact
        title={t('lab_disclaimer_title')}
        body={t('lab_disclaimer_body')}
      />
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft size={14} />
        {t('lab_back_to_research')}
      </button>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-md ${STUDY_TYPE_STYLES[studyType]}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t(getStudyTypeLabel(studyType))}
          </span>
          <span
            className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-full ${EVIDENCE_STYLES[evidenceScore]}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t(getEvidenceLabel(evidenceScore))}
          </span>
          {article.pubdate && (
            <span
              className="text-[0.6rem] text-slate-600"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {article.pubdate}
            </span>
          )}
        </div>

        <h1
          className="text-2xl font-black text-white leading-snug mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {article.title}
        </h1>

        {(article.authors.length > 0 || article.journal) && (
          <p className="text-sm text-slate-500">
            {article.authors.length > 0 && (
              <span>
                {article.authors.length === 1 ? article.authors[0] : `${article.authors[0]} et al.`}
              </span>
            )}
            {article.journal && (
              <span className="text-sky-400/60"> · {article.journal}</span>
            )}
          </p>
        )}
      </div>

      {/* Summary */}
      <SectionCard label={t('lab_summary_label')}>
        <p className="text-sm text-slate-300 leading-relaxed">
          {article.abstract || t('lab_no_abstract')}
        </p>
      </SectionCard>

      {/* Key Findings */}
      {keyFindings.length > 0 && (
        <SectionCard label={t('lab_key_findings')}>
          <ul className="space-y-2">
            {keyFindings.map((finding, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300">
                <span className="text-sky-400/60 shrink-0 mt-0.5">•</span>
                <span>{finding.endsWith('.') ? finding : `${finding}.`}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Risks & limitations */}
      <SectionCard label={t('lab_risks_limitations')}>
        {limitations.length > 0 ? (
          <ul className="space-y-2">
            {limitations.map((line, i) => (
              <li key={i} className="flex gap-3 text-sm text-amber-200/80">
                <span className="text-amber-400/60 shrink-0 mt-0.5">!</span>
                <span>{line.endsWith('.') ? line : `${line}.`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 leading-relaxed">{t(fallbackLimitationKey)}</p>
        )}
      </SectionCard>

      {/* Evidence Analysis */}
      <SectionCard label={t('lab_evidence_analysis')}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{t('lab_study_type_label')}</span>
            <span
              className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-md ${STUDY_TYPE_STYLES[studyType]}`}
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {t(getStudyTypeLabel(studyType))}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{t('lab_evidence_level')}</span>
            <span
              className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-full ${EVIDENCE_STYLES[evidenceScore]}`}
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {t(getEvidenceLabel(evidenceScore))}
            </span>
          </div>
          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              {t(getEvidenceContext(evidenceScore))}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Abstract Accordion */}
      <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setAbstractOpen(o => !o)}
          className="flex items-center justify-between w-full px-5 py-4 text-left"
        >
          <span
            className="text-[0.58rem] font-black uppercase tracking-widest text-slate-500"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t('lab_original_abstract')}
          </span>
          {abstractOpen
            ? <ChevronUp size={14} className="text-slate-500" />
            : <ChevronDown size={14} className="text-slate-500" />
          }
        </button>
        {abstractOpen && (
          <div className="px-5 pb-5 border-t border-white/[0.06]">
            <p className="text-sm text-slate-400 leading-relaxed pt-4">
              {article.abstract || t('lab_no_abstract')}
            </p>
          </div>
        )}
      </div>

      {/* PubMed Button */}
      {article.link && (
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {t('lab_open_pubmed')} <ExternalLink size={14} />
        </a>
      )}
    </div>
  )
}
