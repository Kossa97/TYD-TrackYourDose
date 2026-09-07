import { Check } from 'lucide-react'
import { STACK_ITEM_COLORS } from '../features/my-stack/lib/colors'

interface PeptideColorPaletteProps {
  value: string
  onChange: (color: string) => void
}

// Jedes Feld ist eine Perle, keine Flaeche: ein Glanzpunkt oben links, ein
// dunkler Rand unten rechts. Derselbe Verlauf fuer jede Farbe — der Browser
// rechnet ihn aus, es gibt also keine zwoelf handgepflegten Sonderfaelle.
//
// Warum ueberhaupt: die Objekte im Formular tragen Material und Licht. Zwoelf
// flache Kreise daneben sehen aus wie aus einem anderen Programm.
const PERLE = 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.45), rgba(255,255,255,0.06) 42%, rgba(0,0,0,0.30) 100%)'

export function PeptideColorPalette({ value, onChange }: PeptideColorPaletteProps) {
  // Eine gespeicherte Farbe, die nicht mehr in der Palette steht, verschwindet
  // nicht: sie haengt sich hinten an. Sonst saehe ein alter Eintrag nach dem
  // Wechsel der Palette aus, als haette er nie eine Farbe gehabt.
  const farben = value && !STACK_ITEM_COLORS.includes(value)
    ? [...STACK_ITEM_COLORS, value]
    : STACK_ITEM_COLORS

  return (
    <div className="grid grid-cols-6 gap-3">
      {farben.map(color => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            data-color-swatch={color}
            aria-pressed={selected}
            aria-label={selected ? `Farbe ${color} ausgewählt` : `Farbe ${color}`}
            onClick={() => onChange(color)}
            className={`relative h-11 w-11 cursor-pointer rounded-full transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none motion-reduce:hover:scale-100 ${
              selected ? 'scale-105 motion-reduce:scale-100' : ''
            }`}
            style={{
              background: `${PERLE}, ${color}`,
              // Der Ring der Auswahl liegt AUSSEN und in der Farbe selbst: ein
              // weisser Rahmen um zwoelf Farben herum wuerde sie alle gleich
              // aussehen lassen. Die Luecke dazwischen ist der Untergrund.
              boxShadow: selected
                ? `0 0 0 3px var(--app-bg), 0 0 0 5px ${color}, 0 6px 16px rgba(0,0,0,0.45)`
                : '0 2px 6px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.22)',
            }}
          >
            {selected && (
              <span
                className="absolute inset-0 flex items-center justify-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                // Weiss, nicht text-white: die helle Theme-Regel in index.css
                // faerbt .text-white auf die Textfarbe um. Auf einer farbigen
                // Perle waere das im hellen Theme ein dunkler Haken auf
                // dunklem Violett.
                style={{ color: '#ffffff' }}
              >
                <Check size={18} strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
