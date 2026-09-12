// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { getPublishedPeptide } from '../content'
import { ProtocolsPanel } from './PeptidePanels'

afterEach(cleanup)
it('shows every reported protocol field and the exact primary source link', () => {
  const peptide = getPublishedPeptide('ghrp-2', 'en')!
  render(<ProtocolsPanel peptide={peptide} />)
  const protocol = peptide.protocols[0]
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
