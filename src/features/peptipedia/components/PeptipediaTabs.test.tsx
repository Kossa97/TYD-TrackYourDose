// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { PeptipediaTabs } from './PeptipediaTabs'

afterEach(cleanup)
it('provides all tabs and keyboard navigation', () => {
  let selected = ''
  render(<PeptipediaTabs locale="de" activeTab="overview" onSelect={tab => { selected = tab }} />)
  const tabs = screen.getAllByRole('tab')
  expect(tabs.map(tab => tab.textContent)).toEqual(['Überblick', 'Wirkung', 'Studienprotokolle', 'Rechner', 'Sicherheit', 'Quellen'])
  fireEvent.keyDown(tabs[0], { key: 'End' })
  expect(selected).toBe('sources')
  expect(document.activeElement).toBe(tabs[5])
})
