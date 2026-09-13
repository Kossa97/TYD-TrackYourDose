import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, subDays } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { ProtocolPdfModal } from '../components/ProtocolPdfModal'

function defaultRange() {
  const to = new Date()
  const from = subDays(to, 29)
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  }
}

/** Vollseitiger PDF-Generator (Arzt / Coach / Forum) — ersetzt das alte Protokoll-Dashboard als Ziel von /protokoll. */
export function PdfProtokoll() {
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const range = useMemo(() => defaultRange(), [])

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-10 text-center text-sm text-slate-400">
        Bitte anmelden, um ein PDF zu erstellen.
      </div>
    )
  }

  return (
    <ProtocolPdfModal
      userId={user.id}
      initialRange={range}
      uiLang={i18n.language}
      variant="page"
      onClose={() => navigate(-1)}
    />
  )
}
