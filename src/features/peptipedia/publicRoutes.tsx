import { Route } from 'react-router-dom'
import { PeptideLibrary } from '../../pages/PeptideLibrary'
import { PeptideDetailPage } from '../../pages/PeptideDetailPage'
import { PeptipediaPublicLayout } from './PeptipediaPublicLayout'
import { LegacyPeptipediaRedirect } from './LegacyPeptipediaRedirect'

export function publicPeptipediaRoutes() {
  return [
    ...(['de', 'en'] as const).map(locale => <Route key={locale} element={<PeptipediaPublicLayout locale={locale} />}>
      <Route path={locale === 'de' ? '/peptipedia' : '/en/peptipedia'} element={<PeptideLibrary locale={locale} />} />
      <Route path={locale === 'de' ? '/peptipedia/:slug' : '/en/peptipedia/:slug'} element={<PeptideDetailPage locale={locale} />} />
    </Route>),
    <Route key="legacy-list" path="/lab/library" element={<LegacyPeptipediaRedirect />} />,
    <Route key="legacy-detail" path="/lab/library/:slug" element={<LegacyPeptipediaRedirect />} />,
  ]
}
