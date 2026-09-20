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
import { peptipediaTabs, TAB_HASHES, peptipediaListPath, tabFromHash, type PeptipediaMode } from '../features/peptipedia/routing'

const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function PeptideDetailPage({ locale = 'de', mode = 'public' }: { locale?: PeptipediaLocale; mode?: PeptipediaMode }) {
  const { slug = '' } = useParams<{ slug: string }>()
  usePeptipediaHead(locale, slug, mode === 'public')
  const location = useLocation()
  const navigate = useNavigate()
  // Server output starts at Overview; read the fragment after hydration.
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot)
  const requestedTab = tabFromHash(locale, hydrated ? location.hash : '')
  const tabs = peptipediaTabs(mode)
  const activeTab = tabs.includes(requestedTab) ? requestedTab : 'overview'
  const peptide = getPublishedPeptide(slug, locale)
  const copy = PEPTIPEDIA_UI_COPY[locale]
  if (!peptide) return <div className="text-center py-16"><h1 className="text-xl text-white mb-3">{copy.notFound.title}</h1><p className="text-sm text-slate-400 mb-4">{copy.notFound.text}</p><Link to={peptipediaListPath(locale, mode)} className="text-sky-400">{copy.navigation.backToLibrary}</Link></div>
  const calculator = peptide.calculatorUnsupportedReason
    ? <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl p-5 text-sm text-slate-400 leading-relaxed">{peptide.calculatorUnsupportedReason === 'activity_units'
      ? (locale === 'de' ? 'Dieses Präparat wird in biologischen Aktivitätseinheiten beschrieben. Der mg-/µg-Rechner kann diese nicht zuverlässig umrechnen. Spritzen-Skaleneinheiten sind keine Wirkstoff-Aktivitätseinheiten.' : 'This preparation is described in biological activity units. The mg/µg calculator cannot reliably convert them. Syringe scale units are not drug activity units.')
      : (locale === 'de' ? 'Dies ist eine komplexe Mischung, kein definierter Einzelstoff. Der Einzelstoff-Rechner ist für dieses Präparat nicht geeignet.' : 'This is a complex mixture, not a defined individual compound. The single-compound calculator is not suitable for this preparation.')}</div>
    : peptide.blend
    ? <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl p-5 text-sm text-slate-400 leading-relaxed">{locale === 'de' ? 'Dieser Rechner ist für Einzelstoffe ausgelegt. Die Gesamtmenge eines Blends ist keine Einzelstoffdosis. Ohne getrennte Konzentrationen und ein verifiziertes Mischungsverhältnis wird hier keine Berechnung angeboten.' : 'This calculator is designed for individual compounds. A blend’s total amount is not an individual ingredient dose. No calculation is offered without separate concentrations and a verified mixing ratio.'}</div>
    : <PeptideCalculatorPanel key={slug} locale={locale} />
  const panels = { overview: <OverviewPanel peptide={peptide} />, mechanism: <MechanismPanel peptide={peptide} />, protocols: <ProtocolsPanel peptide={peptide} />, calculator, safety: <SafetyPanel peptide={peptide} />, sources: <SourcesPanel peptide={peptide} /> }
  return <div className="max-w-2xl mx-auto space-y-5 pb-10 min-w-0">
    <Link to={peptipediaListPath(locale, mode)} className="flex min-h-11 items-center gap-1.5 rounded-md text-xs text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"><ArrowLeft size={12} /><span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{copy.navigation.backToLibrary}</span></Link>
    <PeptideSummary peptide={peptide} mode={mode} />
    <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3"><AlertTriangle size={13} className="text-amber-400/60 shrink-0 mt-0.5" /><p className="text-xs text-amber-300/55 leading-relaxed">{copy.disclaimer}</p></div>
    {peptide.identity.status !== 'confirmed' && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-4">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
      <div>
        <h2 className="text-sm font-black text-amber-200">{copy.identityWarning[peptide.identity.status].title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/70">{copy.identityWarning[peptide.identity.status].explanation}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{peptide.identity.description[locale]}</p>
      </div>
    </div>}
    <PeptipediaTabs locale={locale} mode={mode} activeTab={activeTab} onSelect={id => navigate({ pathname: location.pathname, search: location.search, hash: TAB_HASHES[locale][id] })} />
    {tabs.map(id => <section key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={activeTab !== id} tabIndex={0} className="focus-visible:outline-sky-400">{panels[id]}</section>)}
  </div>
}
