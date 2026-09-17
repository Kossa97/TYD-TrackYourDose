import { describe, expect, it } from 'vitest'
import { STACK_TABS, filterByTab, tabCounts } from './stackTabs'
import type { StackCategory } from '../types'

const eintrag = (category: StackCategory, name = 'x') => ({ category, name })

describe('STACK_TABS', () => {
  it('zeigt „Alle" und alle sechs Kategorien — auch die leeren', () => {
    // Ein leerer Reiter „Medikamente" ist keine Lücke, sondern eine Auskunft:
    // die App kann das auch. In Produktion sind drei der sechs Kategorien gar
    // nicht belegt — sie zu verstecken hieße, sie nie zu entdecken.
    expect(STACK_TABS.map(reiter => reiter.key)).toEqual([
      'all', 'peptide', 'medication', 'hormone', 'supplement', 'vitamin', 'other',
    ])
  })

  it('behält die Reihenfolge, egal was im Stack liegt', () => {
    // Fester Platz je Reiter: sonst springt „Medikamente" beim ersten
    // Medikament von Platz 6 auf Platz 3, und das Muskelgedächtnis ist hin.
    const vorher = STACK_TABS.map(reiter => reiter.key)
    tabCounts([eintrag('medication'), eintrag('medication')])
    expect(STACK_TABS.map(reiter => reiter.key)).toEqual(vorher)
  })
})

describe('tabCounts', () => {
  it('zählt je Kategorie und legt die Gesamtzahl auf „Alle"', () => {
    const zaehler = tabCounts([eintrag('peptide'), eintrag('peptide'), eintrag('vitamin')])

    expect(zaehler.get('all')).toBe(3)
    expect(zaehler.get('peptide')).toBe(2)
    expect(zaehler.get('vitamin')).toBe(1)
    expect(zaehler.get('medication')).toBe(0)
  })

  it('kennt jede Kategorie, auch ohne einen einzigen Eintrag', () => {
    const zaehler = tabCounts([])

    for (const reiter of STACK_TABS) {
      expect(zaehler.get(reiter.key), reiter.key).toBe(0)
    }
  })
})

describe('filterByTab', () => {
  it('gibt bei „Alle" alles zurück, sonst nur die Kategorie', () => {
    const stack = [eintrag('peptide', 'a'), eintrag('vitamin', 'b'), eintrag('peptide', 'c')]

    expect(filterByTab(stack, 'all').map(e => e.name)).toEqual(['a', 'b', 'c'])
    expect(filterByTab(stack, 'peptide').map(e => e.name)).toEqual(['a', 'c'])
    expect(filterByTab(stack, 'medication')).toEqual([])
  })

  it('gibt bei „Alle" eine Kopie heraus, nicht die Liste selbst', () => {
    const stack = [eintrag('peptide')]
    expect(filterByTab(stack, 'all')).not.toBe(stack)
  })
})
