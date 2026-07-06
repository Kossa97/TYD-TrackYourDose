import { format, parseISO } from 'date-fns'
import { X } from 'lucide-react'
import type { ProgressPhotoEntry } from '../../types'
import { formatPhotoInterval, orderPhotosForCompare } from '../../lib/photoCompare'

const fmtDate = (d: string) => format(parseISO(`${d}T00:00:00`), 'dd.MM.yyyy')

interface Props {
  photos: [ProgressPhotoEntry, ProgressPhotoEntry]
  onClose: () => void
}

export function PhotoCompareOverlay({ photos, onClose }: Props) {
  const [left, right] = orderPhotosForCompare(photos[0], photos[1])
  const interval = formatPhotoInterval(left.taken_at, right.taken_at)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 70,
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: 'max(12px, env(safe-area-inset-top)) 16px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text)' }}>Fotos vergleichen</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{interval}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface-input)',
            color: 'var(--text-dim)',
            flexShrink: 0,
          }}
        >
          <X size={18} />
        </button>
      </header>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        padding: '12px 10px max(16px, env(safe-area-inset-bottom))',
        minHeight: 0,
      }}>
        {[left, right].map((photo, index) => (
          <div
            key={photo.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <div style={{
              flex: 1,
              minHeight: 0,
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.2)',
            }}>
              <img
                src={photo.display_url}
                alt={photo.taken_at}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div style={{ padding: '10px 4px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {index === 0 ? 'Früher' : 'Später'}
              </p>
              <p style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-dim)', marginTop: 3 }}>
                {fmtDate(photo.taken_at)}
              </p>
              {photo.weight_kg != null && (
                <p style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>
                  {photo.weight_kg} kg
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
