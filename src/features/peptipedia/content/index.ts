import { bpc157 } from './entries/bpc-157'
import { tb500 } from './entries/tb-500'
import { ipamorelin } from './entries/ipamorelin'
import { cjc1295 } from './entries/cjc-1295'
import { ghrp2 } from './entries/ghrp-2'
import { sermorelin } from './entries/sermorelin'
import { semaglutid } from './entries/semaglutid'
import { tirzepatid } from './entries/tirzepatid'
import { selank } from './entries/selank'
import { epithalon } from './entries/epithalon'
import { ghkCu } from './entries/ghk-cu'
import { assertValidPeptipedia } from './validate'
import type { PeptipediaEntry, PeptipediaLocale, PeptipediaView } from './types'

const entries = [bpc157, tb500, ipamorelin, cjc1295, ghrp2, sermorelin, semaglutid, tirzepatid, selank, epithalon, ghkCu]
assertValidPeptipedia(entries)
export const PUBLISHED_PEPTIDES = Object.freeze(entries)

function toView(entry: PeptipediaEntry, locale: PeptipediaLocale): PeptipediaView {
  const { copy, ...shared } = entry
  return Object.freeze({ ...shared, locale, ...copy[locale] })
}

export function getPublishedPeptides(locale: PeptipediaLocale): PeptipediaView[] {
  return PUBLISHED_PEPTIDES.map(entry => toView(entry, locale))
}

export function getPublishedPeptide(slug: string, locale: PeptipediaLocale): PeptipediaView | null {
  const entry = PUBLISHED_PEPTIDES.find(candidate => candidate.slug === slug)
  return entry ? toView(entry, locale) : null
}
