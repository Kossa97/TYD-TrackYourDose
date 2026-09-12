# Public Peptipedia — implementation handoff

The approved 2026-09-08 plan is implemented locally on `main`. Nothing was pushed or deployed. MyStack and Supabase were not changed.

## Delivered

- Eleven repository-owned, source-linked profiles in German and English.
- Public list/detail routes, legacy redirects, and protected personal/admin routes.
- Existing visual style with a short introduction and six horizontally scrollable, keyboard-accessible tabs.
- Structured study protocols distinguish human, animal, laboratory, and approved-label evidence; validation checks matching primary sources.
- Blank, user-input-only calculator with quantity and syringe-capacity validation.
- Twenty-four pre-rendered pages, canonical/alternate/Open Graph metadata, sitemap, and robots file.

## Verification

- Full suite: 76 test files, 589 tests passed.
- Production build: passed, including 24 pre-rendered public pages.
- Targeted lint for changed implementation files: passed.
- Whole-repository lint: not clean; existing errors include unrelated app files and the legacy compatibility worktree. No unrelated lint cleanup was attempted.
- Browser checks: DE/EN navigation, tabs, hash persistence, keyboard navigation, blank calculator, and responsive widths from 320 to 1280 pixels. No exhaustive light-theme or pixel-diff comparison is claimed.

## Operational notes

- Public content is maintained in `src/features/peptipedia/content/entries`, not the old Supabase editor.
- Set `VITE_PUBLIC_SITE_URL` to the intended canonical production origin when deploying; Vercel host variables are supported as fallbacks. Local preview defaults to port 4173.
- Existing filesystem-first Vercel routing already supports pre-rendered files and was left unchanged.
- Deployment, legal/editorial release review, and public-domain verification remain separate release steps.
