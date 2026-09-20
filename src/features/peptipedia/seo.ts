import { getPublishedPeptide, PUBLISHED_PEPTIDES } from './content'
import type { PeptipediaLocale } from './content/types'
import { peptipediaDetailPath, peptipediaListPath } from './routing'

export function peptipediaRouteManifest() {
  return (['de', 'en'] as const).flatMap(locale => [
    { locale, path: peptipediaListPath(locale), slug: undefined as string | undefined },
    ...PUBLISHED_PEPTIDES.map(entry => ({ locale, path: peptipediaDetailPath(locale, entry.slug), slug: entry.slug })),
  ])
}

export function buildPeptipediaMeta(origin: string, locale: PeptipediaLocale, slug?: string) {
  const site = new URL(origin)
  if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password || site.pathname !== '/' || site.search || site.hash) throw new Error('Invalid public site origin')
  const peptide = slug ? getPublishedPeptide(slug, locale) : null
  const path = slug ? peptipediaDetailPath(locale, slug) : peptipediaListPath(locale)
  const title = peptide ? `${peptide.name} – Peptipedia` : slug ? (locale === 'de' ? 'Peptid nicht gefunden – Peptipedia' : 'Peptide not found – Peptipedia') : 'Peptipedia – Peptide Wiki'
  const description = peptide?.tldr ?? (locale === 'de' ? 'Peptide kurz erklärt: Wirkung, Evidenz, Studienprotokolle und Sicherheit mit direkten Quellen.' : 'Peptides explained: mechanisms, evidence, study protocols and safety with direct sources.')
  const canonical = new URL(path, site).href
  return {
    locale, title, description, canonical, noindex: !!slug && !peptide,
    alternates: {
      de: new URL(slug ? peptipediaDetailPath('de', slug) : peptipediaListPath('de'), site).href,
      en: new URL(slug ? peptipediaDetailPath('en', slug) : peptipediaListPath('en'), site).href,
    },
    openGraph: { title, description, url: canonical },
  }
}
