import { useRef, useState, type ChangeEvent } from 'react'
import { format, parseISO } from 'date-fns'
import { Camera, ImageOff, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../context/AuthContext'
import type { ProgressPhotoEntry } from '../../types'
import { PHOTO_BUCKET } from '../../constants'
import { PHOTO_GRID_OPTIONS, photoGridColumns, readPhotoGridSize, writePhotoGridSize, type PhotoGridSize } from '../../lib/photoGrid'
import { isLegacyPhotoUrl } from '../../hooks/useFortschrittData'
import { fieldLabel, inputStyle, panel } from '../../styles'

const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const fmtDate = (d: string) => format(parseISO(`${d}T00:00:00`), 'dd.MM.yyyy')

interface Props {
  photos: ProgressPhotoEntry[]
  onChange: () => void
}

export function FotosTab({ photos, onChange }: Props) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState<ProgressPhotoEntry | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [gridSize, setGridSize] = useState<PhotoGridSize>(() => readPhotoGridSize())

  const handleGridSizeChange = (size: PhotoGridSize) => {
    setGridSize(size)
    writePhotoGridSize(size)
  }

  const openSheet = () => {
    setDate(todayStr())
    setWeight('')
    setNotes('')
    setSelectedFile(null)
    setPreviewUrl(null)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setSelectedFile(null)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleUpload = async () => {
    if (!user || !selectedFile) {
      toast.error('Bitte zuerst ein Foto auswählen')
      return
    }
    setUploading(true)
    try {
      const ext = selectedFile.name.split('.').pop() ?? 'jpg'
      // Privater Bucket: erster Pfad-Teil = user.id, darauf prüfen die Storage-Policies.
      // In der DB liegt nur der Pfad; Anzeige läuft über signierte URLs.
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, selectedFile, { contentType: selectedFile.type, upsert: false })
      if (upErr) throw upErr
      const { error: dbErr } = await supabase.from('progress_photos').insert({
        user_id: user.id,
        photo_url: path,
        taken_at: date,
        weight_kg: weight ? Number(weight) : null,
        notes: notes || null,
      })
      if (dbErr) throw dbErr
      toast.success('Foto gespeichert')
      closeSheet()
      onChange()
    } catch {
      toast.error('Fehler beim Hochladen')
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async (photo: ProgressPhotoEntry) => {
    if (!confirm('Foto wirklich löschen?')) return
    if (isLegacyPhotoUrl(photo.photo_url)) {
      const parts = photo.photo_url.split('/batch-files/')
      if (parts.length > 1) {
        await supabase.storage.from('batch-files').remove([parts[1]])
      }
    } else {
      await supabase.storage.from(PHOTO_BUCKET).remove([photo.photo_url])
    }
    const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id)
    if (error) {
      toast.error('Fehler beim Löschen')
      return
    }
    toast.success('Foto gelöscht')
    setActivePhoto(null)
    onChange()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)' }}>Fotos</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'} gespeichert
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div role="group" aria-label="Rastergröße" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: 3, borderRadius: 12, background: 'var(--surface-input)', border: '1px solid var(--border)' }}>
            {PHOTO_GRID_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={gridSize === option.value}
                onClick={() => handleGridSizeChange(option.value)}
                style={{
                  border: 'none', borderRadius: 9, padding: '6px 8px',
                  background: gridSize === option.value ? 'var(--accent-weak)' : 'transparent',
                  color: gridSize === option.value ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '0.58rem', fontWeight: 800, cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openSheet}
            aria-label="Foto hinzufügen"
            style={{
              width: 44, height: 44, borderRadius: 16, flexShrink: 0,
              background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
              color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div style={{ ...panel, padding: '52px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: 22, background: 'var(--accent-weak)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageOff size={30} color="var(--accent)" />
          </div>
          <div>
            <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 6 }}>Noch keine Fotos</p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Dokumentiere deinen Fortschritt visuell — z. B. alle 2 Wochen.
            </p>
          </div>
          <button type="button" onClick={openSheet} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Camera size={15} /> Foto hinzufügen
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${photoGridColumns(gridSize)}, 1fr)`, gap: 10 }}>
          {photos.map(photo => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActivePhoto(photo)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 18, overflow: 'hidden', padding: 0, textAlign: 'left', cursor: 'pointer',
              }}
            >
              <div style={{ aspectRatio: '3/4', overflow: 'hidden' }}>
                <img src={photo.display_url} alt={photo.taken_at} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '9px 11px' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-dim)' }}>{fmtDate(photo.taken_at)}</p>
                {photo.weight_kg != null && (
                  <p style={{ fontSize: '0.62rem', color: 'var(--accent)', fontWeight: 700 }}>{photo.weight_kg} kg</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {activePhoto && (
        <div onClick={() => setActivePhoto(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.93)', display: 'flex', flexDirection: 'column' }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text)' }}>{fmtDate(activePhoto.taken_at)}</p>
              {activePhoto.weight_kg != null && (
                <p style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>{activePhoto.weight_kg} kg</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={e => { e.stopPropagation(); void deletePhoto(activePhoto) }}
                style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(244,63,94,0.14)', border: '1px solid rgba(244,63,94,0.24)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={16} />
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); setActivePhoto(null) }}
                style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--surface-input)', border: '1px solid var(--border)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <img src={activePhoto.display_url} alt={activePhoto.taken_at} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
          {activePhoto.notes && (
            <div onClick={e => e.stopPropagation()} style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>{activePhoto.notes}</p>
            </div>
          )}
        </div>
      )}

      {sheetOpen && <div onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }} />}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
        padding: '0 18px 40px', transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.30s cubic-bezier(0.4,0,0.2,1)', maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ position: 'sticky', top: 0, paddingTop: 16, paddingBottom: 14, background: 'inherit', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--border)', margin: '0 auto 18px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)' }}>Foto hinzufügen</h2>
            <button type="button" onClick={closeSheet} style={{ color: 'var(--text-muted)', display: 'flex' }}><X size={20} /></button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />

        {previewUrl ? (
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <img src={previewUrl} alt="Vorschau" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 16, display: 'block' }} />
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', padding: '30px 0', borderRadius: 18, marginBottom: 16, border: '2px dashed var(--accent-border)', background: 'var(--accent-weak)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--accent)', cursor: 'pointer' }}>
            <Camera size={30} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>Foto aufnehmen oder aus Galerie wählen</span>
          </button>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Datum</label>
          <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={fieldLabel}>Gewicht in kg (optional)</label>
          <input type="number" inputMode="decimal" placeholder="z.B. 82.5" value={weight} onChange={e => setWeight(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={fieldLabel}>Notizen (optional)</label>
          <textarea placeholder="Besondere Beobachtungen…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'none' }} />
        </div>
        <button type="button" onClick={() => void handleUpload()} disabled={!selectedFile || uploading} className="btn-primary" style={{ width: '100%' }}>
          {uploading ? 'Wird hochgeladen…' : 'Foto speichern'}
        </button>
      </div>
    </>
  )
}
