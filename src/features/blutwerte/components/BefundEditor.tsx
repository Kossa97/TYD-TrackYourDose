import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import type { BloodworkEntry, BloodworkReport } from '../types'
import { MAX_UPLOAD_BYTES, prepareFile } from '../lib/imageResize'
import { parseExtractResult, type ExtractResult } from '../lib/extractResult'
import { CATALOG_MARKER_NAMES, normalizeMarker } from '../lib/markerCatalog'
import { mergeIncoming, markerKey, type MergeConflict, type MergeItem } from '../lib/mergeRows'
import { toNumber } from '../lib/bloodwork'
import { formatDisplayDate, formatNumber } from '../lib/format'
import { MUTED, TEXT } from '../styles'
import { ReviewTable, type ReviewRow } from './import/ReviewTable'
import { ConflictResolver } from './import/ConflictResolver'

interface Props {
  report: BloodworkReport
  /** Bereits gespeicherte Werte dieses Befunds. */
  entries: BloodworkEntry[]
  onClose: () => void
  onSaved: () => void
}

const toMergeItem = (row: ReviewRow): MergeItem => ({
  marker: row.marker,
  value: row.value,
  unit: row.unit,
  ref_min: row.ref_min,
  ref_max: row.ref_max,
})

const entryToMergeItem = (entry: BloodworkEntry): MergeItem => ({
  marker: entry.marker,
  value: toNumber(entry.value),
  unit: entry.unit,
  ref_min: entry.ref_min,
  ref_max: entry.ref_max,
})

const toReviewRow = (item: MergeItem): ReviewRow => ({
  ...item,
  matched: normalizeMarker(item.marker) != null,
  selected: true,
})

