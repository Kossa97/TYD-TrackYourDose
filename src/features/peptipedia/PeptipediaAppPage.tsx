import { useTranslation } from 'react-i18next'
import { PeptideLibrary } from '../../pages/PeptideLibrary'
import { PeptideDetailPage } from '../../pages/PeptideDetailPage'

export function PeptipediaAppPage({ detail = false }: { detail?: boolean }) {
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith('en') ? 'en' : 'de'
  return <div lang={locale} dir="ltr">
    {detail ? <PeptideDetailPage locale={locale} mode="app" /> : <PeptideLibrary locale={locale} mode="app" />}
  </div>
}
