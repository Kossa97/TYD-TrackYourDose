import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag } from 'lucide-react'
import { MELDEGRUENDE, type Meldegrund } from '../lib/moderation'
import { Sheet } from './Sheet'

/** Eine oeffentliche Erfahrung melden: Grund waehlen, optional Details. */
export function ReportSheet({ substanz, busy, onCancel, onSend }: {
  substanz: string
  busy: boolean
  onCancel: () => void
  onSend: (grund: Meldegrund, details: string) => void
}) {
  const { t } = useTranslation()
  const [grund, setGrund] = useState<Meldegrund | null>(null)
  const [details, setDetails] = useState('')
  return (
    <Sheet labelledBy="report-title" busy={busy} onClose={onCancel} data-report-sheet>
      <form onSubmit={event => { event.preventDefault(); if (grund) onSend(grund, details) }}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
            <Flag size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="report-title" className="text-lg font-bold text-white">{t('report_title')}</h2>
            <p className="mt-0.5 truncate text-sm text-slate-400">{substanz}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-400">{t('report_desc')}</p>
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="sr-only">{t('report_title')}</legend>
          {MELDEGRUENDE.map(key => (
            <label
              key={key}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm ${grund === key ? 'border-sky-500 bg-sky-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-300'}`}
            >
              <input type="radio" name="report-reason" value={key} data-report-reason={key} checked={grund === key} onChange={() => setGrund(key)} className="accent-sky-500" />
              {t(`report_reason_${key}`)}
            </label>
          ))}
        </fieldset>
        <label className="mt-4 block text-xs font-semibold text-slate-400" htmlFor="report-details">{t('report_details')}</label>
        <textarea
          id="report-details"
          data-report-details
          value={details}
          maxLength={1000}
          onChange={event => setDetails(event.target.value)}
          rows={3}
          className="input mt-1 w-full resize-none"
        />
        <div className="mt-5 flex gap-2">
          <button type="button" data-app-back-close disabled={busy} onClick={onCancel} className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 disabled:opacity-50">
            {t('cancel')}
          </button>
          <button type="submit" data-report-send disabled={busy || !grund} className="min-h-11 flex-1 rounded-xl bg-amber-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-50">
            {busy ? t('report_sending') : t('report_send')}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
