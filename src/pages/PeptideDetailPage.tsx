// src/pages/PeptideDetailPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, AlertTriangle, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getPeptideBySlug,
  CATEGORY_LABEL_KEYS,
  CATEGORY_COLORS,
  STATUS_LABEL_KEYS,
  STATUS_STYLES,
  EVIDENCE_BAR_WIDTH,
  EVIDENCE_LABEL_KEYS,
  getConfidenceLabelKey,
  getConfidenceStyle,
} from '../services/peptideLibrary'
import type { PeptideEntry, EvidenceLevel, ClinicalLevel } from '../services/peptideLibrary'

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ label, children }: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl p-5">
      <p
        className="text-[0.55rem] font-black uppercase tracking-[0.2em] text-sky-400/55 mb-3"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

// ─── Evidence Row ─────────────────────────────────────────────────────────────

function EvidenceRow({
  label,
  value,
  barColor,
}: {
  label: string
  value: EvidenceLevel | ClinicalLevel
  barColor: string
}) {
  const { t } = useTranslation()
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-10 animate-pulse">
      <div className="h-4 w-24 bg-white/[0.06] rounded" />
      <div className="h-10 w-48 bg-white/[0.08] rounded" />
      <div className="h-3 w-64 bg-white/[0.04] rounded" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-[#0B1220] border border-white/[0.05] rounded-2xl p-5">
          <div className="h-2 w-20 bg-white/[0.06] rounded mb-3" />
          <div className="space-y-1.5">
            <div className="h-3 bg-white/[0.04] rounded" />
            <div className="h-3 w-5/6 bg-white/[0.04] rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PeptideDetailPage() {
  const { t }                     = useTranslation()
  const { slug }                  = useParams<{ slug: string }>()
  const navigate                  = useNavigate()
  const [peptide, setPeptide]     = useState<PeptideEntry | null>(null)
  const [loading, setLoading]     = useState(true)
  const [abstractOpen, setAbstractOpen] = useState(false)

  useEffect(() => {
    if (!slug) return
    getPeptideBySlug(slug)
      .then(setPeptide)
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <Skeleton />

  if (!peptide) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-sm mb-4">{t('plib_not_found')}</p>
        <button
          type="button"
          onClick={() => navigate('/lab/library')}
          className="btn-secondary text-sm"
        >
          ← {t('plib_back_to_library')}
        </button>
      </div>
    )
  }

  const catColors  = CATEGORY_COLORS[peptide.category]
  const confLabel  = t(getConfidenceLabelKey(peptide.evidence_score))
  const confStyle  = getConfidenceStyle(peptide.evidence_score)
  const pubmedUrl  = peptide.pubmed_query
    ? `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(peptide.pubmed_query)}`
    : `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(peptide.name)}`

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">

      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => navigate('/lab/library')}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft size={12} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t('plib_breadcrumb_library')}</span>
      </button>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`text-[0.56rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#0B1220] border border-white/[0.08] ${catColors.text}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t(CATEGORY_LABEL_KEYS[peptide.category])}
          </span>
          <span
            className={`text-[0.56rem] font-black uppercase px-2 py-0.5 rounded-md ${STATUS_STYLES[peptide.research_status]}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t(STATUS_LABEL_KEYS[peptide.research_status])}
          </span>
          <span
            className={`text-[0.56rem] font-black uppercase px-2 py-0.5 rounded-md border ${confStyle}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {confLabel}
          </span>
        </div>

        <h1
          className="text-3xl font-black text-white leading-tight mb-1"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {peptide.name}
        </h1>
        {peptide.full_name && (
          <p
            className="text-xs text-slate-600 mb-3"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {peptide.full_name}
          </p>
        )}
        <p className="text-sm text-slate-400 leading-relaxed">{peptide.tldr}</p>
      </div>

      {/* Research disclaimer */}
      <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
        <AlertTriangle size={13} className="text-amber-400/60 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/55 leading-relaxed">
          {t('plib_detail_disclaimer')}
        </p>
      </div>

      {/* Mechanism */}
      <SectionCard label={t('plib_mechanism')}>
        <p className="text-sm text-slate-300 leading-relaxed">{peptide.mechanism}</p>
      </SectionCard>

      {/* Research Areas (Benefits as pills) */}
      {peptide.benefits.length > 0 && (
        <SectionCard label={t('plib_research_areas')}>
          <div className="flex flex-wrap gap-2">
            {peptide.benefits.map((b, i) => (
              <span
                key={i}
                className="text-xs text-slate-300 bg-white/[0.05] border border-white/[0.08] px-3 py-1 rounded-full"
              >
                {b}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Evidence Strength */}
      <SectionCard label={t('plib_evidence')}>
        <div className="space-y-3 mb-4">
          <EvidenceRow
            label={t('plib_ev_human_long')}
            value={peptide.evidence_human}
            barColor="bg-emerald-500"
          />
          <EvidenceRow
            label={t('plib_ev_animal_long')}
            value={peptide.evidence_animal}
            barColor="bg-amber-500"
          />
          <EvidenceRow
            label={t('plib_ev_clinical_long')}
            value={peptide.evidence_clinical}
            barColor="bg-violet-500"
          />
        </div>

        {/* Overall score */}
        <div className="border-t border-white/[0.05] pt-3 flex items-center justify-between">
          <div>
            <p
              className="text-[0.55rem] uppercase tracking-widest text-slate-600 mb-1"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {t('plib_total_score')}
            </p>
            <div className="flex items-center gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-full rounded-full ${
                    i < peptide.evidence_score ? catColors.scoreDot : 'bg-white/[0.05]'
                  }`}
                />
              ))}
            </div>
          </div>
          <span
            className={`ml-4 text-sm font-black ${catColors.text}`}
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {peptide.evidence_score}/10
          </span>
        </div>
      </SectionCard>

      {/* Study Dosages */}
      {peptide.research_dosage && (
        <SectionCard label={t('plib_study_dosages')}>
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle size={11} className="text-slate-600 shrink-0 mt-0.5" />
            <p
              className="text-[0.58rem] text-slate-700"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {t('plib_dosage_note')}
            </p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{peptide.research_dosage}</p>
        </SectionCard>
      )}

      {/* Administration */}
      {peptide.administration.length > 0 && (
        <SectionCard label={t('plib_administration')}>
          <div className="flex flex-wrap gap-2">
            {peptide.administration.map((route, i) => (
              <span
                key={i}
                className="text-xs text-slate-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1 rounded-lg"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {route}
              </span>
            ))}
          </div>
          {peptide.half_life && (
            <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-2">
              <span
                className="text-[0.55rem] uppercase tracking-widest text-slate-600"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {t('plib_half_life')}
              </span>
              <span className="text-xs text-slate-400">{peptide.half_life}</span>
            </div>
          )}
        </SectionCard>
      )}

      {/* Side Effects */}
      {peptide.side_effects.length > 0 && (
        <SectionCard label={t('plib_side_effects')}>
          <ul className="space-y-2">
            {peptide.side_effects.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-400 leading-relaxed">
                <span className="text-rose-400/50 shrink-0 mt-0.5">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Contraindications */}
      {peptide.contraindications.length > 0 && (
        <SectionCard label={t('plib_contraindications')}>
          <ul className="space-y-2">
            {peptide.contraindications.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-400 leading-relaxed">
                <AlertTriangle size={11} className="text-amber-400/50 shrink-0 mt-0.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Research Gaps */}
      {peptide.research_gaps.length > 0 && (
        <SectionCard label={t('plib_research_gaps')}>
          <ul className="space-y-2">
            {peptide.research_gaps.map((gap, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-400 leading-relaxed">
                <span className="text-slate-600 shrink-0 mt-0.5">↳</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Mechanism accordion (full text for scientific readers) */}
      <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setAbstractOpen(o => !o)}
          className="flex items-center justify-between w-full px-5 py-4 text-left cursor-pointer"
        >
          <span
            className="text-[0.55rem] font-black uppercase tracking-[0.2em] text-slate-600"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t('plib_full_mechanism')}
          </span>
          {abstractOpen
            ? <ChevronUp size={14} className="text-slate-600" />
            : <ChevronDown size={14} className="text-slate-600" />
          }
        </button>
        {abstractOpen && (
          <div className="px-5 pb-5 border-t border-white/[0.05]">
            <p className="text-sm text-slate-400 leading-relaxed pt-4">{peptide.mechanism}</p>
          </div>
        )}
      </div>

      {/* PubMed CTA */}
      <a
        href={pubmedUrl}
        target="_blank"
        rel="noreferrer"
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <FlaskConical size={14} />
        {t('plib_pubmed_cta')}
        <ExternalLink size={13} className="opacity-60" />
      </a>

      {/* Bottom disclaimer */}
      <p
        className="text-[0.55rem] text-slate-700 text-center leading-relaxed pt-2"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {t('plib_bottom_disclaimer')}
      </p>
    </div>
  )
}
