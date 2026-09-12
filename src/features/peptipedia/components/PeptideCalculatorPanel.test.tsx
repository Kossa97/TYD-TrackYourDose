// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { PeptideCalculatorPanel } from './PeptideCalculatorPanel'

afterEach(cleanup)
it('starts empty and only calculates the entered target', () => {
  render(<PeptideCalculatorPanel locale="de" />)
  const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
  expect(inputs.every(input => input.value === '')).toBe(true)
  for (const [index, value] of ['5', '2', '250', '1', '100'].entries()) {
    fireEvent.change(inputs[index], { target: { value } })
  }
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'mcg' } })
  fireEvent.click(screen.getByRole('button', { name: 'Berechnen' }))
  expect(screen.getByRole('status').textContent).toContain('0,1 ml')
  expect(screen.getByRole('status').textContent).toContain('10')
})
