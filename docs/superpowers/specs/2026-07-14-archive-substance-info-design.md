# Archive Substance Info

## Goal

Add a dedicated full-screen information view for each archived substance without making the archive list longer or denser.

## Archive Entry Point

- Keep the existing full-screen archive and its compact rows unchanged.
- Add a neutral information icon button before restore and permanent delete.
- The button uses the same 44 by 44 pixel touch target and focus treatment as the existing row actions.
- Restore and permanent delete remain available only in the archive list.

## Full-Screen Detail

- Open a nested full-screen detail surface above the archive.
- The header contains a back button, the substance name, and the archived date.
- The body begins with the existing gray, empty, compact vial visual.
- Present saved substance data in scan-friendly sections: application and vial, reconstitution and stock, batch and documentation, and notes.
- Missing values remain visible as a simple dash so the view is structurally consistent.
- An analysis document remains an external link when available.

## Cycle Summary

- Reuse the cycles already loaded by the My Stack page; do not add a new query or schema field.
- Show every cycle belonging to the archived substance, newest first.
- Each cycle shows only its name, active/inactive status, date range, dose and unit, frequency, and method.
- Do not show individual intakes, escalation history, reminders, adherence, charts, or editing controls.
- Use the existing empty-cycle copy when no cycle exists.

## Interaction And Accessibility

- Escape and the back button close the detail view before closing the archive.
- While detail is open, keyboard focus is trapped inside that nested full-screen surface.
- Closing detail restores focus to the originating information button.
- The detail surface has dialog semantics and a labelled heading.

## Scope

- Do not modify archive persistence, restore, permanent delete, carousel, liquid animation, or cycle data.
- Do not add a route, dependency, database migration, or new network request.
- Reuse existing localization keys wherever possible.

## Verification

- A regression test covers the information button, nested full-screen shell, substance fields, cycle summaries, empty-cycle state, and nested focus behavior.
- Run the focused Peptide tests, the complete test suite, a production build, and a diff check.
