export type ObAdvance = 'click' | 'next'

export interface OnboardingStepMeta {
  id: string
  emoji: string
  titleKey: string
  subtitleKey: string
  descriptionKey: string
  targetSelector: string | null
  placement: 'auto' | 'top' | 'bottom' | 'center'
  advance: ObAdvance
  /** Navigate when this step becomes active */
  route?: string
  scrollTarget?: boolean
  tapHintKey?: string
  navTarget?: boolean
  /** For center placement: snap card to top or bottom of viewport instead of center */
  snapToViewport?: 'top' | 'bottom'
  /**
   * Gate the "Weiter" button: it stays dimmed until this precondition is met.
   * - 'filled'    → the target input has a value
   * - 'modal'     → a form modal is open (user tapped the highlighted open button)
   * - 'no-modal'  → no form modal open (user tapped Save → form closed)
   * - 'sim'       → the simulated confirmation was clicked
   * undefined → enabled immediately (pure explanation steps).
   */
  precondition?: 'filled' | 'positive' | 'modal' | 'no-modal' | 'sim'
  /** Additional selectors whose subtrees are also interactive at this step. */
  extraTargets?: string[]
  /**
   * If set: the ring is drawn around targetSelector (big area),
   * but only this element is clickable/interactive.
   */
  clickSelector?: string
  /** If the target does not appear within ~700ms, auto-skip this step. */
  optionalTarget?: boolean
}

/**
 * Guided tour: inventory (+ Add to stock) → create peptide → cycle → calendar → home features.
 * Step ids match subtitle “Step N” (welcome = intro, no step number in subtitle).
 */
