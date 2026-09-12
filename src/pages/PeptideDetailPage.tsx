import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { usePeptipediaHead } from '../features/peptipedia/usePeptipediaHead'
import { getPublishedPeptide } from '../features/peptipedia/content'
import type { PeptipediaLocale } from '../features/peptipedia/content/types'
import { PEPTIPEDIA_UI_COPY } from '../features/peptipedia/content/uiCopy'
import { PeptideSummary } from '../features/peptipedia/components/PeptideSummary'
import { PeptipediaTabs } from '../features/peptipedia/components/PeptipediaTabs'
import { OverviewPanel, MechanismPanel, ProtocolsPanel, SafetyPanel, SourcesPanel } from '../features/peptipedia/components/PeptidePanels'
import { PeptideCalculatorPanel } from '../features/peptipedia/components/PeptideCalculatorPanel'
import { PEPTIPEDIA_TAB_IDS, TAB_HASHES, peptipediaListPath, tabFromHash } from '../features/peptipedia/routing'

const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function PeptideDetailPage({ locale = 'de' }: { locale?: PeptipediaLocale }) {
  const { slug = '' } = useParams<{ slug: string }>()
  usePeptipediaHead(locale, slug)
  const location = useLocation()
  const navigate = useNavigate()
  // Server output starts at Overview; read the fragment after hydration.
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot)
  const activeTab = tabFromHash(locale, hydrated ? location.hash : '')
  const peptide = getPublishedPeptide(slug, locale)
  const copy = PEPTIPEDIA_UI_COPY[locale]
  if (!peptide) return <div className="text-center py-16"><h1 className="text-xl text-white mb-3">{copy.notFound.title}</h1><p className="text-sm text-slate-400 mb-4">{copy.notFound.text}</p><Link to={peptipediaListPath(locale)} className="text-sky-400">{copy.navigation.backToLibrary}</Link></div>
  const panels = { overview: <OverviewPanel peptide={peptide} />, mechanism: <MechanismPanel peptide={peptide} />, protocols: <ProtocolsPanel peptide={peptide} />, calculator: <PeptideCalculatorPanel key={slug} locale={locale} />, safety: <SafetyPanel peptide={peptide} />, sources: <SourcesPanel peptide={peptide} /> }
  return <div className="max-w-2xl mx-auto space-y-5 pb-10 min-w-0">
    <Link to={peptipediaListPath(locale)} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"><ArrowLeft size={12} /><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{copy.navigation.backToLibrary}</span></Link>
    <PeptideSummary peptide={peptide} />
    <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3"><AlertTriangle size={13} className="text-amber-400/60 shrink-0 mt-0.5" /><p className="text-xs text-amber-300/55 leading-relaxed">{copy.disclaimer}</p></div>
    <PeptipediaTabs locale={locale} activeTab={activeTab} onSelect={id => navigate({ pathname: location.pathname, search: location.search, hash: TAB_HASHES[locale][id] })} />
    {PEPTIPEDIA_TAB_IDS.map(id => <section key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={activeTab !== id} tabIndex={0} className="focus-visible:outline-sky-400">{panels[id]}</section>)}
  </div>
}
