// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
