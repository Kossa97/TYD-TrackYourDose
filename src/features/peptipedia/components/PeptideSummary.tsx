import type { PeptipediaView } from '../content/types'
import { Link } from 'react-router-dom'
import { peptipediaDetailPath, type PeptipediaMode } from '../routing'
import { peptipediaText } from '../content/legacyLabels'
import { CATEGORY_COLORS, CATEGORY_LABEL_KEYS, STATUS_STYLES, STATUS_LABEL_KEYS } from '../display'

export function PeptideSummary({ peptide, mode = 'public' }: { peptide: PeptipediaView; mode?: PeptipediaMode }) {
  const t = peptipediaText(peptide.locale)
  const catColors = CATEGORY_COLORS[peptide.category]
  const approvedRegions = [...new Set(peptide.approvals?.filter(approval => approval.status === 'approved').map(approval => approval.region))]
  return (
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {peptide.blend && <span className="text-[0.56rem] font-black uppercase px-2 py-0.5 rounded-md text-sky-300 bg-sky-500/10 border border-sky-500/25">Blend</span>}
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
            {t(STATUS_LABEL_KEYS[peptide.researchStatus])}{approvedRegions?.length ? ` · ${approvedRegions.join('/')}` : ''}
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
        {!!peptide.approvals?.length && <div className="mt-4">
          <p className="text-[0.55rem] font-black uppercase tracking-[0.18em] text-slate-600 mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{peptide.locale === 'de' ? 'Zulassungen' : 'Approvals'}</p>
          <div className="flex flex-wrap gap-2">{peptide.approvals.map(approval => <span
            key={`${approval.region}-${approval.product}`}
            title={`${approval.product}: ${approval.indication}`}
            className={`text-[0.6rem] font-bold px-2.5 py-1 rounded-full border ${approval.status === 'approved' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' : 'text-amber-300 bg-amber-500/10 border-amber-500/25'}`}
          >{approval.region} · {approval.status === 'approved' ? (peptide.locale === 'de' ? 'Zugelassen' : 'Approved') : (peptide.locale === 'de' ? 'Antrag zurückgezogen' : 'Application withdrawn')}</span>)}</div>
        </div>}
        {peptide.blend && <div className="mt-4 p-4 bg-[#0B1220] border border-white/[0.06] rounded-xl">
          <h2 className="text-xs text-slate-400 mb-2">{peptide.locale === 'de' ? 'Bestandteile laut Katalog' : 'Components listed in the catalogue'}</h2>
          <ul className="flex flex-wrap gap-2">{peptide.blend.components.map(component => <li key={component.name} className="text-xs rounded-full border border-white/10 px-3 py-1">
            {component.slug ? <Link className="text-sky-400 hover:text-sky-300" to={peptipediaDetailPath(peptide.locale, component.slug, mode)}>{component.name}</Link> : <span className="text-slate-400">{component.name}</span>}
          </li>)}</ul>
          <p className="text-xs text-slate-500 mt-3">{peptide.locale === 'de' ? 'Ein Blend-Name ist keine standardisierte Rezeptur. Zusammensetzung und Verhältnis können je nach Produkt abweichen; Daten zu Einzelstoffen belegen nicht die Mischung.' : 'A blend name is not a standardized formula. Ingredients and ratios may vary by product; evidence on individual compounds does not establish the blend’s effects.'}</p>
        </div>}
      </div>
  )
}
