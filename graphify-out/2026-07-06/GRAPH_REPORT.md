# Graph Report - .  (2026-07-05)

## Corpus Check
- 329 files · ~409,770 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1536 nodes · 2761 edges · 95 communities (86 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.78)
- Token cost: 324,703 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_PDF Protocol Export|PDF Protocol Export]]
- [[_COMMUNITY_Peptipedia Article Cards|Peptipedia Article Cards]]
- [[_COMMUNITY_FAQ i18n Content|FAQ i18n Content]]
- [[_COMMUNITY_Daily Logs & Effects|Daily Logs & Effects]]
- [[_COMMUNITY_Design System Components|Design System Components]]
- [[_COMMUNITY_Admin Library Panel|Admin Library Panel]]
- [[_COMMUNITY_Health Data Integration|Health Data Integration]]
- [[_COMMUNITY_Cycle Form & Vials|Cycle Form & Vials]]
- [[_COMMUNITY_Onboarding i18n Scripts|Onboarding i18n Scripts]]
- [[_COMMUNITY_3D Injection Map|3D Injection Map]]
- [[_COMMUNITY_Auth & Supabase Client|Auth & Supabase Client]]
- [[_COMMUNITY_Injection Log & Deeplink|Injection Log & Deeplink]]
- [[_COMMUNITY_Dose Schedule & Backfill|Dose Schedule & Backfill]]
- [[_COMMUNITY_Lab Evidence Scoring|Lab Evidence Scoring]]
- [[_COMMUNITY_Chart Math Helpers|Chart Math Helpers]]
- [[_COMMUNITY_Home Dashboard|Home Dashboard]]
- [[_COMMUNITY_Injection History Tabs|Injection History Tabs]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Injection Persistence|Injection Persistence]]
- [[_COMMUNITY_Progress & Bloodwork Tabs|Progress & Bloodwork Tabs]]
- [[_COMMUNITY_App Routing & Pages|App Routing & Pages]]
- [[_COMMUNITY_Blood-Level Simulation|Blood-Level Simulation]]
- [[_COMMUNITY_Reminder Scheduler|Reminder Scheduler]]
- [[_COMMUNITY_Dev Build Tooling|Dev Build Tooling]]
- [[_COMMUNITY_Graphify Skill Docs|Graphify Skill Docs]]
- [[_COMMUNITY_App Feature Overview|App Feature Overview]]
- [[_COMMUNITY_Cycle Seed Builder|Cycle Seed Builder]]
- [[_COMMUNITY_Onboarding UI Flow|Onboarding UI Flow]]
- [[_COMMUNITY_Blood-Level History Curve|Blood-Level History Curve]]
- [[_COMMUNITY_iOS App Delegate|iOS App Delegate]]
- [[_COMMUNITY_TS App Config|TS App Config]]
- [[_COMMUNITY_Language & Onboarding Context|Language & Onboarding Context]]
- [[_COMMUNITY_Bloodwork Form|Bloodwork Form]]
- [[_COMMUNITY_TS Node Config|TS Node Config]]
- [[_COMMUNITY_FAQ Locale Generator|FAQ Locale Generator]]
- [[_COMMUNITY_Blood-Level Carousel|Blood-Level Carousel]]
- [[_COMMUNITY_Vial Slosh Engine|Vial Slosh Engine]]
- [[_COMMUNITY_Theme & Profile Settings|Theme & Profile Settings]]
- [[_COMMUNITY_Test Data Seeding|Test Data Seeding]]
- [[_COMMUNITY_Live Blood-Level Chart|Live Blood-Level Chart]]
- [[_COMMUNITY_Peptide Vial Visual|Peptide Vial Visual]]
- [[_COMMUNITY_PubMed API Module|PubMed API Module]]
- [[_COMMUNITY_3D Injection Hero|3D Injection Hero]]
- [[_COMMUNITY_Push Notifications|Push Notifications]]
- [[_COMMUNITY_Peptide Form Modal|Peptide Form Modal]]
- [[_COMMUNITY_Injection Intake Selection|Injection Intake Selection]]
- [[_COMMUNITY_Chart Redesign Specs|Chart Redesign Specs]]
- [[_COMMUNITY_NPM Scripts|NPM Scripts]]
- [[_COMMUNITY_Vial Liquid Geometry|Vial Liquid Geometry]]
- [[_COMMUNITY_Injection Tracker 3D Specs|Injection Tracker 3D Specs]]
- [[_COMMUNITY_Public Profile Page|Public Profile Page]]
- [[_COMMUNITY_Peptide Expiry Warnings|Peptide Expiry Warnings]]
- [[_COMMUNITY_Peptide Color Palette|Peptide Color Palette]]
- [[_COMMUNITY_The Lab Research Specs|The Lab Research Specs]]
- [[_COMMUNITY_App Layout & Nav|App Layout & Nav]]
- [[_COMMUNITY_Workflow Banner|Workflow Banner]]
- [[_COMMUNITY_Package Manifest|Package Manifest]]
- [[_COMMUNITY_Peptide AI Prompts|Peptide AI Prompts]]
- [[_COMMUNITY_UI Theming Specs|UI Theming Specs]]
- [[_COMMUNITY_Health Data Seeding|Health Data Seeding]]
- [[_COMMUNITY_Onboarding Callout Layout|Onboarding Callout Layout]]
- [[_COMMUNITY_Android Instrumented Test|Android Instrumented Test]]
- [[_COMMUNITY_Push Test Endpoint|Push Test Endpoint]]
- [[_COMMUNITY_Onboarding Rework Specs|Onboarding Rework Specs]]
- [[_COMMUNITY_Android Unit Test|Android Unit Test]]
- [[_COMMUNITY_Cycle Versioning Specs|Cycle Versioning Specs]]
- [[_COMMUNITY_Peptipedia i18n Script|Peptipedia i18n Script]]
- [[_COMMUNITY_Service Worker Push|Service Worker Push]]
- [[_COMMUNITY_Android Main Activity|Android Main Activity]]
- [[_COMMUNITY_Feature Flags|Feature Flags]]
- [[_COMMUNITY_TS Root Config|TS Root Config]]
- [[_COMMUNITY_Vercel Config & Crons|Vercel Config & Crons]]
- [[_COMMUNITY_Capacitor Config|Capacitor Config]]
- [[_COMMUNITY_Swift Package Manifest|Swift Package Manifest]]
- [[_COMMUNITY_Graphify Watch Mode|Graphify Watch Mode]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 44 edges
2. `Protokoll()` - 27 edges
3. `supabase` - 26 edges
4. `Peptide` - 21 edges
5. `Dashboard()` - 19 edges
6. `FaqCategory` - 17 edges
7. `FaqBundle` - 17 edges
8. `InjektionsTracker()` - 17 edges
9. `compilerOptions` - 17 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Home dashboard quick-stats` --semantically_similar_to--> `TYD homescreen mockup (static HTML)`  [INFERRED] [semantically similar]
  HANDOFF.md → public/mockup.html
- `CapApp-SPM (Capacitor SPM host)` --conceptually_related_to--> `TYD — Track Your Dose (peptide tracking app)`  [INFERRED]
  ios/App/CapApp-SPM/README.md → HANDOFF.md
- `Trunk-based development (push to main)` --conceptually_related_to--> `TYD — Track Your Dose (peptide tracking app)`  [INFERRED]
  README.md → HANDOFF.md
- `Post-commit auto-rebuild hook + CLAUDE.md integration` --references--> `Project graphify usage rules`  [INFERRED]
  .claude/skills/graphify/references/hooks.md → CLAUDE.md
- `Project graphify usage rules` --references--> `graphify query / path / explain traversal`  [INFERRED]
  CLAUDE.md → .claude/skills/graphify/references/query.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **graphify skill reference documents** — _claude_skills_graphify_skill_pipeline, _claude_skills_graphify_references_add_watch_add, _claude_skills_graphify_references_exports_exports, _claude_skills_graphify_references_extraction_spec_spec, _claude_skills_graphify_references_github_and_merge_clone_merge, _claude_skills_graphify_references_hooks_commit_hook, _claude_skills_graphify_references_query_query, _claude_skills_graphify_references_transcribe_transcribe, _claude_skills_graphify_references_update_update [EXTRACTED 1.00]
- **Features built on the Supabase peptide schema** — handoff_supabase_schema, handoff_peptipedia, handoff_pk_profiles, handoff_push_reminders, handoff_home_dashboard, handoff_inventory_workflow [INFERRED 0.85]
- **The Lab PubMed Research Feature** — docs_superpowers_plans_2026_05_21_the_lab_premium_redesign_pubmed_research_terminal, docs_superpowers_plans_2026_05_21_the_lab_redesign_pubmed_api_module, docs_superpowers_plans_2026_05_21_the_lab_redesign_research_dashboard, docs_superpowers_plans_2026_05_21_the_lab_premium_redesign_evidence_scoring [INFERRED 0.85]
- **3D Injection Tracking + Dose-Log Linkage** — docs_superpowers_plans_2026_06_17_injektionstracker_pro_3d_3d_injection_map, docs_superpowers_plans_2026_06_17_injektionstracker_pro_3d_dose_log_linkage, docs_superpowers_plans_2026_06_25_confirmed_injection_intake_linking_intake_status_model, docs_superpowers_plans_2026_06_25_confirmed_injection_intake_linking_unique_dose_log_index [INFERRED 0.85]
- **UI Foundation: Theming, Motion, Icons** — docs_superpowers_plans_2026_05_30_ui_foundation_theming_semantic_theme_tokens, docs_superpowers_plans_2026_05_30_ui_foundation_theming_pre_paint_theme_init, docs_superpowers_plans_2026_05_30_ui_foundation_theming_motion_system, docs_superpowers_plans_2026_05_30_ui_foundation_theming_lucide_icon_unification [EXTRACTED 1.00]

## Communities (95 total, 9 thin omitted)

### Community 0 - "PDF Protocol Export"
Cohesion: 0.06
Nodes (77): jspdf, Props, ProtocolPdfModal(), T, UILang, CycleRow, embedName(), loadProtocolData() (+69 more)

### Community 1 - "Peptipedia Article Cards"
Cohesion: 0.06
Nodes (49): ArticleGridCard(), ArticleHero(), ArticleMiniItem(), DEFAULT_STYLE, detectPeptide(), formatAuthors(), getPeptideStyle(), isRecent() (+41 more)

### Community 2 - "FAQ i18n Content"
Cohesion: 0.07
Nodes (29): outDir, root, FAQ_LOADERS, loadFaqBundle(), arCategories, deCategories, enCategories, esCategories (+21 more)

### Community 3 - "Daily Logs & Effects"
Cohesion: 0.06
Nodes (53): DailyLogField, DailyLogRow, isWellnessMarker(), WELLNESS_MARKER_FIELD, WELLNESS_MARKERS, WellnessMarker, wellnessMarkersWithData(), wellnessSeries() (+45 more)

### Community 4 - "Design System Components"
Cohesion: 0.06
Nodes (49): CarouselCounter(), CarouselPagination(), accentAlpha(), ActionTile(), combineClassNames(), GlassPanel(), IconBadge(), paddingMap (+41 more)

### Community 5 - "Admin Library Panel"
Cohesion: 0.07
Nodes (34): AdminPanel(), buildLibraryPayload(), LIBRARY_ARRAY_FIELDS, LIBRARY_WRITE_FIELDS, PK_CATEGORIES, PkProfile, saveLibraryRow(), Status (+26 more)

### Community 6 - "Health Data Integration"
Cohesion: 0.06
Nodes (42): ANDROID_READ_PERMISSIONS, getHealthKitSource(), getHeartRate(), getSleep(), getSteps(), getWeight(), HealthConnectHeartRateRecord, HealthConnectReadRecordsResult (+34 more)

### Community 7 - "Cycle Form & Vials"
Cohesion: 0.07
Nodes (35): LabLoader(), LabLoaderProps, NewDot(), useNew(), BASE_FREQUENCIES, compareNullableDate(), compareNullableNum(), CycleForm (+27 more)

### Community 8 - "Onboarding i18n Scripts"
Cohesion: 0.08
Nodes (29): __dirname, main(), outDir, outPath, sleep(), TARGETS, es, fr (+21 more)

### Community 9 - "3D Injection Map"
Cohesion: 0.10
Nodes (28): CameraRig(), focusTargetForRequest(), INJECTION_MAP_LIGHTS, InjectionFocusRequest, InjectionMapCanvas(), LightPosition, OrbitControlsApi, resetCameraFrame() (+20 more)

### Community 10 - "Auth & Supabase Client"
Cohesion: 0.09
Nodes (25): PK_PROFILES, PkSeed, ProtectedRoute(), AuthContext, AuthContextType, AuthProvider(), useAuth(), getDateLocale() (+17 more)

### Community 11 - "Injection Log & Deeplink"
Cohesion: 0.11
Nodes (24): InjectionLogSheet(), InjectionSaveInput, InjectionSaveMode, METHOD_OPTIONS, toLocalInput(), UNIT_OPTIONS, buildInjectionTrackerUrl(), findTargetInjectionIntake() (+16 more)

### Community 12 - "Dose Schedule & Backfill"
Cohesion: 0.12
Nodes (27): adjustmentStartDay(), buildDoseAdjustmentBackfillUpdates(), DoseAdjustmentBackfillLog, DoseAdjustmentBackfillUpdate, earliestAdjustmentStartDay(), logDay(), adjustment, cycle (+19 more)

### Community 13 - "Lab Evidence Scoring"
Cohesion: 0.12
Nodes (27): EvidenceScore, getDefaultLimitationKey(), getEvidenceContext(), getEvidenceLabel(), getEvidenceScore(), getKeyFindings(), getLimitationsAndRisks(), getStudyType() (+19 more)

### Community 14 - "Chart Math Helpers"
Cohesion: 0.14
Nodes (24): alignLocalSixHourFloor(), ChartPoint, clampViewEnd(), lerpLevel(), LIVE_CHART_WINDOW_MS_MOBILE, MarkerPoint, NamedMarker, panHapticStepMs() (+16 more)

### Community 15 - "Home Dashboard"
Cohesion: 0.07
Nodes (19): EMPTY_INJECTION_HERO, EMPTY_OVERVIEW, FEATURE_CARDS, FeatureDef, fmtCountdown(), IntakeRow(), labelStyle, msUntilTime() (+11 more)

### Community 16 - "Injection History Tabs"
Cohesion: 0.14
Nodes (19): HistoryDaysSelect(), InjectionHistorySheet(), InjectionTrackerTabs(), OPEN_DAYS_OPTIONS, openAgeLabel(), openDaysLabel(), OpenIntakeRow(), filterInjectionHistory() (+11 more)

### Community 17 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (26): dependencies, @capacitor/android, @capacitor/cli, @capacitor/core, @capacitor/haptics, capacitor-health-connect, @capacitor/ios, date-fns (+18 more)

### Community 18 - "Injection Persistence"
Cohesion: 0.16
Nodes (18): InjectionIntroSheet(), assertInjectionProSchema(), buildInjectionInsertPayload(), confirmIntakeDoseLog(), isDoseLogAlreadyLinkedError(), isInjectionProSchemaError(), loadInjectionLogs(), resolveInjectionDoseLogId() (+10 more)

### Community 19 - "Progress & Bloodwork Tabs"
Cohesion: 0.10
Nodes (25): axisTick, BloodworkEntry, BlutwerteTab(), DailyLog, EntrySheet(), fieldLabel, fmtDate(), fmtShort() (+17 more)

### Community 20 - "App Routing & Pages"
Cohesion: 0.08
Nodes (20): AdminPanel, Bewertungen, BlutspiegelSimulation, Blutwerte, Dashboard, FAQ, Health, Home (+12 more)

### Community 21 - "Blood-Level Simulation"
Cohesion: 0.11
Nodes (19): useMediaQuery(), BlutspiegelSimulation(), CATEGORY_ACCENT, ChartPoint, computeSingleDose(), INPUT, LABEL, LiveCycleCard() (+11 more)

### Community 22 - "Reminder Scheduler"
Cohesion: 0.22
Nodes (19): addDaysKey(), cycleAppliesToDay(), daySlots(), diffDays(), dueReminders(), effectiveDoseForDay(), localParts(), noonUTC() (+11 more)

### Community 23 - "Dev Build Tooling"
Cohesion: 0.09
Nodes (23): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+15 more)

### Community 24 - "Graphify Skill Docs"
Cohesion: 0.10
Nodes (22): graphify add <url> (ingest), Extra exports (Neo4j, FalkorDB, SVG, GraphML, MCP, wiki), graphify MCP stdio server, Confidence score rubric (discrete INFERRED values), Node ID format rule (repo-relative stem_entity), Extraction subagent prompt spec, GitHub clone + cross-repo merge, Post-commit auto-rebuild hook + CLAUDE.md integration (+14 more)

### Community 25 - "App Feature Overview"
Cohesion: 0.11
Nodes (22): AI Admin Panel (api/peptide-ai.js, Claude Haiku), Design system (dark neon-cyan tokens, index.css), Home dashboard quick-stats, i18n — 14 languages (i18next), Injection site rotation (/injektionen), Inventory workflow (vials_initial never overwritten), Guided onboarding (24 steps), Peptipedia (evidence-based peptide database) (+14 more)

### Community 26 - "Cycle Seed Builder"
Cohesion: 0.18
Nodes (21): batchInsert(), batchUpsertDaily(), buildDoseLogsForCycle(), buildPlannedCycles(), clamp(), CycleRow, END_STR, fail() (+13 more)

### Community 27 - "Onboarding UI Flow"
Cohesion: 0.19
Nodes (15): isPanelNode(), Onboarding(), OnboardingRestartButton(), OB_Z, ObAdvance, ONBOARDING_STEPS, OnboardingStepMeta, getOnboardingHighlightRect() (+7 more)

### Community 28 - "Blood-Level History Curve"
Cohesion: 0.15
Nodes (20): BlutspiegelCurvePoint, calculateCurveTo(), calculateHistoryBlutspiegelCurve(), computeTrend(), cycleAppliesToDay(), cycleIntakeMinutes(), CycleRow, CycleScheduleRow (+12 more)

### Community 29 - "iOS App Delegate"
Cohesion: 0.13
Nodes (13): Any, Bool, Capacitor, AppDelegate, NSUserActivity, UIApplication, UIApplicationDelegate, UIKit (+5 more)

### Community 30 - "TS App Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 31 - "Language & Onboarding Context"
Cohesion: 0.19
Nodes (13): LanguageGate(), Ctx, getKeys(), OnboardingCtx, OnboardingProvider(), useOnboarding(), loadDateLocale(), LOADERS (+5 more)

### Community 32 - "Bloodwork Form"
Cohesion: 0.18
Nodes (16): ALL_MARKERS, BloodworkEntry, BloodworkForm, Blutwerte(), computeTrend(), emptyForm(), formatDisplayDate(), formatNumber() (+8 more)

### Community 33 - "TS Node Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 34 - "FAQ Locale Generator"
Cohesion: 0.20
Nodes (16): applyTranslations(), CACHE_PATH, collectStrings(), dataDir, __dirname, escapeTsString(), formatAnswer(), loadCache() (+8 more)

### Community 35 - "Blood-Level Carousel"
Cohesion: 0.15
Nodes (13): BlutspiegelCarousel(), CarouselCard, CATEGORY_ACCENT, CycleWithPk, easeOutCubic(), isCycleActiveForCarousel(), LevelDisplay(), normalizeCategory() (+5 more)

### Community 36 - "Vial Slosh Engine"
Cohesion: 0.21
Nodes (12): SloshContext, SloshProvider(), useSloshEngine(), clamp(), createSloshEngine(), SloshEngine, SloshState, SpringState (+4 more)

### Community 37 - "Theme & Profile Settings"
Cohesion: 0.21
Nodes (14): LANGUAGES, applyTheme(), getThemeMode(), resolveTheme(), setThemeMode(), systemPrefersLight(), ThemeMode, useTheme() (+6 more)

### Community 38 - "Test Data Seeding"
Cohesion: 0.17
Nodes (15): allLogs, buildLogs(), CYC, cyclesData, effectiveDose(), effectsData, INV, cycleAppliesToDay() (+7 more)

### Community 39 - "Live Blood-Level Chart"
Cohesion: 0.16
Nodes (14): lerp(), LiveBlutspiegelChart(), PAD, TooltipData, loadDoseHistory(), CATEGORY_ACCENT, ChartPoint, CycleChartData (+6 more)

### Community 40 - "Peptide Vial Visual"
Cohesion: 0.20
Nodes (12): clamp01(), clampFill(), clampSlosh(), fillMotionShiftPct(), LIQUID_BUBBLES, PeptideVialVisual(), PeptideVialVisualProps, usePrefersReducedMotion() (+4 more)

### Community 41 - "PubMed API Module"
Cohesion: 0.15
Nodes (11): buildEutilsUrl(), corsHeaders, ESearchResponse, ESummaryArticle, ESummaryResponse, ESummaryResult, fetchPubMedAbstracts(), fetchPubMedSummaries() (+3 more)

### Community 42 - "3D Injection Hero"
Cohesion: 0.18
Nodes (10): Torso(), HERO_PIN_COLORS, HeroTorsoModel(), InjectionHeroPin, InjectionTrackerHero(), Vector3Json, FALLBACK_TORSO_COLOR, prepareInjectionTorsoModel() (+2 more)

### Community 43 - "Push Notifications"
Cohesion: 0.22
Nodes (13): Layout(), PushPayloadMessage, showPageNotification(), waitForServiceWorkerPush(), fetchServerVapidPublicKey(), isInstalledPWA(), isIOSDevice(), PushState (+5 more)

### Community 44 - "Peptide Form Modal"
Cohesion: 0.17
Nodes (11): EXPIRY_PRESETS, FieldId, METHOD_KEYS, METHODS, PeptideFormModal(), PeptideFormModalProps, POPULAR_PEPTIDES, UNITS (+3 more)

### Community 45 - "Injection Intake Selection"
Cohesion: 0.24
Nodes (13): buildSelectableInjectionIntakes(), cycleName(), doseLogSlotKey(), INJECTABLE_METHODS, InjectionCycleRow, InjectionDoseLog, injectionIntakeLookbackStart(), isAutoMissedDoseLog() (+5 more)

### Community 46 - "Chart Redesign Specs"
Cohesion: 0.14
Nodes (14): Biohacking Dashboard (KPI + Presets), Normalized % Correlation Chart, Protokoll Redesign Plan, Small Multiples with Normal Ranges, Canvas Blood-Level Chart, Chart Math Helpers (lerp, pan, ticks), Live Blutspiegel Graph Redesign Plan, Ref-Based Pan/Read State (rAF, No Re-Render) (+6 more)

### Community 47 - "NPM Scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, faq:export, faq:generate, i18n:onboarding:generate, i18n:onboarding:merge, lint (+5 more)

### Community 48 - "Vial Liquid Geometry"
Cohesion: 0.33
Nodes (11): buildLiquid(), clamp(), fillSloshResponse(), finite(), LiquidGeometry, LiquidParams, liquidSurfaceY(), moveTo() (+3 more)

### Community 49 - "Injection Tracker 3D Specs"
Cohesion: 0.20
Nodes (11): 3D Injection Map Canvas, Optional Dose-Log Linkage, Injection Geometry & Proximity Warning, Model-Relative Coordinate Persistence, Injektionstracker Pro 3D Plan, Selectable Intake Status Model, No Double Confirm / No Stock Debit, Confirmed Injection Intake Linking Plan (+3 more)

### Community 50 - "Public Profile Page"
Cohesion: 0.18
Nodes (7): DoseLog, Effect, Peptide, Profile, Review, SEVERITY_COLORS, SEVERITY_LABELS

### Community 51 - "Peptide Expiry Warnings"
Cohesion: 0.28
Nodes (6): alertMessage(), ExpiryWarningBanners(), ExpiryStatus, getPeptideExpiryAlerts(), PeptideExpiryAlert, PeptideExpirySource

### Community 52 - "Peptide Color Palette"
Cohesion: 0.39
Nodes (5): PeptideColorPalette(), PeptideColorPaletteProps, getPeptideColor(), getRandomPeptideColor(), PEPTIDE_COLORS

### Community 53 - "The Lab Research Specs"
Cohesion: 0.32
Nodes (8): Evidence Scoring & Study Type Classification, The Lab Premium Redesign Plan, PubMed Research Terminal (The Lab), The Lab Redesign Plan, PubMed API Module (pubmed.ts), Research Dashboard Layout, The Lab Premium Redesign Spec, The Lab Redesign Spec

### Community 54 - "App Layout & Nav"
Cohesion: 0.29
Nodes (4): QUICK_ACTIONS, QUICK_TILES, PushNotificationListener(), PushPayloadMessage

### Community 55 - "Workflow Banner"
Cohesion: 0.29
Nodes (6): iconBoxBase, labelStyle, panelStyle, storageKey(), WORKFLOW_STEPS, WorkflowBanner()

### Community 56 - "Package Manifest"
Cohesion: 0.29
Nodes (6): engines, node, name, private, type, version

### Community 57 - "Peptide AI Prompts"
Cohesion: 0.60
Nodes (5): buildCreatePrompt(), buildUpdatePrompt(), handler(), readBody(), sendJSON()

### Community 58 - "UI Theming Specs"
Cohesion: 0.33
Nodes (6): Lucide Icon Unification, Motion System with Reduced-Motion Guard, UI Foundation Theming Plan, Pre-Paint Theme Init (No Flash), Semantic Theme Token System, UI Foundation Theming Design Spec

### Community 59 - "Health Data Seeding"
Cohesion: 0.33
Nodes (4): bloodworkEntries, sb, startDate, weightLogs

### Community 60 - "Onboarding Callout Layout"
Cohesion: 0.40
Nodes (5): CalloutLayout, CalloutLayoutOptions, CalloutPlacement, computeCalloutLayout(), getViewportReserves()

### Community 61 - "Android Instrumented Test"
Cohesion: 0.60
Nodes (3): ExampleInstrumentedTest, Test, RunWith

### Community 62 - "Push Test Endpoint"
Cohesion: 0.70
Nodes (4): handler(), normalizeSubscription(), readJsonBody(), require

### Community 63 - "Onboarding Rework Specs"
Cohesion: 0.40
Nodes (5): Field-by-Field Onboarding Guidance, Onboarding Rework Plan, Simulated Intake Confirmation Card, Step Gating Flags (requireFilled, optionalTarget), Onboarding Rework Design Spec

### Community 65 - "Cycle Versioning Specs"
Cohesion: 0.50
Nodes (4): Zyklus Planung Versionierung Plan, scheduleForDay Resolver, Versioned Cycle Schedule History, Zyklus Planung Versionierung Design Spec

### Community 66 - "Peptipedia i18n Script"
Cohesion: 0.50
Nodes (3): localeDir, root, T

## Knowledge Gaps
- **511 isolated node(s):** `SLOT_TIMES`, `WEEKDAYS_DE`, `REMINDER_OFFSETS_MIN`, `config`, `UIKit` (+506 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `supabase` connect `Auth & Supabase Client` to `PDF Protocol Export`, `Bloodwork Form`, `Blood-Level Carousel`, `Design System Components`, `Admin Library Panel`, `Health Data Integration`, `Cycle Form & Vials`, `Theme & Profile Settings`, `Daily Logs & Effects`, `Live Blood-Level Chart`, `Push Notifications`, `Home Dashboard`, `Injection Persistence`, `Progress & Bloodwork Tabs`, `Public Profile Page`, `Blood-Level Simulation`, `Cycle Seed Builder`, `Blood-Level History Curve`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Auth & Supabase Client` to `Bloodwork Form`, `Blood-Level Carousel`, `Design System Components`, `Admin Library Panel`, `Health Data Integration`, `Cycle Form & Vials`, `Theme & Profile Settings`, `Daily Logs & Effects`, `Push Notifications`, `Injection Log & Deeplink`, `Home Dashboard`, `Injection Persistence`, `Progress & Bloodwork Tabs`, `Blood-Level Simulation`, `App Layout & Nav`, `Language & Onboarding Context`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `Package Manifest`, `PDF Protocol Export`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `SLOT_TIMES`, `WEEKDAYS_DE`, `REMINDER_OFFSETS_MIN` to the rest of the system?**
  _521 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PDF Protocol Export` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `Peptipedia Article Cards` be split into smaller, more focused modules?**
  _Cohesion score 0.05961538461538462 - nodes in this community are weakly interconnected._
- **Should `FAQ i18n Content` be split into smaller, more focused modules?**
  _Cohesion score 0.06768905341089371 - nodes in this community are weakly interconnected._