export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  { id:'welcome', emoji:'👋', titleKey:'obx_welcome_title', subtitleKey:'obx_welcome_sub', descriptionKey:'obx_welcome_desc', targetSelector:null, placement:'center', advance:'next' },
  { id:'nav-mystack', emoji:'🧬', titleKey:'obx_navmystack_title', subtitleKey:'obx_navmystack_sub', descriptionKey:'obx_navmystack_desc', targetSelector:'[data-ob="nav-peptide"]', placement:'top', advance:'click', navTarget:true, route:'/peptide', tapHintKey:'obx_navmystack_tap' },
  { id:'open-peptide', emoji:'➕', titleKey:'obx_openpep_title', subtitleKey:'obx_openpep_sub', descriptionKey:'obx_openpep_desc', targetSelector:'[data-ob="btn-peptid-anlegen"]', placement:'bottom', advance:'click', tapHintKey:'obx_openpep_tap', precondition:'modal' },
  { id:'pep-name', emoji:'🏷️', titleKey:'obx_pepname_title', subtitleKey:'obx_pepname_sub', descriptionKey:'obx_pepname_desc', targetSelector:'[data-ob="pep-name"]', placement:'auto', advance:'next', precondition:'filled' },
  { id:'pep-pk', emoji:'🧬', titleKey:'obx_peppk_title', subtitleKey:'obx_peppk_sub', descriptionKey:'obx_peppk_desc', targetSelector:'[data-ob="pep-pk-badge"]', placement:'auto', advance:'next', optionalTarget:true },
  { id:'pep-color', emoji:'🎨', titleKey:'obx_pepcolor_title', subtitleKey:'obx_pepcolor_sub', descriptionKey:'obx_pepcolor_desc', targetSelector:'[data-ob="pep-color"]', placement:'auto', advance:'next' },
  { id:'pep-mg', emoji:'💊', titleKey:'obx_pepmg_title', subtitleKey:'obx_pepmg_sub', descriptionKey:'obx_pepmg_desc', targetSelector:'[data-ob="pep-mg"]', placement:'auto', advance:'next', precondition:'filled' },
  { id:'pep-liquid', emoji:'💧', titleKey:'obx_pepliquid_title', subtitleKey:'obx_pepliquid_sub', descriptionKey:'obx_pepliquid_desc', targetSelector:'[data-ob="pep-liquid"]', placement:'auto', advance:'next', precondition:'filled' },
  { id:'pep-recon', emoji:'📅', titleKey:'obx_peprecon_title', subtitleKey:'obx_peprecon_sub', descriptionKey:'obx_peprecon_desc', targetSelector:'[data-ob="pep-recon-date"]', placement:'auto', advance:'next', precondition:'filled' },
  { id:'pep-expiry', emoji:'⏳', titleKey:'obx_pepexpiry_title', subtitleKey:'obx_pepexpiry_sub', descriptionKey:'obx_pepexpiry_desc', targetSelector:'[data-ob="pep-expiry"]', placement:'auto', advance:'next' },
  { id:'pep-vials', emoji:'🧴', titleKey:'obx_pepvials_title', subtitleKey:'obx_pepvials_sub', descriptionKey:'obx_pepvials_desc', targetSelector:'[data-ob="pep-vials"]', placement:'auto', advance:'next' },
  { id:'pep-batch', emoji:'🔖', titleKey:'obx_pepbatch_title', subtitleKey:'obx_pepbatch_sub', descriptionKey:'obx_pepbatch_desc', targetSelector:'[data-ob="pep-batch"]', placement:'auto', advance:'next' },
  { id:'pep-source', emoji:'🏭', titleKey:'obx_pepsource_title', subtitleKey:'obx_pepsource_sub', descriptionKey:'obx_pepsource_desc', targetSelector:'[data-ob="pep-source"]', placement:'auto', advance:'next' },
  { id:'pep-doc', emoji:'📎', titleKey:'obx_pepdoc_title', subtitleKey:'obx_pepdoc_sub', descriptionKey:'obx_pepdoc_desc', targetSelector:'[data-ob="pep-doc"]', placement:'auto', advance:'next' },
  { id:'pep-dose', emoji:'💉', titleKey:'obx_pepdose_title', subtitleKey:'obx_pepdose_sub', descriptionKey:'obx_pepdose_desc', targetSelector:'[data-ob="pep-dose-amount"]', placement:'auto', advance:'next', precondition:'filled' },
  { id:'pep-method', emoji:'🧭', titleKey:'obx_pepmethod_title', subtitleKey:'obx_pepmethod_sub', descriptionKey:'obx_pepmethod_desc', targetSelector:'[data-ob="pep-method"]', placement:'auto', advance:'next' },
  { id:'pep-notes', emoji:'📝', titleKey:'obx_pepnotes_title', subtitleKey:'obx_pepnotes_sub', descriptionKey:'obx_pepnotes_desc', targetSelector:'[data-ob="pep-notes"]', placement:'auto', advance:'next' },
  { id:'pep-save', emoji:'✅', titleKey:'obx_pepsave_title', subtitleKey:'obx_pepsave_sub', descriptionKey:'obx_pepsave_desc', targetSelector:'[data-ob="btn-pep-save"]', placement:'top', advance:'click', tapHintKey:'obx_pepsave_tap', scrollTarget:true, precondition:'no-modal' },
  { id:'open-cycle', emoji:'🔄', titleKey:'obx_opencyc_title', subtitleKey:'obx_opencyc_sub', descriptionKey:'obx_opencyc_desc', targetSelector:'[data-ob="btn-zyklus-add"]', placement:'top', advance:'click', tapHintKey:'obx_opencyc_tap', scrollTarget:true, precondition:'modal' },
  { id:'cyc-name', emoji:'🏷️', titleKey:'obx_cycname_title', subtitleKey:'obx_cycname_sub', descriptionKey:'obx_cycname_desc', targetSelector:'[data-ob="cyc-name"]', placement:'auto', advance:'next' },
  { id:'cyc-dose', emoji:'💉', titleKey:'obx_cycdose_title', subtitleKey:'obx_cycdose_sub', descriptionKey:'obx_cycdose_desc', targetSelector:'[data-ob="cyc-dose"]', placement:'auto', advance:'next', precondition:'filled' },
  { id:'cyc-unit', emoji:'⚖️', titleKey:'obx_cycunit_title', subtitleKey:'obx_cycunit_sub', descriptionKey:'obx_cycunit_desc', targetSelector:'[data-ob="cyc-unit"]', placement:'auto', advance:'next' },
  { id:'cyc-method', emoji:'🧭', titleKey:'obx_cycmethod_title', subtitleKey:'obx_cycmethod_sub', descriptionKey:'obx_cycmethod_desc', targetSelector:'[data-ob="cyc-method"]', placement:'auto', advance:'next' },
  { id:'cyc-freq', emoji:'🔁', titleKey:'obx_cycfreq_title', subtitleKey:'obx_cycfreq_sub', descriptionKey:'obx_cycfreq_desc', targetSelector:'[data-ob="cyc-frequency"]', placement:'auto', advance:'next', extraTargets:['[data-ob="cyc-interval"]','[data-ob="cyc-weekdays"]'] },
  { id:'cyc-dates', emoji:'📅', titleKey:'obx_cycdates_title', subtitleKey:'obx_cycdates_sub', descriptionKey:'obx_cycdates_desc', targetSelector:'[data-ob="cyc-dates"]', placement:'auto', advance:'next', precondition:'filled' },
  { id:'cyc-intake', emoji:'⏰', titleKey:'obx_cycintake_title', subtitleKey:'obx_cycintake_sub', descriptionKey:'obx_cycintake_desc', targetSelector:'[data-ob="cyc-intake"]', placement:'auto', advance:'next' },
  { id:'cyc-reminder', emoji:'🔔', titleKey:'obx_cycreminder_title', subtitleKey:'obx_cycreminder_sub', descriptionKey:'obx_cycreminder_desc', targetSelector:'[data-ob="cyc-reminder"]', placement:'auto', advance:'next' },
  { id:'cyc-save', emoji:'✅', titleKey:'obx_cycsave_title', subtitleKey:'obx_cycsave_sub', descriptionKey:'obx_cycsave_desc', targetSelector:'[data-ob="btn-cycle-save"]', placement:'top', advance:'click', tapHintKey:'obx_cycsave_tap', scrollTarget:true, precondition:'no-modal' },
  { id:'open-esc', emoji:'📈', titleKey:'obx_openesc_title', subtitleKey:'obx_openesc_sub', descriptionKey:'obx_openesc_desc', targetSelector:'[data-ob="btn-esc-add"]', placement:'top', advance:'click', tapHintKey:'obx_openesc_tap', scrollTarget:true, precondition:'modal' },
  { id:'esc-amount', emoji:'➕', titleKey:'obx_escamount_title', subtitleKey:'obx_escamount_sub', descriptionKey:'obx_escamount_desc', targetSelector:'[data-ob="esc-amount"]', placement:'auto', advance:'next', precondition:'filled' },
  { id:'esc-when', emoji:'🕒', titleKey:'obx_escwhen_title', subtitleKey:'obx_escwhen_sub', descriptionKey:'obx_escwhen_desc', targetSelector:'[data-ob="esc-when"]', placement:'auto', advance:'next', extraTargets:['[data-ob="esc-when-detail"]'] },
  { id:'esc-notes', emoji:'📝', titleKey:'obx_escnotes_title', subtitleKey:'obx_escnotes_sub', descriptionKey:'obx_escnotes_desc', targetSelector:'[data-ob="esc-notes"]', placement:'auto', advance:'next' },
  { id:'esc-save', emoji:'✅', titleKey:'obx_escsave_title', subtitleKey:'obx_escsave_sub', descriptionKey:'obx_escsave_desc', targetSelector:'[data-ob="btn-esc-save"]', placement:'top', advance:'click', tapHintKey:'obx_escsave_tap', scrollTarget:true, precondition:'no-modal' },
  { id:'nav-calendar', emoji:'🗓️', titleKey:'obx_navcal_title', subtitleKey:'obx_navcal_sub', descriptionKey:'obx_navcal_desc', targetSelector:'[data-ob="nav-kalender"]', placement:'top', advance:'click', navTarget:true, route:'/kalender', tapHintKey:'obx_navcal_tap' },
  { id:'calendar-show', emoji:'📆', titleKey:'obx_calshow_title', subtitleKey:'obx_calshow_sub', descriptionKey:'obx_calshow_desc', targetSelector:'[data-ob="calendar-main"]', clickSelector:'[data-ob="ob-cal-today"]', placement:'top', advance:'click', tapHintKey:'obx_calshow_tap', route:'/kalender' },
  { id:'sim-confirm', emoji:'☑️', titleKey:'obx_simconfirm_title', subtitleKey:'obx_simconfirm_sub', descriptionKey:'obx_simconfirm_desc', targetSelector:'[data-ob="ob-sim-confirm"]', placement:'top', advance:'click', tapHintKey:'obx_simconfirm_tap', route:'/kalender', precondition:'sim' },
  { id:'finish', emoji:'🚀', titleKey:'obx_finish_title', subtitleKey:'obx_finish_sub', descriptionKey:'obx_finish_desc', targetSelector:null, placement:'center', advance:'next' },
]

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length

/** Steps that count as “Step 1…N” in the UI (excludes welcome + finish) */
export const ONBOARDING_TOUR_STEP_COUNT = ONBOARDING_STEP_COUNT - 2
