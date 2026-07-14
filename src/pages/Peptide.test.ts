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

    expect(text).toContain('min(6rem, 25vw)')
    expect(text).toContain('snap-center')
    expect(text).toContain("isActive ? 'scale-100' : 'scale-90'")
  })

  test('aligns the Neue Substanz tile with the vial carousel axis', () => {
    const text = source()

    expect(text).toContain('data-vial-add-slot')
    expect(text).toContain('min-h-[calc(7rem+3rem)]')
    expect(text).toContain('sm:min-h-[calc(9rem+3rem)]')
    expect(text).toContain('flex items-center')
  })

  test('keeps Neue Substanz illuminated while its carousel tile is active', () => {
    const text = source()

    expect(text).toContain('active={addTileActive}')
    expect(text).toContain("active ? 'border-cyan-400/45 bg-slate-900/40 text-cyan-200'")
    expect(text).toContain("active ? 'border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_30px_rgba(34,211,238,0.18)]'")
  })

  test('shows the fill percentage directly under the active vial in My Stack', () => {
    const text = source()

    expect(text).toContain("{isActive && (")
    expect(text).toContain('mt-1 text-center')
    expect(text).toContain('{Math.round(vialPct)}%')
  })

  test('shrinks the vial carousel and removes its surrounding frame so it can bleed edge-to-edge', () => {
    const text = source()

    expect(text).toContain('size="carousel"')
    // the outer wrapper no longer draws a bordered/tinted card around the carousel
    expect(text).not.toContain('overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 px-2 py-5 sm:px-5')
    // the carousel row cancels the page's own horizontal padding to reach full viewport width
    expect(text).toContain('className="relative -mx-3"')
  })

  test('shows the cycle panel directly under the Info panel, without a collapse toggle', () => {
    const text = source()

    // the cycle section is no longer hidden behind an expandable toggle
    expect(text).not.toContain('vialCyclesOpen')
    // it renders directly under the Info panel
    expect(text).toContain('<span>Info</span>')
    expect(text).toContain("t('aktiver_zyklus')")
    expect(text.indexOf('<span>Info</span>')).toBeLessThan(text.indexOf("t('aktiver_zyklus')"))
  })

  test('renders a single active-cycle cockpit with empty states for no active / no cycle', () => {
    const text = source()

    // only one cockpit block exists (no old always-visible second copy)
    expect(text.split("t('aktiver_zyklus')").length - 1).toBe(1)
    // empty states branch on whether cycles exist
    expect(text).toContain("t('kein_aktiver_zyklus')")
    expect(text).toContain("t('noch_kein_zyklus_desc')")
    expect(text).not.toContain('setCycleManagerPeptide(p)')
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

  test('keeps programmatic vial selection stable while smooth-scrolling to the target', () => {
    const text = source()
    const selectHandler = text.slice(text.indexOf('const selectPeptideIndex'), text.indexOf('const getClosestVialIndex'))
    const scrollHandler = text.slice(text.indexOf('const handleVialCarouselScroll'), text.indexOf('const scrollToClosestVial'))
    const offsetHandler = text.slice(text.indexOf('const selectPeptideOffset'), text.indexOf('const handleVialCarouselPointerDown'))

    expect(text).toContain('vialTargetIndexRef')
    expect(selectHandler).toContain('vialTargetIndexRef.current = index')
    expect(selectHandler).not.toContain('setActivePeptideId(next.id)')
    expect(scrollHandler).toContain('if (vialTargetIndexRef.current === closestIndex)')
    expect(offsetHandler).toContain('vialTargetIndexRef.current ?? activeIndex')
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

    expect(text).toContain('updateVialFocus')
    expect(text).toContain('data-vial-detail="carousel-spotlight"')
    expect(text).toContain('1 - Math.abs(normalized) * 0.78')
  })

  test('pushes scroll focus through imperative stage-light handles instead of React state', () => {
    const text = source()

    expect(text).toContain('vialStageLightHandlesRef')
    expect(text).toContain('setStageLight')
    expect(text).toContain('stageLightRef={handle =>')
    // the old per-scroll-frame state update must stay gone — it re-rendered
    // the whole page on every swipe frame
    expect(text).not.toContain('vialFocusByIndex')
    expect(text).not.toContain('setVialFocusByIndex')
  })

  test('batches carousel spotlight updates so liquid slosh frames stay smooth', () => {
    const text = source()
    const scrollHandler = text.slice(text.indexOf('const handleVialCarouselScroll'), text.indexOf('const scrollToClosestVial'))

    expect(text).toContain('vialFocusFrameRef')
    expect(text).toContain('scheduleVialFocusUpdate')
    expect(scrollHandler).toContain('scheduleVialFocusUpdate()')
    expect(scrollHandler).not.toContain('updateVialFocus()')
  })

  test('uses a compact mobile cockpit for vial details and the active cycle', () => {
    const text = source()

    expect(text).toContain('vialDetailsOpen')
    expect(text).toContain('const [vialDetailsOpen, setVialDetailsOpen] = useState(false)')
    expect(text).toContain('setVialDetailsOpen(false)')
    expect(text).toContain('<FileText size={15} className="text-cyan-300" />')
    expect(text).toContain('<span>Info</span>')
    expect(text).toContain('justify-center gap-2')
    expect(text).toContain("t('aktiver_zyklus')")
    expect(text).toContain('Dosisanpassungen')
    expect(text).toContain('effectiveDose(activeCycle')
    expect(text).toContain('escalationTargetDose(activeCycle, e)')
    expect(text).toContain('doseAdjustmentIcon(activeCycle, e)')
    expect(text).toContain('activeFrequency')
    expect(text).toContain("[freqLabel(activeCycle), activeIntake].filter(Boolean).join(' · ')")
    expect(text).toContain('currentEscalationId')
    expect(text).toContain('absolute bottom-5 left-[13px] top-5 w-px -translate-x-1/2')
    expect(text).toContain('ring-orange-500/15')
    expect(text).toContain('<Clock size={15} />')
    expect(text).toContain('mt-2 flex justify-center')
    expect(text).toContain("cycleDay ? `${cycleDay} / ${cycleTotalDays ?? t('ende_offen')}` : '-'")
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

  test('places the archive icon between search and view controls', () => {
    const text = source()
    const searchIndex = text.indexOf('aria-label={searchOpen ?')
    const archiveIndex = text.indexOf("aria-label={t('archiv')}", searchIndex)
    const filterIndex = text.indexOf("aria-label={t('sort_aria_label')}", searchIndex)
    const editIndex = text.indexOf('onClick={() => openEditPeptide(activePeptide)}')
    const deleteIndex = text.indexOf('onClick={() => removePeptide(activePeptide.id)}', editIndex)

    expect(searchIndex).toBeGreaterThan(-1)
    expect(archiveIndex).toBeGreaterThan(searchIndex)
    expect(archiveIndex).toBeLessThan(filterIndex)
    expect(text.slice(searchIndex, filterIndex)).toContain('setArchiveViewOpen(true)')
    expect(text.slice(searchIndex, filterIndex)).toContain('loadArchived()')
    expect(text.slice(searchIndex, filterIndex)).toContain('<Archive size={18} />')
    expect(text.slice(searchIndex, filterIndex)).toContain('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70')
    expect(editIndex).toBeGreaterThan(-1)
    expect(deleteIndex).toBeGreaterThan(editIndex)
    expect(text.slice(editIndex, deleteIndex)).not.toContain("aria-label={t('archiv')}")
  })

  test('persists and localizes the archive timestamp', () => {
    const text = source()
    const sql = readFileSync(new URL('../../supabase-archive.sql', import.meta.url), 'utf8')
    const localeNames = [
      'ar', 'de', 'en', 'es', 'fr', 'hi', 'id',
      'it', 'ja', 'ko', 'pt', 'ru', 'tr', 'zh',
    ]

    expect(text).toContain('archived_at: string | null')
    expect(text).toContain("update({ archived: true, archived_at: archivedAt })")
    expect(text).toContain("update({ archived: false, archived_at: null })")
    expect(text).toContain("order('archived_at', { ascending: false, nullsFirst: false })")
    expect(sql).toContain('archived_at timestamptz')

    for (const localeName of localeNames) {
      const locale = JSON.parse(readFileSync(
        new URL(`../i18n/locales/${localeName}.json`, import.meta.url),
        'utf8',
      )) as Record<string, string>

      expect(locale.archiviert_am).toContain('{{date}}')
    }
  })

  test('renders the archive as a full-screen vial list', () => {
    const text = source()

    expect(text).toContain('data-archive-fullscreen')
    expect(text).toContain('data-archive-row')
    expect(text).toContain('className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-slate-950"')
    expect(text).toContain('fillPct={0}')
    expect(text).toContain('color="#64748b"')
    expect(text).toContain('animateOnMount={false}')
    expect(text).toContain('isActive={false}')
    expect(text).toContain('size="compact"')
    expect(text).toContain("t('archiviert_am'")
    expect(text).toContain('h-11 w-11')
    expect(text).toContain("Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language)")
  })
  test('opens complete archived substance information in a nested full-screen view', () => {
    const text = source()

    expect(text).toContain('archiveInfoPeptide')
    expect(text).toContain('data-archive-info-button={p.id}')
    expect(text).toContain('setArchiveInfoPeptide(p)')
    expect(text).toContain('data-archive-info-detail={p.id}')
    expect(text).toContain('className="fixed inset-0 z-[60] flex min-h-dvh flex-col bg-slate-950"')
    expect(text).toContain('p.vial_amount_mg')
    expect(text).toContain('p.reconstitution_ml')
    expect(text).toContain('p.syringe_type')
    expect(text).toContain('p.reconstitution_date')
    expect(text).toContain('p.expiry_days')
    expect(text).toContain('p.vials_in_stock')
    expect(text).toContain('p.batch_number')
    expect(text).toContain('p.batch_source')
    expect(text).toContain('p.batch_file_url')
    expect(text).toContain('p.notes')
    expect(text).toContain("t('keine_zyklen')")
    expect(text).toContain('c.start_date')
    expect(text).toContain('c.end_date')
    expect(text).toContain('c.dose')
    expect(text).toContain('c.frequency')
    expect(text).toContain('c.method')
  })

  test('keeps archived cycles collapsed by default and sorts newest first', () => {
    const text = source()
    const archiveDetail = text.slice(text.indexOf('{archiveInfoPeptide'), text.indexOf('{cyclePromptPeptide'))

    expect(text).toContain('archiveCyclesOpen')
    expect(text).toContain('setArchiveCyclesOpen(false)')
    expect(archiveDetail).toContain('.filter(c => c.peptide_id === p.id)')
    expect(archiveDetail).toContain('.sort((a, b) => b.created_at.localeCompare(a.created_at))')
    expect(archiveDetail).toContain('aria-expanded={archiveCyclesOpen}')
    expect(archiveDetail).toContain('aria-controls="archive-cycle-list"')
    expect(archiveDetail).toContain('onClick={() => setArchiveCyclesOpen(open => !open)}')
    expect(archiveDetail).toContain('{archiveCyclesOpen && (')
    expect(archiveDetail).toContain('id="archive-cycle-list"')
  })

  test('contains archive detail focus and restores it to the originating info button', () => {
    const text = source()

    expect(text).toContain("document.querySelector<HTMLElement>('[data-archive-info-detail]')")
    expect(text).toContain('const focusScope = nestedDialog ?? archiveInfoDialog ?? dialog')
    expect(text).toContain('role="dialog"')
    expect(text).toContain('aria-labelledby="archive-info-title"')
    expect(text).toContain('id="archive-info-title"')
    expect(text).toContain('ref={archiveInfoBackButtonRef}')
    expect(text).toContain('setArchiveInfoPeptide(null)')
    expect(text).toContain('document.querySelector<HTMLButtonElement>(`[data-archive-info-button="${peptideId}"]`)?.focus()')
    expect(text).toContain('document.querySelector<HTMLButtonElement>(`[data-archive-info-button="${p.id}"]`)?.focus()')
  })

  test('stops the archive flow when the peptide write fails', () => {
    const text = source()
    const archiveHandler = text.slice(text.indexOf('const archivePeptide'), text.indexOf('const hardDeletePeptide'))

    expect(archiveHandler).toContain('const { error: archiveError }')
    expect(archiveHandler).toContain('if (archiveError)')
    expect(archiveHandler.indexOf('if (archiveError)')).toBeLessThan(archiveHandler.indexOf("from('cycles').update"))
  })

  test('keeps archive-origin deletion separate from archiving again', () => {
    const text = source()

    expect(text).toContain('deletePromptFromArchive')
    expect(text).toContain('!deletePromptFromArchive && (')
    expect(text).toContain('setDeletePromptFromArchive(true); setDeletePromptPeptide(p)')
    expect(text).toContain('p.archived_at ?? new Date().toISOString()')
  })

  test('exposes and contains the full-screen archive as an accessible dialog', () => {
    const text = source()

    expect(text).toContain('ref={archiveDialogRef}')
    expect(text).toContain('role="dialog"')
    expect(text).toContain('aria-modal="true"')
    expect(text).toContain('aria-labelledby="archive-title"')
    expect(text).toContain('id="archive-title"')
    expect(text).toContain('ref={archiveCloseButtonRef}')
    expect(text).toContain("if (e.key === 'Escape')")
    expect(text).toContain("if (e.key !== 'Tab') return")
    expect(text).toContain("document.querySelector<HTMLElement>('[data-archive-delete-confirmation]')")
    expect(text).toContain('const focusScope = nestedDialog ?? archiveInfoDialog ?? dialog')
    expect(text).toContain('if (!focusScope?.contains(document.activeElement))')
    expect(text).toContain('setDeletePromptPeptide(null); window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())')
    expect(text).toContain('previouslyFocused?.focus()')
  })

  test('offers a mobile cycle manager from the vial cockpit', () => {
    const text = source()

    expect(text).toContain('cycleManagerPeptide')
    expect(text).toContain('setCycleManagerPeptide(activePeptide)')
    expect(text).not.toContain("t('neu')")
    expect(text).toContain("t('zyklen_verwalten')")
    expect(text).toContain('toggleManagerCard(c.id)')
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
