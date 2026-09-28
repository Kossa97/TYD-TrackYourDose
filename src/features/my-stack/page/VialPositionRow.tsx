import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Wo bin ich. Bei 70 % Breite sind die Nachbarn nur noch
 * angeschnitten — ohne diese Zeile wuesste niemand, ob nach
 * dem dritten Wisch noch fuenf kommen oder einer. Vorn steht
 * ein „+" fuer die „Neu"-Kachel: sie liegt links von der
 * ersten Substanz, und ohne diesen Hinweis sucht sie dort
 * niemand. Bis zu sieben Substanzen als Punkte, darueber eine
 * Leiste, weil fuenfzehn Punkte niemand mehr zaehlt.
 * Die Zeile ist immer gleich hoch (h-2.5): Punkte, Leiste
 * oder „+" duerfen die Buehne darueber nicht groesser oder
 * kleiner machen. Die Knoepfe sind 24 px hoch und ragen per
 * negativem Rand ueber die Zeile hinaus — gross genug zum
 * Treffen, ohne die Zeile zu strecken.
 */
export function VialPositionRow({ stagePeptides, activeIndex, addTileActive, selectAddTile, selectPeptideIndex }: {
  stagePeptides: readonly { id: string; name: string }[]
  activeIndex: number
  addTileActive: boolean
  selectAddTile: () => void
  selectPeptideIndex: (index: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div data-vial-position className="mb-2 mt-1 flex h-2.5 shrink-0 items-center justify-center">
      <button
        type="button"
        onClick={selectAddTile}
        aria-label={String(t('my_stack_go_to_add_tile', { defaultValue: 'Zur Kachel „Neue Substanz“' }))}
        aria-current={addTileActive || undefined}
        data-vial-add-dot
        className="-my-[7px] flex h-6 min-w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        <span className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-300 ${
          addTileActive ? 'bg-cyan-300 text-slate-950' : 'bg-cyan-300/15 text-cyan-200'
        }`}>
          <Plus size={11} strokeWidth={2.6} aria-hidden="true" />
        </span>
      </button>
      {stagePeptides.length <= 7 ? stagePeptides.map((p, index) => {
        const aktuell = !addTileActive && index === activeIndex
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => selectPeptideIndex(index)}
            aria-label={String(t('my_stack_go_to_item', { defaultValue: 'Zu {{name}}', name: p.name }))}
            aria-current={aktuell || undefined}
            data-vial-dot={index}
            className="group -my-[7px] flex h-6 min-w-5 items-center justify-center rounded-full px-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span className={`h-2.5 rounded-full transition-all duration-300 ${
              aktuell ? 'w-6 bg-cyan-300' : 'w-2.5 bg-slate-700 group-hover:bg-slate-500'
            }`} />
          </button>
        )
      }) : (
        <div className="ml-1.5 h-1 w-24 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-300 ${addTileActive ? 'bg-slate-600' : 'bg-cyan-300'}`}
            style={{
              width: `${100 / stagePeptides.length}%`,
              marginInlineStart: `${(activeIndex / stagePeptides.length) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}
