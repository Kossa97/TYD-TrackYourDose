import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function CourseTimezoneReview({ timeZone, onConfirm }: {
  timeZone: string
  onConfirm(timeZone: string): Promise<void>
}) {
  const { t } = useTranslation()
  const [zone, setZone] = useState(timeZone)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  async function confirm() {
    setPending(true)
    setFailed(false)
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone }).format()
      await onConfirm(zone)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }
  return <section className="space-y-3 rounded-xl border border-amber-500/40 p-4" role="alert">
    <p>{t('my_stack_course_timezone_review')}</p>
    <label className="block text-sm">
      {t('my_stack_course_timezone')}
      <input className="input mt-1 w-full" value={zone} disabled={pending} onChange={event => setZone(event.target.value.trim())} />
    </label>
    {failed && <p>{t('my_stack_course_timezone_error')}</p>}
    <button className="btn-primary" disabled={pending || !zone} onClick={() => void confirm()}>
      {t('my_stack_course_timezone_confirm')}
    </button>
  </section>
}
