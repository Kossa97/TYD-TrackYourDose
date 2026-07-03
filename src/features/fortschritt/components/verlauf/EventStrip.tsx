import type { BloodworkEntry, ProgressPhotoEntry } from '../../types'
import { barPosition } from '../../lib/verlaufRange'
import type { DateRange } from '../../types'
import { panel, sectionLabel } from '../../styles'

interface Props {
  range: DateRange
  photos: ProgressPhotoEntry[]
  bloodwork: BloodworkEntry[]
}

export function EventStrip({ range, photos, bloodwork }: Props) {
  const photoDates = [...new Set(photos.map(p => p.taken_at))].sort()
  const bloodDates = [...new Set(bloodwork.map(b => b.tested_at))].sort()

  if (photoDates.length === 0 && bloodDates.length === 0) return null

  return (
    <section style={{ ...panel, padding: '12px 16px' }}>
      <p style={{ ...sectionLabel, marginBottom: 10 }}>Ereignisse</p>
      <div style={{ position: 'relative', height: 36 }}>
        {photoDates.map(date => {
          const pos = barPosition(date, date, range)
          return (
            <span
              key={`photo-${date}`}
              title={`Foto ${date}`}
              style={{
                position: 'absolute',
                left: `${pos.left}%`,
                transform: 'translateX(-50%)',
                fontSize: '0.9rem',
                top: 0,
              }}
            >
              📷
            </span>
          )
        })}
        {bloodDates.map(date => {
          const pos = barPosition(date, date, range)
          return (
            <span
              key={`blood-${date}`}
              title={`Bluttest ${date}`}
              style={{
                position: 'absolute',
                left: `${pos.left}%`,
                transform: 'translateX(-50%)',
                fontSize: '0.9rem',
                top: 18,
              }}
            >
              🩸
            </span>
          )
        })}
      </div>
    </section>
  )
}
