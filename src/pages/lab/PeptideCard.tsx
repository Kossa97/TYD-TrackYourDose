// src/pages/lab/PeptideCard.tsx
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { peptipediaDetailPath, type PeptipediaMode } from '../../features/peptipedia/routing'
import { peptipediaText } from '../../features/peptipedia/content/legacyLabels'
import { PEPTIPEDIA_UI_COPY } from '../../features/peptipedia/content/uiCopy'
import type { PeptipediaView, PeptipediaLocale } from '../../features/peptipedia/content/types'
import {
  CATEGORY_LABEL_KEYS,
  CATEGORY_COLORS,
  STATUS_LABEL_KEYS,
  STATUS_STYLES,
} from '../../features/peptipedia/display'

interface PeptideCardProps {
  peptide: PeptipediaView
  locale: PeptipediaLocale
  mode?: PeptipediaMode
}

export function PeptideCard({ peptide, locale, mode = 'public' }: PeptideCardProps) {
  const t = peptipediaText(locale)
  const evidenceCopy = PEPTIPEDIA_UI_COPY[locale].evidence
  const catColors   = CATEGORY_COLORS[peptide.category]
  const approvedRegions = [...new Set(peptide.approvals?.filter(approval => approval.status === 'approved').map(approval => approval.region))]

  const detailPath = peptipediaDetailPath(locale, peptide.slug, mode)

  return (
    <article
      className={[
        'group relative bg-[#0B1220] rounded-2xl overflow-hidden cursor-pointer',
        'border border-white/[0.07] border-t-2',
        catColors.topBorder,
        'transition-all duration-300',
        'hover:border-white/[0.15] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
        'hover:-translate-y-0.5',
      ].join(' ')}
    >
      {/* Subtle inner gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.015] via-transparent to-transparent pointer-events-none" />

      <div className="relative p-5">
        {/* Top row: category + identity */}
        <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span
            className={`text-[0.55rem] font-black uppercase tracking-[0.18em] ${catColors.text}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t(CATEGORY_LABEL_KEYS[peptide.category])}
          </span>
          <div className="flex max-w-full flex-wrap items-center gap-1.5 text-[0.55rem]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <span className="uppercase tracking-wider text-slate-600">{locale === 'de' ? 'Identität' : 'Identity'}</span>
            <span className="break-words rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-black text-slate-300">
              {evidenceCopy.identity[peptide.identity.status]}
            </span>
          </div>
        </div>

        {/* Name */}
        <h2
          className="text-xl font-black text-white mb-0.5 leading-tight group-hover:text-sky-50 transition-colors duration-200"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <Link to={detailPath} className="after:absolute after:inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400">{peptide.name}</Link>
        </h2>

        {/* Full name */}
        {peptide.blend && <span className="inline-block text-[0.55rem] text-sky-300 border border-sky-500/25 rounded-full px-2 py-0.5 my-2">Blend · {peptide.blend.components.length} {locale === 'de' ? 'Bestandteile' : 'components'}</span>}
        {peptide.fullName && (
          <p
            className="text-[0.6rem] text-slate-600 mb-3 leading-tight"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {peptide.fullName}
          </p>
        )}

        {/* TLDR */}
        <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">
          {peptide.tldr}
        </p>

        {/* Compact, non-aggregate evidence summary */}
        <div className="mb-4 flex items-center justify-between gap-3 border-y border-white/[0.05] py-2 text-[0.6rem]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          <span className="uppercase tracking-wider text-slate-600">{evidenceCopy.dimensions.human}</span>
          <span className="text-right text-slate-400">{evidenceCopy.human[peptide.evidenceMatrix.human]}</span>
        </div>

        {/* Tags */}
        {peptide.researchAreas && peptide.researchAreas.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {peptide.researchAreas.slice(0, 4).map((tag, i) => (
              <span key={i}
                className="text-[0.55rem] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-slate-500 border border-white/[0.06]">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: status + CTA */}
        <div className="flex items-center justify-between">
          <span
            className={`text-[0.56rem] font-black uppercase px-2 py-0.5 rounded-md ${STATUS_STYLES[peptide.researchStatus]}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t(STATUS_LABEL_KEYS[peptide.researchStatus])}{approvedRegions?.length ? ` · ${approvedRegions.join('/')}` : ''}
          </span>
          <span
            className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-sky-400 transition-colors duration-200"
          >
            {t('plib_profile')}
            <ArrowRight
              size={12}
              className="group-hover:translate-x-0.5 transition-transform duration-200"
            />
          </span>
        </div>
      </div>
    </article>
  )
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

export function PeptideCardSkeleton() {
  return (
    <div className="bg-[#0B1220] rounded-2xl border border-white/[0.06] border-t-2 border-t-slate-700 p-5 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-2.5 w-24 bg-white/[0.06] rounded" />
        <div className="h-2.5 w-8 bg-white/[0.06] rounded" />
      </div>
      <div className="h-6 w-20 bg-white/[0.08] rounded mb-1" />
      <div className="h-2 w-32 bg-white/[0.04] rounded mb-3" />
      <div className="space-y-1.5 mb-3">
        <div className="h-2 bg-white/[0.04] rounded" />
        <div className="h-2 w-5/6 bg-white/[0.04] rounded" />
      </div>
      <div className="space-y-1.5 mb-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex gap-2 items-center">
            <div className="w-10 h-1.5 bg-white/[0.04] rounded" />
            <div className="flex-1 h-[2px] bg-white/[0.04] rounded" />
            <div className="w-14 h-1.5 bg-white/[0.04] rounded" />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <div className="h-4 w-16 bg-white/[0.06] rounded" />
        <div className="h-4 w-12 bg-white/[0.04] rounded" />
      </div>
    </div>
  )
}