/** Ermittelt eine verständliche deutsche Fehlermeldung aus der Edge-Function-Antwort. */
async function describeExtractError(response: Response | undefined): Promise<string> {
  if (!response) {
    return 'Der Befund konnte nicht ausgelesen werden. Bitte manuell eintragen.'
  }
  if (response.status === 429) {
    return 'Import-Limit erreicht (10 pro Monat). Bitte später erneut versuchen.'
  }
  if (response.status === 413) {
    return 'Datei ist zu groß (max. 10 MB).'
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
  if (code === 'file_too_large') {
    return 'Datei ist zu groß (max. 10 MB).'
  }
  if (code === 'no_bloodwork_found') {
    return 'Auf dem Bild wurde kein Laborbefund erkannt. Bitte manuell eintragen.'
  }
  return 'Der Befund konnte nicht ausgelesen werden. Bitte manuell eintragen.'
}

export function BefundEditor({ report, entries, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [pending, setPending] = useState<ReviewRow[]>([])
  const [conflicts, setConflicts] = useState<MergeConflict[]>([])
  const [replacements, setReplacements] = useState<Record<string, MergeItem>>({})
  const [rescanning, setRescanning] = useState(false)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const savedKeyToEntry = new Map<string, BloodworkEntry>()
  entries.forEach(entry => savedKeyToEntry.set(markerKey(entry.marker), entry))

  /** Ruft die Extraktion auf und gibt das validierte Ergebnis zurück (oder null bei Fehler). */
  const runExtraction = async (file: File): Promise<ExtractResult | null> => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Datei ist zu groß (max. 10 MB). Bitte kleiner fotografieren oder komprimieren.')
      return null
    }
    const prepared = await prepareFile(file)
    const { data, error, response } = await supabase.functions.invoke('bloodwork-extract', {
      body: { file: prepared.base64, mimeType: prepared.mimeType, markerNames: CATALOG_MARKER_NAMES },
    })

    if (error) {
      toast.error(await describeExtractError(response))
      return null
    }

    const result = parseExtractResult(data)
    if (!result || result.values.length === 0) {
      toast.error('Auf dem Bild wurde kein Laborbefund erkannt. Bitte manuell eintragen.')
      return null
    }
    return result
  }

  const addManualRow = () => {
    setPending(current => [
      ...current,
      { marker: '', value: 0, unit: '', ref_min: null, ref_max: null, matched: false, selected: true },
    ])
  }

  const handleRescan = async (file: File | undefined) => {
    if (!file) return
    setRescanning(true)
    try {
      const result = await runExtraction(file)
      if (!result) return

      const incoming: MergeItem[] = result.values.map(v => ({
        marker: v.marker,
        value: v.value,
        unit: v.unit,
        ref_min: v.ref_min,
        ref_max: v.ref_max,
      }))

      const existingSet: MergeItem[] = [...entries.map(entryToMergeItem), ...pending.map(toMergeItem)]
      const { added, conflicts: newConflicts, duplicates } = mergeIncoming(existingSet, incoming)

      if (added.length > 0) setPending(current => [...current, ...added.map(toReviewRow)])
      if (newConflicts.length > 0) setConflicts(newConflicts)

      const parts: string[] = []
      if (added.length > 0) parts.push(`${added.length} ergänzt`)
      if (duplicates > 0) parts.push(`${duplicates} bereits vorhanden`)
      if (newConflicts.length > 0) parts.push(`${newConflicts.length} zu klären`)
      toast.success(parts.length > 0 ? parts.join(' · ') : 'Keine neuen Werte gefunden')
    } catch {
      toast.error('Die Datei konnte nicht verarbeitet werden.')
    } finally {
      setRescanning(false)
    }
  }

  const onRescanInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    void handleRescan(file)
  }

  const resolveConflicts = (replaceByKey: Record<string, boolean>) => {
    const newReplacements: Record<string, MergeItem> = {}
    conflicts.forEach(c => {
      if (!replaceByKey[c.key]) return
      const savedEntry = savedKeyToEntry.get(c.key)
      if (savedEntry) newReplacements[savedEntry.id] = c.incoming
    })
    if (Object.keys(newReplacements).length > 0) {
      setReplacements(current => ({ ...current, ...newReplacements }))
    }

    setPending(current =>
      current.map(row => {
        const key = markerKey(row.marker)
        const conflict = conflicts.find(c => c.key === key)
        if (conflict && replaceByKey[key] && !savedKeyToEntry.has(key)) {
          return {
            ...row,
            value: conflict.incoming.value,
            unit: conflict.incoming.unit,
            ref_min: conflict.incoming.ref_min,
            ref_max: conflict.incoming.ref_max,
          }
        }
        return row
      }),
    )
    setConflicts([])
  }

  const validPending = pending.filter(r => r.selected && r.marker.trim() && Number.isFinite(r.value))
  const insertable = validPending.filter(r => !savedKeyToEntry.has(markerKey(r.marker)))

  const handleSave = async () => {
    if (!user) return

    const skipped = validPending.length - insertable.length
    if (skipped > 0) {
      toast.success(`${skipped} Wert(e) übersprungen (schon im Befund).`)
    }

    if (insertable.length === 0 && Object.keys(replacements).length === 0) {
      toast.error('Nichts zu speichern')
      return
    }

    setSaving(true)

    if (insertable.length > 0) {
      const payload = insertable.map(row => ({
        user_id: user.id,
        report_id: report.id,
        tested_at: report.tested_at,
        marker: row.marker.trim(),
        value: row.value,
        unit: row.unit.trim(),
        ref_min: row.ref_min,
        ref_max: row.ref_max,
        notes: null,
      }))
      const { error } = await supabase.from('bloodwork').insert(payload)
      if (error) {
        toast.error('Konnte nicht gespeichert werden')
        setSaving(false)
        return
      }
    }

    for (const [entryId, item] of Object.entries(replacements)) {
      const { error } = await supabase
        .from('bloodwork')
        .update({ value: item.value, unit: item.unit, ref_min: item.ref_min, ref_max: item.ref_max })
        .eq('id', entryId)
        .eq('user_id', user.id)
      if (error) {
        toast.error('Konnte nicht gespeichert werden')
        setSaving(false)
        return
      }
    }

    toast.success('Befund aktualisiert')
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh] rounded-t-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold" style={{ color: TEXT }}>
          Befund vom {formatDisplayDate(report.tested_at)}{report.lab_name ? ` · ${report.lab_name}` : ''} ergänzen
        </h2>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
            Bereits gespeichert ({entries.length})
          </p>
          <div className="space-y-1.5">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <span style={{ color: MUTED }}>{entry.marker}</span>
                <span style={{ color: MUTED }}>
                  {formatNumber(entry.value)} {entry.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
            Neue Werte
          </p>
          <ReviewTable
            rows={pending}
            onChange={(index, row) => setPending(pending.map((r, i) => (i === index ? row : r)))}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={onRescanInputChange}
        />

        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={addManualRow} disabled={saving || rescanning}>
            Manuell hinzufügen
          </button>
          <button
            className="btn-secondary flex-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving || rescanning}
          >
            {rescanning ? 'Wird ausgelesen...' : 'Datei scannen'}
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>Abbrechen</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving || rescanning}>
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <ConflictResolver
          conflicts={conflicts}
          onResolve={resolveConflicts}
          onCancel={() => setConflicts([])}
        />
      )}
    </div>
  )
}
