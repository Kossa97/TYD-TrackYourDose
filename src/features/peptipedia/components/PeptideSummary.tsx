import type { PeptipediaView } from '../content/types'
import { peptipediaText } from '../content/legacyLabels'
import { CATEGORY_COLORS, CATEGORY_LABEL_KEYS, STATUS_STYLES, STATUS_LABEL_KEYS, getConfidenceStyle, getConfidenceLabelKey } from '../display'

export function PeptideSummary({ peptide }: { peptide: PeptipediaView }) {
  const t = peptipediaText(peptide.locale)
  const catColors = CATEGORY_COLORS[peptide.category]
  const confLabel = t(getConfidenceLabelKey(peptide.evidence.score))
  const confStyle = getConfidenceStyle(peptide.evidence.score)
  return (
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`text-[0.56rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#0B1220] border border-white/[0.08] ${catColors.text}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t(CATEGORY_LABEL_KEYS[peptide.category])}
          </span>
          <span
            className={`text-[0.56rem] font-black uppercase px-2 py-0.5 rounded-md ${STATUS_STYLES[peptide.researchStatus]}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t(STATUS_LABEL_KEYS[peptide.researchStatus])}
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
        {peptide.fullName && (
          <p
            className="text-xs text-slate-600 mb-3"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {peptide.fullName}
          </p>
        )}
        <p className="text-sm text-slate-400 leading-relaxed">{peptide.tldr}</p>
      </div>
  )
}
