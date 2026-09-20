// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { getPublishedPeptide } from '../content'
import { MechanismPanel, OverviewPanel, ProtocolsPanel, SafetyPanel, SourcesPanel } from './PeptidePanels'

afterEach(cleanup)
it('shows every reported protocol field and the exact primary source link', () => {
  const base = getPublishedPeptide('ghrp-2', 'en')!
  const protocol = {
    id: 'reported-study', evidenceType: 'human' as const, populationOrModel: 'Healthy adults', route: 'Intravenous',
    amount: 'Amount reported in the source', frequency: 'Single administration', duration: 'One study visit',
    objective: 'Pharmacodynamic response', outcome: 'Response measured in the study', sourceIds: [base.sources[0].id],
  }
  const peptide = { ...base, protocols: [protocol] }
  render(<ProtocolsPanel peptide={peptide} />)
  for (const field of ['populationOrModel', 'route', 'amount', 'frequency', 'duration', 'objective', 'outcome'] as const) expect(screen.getByText(protocol[field])).toBeTruthy()
  const link = screen.getByRole('link')
  expect(link.getAttribute('href')).toBe(peptide.sources.find(source => source.id === protocol.sourceIds[0])!.url)
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
})
it('explicitly explains missing protocols', () => {
  render(<ProtocolsPanel peptide={getPublishedPeptide('tb-500', 'de')!} />)
  expect(screen.getByText('Keine ausreichend belegten, exakt zitierbaren Studienprotokolle hinterlegt.')).toBeTruthy()
})

it('renders the six evidence dimensions without an aggregate verdict', () => {
  render(<OverviewPanel peptide={getPublishedPeptide('bpc-157', 'de')!} />)

  for (const label of ['Molekülidentität', 'Humanforschung', 'Replikation', 'Klinische Endpunkte', 'Sicherheit', 'Zulassung']) {
    expect(screen.getByText(label)).toBeTruthy()
  }
  expect(screen.getByText('Teilweise geklärt')).toBeTruthy()
  expect(screen.getByText('Sehr begrenzt')).toBeTruthy()
  expect(screen.queryByText(/\/10/)).toBeNull()
  expect(screen.queryByText(/Konfidenz|Nicht bewertet/)).toBeNull()
})

it('shows complete source metadata and distinguishes source types', () => {
  render(<SourcesPanel peptide={getPublishedPeptide('bpc-157', 'de')!} />)

  const source = getPublishedPeptide('bpc-157', 'de')!.sources[0]
  const item = screen.getAllByRole('listitem')[0]
  expect(within(item).getByRole('link', { name: source.title })).toBeTruthy()
  expect(within(item).getByText(String(source.year))).toBeTruthy()
  expect(within(item).getByText(source.publisherOrAuthors)).toBeTruthy()
  expect(within(item).getByText('Humanstudie')).toBeTruthy()
  expect(item.textContent).toContain(`Abgerufen: ${source.accessedAt}`)
})

it('labels a government news source as neither a study nor a catalogue', () => {
  render(<SourcesPanel peptide={getPublishedPeptide('mazdutide', 'en')!} />)

  expect(screen.getByText('Government news')).toBeTruthy()
  expect(screen.queryByText('Catalogue / composition — not a study')).toBeNull()
})

it('renders only the sources explicitly assigned to mechanism and safety claims', () => {
  const base = getPublishedPeptide('bpc-157', 'de')!
  const peptide = {
    ...base,
    mechanismSourceIds: [base.sources[0].id],
    safetySourceIds: [base.sources[1].id],
  }

  const mechanism = render(<MechanismPanel peptide={peptide} />)
  expect(mechanism.getByRole('link', { name: base.sources[0].title })).toBeTruthy()
  expect(mechanism.queryByRole('link', { name: base.sources[1].title })).toBeNull()
  mechanism.unmount()

  render(<SafetyPanel peptide={peptide} />)
  expect(screen.getByRole('link', { name: base.sources[1].title })).toBeTruthy()
  expect(screen.queryByRole('link', { name: base.sources[0].title })).toBeNull()
})
