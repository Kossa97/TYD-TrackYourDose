import { describe, expect, it } from 'vitest'
import { reviewsByPeptide, type ReviewRow } from './insights'

const row = (rating: number, extra: Partial<ReviewRow> = {}): ReviewRow => ({
  id: String(Math.random()), stack_item_id: 'bpc', rating, experience: rating >= 4 ? 'gut' : rating === 3 ? 'mittel' : 'schlecht',
  stack_items: { display_name: 'BPC-157' }, ...extra,
})

describe('reviewsByPeptide mit Kriterien (Bewertungen v2)', () => {
  it('mittelt Wirkung und Vertraeglichkeit nur ueber Bewertungen, die sie haben', () => {
    const [stat] = reviewsByPeptide([
      row(5, { wirkung: 5, vertraeglichkeit: 4, wieder_nehmen: 'ja' }),
      row(4, { wirkung: 4, wieder_nehmen: 'unsicher' }),
      row(2),
    ])
    expect(stat).toMatchObject({
      avgRating: 3.7, count: 3, avgWirkung: 4.5, avgVertraeglichkeit: 4, wiederJa: 1, wiederBeantwortet: 2,
    })
  })

  it('alte Bewertungen ohne Kriterien: keine Mittel, keine Zaehlung', () => {
    const [stat] = reviewsByPeptide([row(4), row(3)])
    expect(stat).toMatchObject({ avgWirkung: null, avgVertraeglichkeit: null, wiederJa: 0, wiederBeantwortet: 0 })
  })
})
