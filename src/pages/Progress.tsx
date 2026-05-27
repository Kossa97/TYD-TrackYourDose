import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { format } from 'date-fns'
import { Camera, ImageOff, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Typen ─────────────────────────────────────────────────────────────────

interface ProgressPhoto {
  id: string
  photo_url: string
  taken_at: string
  weight_kg: number | null
  notes: string | null
}

const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const fmtDate  = (d: string) => format(new Date(`${d}T00:00:00`), 'dd.MM.yyyy')

// ── Styles (konsistent mit Design-System) ────────────────────────────────

const panel = {
  background: 'linear-gradient(145deg, rgba(9,14,34,0.94), rgba(4,7,18,0.96))',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 24,
} as const

const label = {
  fontSize: '0.6rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(154,170,191,0.60)',
  display: 'block',
  marginBottom: 6,
} as const

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#eaeefc',
  fontSize: '0.9rem',
  fontWeight: 700,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
} as const

// ── Komponente ────────────────────────────────────────────────────────────

export function Progress() {
  const { user } = useAuth()
  const [photos,    setPhotos]    = useState<ProgressPhoto[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)

  // Bottom-Sheet
  const [sheetOpen,    setSheetOpen]    = useState(false)
  const [date,         setDate]         = useState(todayStr())
  const [weight,       setWeight]       = useState('')
  const [notes,        setNotes]        = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Vollbild-Overlay
  const [activePhoto, setActivePhoto] = useState<ProgressPhoto | null>(null)

  // ── Daten laden ──────────────────────────────────────────────────────

  const loadPhotos = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('progress_photos')
      .select('id, photo_url, taken_at, weight_kg, notes')
      .eq('user_id', user.id)
      .order('taken_at', { ascending: false })
    setPhotos((data as ProgressPhoto[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { void loadPhotos() }, [loadPhotos])

  // ── Bottom-Sheet ─────────────────────────────────────────────────────

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
      const ext  = selectedFile.name.split('.').pop() ?? 'jpg'
      const path = `progress/${user.id}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('batch-files')
        .upload(path, selectedFile, { contentType: selectedFile.type, upsert: false })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('batch-files')
        .getPublicUrl(path)

      const { error: dbErr } = await supabase
        .from('progress_photos')
        .insert({
          user_id:  user.id,
          photo_url: publicUrl,
          taken_at:  date,
          weight_kg: weight ? Number(weight) : null,
          notes:     notes || null,
        })
      if (dbErr) throw dbErr

      toast.success('Foto gespeichert')
      closeSheet()
      void loadPhotos()
    } catch {
      toast.error('Fehler beim Hochladen')
    } finally {
      setUploading(false)
    }
  }

  // ── Löschen ──────────────────────────────────────────────────────────

  const deletePhoto = async (photo: ProgressPhoto) => {
    if (!confirm('Foto wirklich löschen?')) return
    // Storage-Pfad aus URL extrahieren
    const parts = photo.photo_url.split('/batch-files/')
    if (parts.length > 1) {
      await supabase.storage.from('batch-files').remove([parts[1]])
    }
    const { error } = await supabase
      .from('progress_photos')
      .delete()
      .eq('id', photo.id)
    if (error) { toast.error('Fehler beim Löschen'); return }
    toast.success('Foto gelöscht')
    setActivePhoto(null)
    void loadPhotos()
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>

        {/* Header-Panel */}
        <div style={{ ...panel, padding: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 88% 10%, rgba(0,204,245,0.18), transparent 34%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(0,204,245,0.74)', marginBottom: 4 }}>
                Körper
              </p>
              <h1 style={{ fontSize: '1.7rem', fontWeight: 900, letterSpacing: '-0.04em', color: '#f8fbff', lineHeight: 1.05 }}>
                Foto-Fortschritt
              </h1>
              <p style={{ fontSize: '0.74rem', color: 'rgba(213,224,242,0.55)', marginTop: 5 }}>
                {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'} gespeichert
              </p>
            </div>
            <button
              onClick={openSheet}
              style={{
                width: 44, height: 44, borderRadius: 16, flexShrink: 0,
                background: 'rgba(0,204,245,0.14)',
                border: '1px solid rgba(0,204,245,0.28)',
                color: '#00ccf5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0,204,245,0.16)',
              }}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Inhalt */}
        {loading ? (
          <p style={{ textAlign: 'center', color: 'rgba(154,170,191,0.45)', fontSize: '0.85rem', padding: '40px 0' }}>
            Lade…
          </p>
        ) : photos.length === 0 ? (

          /* Empty State */
          <div style={{ ...panel, padding: '52px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{ width: 68, height: 68, borderRadius: 22, background: 'rgba(0,204,245,0.09)', border: '1px solid rgba(0,204,245,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageOff size={30} color="rgba(0,204,245,0.55)" />
            </div>
            <div>
              <p style={{ fontSize: '0.95rem', fontWeight: 800, color: '#eaeefc', marginBottom: 6 }}>Noch keine Fotos</p>
              <p style={{ fontSize: '0.74rem', color: 'rgba(154,170,191,0.52)', lineHeight: 1.55 }}>
                Füge dein erstes Fortschrittsfoto hinzu und verfolge deine Entwicklung.
              </p>
            </div>
            <button
              onClick={openSheet}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '10px 22px', borderRadius: 14,
                background: 'rgba(0,204,245,0.12)', border: '1px solid rgba(0,204,245,0.24)',
                color: '#00ccf5', fontSize: '0.82rem', fontWeight: 800,
              }}
            >
              <Camera size={15} /> Foto hinzufügen
            </button>
          </div>

        ) : (

          /* 2-Spalten-Grid */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {photos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setActivePhoto(photo)}
                style={{
                  background: 'rgba(9,14,34,0.94)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                  overflow: 'hidden',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {/* Foto 3:4 */}
                <div style={{ aspectRatio: '3/4', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={photo.photo_url}
                    alt={photo.taken_at}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                {/* Meta */}
                <div style={{ padding: '9px 11px' }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 800, color: '#eaeefc', marginBottom: 2 }}>
                    {fmtDate(photo.taken_at)}
                  </p>
                  {photo.weight_kg != null && (
                    <p style={{ fontSize: '0.62rem', color: '#00ccf5', fontWeight: 700 }}>
                      {photo.weight_kg} kg
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Vollbild-Overlay ──────────────────────────────────────────────── */}
      {activePhoto && (
        <div
          onClick={() => setActivePhoto(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.93)', display: 'flex', flexDirection: 'column' }}
        >
          {/* Top-Bar */}
          <div
            onClick={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div>
              <p style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fbff' }}>
                {fmtDate(activePhoto.taken_at)}
              </p>
              {activePhoto.weight_kg != null && (
                <p style={{ fontSize: '0.72rem', color: '#00ccf5', fontWeight: 700, marginTop: 2 }}>
                  {activePhoto.weight_kg} kg
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={e => { e.stopPropagation(); void deletePhoto(activePhoto) }}
                style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(244,63,94,0.14)', border: '1px solid rgba(244,63,94,0.24)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setActivePhoto(null) }}
                style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#eaeefc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Foto */}
          <div style={{ flex: 1, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <img src={activePhoto.photo_url} alt={activePhoto.taken_at} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          </div>

          {/* Notizen */}
          {activePhoto.notes && (
            <div
              onClick={e => e.stopPropagation()}
              style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(9,14,34,0.96)' }}
            >
              <p style={{ fontSize: '0.75rem', color: 'rgba(213,224,242,0.68)', lineHeight: 1.55 }}>
                {activePhoto.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Upload Bottom-Sheet ───────────────────────────────────────────── */}
      {sheetOpen && (
        <div onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }} />
      )}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'linear-gradient(180deg, rgba(11,16,38,0.99), rgba(5,9,22,0.99))',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: '24px 24px 0 0',
        padding: '0 18px 40px',
        transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.30s cubic-bezier(0.4,0,0.2,1)',
        maxHeight: '92vh',
        overflowY: 'auto',
      }}>
        {/* Handle + Header */}
        <div style={{ position: 'sticky', top: 0, paddingTop: 16, paddingBottom: 14, background: 'inherit', zIndex: 1 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.16)', margin: '0 auto 18px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f8fbff' }}>Foto hinzufügen</h2>
            <button onClick={closeSheet} style={{ color: 'rgba(154,170,191,0.55)', display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Foto-Picker */}
        {previewUrl ? (
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <img src={previewUrl} alt="Vorschau" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 16, display: 'block' }} />
            <button
              onClick={() => { setSelectedFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
              style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 10, background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ width: '100%', padding: '30px 0', borderRadius: 18, marginBottom: 16, border: '2px dashed rgba(0,204,245,0.24)', background: 'rgba(0,204,245,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#00ccf5', cursor: 'pointer' }}
          >
            <Camera size={30} />
            <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>Foto aufnehmen oder aus Galerie wählen</span>
          </button>
        )}

        {/* Datum */}
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Datum</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </div>

        {/* Gewicht */}
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Gewicht in kg (optional)</label>
          <input type="number" inputMode="decimal" placeholder="z.B. 82.5" value={weight} onChange={e => setWeight(e.target.value)} style={inputStyle} />
        </div>

        {/* Notizen */}
        <div style={{ marginBottom: 20 }}>
          <label style={label}>Notizen (optional)</label>
          <textarea
            placeholder="Wie fühlst du dich? Besondere Beobachtungen…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>

        {/* Speichern */}
        <button
          onClick={() => void handleUpload()}
          disabled={!selectedFile || uploading}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 16,
            background: (!selectedFile || uploading) ? 'rgba(255,255,255,0.05)' : 'rgba(0,204,245,0.16)',
            border: (!selectedFile || uploading) ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,204,245,0.32)',
            color: (!selectedFile || uploading) ? 'rgba(154,170,191,0.38)' : '#00ccf5',
            fontSize: '0.92rem', fontWeight: 900,
            cursor: (!selectedFile || uploading) ? 'not-allowed' : 'pointer',
            transition: 'all 0.18s',
          }}
        >
          {uploading ? 'Wird hochgeladen…' : 'Foto speichern'}
        </button>
      </div>
    </>
  )
}
