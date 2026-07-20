import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../context/AuthContext'
import { prepareFile } from '../../lib/imageResize'
import { parseExtractResult } from '../../lib/extractResult'
import { CATALOG_MARKER_NAMES } from '../../lib/markerCatalog'
import { formatDisplayDate } from '../../lib/format'
import { CYAN, MUTED, TEXT } from '../../styles'
import { ReviewTable, type ReviewRow } from './ReviewTable'

type Phase = 'idle' | 'extracting' | 'review' | 'saving'

interface Props {
  onClose: () => void
  onSaved: () => void
}

/** Ermittelt eine verständliche deutsche Fehlermeldung aus der Edge-Function-Antwort. */
async function describeExtractError(response: Response | undefined): Promise<string> {
  if (!response) {
    return 'Der Befund konnte nicht ausgelesen werden. Bitte manuell eintragen.'
  }
  if (response.status === 429) {
    return 'Import-Limit erreicht (10 pro Monat). Bitte später erneut versuchen.'
  }

  let code: string | undefined
  try {
    const body = await response.json()
    code = typeof body?.error === 'string' ? body.error : undefined
  } catch {
    code = undefined
  }

  if (code === 'rate_limit') {
    return 'Import-Limit erreicht (10 pro Monat). Bitte später erneut versuchen.'
  }
  if (code === 'no_bloodwork_found') {
    return 'Auf dem Bild wurde kein Laborbefund erkannt. Bitte manuell eintragen.'
  }
  return 'Der Befund konnte nicht ausgelesen werden. Bitte manuell eintragen.'
}

export function ImportFlow({ onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [phase, setPhase] = useState<Phase>('idle')
  const [testedAt, setTestedAt] = useState('')
  const [labName, setLabName] = useState('')
  const [rows, setRows] = useState<ReviewRow[]>([])

  const photoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setPhase('extracting')

    try {
      const prepared = await prepareFile(file)
      const { data, error, response } = await supabase.functions.invoke('bloodwork-extract', {
        body: { file: prepared.base64, mimeType: prepared.mimeType, markerNames: CATALOG_MARKER_NAMES },
      })

      if (error) {
        toast.error(await describeExtractError(response))
        setPhase('idle')
        return
      }

      const result = parseExtractResult(data)
      if (!result || result.values.length === 0) {
        toast.error('Auf dem Bild wurde kein Laborbefund erkannt. Bitte manuell eintragen.')
        setPhase('idle')
        return
      }

      setTestedAt(result.tested_at)
      setLabName(result.lab_name ?? '')
      setRows(result.values.map(v => ({ ...v, selected: true })))
      setPhase('review')
    } catch {
      toast.error('Die Datei konnte nicht verarbeitet werden.')
      setPhase('idle')
    }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    void handleFile(file)
  }

  const selected = rows.filter(r => r.selected && r.marker.trim() && Number.isFinite(r.value))

  const handleSave = async () => {
    if (!user) return

    if (selected.length === 0) {
      toast.error('Bitte mindestens einen Wert auswählen')
      return
    }
    if (!testedAt) {
      toast.error('Bitte ein Testdatum eintragen')
      return
    }

    setPhase('saving')

    const { data: report, error: reportError } = await supabase
      .from('bloodwork_reports')
      .insert({ user_id: user.id, tested_at: testedAt, lab_name: labName.trim() || null, source: 'import' })
      .select()
      .single()

    if (reportError || !report) {
      toast.error('Werte konnten nicht gespeichert werden')
      setPhase('review')
      return
    }

    const payload = selected.map(row => ({
      user_id: user.id,
      report_id: report.id,
      tested_at: testedAt,
      marker: row.marker.trim(),
      value: row.value,
      unit: row.unit.trim(),
      ref_min: row.ref_min,
      ref_max: row.ref_max,
      notes: null,
    }))

    const { error: valuesError } = await supabase.from('bloodwork').insert(payload)

    if (valuesError) {
      // Ein Befund ohne Werte wäre ein verwaister Datensatz.
      await supabase.from('bloodwork_reports').delete().eq('id', report.id)
      toast.error('Werte konnten nicht gespeichert werden')
      setPhase('review')
      return
    }

    toast.success(`${selected.length} Werte übernommen`)
    onSaved()
    onClose()
  }

  const saving = phase === 'saving'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh] rounded-t-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold" style={{ color: TEXT }}>Befund importieren</h2>

        {phase === 'idle' && (
          <>
            <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
              Fotografiere einen Laborbefund oder lade eine Datei hoch. Die Werte werden automatisch
              erkannt und müssen vor dem Speichern geprüft werden.
            </p>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileInputChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={onFileInputChange}
            />

            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => fileInputRef.current?.click()}>Datei</button>
              <button className="btn-primary flex-1" onClick={() => photoInputRef.current?.click()}>Foto</button>
            </div>
            <button className="btn-secondary w-full" onClick={onClose}>Abbrechen</button>
          </>
        )}

        {phase === 'extracting' && (
          <div className="py-10 text-center font-semibold" style={{ color: CYAN }}>
            Befund wird ausgelesen...
          </div>
        )}

        {(phase === 'review' || saving) && (
          <>
            <div>
              <label className="label">Testdatum</label>
              <input
                className="input"
                type="date"
                value={testedAt}
                onChange={e => setTestedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Labor</label>
              <input
                className="input"
                placeholder="Optional"
                value={labName}
                onChange={e => setLabName(e.target.value)}
              />
            </div>

            <ReviewTable
              rows={rows}
              onChange={(index, row) => setRows(rows.map((r, i) => (i === index ? row : r)))}
            />

            <p className="text-xs" style={{ color: MUTED }}>
              Wird gespeichert als Befund vom {testedAt ? formatDisplayDate(testedAt) : '–'}
            </p>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>Abbrechen</button>
              <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
                {saving ? 'Speichern...' : `${selected.length} übernehmen`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
