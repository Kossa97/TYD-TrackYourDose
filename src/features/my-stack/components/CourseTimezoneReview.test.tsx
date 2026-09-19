// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CourseTimezoneReview } from './CourseTimezoneReview'
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
it('requires explicit confirmation of the displayed editable device timezone', async () => {
  const confirm = vi.fn(async () => undefined)
  render(<CourseTimezoneReview timeZone="Europe/Berlin" onConfirm={confirm} />)
  expect(confirm).not.toHaveBeenCalled()
  const input = screen.getByLabelText('my_stack_course_timezone')
  expect((input as HTMLInputElement).value).toBe('Europe/Berlin')
  fireEvent.change(input, { target: { value: 'America/New_York' } })
  fireEvent.click(screen.getByRole('button', { name: 'my_stack_course_timezone_confirm' }))
  await waitFor(() => expect(confirm).toHaveBeenCalledWith('America/New_York'))
})
