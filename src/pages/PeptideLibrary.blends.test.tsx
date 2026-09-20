// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { PeptideLibrary } from './PeptideLibrary'
import { PeptideDetailPage } from './PeptideDetailPage'

afterEach(cleanup)

it('filters blends without mixing them with individual profiles and searches ingredients', () => {
  render(<MemoryRouter><PeptideLibrary locale="de" /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Blends' }))
  expect(screen.getAllByRole('article')).toHaveLength(10)
  expect(screen.queryByRole('heading', { name: 'BPC-157' })).toBeNull()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'KPV' } })
  expect(screen.getByRole('heading', { name: 'KLOW' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Tri-Heal' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'GLOW' })).toBeNull()
})

it('links blend ingredients inside the app and describes identity without an evidence score', () => {
  render(<MemoryRouter initialEntries={['/lab/peptipedia/glow']}><Routes>
    <Route path="/lab/peptipedia/:slug" element={<PeptideDetailPage locale="de" mode="app" />} />
  </Routes></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'GLOW' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'GHK-Cu' }).getAttribute('href')).toBe('/lab/peptipedia/ghk-cu')
  expect(screen.getAllByText('Produkt- oder blendabhängig').length).toBeGreaterThan(0)
  expect(screen.queryByText('1/10')).toBeNull()
  expect(screen.queryByRole('tab', { name: 'Rechner' })).toBeNull()
})

it('distinguishes modified ingredients and labels catalogue sources separately', () => {
  render(<MemoryRouter initialEntries={['/en/peptipedia/neuroxelin']}><Routes>
    <Route path="/en/peptipedia/:slug" element={<PeptideDetailPage locale="en" />} />
  </Routes></MemoryRouter>)
  expect(screen.getByText('N-acetyl Semax', { exact: true })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'N-acetyl Semax' })).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'Sources' }))
  expect(within(screen.getByRole('tabpanel', { name: 'Sources' })).getByText('Catalogue or composition source — not a study')).toBeTruthy()
})

it('does not apply the single-compound calculator to a blend total', () => {
  render(<MemoryRouter initialEntries={['/peptipedia/glow#rechner']}><Routes>
    <Route path="/peptipedia/:slug" element={<PeptideDetailPage locale="de" />} />
  </Routes></MemoryRouter>)
  const calculator = within(screen.getByRole('tabpanel', { name: 'Rechner' }))
  expect(calculator.queryByRole('button', { name: 'Berechnen' })).toBeNull()
  expect(calculator.getByText(/Gesamtmenge.*Einzelstoffdosis/)).toBeTruthy()
})

it('offers alphabetical sorting without an evidence-score order', () => {
  render(<MemoryRouter><PeptideLibrary locale="en" /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Show filters' }))
  expect(screen.queryByRole('button', { name: 'Evidence ↑' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Evidence ↓' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Name A–Z' }))
  expect(within(screen.getAllByRole('article')[0]).getByRole('heading', { name: 'Adamax' })).toBeTruthy()
})

it.each(['hmg', 'hcg', 'oxytocin', 'cerebrolysin'])('does not treat %s as a defined single-compound mass input', slug => {
  render(<MemoryRouter initialEntries={[`/peptipedia/${slug}#rechner`]}><Routes>
    <Route path="/peptipedia/:slug" element={<PeptideDetailPage locale="de" />} />
  </Routes></MemoryRouter>)
  const calculator = within(screen.getByRole('tabpanel', { name: 'Rechner' }))
  expect(calculator.queryByRole('button', { name: 'Berechnen' })).toBeNull()
  expect(calculator.getByText(/Einzelstoff|Aktivitätseinheiten/)).toBeTruthy()
})

it.each(['SS-31', 'Semax'])('includes documented %s human research in the human-data filter', name => {
  render(<MemoryRouter><PeptideLibrary locale="en" /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Show filters' }))
  fireEvent.click(screen.getByRole('button', { name: 'Available' }))
  expect(screen.getByRole('heading', { name })).toBeTruthy()
})

it('filters unresolved profiles without including approved medicines', () => {
  render(<MemoryRouter><PeptideLibrary locale="en" /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Show filters' }))
  fireEvent.click(screen.getByRole('button', { name: 'Evidence unresolved' }))
  expect(screen.getByRole('heading', { name: 'Adamax' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Tesamorelin' })).toBeNull()
})
