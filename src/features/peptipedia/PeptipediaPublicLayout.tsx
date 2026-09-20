import { Link, Outlet, useLocation } from 'react-router-dom'
import type { PeptipediaLocale } from './content/types'
import { peptipediaListPath } from './routing'

export function PeptipediaPublicLayout({ locale }: { locale: PeptipediaLocale }) {
  const location = useLocation()
  const otherLocale = locale === 'de' ? 'en' : 'de'
  const suffix = location.pathname.slice(peptipediaListPath(locale).length)
  const alternate = peptipediaListPath(otherLocale) + suffix
  return <div lang={locale} dir="ltr" className="min-h-screen bg-[#070B11] text-slate-300">
    <header className="sticky top-0 z-30 h-14 bg-[#070B11] border-b border-white/[0.06]">
      <nav aria-label={locale === 'de' ? 'Hauptnavigation' : 'Main navigation'} className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        <Link to={peptipediaListPath(locale)} className="text-sm font-black text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Peptipedia</Link>
        <div className="flex items-center gap-4 text-xs text-slate-400"><Link to={alternate} hrefLang={otherLocale} lang={otherLocale}>{otherLocale === 'en' ? 'English' : 'Deutsch'}</Link><Link to="/auth" className="text-sky-400">{locale === 'de' ? 'Zur App' : 'Open app'}</Link></div>
      </nav>
    </header>
    <main className="max-w-6xl mx-auto px-4 pt-6 pb-10 min-w-0"><Outlet /></main>
  </div>
}
