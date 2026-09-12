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
  expect(screen.getByText('Tierstudie – nicht auf Menschen übertragbar')).toBeTruthy()
})
it('opens localized deep links and displays missing profiles', () => {
  const view = show('/peptipedia/bpc-157#sicherheit')
  expect(screen.getByRole('tab', { name: 'Sicherheit' }).getAttribute('aria-selected')).toBe('true')
  view.unmount()
  show('/peptipedia/unknown')
  expect(screen.getByRole('heading', { name: 'Peptid nicht gefunden' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Zurück zur Peptipedia' }).getAttribute('href')).toBe('/peptipedia')
})
