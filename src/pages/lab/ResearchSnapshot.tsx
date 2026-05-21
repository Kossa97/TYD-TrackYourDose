// src/pages/lab/ResearchSnapshot.tsx
import type { ChartEntry, PubMedArticle } from './pubmed'

interface ResearchSnapshotProps {
  chartData: ChartEntry[]
  articles: PubMedArticle[]
  onSearch: (query: string) => void
}

interface SnapshotCardProps {
  kicker: string
  kickerColor: string
  topBorderColor: string
  title: string
  sub: string
  cta?: string
  onCta?: () => void
}

function SnapshotCard({
  kicker, kickerColor, topBorderColor, title, sub, cta, onCta,
}: SnapshotCardProps) {
  return (
    <div
      className={`bg-[#0B1220] border border-white/[0.06] ${topBorderColor} rounded-2xl p-4 hover:bg-[#111827] hover:-translate-y-0.5 transition-all duration-200`}
    >
      <p
        className={`text-[0.58rem] font-black uppercase tracking-wider mb-2 ${kickerColor}`}
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {kicker}
      </p>
      <p
        className="text-xl font-black text-white mb-0.5 leading-tight truncate"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {title}
      </p>
      <p className="text-xs text-slate-500">{sub}</p>
      {cta && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-3 text-xs text-slate-500 hover:text-sky-400 transition-colors"
        >
          {cta} →
        </button>
      )}
    </div>
  )
}

export function ResearchSnapshot({ chartData, articles, onSearch }: ResearchSnapshotProps) {
  const top = chartData[0]
  const second = chartData[1]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-6">
      <SnapshotCard
        kicker="⚡ Trending"
        kickerColor="text-sky-400/70"
        topBorderColor="border-t-2 border-t-sky-500"
        title={top?.name ?? '—'}
        sub={top ? `${top.count.toLocaleString('de-DE')} Studien · PubMed` : 'Lade Daten…'}
        cta="Entdecken"
        onCta={() => top && onSearch(top.name)}
      />
      <SnapshotCard
        kicker="🧬 Meisterforscht"
        kickerColor="text-violet-400/70"
        topBorderColor="border-t-2 border-t-violet-500"
        title={second?.name ?? '—'}
        sub={second ? `${second.count.toLocaleString('de-DE')} Papers` : 'Lade Daten…'}
        cta="Entdecken"
        onCta={() => second && onSearch(second.name)}
      />
      <SnapshotCard
        kicker="🔬 Neu Geladen"
        kickerColor="text-blue-400/70"
        topBorderColor="border-t-2 border-t-blue-500"
        title={String(articles.length)}
        sub="Studien geladen · sortiert nach Datum"
      />
    </div>
  )
}
