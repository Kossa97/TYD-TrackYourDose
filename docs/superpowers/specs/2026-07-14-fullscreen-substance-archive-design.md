# Fullscreen Substance Archive

## Goal

Replace the current archive bottom sheet in My Stack with a full-screen archive that presents archived substances as a compact vertical list.

## Full-Screen Structure

- The archive occupies the complete viewport and uses the existing dark application surface.
- A fixed header respects the top safe area and contains the archive title and a 44 by 44 pixel close button.
- Only the list body scrolls. Content may use a readable maximum width on larger screens while the archive surface remains full-screen.
- The existing empty state remains available when no substances are archived.

## Archive Rows

Each archived substance is one horizontal list row separated by a subtle divider:

- Left: the existing `PeptideVialVisual`, rendered compact, gray, empty (`fillPct={0}`), inactive, and without mount animation.
- Center: the substance name and `Archiviert am <date>` using the user's locale.
- Right: permanently visible restore and delete icon buttons with 44 by 44 pixel touch targets, accessible labels, and visible focus states.

Restore remains the positive action. Delete remains visually destructive and continues to open the existing permanent-delete confirmation flow. Rows do not introduce a new details view or hidden swipe actions.

## Archive Timestamp

Add an optional timestamp to the peptide record:

```sql
alter table peptides
  add column if not exists archived_at timestamptz;
```

When a substance is archived, set `archived = true` and `archived_at` to the current ISO timestamp in the same update. When restored, set `archived = false` and clear `archived_at`.

Archived substances are loaded newest first by `archived_at`. There are currently no archived substances that require timestamp backfilling.

The repository does not automatically run SQL migrations during the Vercel build. The idempotent schema update must therefore be applied to Supabase before or together with the frontend release.

## Localization

Add an `archiviert_am` label with a date interpolation value to every application locale. Format the stored timestamp using the active application locale and show only the calendar date, without a time.

## Scope

- Keep the archive entry button in its current My Stack header position.
- Keep restore and permanent-delete behavior unchanged apart from timestamp updates.
- Do not change the main vial carousel, cycles, liquid animation, or active substance cards.

## Verification

- Regression tests verify the full-screen shell, list-row layout, gray empty vial props, timestamp display, and timestamp updates.
- The focused Peptide tests, complete test suite, lint check for touched files, and production build must pass.
- Responsive visual checks cover mobile and desktop widths, including safe areas, scrolling, touch targets, and absence of horizontal overflow.
