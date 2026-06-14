import { Check } from 'lucide-react'
import { PEPTIDE_COLORS } from '../lib/peptideColors'

interface PeptideColorPaletteProps {
  value: string
  onChange: (color: string) => void
}

export function PeptideColorPalette({ value, onChange }: PeptideColorPaletteProps) {
  return (
    <div className="grid grid-cols-6 gap-3">
      {PEPTIDE_COLORS.map(color => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            data-color-swatch={color}
            aria-label={selected ? `Farbe ${color} ausgewählt` : `Farbe ${color}`}
            onClick={() => onChange(color)}
            className={`relative h-11 w-11 rounded-2xl border transition-all ${
              selected
                ? 'border-white shadow-[0_0_0_4px_rgba(255,255,255,0.08)]'
                : 'border-white/10 opacity-75 hover:opacity-100'
            }`}
            style={{ background: color }}
          >
            {selected && (
              <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow">
                <Check size={18} strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
