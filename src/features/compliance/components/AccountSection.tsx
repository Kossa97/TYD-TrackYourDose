import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Ban, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { loescheKonto, type AccountClient } from '../services/account'
import { LegalLinks } from './LegalLinks'
import { Sheet } from './Sheet'

/**
 * Unten im Profil: blockierte Profile, Rechtstexte und „Konto loeschen".
 * Das Loeschen verlangt das Eintippen eines Worts — ein versehentlicher
 * Tipp loescht nichts.
 */
export function AccountSection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [blockiert, setBlockiert] = useState<{ username: string }[] | null>(null)
  const [neuLaden, setNeuLaden] = useState(0)
  const [loeschen, setLoeschen] = useState(false)
  const [eingabe, setEingabe] = useState('')
  const [busy, setBusy] = useState(false)
  const wort = t('account_delete_word')

  useEffect(() => {
    if (!user) return
    let aktuell = true
    void supabase.rpc('my_blocked_profiles').then(({ data, error }) => {
      if (aktuell) setBlockiert(error ? [] : (data as { username: string }[] | null) ?? [])
    })
    return () => { aktuell = false }
  }, [user, neuLaden])

  const entblocken = async (username: string) => {
    const { error } = await supabase.rpc('set_profile_block', { p_username: username, p_blocked: false })
    if (error) return toast.error(t('error'))
    toast.success(t('unblock_done'))
    setNeuLaden(n => n + 1)
  }

  const kontoLoeschen = async () => {
    if (!user || eingabe.trim().toUpperCase() !== wort.toUpperCase()) return
    setBusy(true)
    try {
      await loescheKonto(supabase as unknown as AccountClient, user.id)
      toast.success(t('account_deleted'))
    } catch {
      setBusy(false)
      toast.error(t('account_delete_error'))
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-4" data-account-section>
      <div className="card space-y-2">
        <h2 className="flex items-center gap-2 font-semibold text-slate-300">
          <Ban size={15} className="text-slate-500" aria-hidden="true" /> {t('blocked_list_title')}
        </h2>
        {blockiert === null ? null : blockiert.length === 0 ? (
          <p className="text-sm text-slate-500">{t('blocked_list_empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800" data-blocked-list>
            {blockiert.map(eintrag => (
              <li key={eintrag.username} className="flex min-h-11 items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-slate-300">@{eintrag.username}</span>
                <button type="button" data-unblock={eintrag.username} onClick={() => void entblocken(eintrag.username)} className="min-h-11 shrink-0 px-2 text-xs font-semibold text-sky-400">
                  {t('unblock_action')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        data-account-delete-open
        onClick={() => { setEingabe(''); setLoeschen(true) }}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 text-sm font-semibold text-red-300"
      >
        <Trash2 size={15} aria-hidden="true" /> {t('account_delete_title')}
      </button>

      <LegalLinks className="pb-2" />

      {loeschen && (
        <Sheet labelledBy="account-delete-title" busy={busy} onClose={() => setLoeschen(false)} role="alertdialog" data-account-delete-sheet>
          <form onSubmit={event => { event.preventDefault(); void kontoLoeschen() }}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                <Trash2 size={18} aria-hidden="true" />
              </span>
              <h2 id="account-delete-title" className="pt-2 text-lg font-bold text-white">{t('account_delete_title')}</h2>
            </div>
            <p className="mt-3 text-sm text-slate-400">{t('account_delete_desc')}</p>
            <label htmlFor="account-delete-confirm" className="mt-4 block text-xs font-semibold text-slate-400">
              {t('account_delete_confirm_label', { word: wort })}
            </label>
            <input
              id="account-delete-confirm"
              data-account-delete-input
              value={eingabe}
              onChange={event => setEingabe(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className="input mt-1 w-full"
            />
            <div className="mt-5 flex gap-2">
              <button type="button" autoFocus data-app-back-close disabled={busy} onClick={() => setLoeschen(false)} className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 disabled:opacity-50">
                {t('cancel')}
              </button>
              <button
                type="submit"
                data-account-delete-confirm
                disabled={busy || eingabe.trim().toUpperCase() !== wort.toUpperCase()}
                className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? t('account_deleting') : t('account_delete_action')}
              </button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  )
}
