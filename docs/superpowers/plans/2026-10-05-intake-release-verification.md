# Intake release verification implementation plan

**Goal:** Verify the existing plan → intake → calendar → inventory journey in the built app, fix demonstrated regressions, and run the complete checks in CI.

**Approved scope:** The user approved the four-part proposal (journeys, failure cases, WebKit, CI) and explicitly authorized execution without further questions. Existing development happens on `main` per README. No new product subsystem or production database operation is required.

**Architecture:** Extend the existing Playwright fixtures and strict in-memory Supabase HTTP substitute. Assert both visible state and persisted request/result state. Keep database semantics in the substitute explicitly bounded; these checks do not prove SQL/RLS or physical iOS behavior.

**Constraints:** Test data only. Preserve existing tests. DE/EN only. Fix application code only with a reproducing failing test. No unrelated redesign/refactor. No external notifications.

## Tasks and verification

- [x] 1. Record baseline for unit tests, lint, TypeScript/build and installed browsers. Inspect existing RPC contracts and calendar/home UI before writing scenarios.
- [x] 2. Extend `e2e/support/mockSupabase.ts` with only the intake/inventory RPCs, relations and query operators required by the journeys. Add focused tests for the substitute's contract (retry identity, rollback, filters) where behavior is introduced.
- [x] 3. Add browser journeys under `e2e/`: plan creation through calendar confirmation and inventory; skip and undo; repeated input; failed confirmation and stock-only retry; date boundary and plan adjustment; EN smoke. Assert state after navigation/reload and no unhandled requests/errors.
- [x] 4. Extend `playwright.config.ts`, `e2e/support/fixtures.ts`, package scripts and `.github/workflows/e2e.yml` for Chromium/WebKit and complete CI checks. Keep browser executable overrides scoped to Chromium. Use isolated test sessions/build configuration.
- [x] 5. Fix only failures established by the new checks. Run focused regression tests first, then complete unit/lint/type/build/browser checks.
- [x] 6. Independently review changed files; resolve significant findings; run graph update and document its result; write final verification results, remaining limits and commands.

## Ownership / interfaces

| Work | Owner | Interface |
| --- | --- | --- |
| Mock HTTP/RPC contracts | mock agent | Preserve `MockSupabase`, `onRpc`, `callRpc`, `table`, `insert`; new handlers follow repository SQL contracts |
| Browser/CI configuration | CI agent | Preserve existing project names; add WebKit project; fixture defaults stay German and fixed NOW |
| Browser scenarios and focused fixes | root | Consume shared mock/fixture; coordinate before editing shared files |
| Final review | independent reviewer | Review final diff and verification evidence |

## Progress / rulings

- Initial inspection: clean working tree on `main`; six existing My Stack browser scenarios, three Chromium device profiles; 212 unit/component test files. Existing workflows do not run the full unit suite, lint or production build.
- Ruling: implement in the existing checkout, following its documented trunk-based workflow and the user's authorization. Do not introduce a feature branch.
- Ruling: existing behavior may already pass new coverage; do not manufacture failures or change working code merely to obtain a red test. New fixes require demonstrated failures.
- Interface review: mock changes and configuration changes are independent. Scenario work consumes both, and final verification waits for both. Only the CI agent edits shared fixtures/configuration during implementation.
- Baseline: 2,621 unit tests passed; one future-version test failed because October 1 was no longer in the future. Frozen test time fixes it; 34/34 service tests pass. Lint: zero errors, 29 existing warnings. Full build passes and prerenders 134 public pages. Existing six journeys pass on Chromium and WebKit (12 checks).
- Harness corrections: add nested PK relation used by Home; date filters compare actual instants; auth expiry follows the fixture clock. Calendar date deep links include the existing required `#due-intakes` anchor.
- Initial new journeys exposed a real powder-vial mismatch: the wizard sends `5 mg / 2 ml`, but inventory counts vials and expects strength per vial. Retain the failing creation journey while correcting serialization and edit roundtrip; no mock-only normalization.
- Nine new non-creation scenarios pass in Chromium, including commit-response loss, DE/EN, stock retry, undo and local date/plan boundaries. Full final verification follows the product fix.
- Independent review requested. Two assertion gaps found (absence check before loaded Home; partial stock display assertion) corrected with positive loaded state and complete stock presentation.
- Before publication, fetching exposed a stale local tracking ref. Rebased the task onto current `origin/main` (`670badb0`), preserving upstream Node 24/Sentry 11, UI and all existing tests. Combined escaped search filters with nested calendar filters and retained upstream consent/storage/compliance behavior; added a regression test for the combined parser.
- Upstream already contained the clock and timing-test fixes found on the old baseline; retained those without duplication. Corrected a newly reproduced Windows CRLF-only generator assertion using the repository's existing normalization convention. Full integrated unit suite: 2,748/2,748; lint: zero errors and 27 existing warnings; full build and E2E TypeScript pass.
- Independent review of the rebased diff and CRLF correction: no open blockers. Graphify update on the current baseline refused a 6,610 → 5,983 node rebuild. All current graph/cache files restored byte-for-byte, including all 92 semantic nodes; graph refresh remains a documented tool limitation.
- The complete new WebKit coverage exposed a second product bug: the existing geometry fallback activated visible vials but never stopped them when the observer missed later updates. The same throttled check now handles both directions. The failing carousel case passes without weaker assertions. Existing mouse-swipe tests now wait for the closing animation; the deployment case models changed chunk URLs after a real reload. Three CDP-only cases are explicitly Chromium-only.
- Final integrated verification: 2,748 unit/component tests in 228 files pass; 277 browser checks pass, 3 expected WebKit/CDP skips, zero failures. Lint has zero errors and 27 existing warnings; E2E TypeScript and full production build with 134 prerendered pages pass. Final independent review: no findings. See [verification report](../../research/2026-10-05-intake-verification.md).
- The first remote CI run exposed five existing fixtures that assumed a Berlin host timezone. Reproduced all five with a UTC parent process; Vitest now sets Berlin before worker startup. All 2,748 tests then passed from that UTC environment, with unchanged assertions; lint remains clean of errors. Independent review confirms a test-environment correction only.
- The next Linux CI passed all earlier checks and 275 browser cases, but two WebKit document navigations failed. Traces showed successful edit persistence checks before interrupting the opening detail animation, and a real recovery reload that WebKit aborted while Home preloads were still active. Test sequencing now closes the painted detail through the UI and starts stale-chunk recovery from loaded My Stack. Independent review confirms all original business/recovery assertions remain; these changes do not establish an engine fix.
- The explicit close after reload reproduced a third product bug: reopening a restored detail ID pushed a duplicate history entry, so one close left the dialog open. Reopening the same ID now replaces the retained entry; other opens still push. The failing close assertion is preserved, and independent source review found no issues with the single-line change.
- Focused verification of these corrections: edit/reload/close passes 12/12 (three per profile), deployment recovery 4/4, My-Stack component tests 45/45. Production/browser TypeScript and lint of changed files pass. Full Linux CI remains the final platform verification.
- Linux then passed 276 cases including deployment recovery and the corrected close. A direct full-document switch after the edit/reload still crashed Linux WebKit before the timeout. Its exact engine cause remains unresolved and is explicitly documented. The journey now uses the actual Calendar link with identical four calendar assertions; its prior reload/persistence proof is unchanged.
