import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

describe('Peptide page vial view', () => {
  const source = () => readFileSync(new URL('./Peptide.tsx', import.meta.url), 'utf8')
  const peptideFormSource = () => readFileSync(new URL('../components/PeptideFormModal.tsx', import.meta.url), 'utf8')

  test('defaults My Stack to the vial carousel view with a persisted toggle', () => {
    const text = source()

    expect(text).toContain("tyd_peptide_view")
    expect(text).toContain("'vials'")
    expect(text).toContain("'list'")
    expect(text).toContain('setViewMode')
  })

  test('uses the reusable vial visual for the My Stack carousel', () => {
    const text = source()

    expect(text).toContain('PeptideVialVisual')
    expect(text).toContain('activePeptideId')
    expect(text).toContain('animateOnMount')
  })

  test('updates the active vial from carousel scroll position instead of direct vial taps', () => {
    const text = source()

    expect(text).toContain('vialCarouselRef')
    expect(text).toContain('handleVialCarouselScroll')
    expect(text).toContain('data-vial-index')
    expect(text).toContain('scrollIntoView')
    expect(text).not.toContain('onClick={() => setActivePeptideId(p.id)}')
  })

  test('keeps neighboring vials partially visible around the centered active vial', () => {
    const text = source()

    expect(text).toContain('min(9rem, 38vw)')
    expect(text).toContain('snap-center')
    expect(text).toContain("isActive ? 'scale-100' : 'scale-90'")
  })

  test('shows the fill percentage directly under the active vial in My Stack', () => {
    const text = source()

    expect(text).toContain("{isActive && (")
    expect(text).toContain('mt-2 text-center')
    expect(text).toContain('{Math.round(vialPct)}%')
  })

  test('supports desktop drag, wheel navigation, and vial clicks in the carousel', () => {
    const text = source()

    expect(text).toContain('handleVialCarouselPointerDown')
    expect(text).toContain('handleVialCarouselPointerMove')
    expect(text).toContain('handleVialCarouselPointerUp')
    expect(text).toContain('handleVialCarouselWheel')
    expect(text).toContain('scrollToClosestVial')
    expect(text).toContain('pushVialSlosh')
    expect(text).toContain('vialLastScrollLeftRef')
    expect(text).toContain("const vialSnapClassName = isVialCarouselDragging ? 'snap-none' : 'snap-x snap-mandatory'")
    expect(text).toContain("const vialItemSnapClassName = isVialCarouselDragging ? '' : 'snap-center'")
    expect(text).toContain('onPointerDown={handleVialCarouselPointerDown}')
    expect(text).toContain('onPointerMove={handleVialCarouselPointerMove}')
    expect(text).toContain('onPointerUp={handleVialCarouselPointerUp}')
    expect(text).toContain('onPointerCancel={handleVialCarouselPointerUp}')
    expect(text).toContain('onWheel={handleVialCarouselWheel}')
    expect(text).toContain('selectPeptideOffset(e.deltaY > 0 ? 1 : -1)')
    expect(text).toContain('handleVialCarouselItemClick(index)')
    expect(text).toContain("isVialCarouselDragging ? 'cursor-grabbing' : 'cursor-grab'")
    expect(text).not.toContain('setPointerCapture(e.pointerId)\n    e.preventDefault()')
  })

  test('drives the carousel liquid with the shared spring physics engine', () => {
    const text = source()

    // The page owns one engine and shares it with the vials via the provider.
    expect(text).toContain('useSloshEngine')
    expect(text).toContain('<SloshProvider engine={sloshEngine}>')
    // Interaction velocity is fed into the engine as a slosh impulse.
    expect(text).toContain('sloshEngine.pushImpulse(velocity)')
    expect(text).toContain('fillPct={vialPct}')
    // The old per-render slosh state / keyframe epoch wiring is gone.
    expect(text).not.toContain('setVialSlosh')
    expect(text).not.toContain('vialSloshEpoch')
    expect(text).not.toContain('vialSloshSettleRef')
    expect(text).not.toContain('slosh={vialSlosh}')
    expect(text).not.toContain('sloshEpoch={vialSloshEpoch}')
  })
  test('drives the carousel spotlight and vial highlights from scroll focus', () => {
    const text = source()

    expect(text).toContain('vialFocusByIndex')
    expect(text).toContain('updateVialFocus')
    expect(text).toContain('data-vial-detail="carousel-spotlight"')
    expect(text).toContain('focus={focusState.focus}')
    expect(text).toContain('lightOffset={focusState.lightOffset}')
    expect(text).toContain('1 - Math.abs(normalized) * 0.78')
  })

  test('uses a compact mobile cockpit for vial details and the active cycle', () => {
    const text = source()

    expect(text).toContain('vialDetailsOpen')
    expect(text).toContain('const [vialDetailsOpen, setVialDetailsOpen] = useState(false)')
    expect(text).toContain('setVialDetailsOpen(false)')
    expect(text).toContain('<FileText size={15} className="text-cyan-300" />')
    expect(text).toContain('<span>Info</span>')
    expect(text).toContain('justify-center gap-2')
    expect(text).toContain('Aktiver Zyklus')
    expect(text).toContain('Dosisanpassungen')
    expect(text).toContain('effectiveDose(activeCycle')
    expect(text).toContain('escalationTargetDose(activeCycle, e)')
    expect(text).toContain('doseAdjustmentIcon(activeCycle, e)')
    expect(text).toContain('activeFrequency')
    expect(text).toContain("[freqLabel(activeCycle), activeIntake].filter(Boolean).join(' · ')")
    expect(text).toContain('currentEscalationId')
    expect(text).toContain('absolute bottom-5 left-3 top-5 w-px')
    expect(text).toContain('ring-orange-500/15')
    expect(text).toContain('<Clock size={15} />')
    expect(text).toContain('mt-2 flex justify-center')
    expect(text).toContain('cycleProgressPct')
    expect(text).toContain("cycleDay ? `${cycleDay} / ${cycleTotalDays ?? 'Ende offen'}` : '-'")
    expect(text).toContain('{cycleDayLabel}')
    expect(text).toContain('Haltbar')
    expect(text).toContain('Rekonst.')
    expect(text).toContain('Peptidname')
    expect(text).toContain('Rohe Vials in Reserve')
    expect(text).toContain('grid grid-cols-2 gap-2')
    expect(text).toContain('compactInfoRows.map')
    expect(text).toContain('Analyse-Dokument')
    expect(text).not.toContain('Nächste Dosis')
    expect(text).not.toContain('Zeit offen')
    const mojibakeSeparator = String.fromCharCode(0xc3, 0x201a, 0xc2, 0xb7)
    expect(text).not.toContain(`labels.join('${mojibakeSeparator}')`)
    expect(text).not.toContain("{ label: 'Farbe'")
    expect(text).not.toContain("{ label: 'Füllstand'")
    expect(text).not.toContain('Standard-Dosis')
    expect(text).not.toContain('standard_dosis_label')
    expect(text).not.toContain('Mehr Optionen')
    expect(text).toContain('aria-expanded={vialDetailsOpen}')
    expect(text).toContain('sortedEscalationsOf(activeCycle.id)')
    expect(text).toContain('targetDose - baseDoseAtStart')
    expect(text.indexOf('Rekonst.')).toBeLessThan(text.indexOf('<span>Info</span>'))
    expect(text).not.toContain('<h3 className="truncate text-xl font-bold text-white">{p.name}</h3>')
  })

  test('offers a mobile cycle manager from the vial cockpit', () => {
    const text = source()

    expect(text).toContain('cycleManagerPeptide')
    expect(text).toContain('setCycleManagerPeptide(p)')
    expect(text).toContain('Zyklen verwalten')
    expect(text).toContain('Alle erstellten Zyklen')
    expect(text).toContain('cyclesOf(cycleManagerPeptide.id)')
    expect(text).toContain('openEditCycle(cycleManagerPeptide, c)')
    expect(text).toContain('toggleCycleActive(c)')
    expect(text).toContain('removeCycle(c.id)')
    expect(text).toContain('openNewEsc(c)')
    expect(text).toContain('openEditEsc(c, e)')
    expect(text).toContain('removeEsc(e.id)')
    expect(text).toContain('escalationsOf(c.id)')
  })

  test('uses the full mobile screen for the cycle form', () => {
    const text = source()

    expect(text).toContain('fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950 sm:items-end sm:bg-black/80')
    expect(text).toContain('flex h-full w-full flex-col overflow-hidden bg-slate-900 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-t-2xl')
    expect(text).toContain('flex-1 space-y-4 overflow-y-auto px-6 py-4')
    expect(text).toContain('pb-[calc(1rem+env(safe-area-inset-bottom))]')
  })

  test('allows adding a new cycle even when another cycle is active', () => {
    const text = source()
    const openNewCycleStart = text.indexOf('const openNewCycle = (p: Peptide) => {')
    const openEditCycleStart = text.indexOf('const openEditCycle = (p: Peptide, c: Cycle) => {')
    const openNewCycleSource = text.slice(openNewCycleStart, openEditCycleStart)

    expect(openNewCycleSource).toContain('setShowCycleForm(true)')
    expect(openNewCycleSource).not.toContain('aktiver_zyklus_hinweis')
    expect(openNewCycleSource).not.toContain('activeExists')
  })

  test('offers creating a cycle after adding a new peptide', () => {
    const text = source()

    expect(text).toContain('cyclePromptPeptide')
    expect(text).toContain('Substanz gespeichert')
    expect(text).toContain('Zyklus anlegen')
    expect(text).toContain('openNewCycle(peptide)')
    expect(text).toContain('Später')
  })

  test('centers Neue Substanz field editors for mobile thumb reach', () => {
    const text = peptideFormSource()

    expect(text).toContain('flex min-h-full items-center justify-center py-8')
    expect(text).toContain('<div className="w-full">{body}</div>')
    expect(text).toContain('h-[100dvh] max-h-[100dvh]')
  })

  test('assigns a random palette color when creating a peptide', () => {
    const text = source()

    expect(text).toContain('getRandomPeptideColor')
    expect(text).toContain('color_hex: getRandomPeptideColor()')
  })
})
