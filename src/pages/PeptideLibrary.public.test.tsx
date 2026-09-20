// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { PeptideLibrary } from './PeptideLibrary'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => { throw new Error('Supabase must not run') }) } }))
afterEach(cleanup)

it('renders and searches public entries without a session or database', () => {
  render(<MemoryRouter><PeptideLibrary locale="de" /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Peptipedia' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'BPC-157' })).toBeTruthy()
  expect(screen.queryByText('Admin')).toBeNull()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ghk' } })
  expect(screen.getByRole('heading', { name: 'GHK-Cu' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'BPC-157' })).toBeNull()
})

it('qualifies approved catalogue cards with their approval regions', () => {
  render(<MemoryRouter><PeptideLibrary locale="de" /></MemoryRouter>)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Mazdutide' } })

  expect(screen.getByText('Zugelassen · CN')).toBeTruthy()
})

it('shows only identity and human-research summaries instead of confidence labels', () => {
  render(<MemoryRouter><PeptideLibrary locale="de" /></MemoryRouter>)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'BPC-157' } })

  const card = screen.getByRole('heading', { name: 'BPC-157' }).closest('article')!
  expect(within(card).getByText('Identität')).toBeTruthy()
  expect(within(card).getAllByText('Humanforschung').length).toBeGreaterThan(0)
  expect(within(card).queryByText(/Konfidenz|Nicht bewertet|\/10/)).toBeNull()
})

it('offers deterministic default and alphabetical sorting without evidence-score controls', () => {
  render(<MemoryRouter><PeptideLibrary locale="de" /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Filter anzeigen' }))

  expect(screen.getByRole('button', { name: 'Standard' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Name A–Z' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Name Z–A' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Evidenz ↓' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Evidenz ↑' })).toBeNull()
})

it('uses the visible evidence matrix for the human-research filter', () => {
  render(<MemoryRouter><PeptideLibrary locale="de" /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Filter anzeigen' }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'BPC-157' } })
  fireEvent.click(screen.getByRole('button', { name: 'Moderat / Stark' }))

  expect(screen.queryByRole('heading', { name: 'BPC-157' })).toBeNull()
})
