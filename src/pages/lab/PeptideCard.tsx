// src/pages/lab/PeptideCard.tsx
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PeptideEntry } from '../../services/peptideLibrary'
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  STATUS_LABELS,
  STATUS_STYLES,
  EVIDENCE_BAR_WIDTH,
  EVIDENCE_LABELS,
  getConfidenceStyle,
} from '../../services/peptideLibrary'

interface PeptideCardProps {
  peptide: PeptideEntry
}

export function PeptideCard({ peptide }: PeptideCardProps) {
  const navigate    = useNavigate()
  const catColors   = CATEGORY_COLORS[peptide.category]
  const confStyle   = getConfidenceStyle(peptide.evidence_score)

  const openDetail = () => navigate(`/lab/library/${peptide.slug}`)

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
      onClick={openDetail}
    >
      {/* Subtle inner gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.015] via-transparent to-transparent pointer-events-none" />

      <div className="relative p-5">
        {/* Top row: category + score */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-[0.55rem] font-black uppercase tracking-[0.18em] ${catColors.text}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {CATEGORY_LABELS[peptide.category]}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[0.55rem] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${confStyle}`}
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {peptide.evidence_score}/10
            </span>
          </div>
        </div>

        {/* Name */}
        <h2
          className="text-xl font-black text-white mb-0.5 leading-tight group-hover:text-sky-50 transition-colors duration-200"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {peptide.name}
        </h2>

        {/* Full name */}
        {peptide.full_name && (
          <p
            className="text-[0.6rem] text-slate-600 mb-3 leading-tight"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {peptide.full_name}
          </p>
        )}

        {/* TLDR */}
        <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">
          {peptide.tldr}
        </p>

        {/* Mini evidence bars */}
        <div className="space-y-1.5 mb-4">
          <MiniEvidenceBar
            label="Human"
            value={peptide.evidence_human}
            color="bg-emerald-500"
          />
          <MiniEvidenceBar
            label="Tier"
            value={peptide.evidence_animal}
            color="bg-amber-500"
          />
          <MiniEvidenceBar
            label="Klinisch"
            value={peptide.evidence_clinical}
            color="bg-violet-500"
          />
        </div>

        {/* Tags */}
        {peptide.tags && peptide.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {peptide.tags.slice(0, 4).map((tag, i) => (
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
            className={`text-[0.56rem] font-black uppercase px-2 py-0.5 rounded-md ${STATUS_STYLES[peptide.research_status]}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {STATUS_LABELS[peptide.research_status]}
          </span>
          <span
            className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-sky-400 transition-colors duration-200"
          >
            Profil
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

// ─── Mini Evidence Bar ────────────────────────────────────────────────────────

function MiniEvidenceBar({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  const width = EVIDENCE_BAR_WIDTH[value as keyof typeof EVIDENCE_BAR_WIDTH] ?? 'w-0'
  const text  = EVIDENCE_LABELS[value as keyof typeof EVIDENCE_LABELS] ?? 'Keine'

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[0.5rem] uppercase tracking-widest text-slate-700 w-10 shrink-0"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {label}
      </span>
      <div className="flex-1 h-[2px] bg-white/[0.05] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} ${width}`} />
      </div>
      <span
        className="text-[0.5rem] text-slate-600 w-14 text-right shrink-0"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {text}
      </span>
    </div>
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
