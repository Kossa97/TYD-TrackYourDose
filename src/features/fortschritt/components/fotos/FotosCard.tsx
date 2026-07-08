import { useMemo, useState } from 'react'
import { Camera, ImageOff, Plus, X } from 'lucide-react'
import type { DateRange, ProgressPhotoEntry } from '../../types'
import { filterByDateRange } from '../../lib/range'
import { panel, sectionLabel } from '../../styles'
import { FotosTab } from './FotosTab'

interface Props {
  photos: ProgressPhotoEntry[]
  range: DateRange
  onChange: () => void
}

export function FotosCard({ photos, range, onChange }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const inRange = useMemo(
    () => filterByDateRange(photos, range, p => p.taken_at),
    [photos, range],
  )

  const preview = useMemo(
    () => [...inRange].sort((a, b) => b.taken_at.localeCompare(a.taken_at)).slice(0, 4),
    [inRange],
  )

  return (
    <>
      <section style={{ ...panel, padding: '14px 14px 12px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={sectionLabel}>Fotos</p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="Foto hinzufügen"
            style={{
              width: 28,
              height: 28,
              borderRadius: 9,
              background: 'var(--accent-weak)',
              border: '1px solid var(--accent-border)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={15} />
          </button>
        </div>

        {preview.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px 0', gap: 10 }}>
            <ImageOff size={22} color="var(--text-muted)" />
            <p style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1.45 }}>
              {photos.length === 0 ? 'Noch keine Fotos' : 'Keine Fotos im Zeitraum'}
            </p>
            <button type="button" onClick={() => setSheetOpen(true)} className="btn-secondary" style={{ fontSize: '0.72rem', padding: '8px 10px' }}>
              <Camera size={14} /> Foto hinzufügen
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {preview.map(photo => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    padding: 0,
                    border: '1px solid var(--border)',
                    aspectRatio: '1',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={photo.display_url}
                    alt={photo.taken_at}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              style={{
                marginTop: 10,
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '0.68rem',
                fontWeight: 800,
                cursor: 'pointer',
                textAlign: 'left',
                padding: 0,
              }}
            >
              Alle anzeigen ({inRange.length})
            </button>
          </>
        )}
      </section>

      {sheetOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10060,
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: 'max(10px, env(safe-area-inset-top)) 12px 0',
            flexShrink: 0,
          }}>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Schließen"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface-input)',
                color: 'var(--text-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ padding: '0 12px 24px', flex: 1 }}>
            <FotosTab photos={photos} onChange={() => { onChange(); }} />
          </div>
        </div>
      )}
    </>
  )
}
