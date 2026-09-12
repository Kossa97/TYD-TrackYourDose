import { expect, it } from 'vitest'
import { buildPeptipediaMeta, peptipediaRouteManifest } from './seo'

it('includes all 24 public routes and reciprocal language links', () => {
  expect(peptipediaRouteManifest()).toHaveLength(24)
  expect(new Set(peptipediaRouteManifest().map(route => route.path)).size).toBe(24)
  const meta = buildPeptipediaMeta('https://example.test', 'de', 'bpc-157')
  expect(meta.canonical).toBe('https://example.test/peptipedia/bpc-157')
  expect(meta.alternates.en).toBe('https://example.test/en/peptipedia/bpc-157')
  expect(meta.title).toContain('BPC-157')
})
