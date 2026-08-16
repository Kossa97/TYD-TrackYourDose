// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DoseUnitControl } from './DoseUnitControl'

afterEach(cleanup)

describe('DoseUnitControl', () => {
  it('renders the effective unit as a locked value for an existing plan', () => {
    const onChange = vi.fn()
    render(<DoseUnitControl label="Einheit" unit="mg" units={['mcg', 'mg']} locked onChange={onChange} />)

    expect(screen.queryByRole('combobox', { name: 'Einheit' })).toBeNull()
    const unit = screen.getByLabelText('Einheit') as HTMLInputElement
    expect(unit.value).toBe('mg')
    expect(unit.readOnly).toBe(true)
    fireEvent.change(unit, { target: { value: 'mcg' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('allows choosing the initial unit when no effective plan exists yet', () => {
    const onChange = vi.fn()
    render(<DoseUnitControl label="Einheit" unit="mcg" units={['mcg', 'mg']} locked={false} onChange={onChange} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Einheit' }), { target: { value: 'mg' } })
    expect(onChange).toHaveBeenCalledWith('mg')
  })
})
