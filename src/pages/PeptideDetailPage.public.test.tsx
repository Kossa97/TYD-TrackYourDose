// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { PeptideDetailPage } from './PeptideDetailPage'
import { getPublishedPeptide } from '../features/peptipedia/content'

vi.mock('../lib/supabase', () => ({ supabase: { from: () => { throw new Error('No database') } } }))
afterEach(cleanup)
function show(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/peptipedia/:slug" element={<PeptideDetailPage locale="de" />} /></Routes></MemoryRouter>)
}
it('shows summary above tabs and retains all panels in the document', () => {
  show('/peptipedia/bpc-157')
  const summary = screen.getByText(getPublishedPeptide('bpc-157', 'de')!.tldr)
  expect(summary.compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(6)
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  fireEvent.click(screen.getByRole('tab', { name: 'Studienprotokolle' }))
  expect(screen.getByText('Keine ausreichend belegten, exakt zitierbaren Studienprotokolle hinterlegt.')).toBeTruthy()
})
it('opens localized deep links and displays missing profiles', () => {
  const view = show('/peptipedia/bpc-157#sicherheit')
  expect(screen.getByRole('tab', { name: 'Sicherheit' }).getAttribute('aria-selected')).toBe('true')
  view.unmount()
  show('/peptipedia/unknown')
  expect(screen.getByRole('heading', { name: 'Peptid nicht gefunden' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Zurück zur Peptipedia' }).getAttribute('href')).toBe('/peptipedia')
})

it('shows regional approvals without a numeric editorial score', () => {
  show('/peptipedia/semaglutid')

  expect(screen.getByText('Zulassungen')).toBeTruthy()
  expect(screen.getAllByText('EU · Zugelassen').length).toBeGreaterThan(0)
  expect(screen.getAllByText('US · Zugelassen').length).toBeGreaterThan(0)
  expect(screen.queryByText('10/10')).toBeNull()
})

it('places a plain-language identity warning before tabs for an ambiguous profile', () => {
  show('/peptipedia/bpc-157')

  const warning = screen.getByRole('alert')
  expect(warning.textContent).toContain('Identität nicht bestätigt')
  expect(warning.textContent).toContain('Der Name kann unterschiedliche Stoff- oder Produktformen bezeichnen.')
  expect(warning.textContent).toContain(getPublishedPeptide('bpc-157', 'de')!.identity.description.de)
  expect(warning.compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it.each([
  ['/en/peptipedia/glow', 'Brand or blend identity', 'The name describes a source-specific product or mixture, not a standardized single substance.'],
  ['/en/peptipedia/cerebrolysin', 'Complex mixture', 'This is a multi-component mixture, not one chemically defined peptide.'],
])('explains %s identity context in plain English', (path, heading, explanation) => {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/en/peptipedia/:slug" element={<PeptideDetailPage locale="en" />} /></Routes></MemoryRouter>)

  const warning = screen.getByRole('alert')
  expect(warning.textContent).toContain(heading)
  expect(warning.textContent).toContain(explanation)
})
