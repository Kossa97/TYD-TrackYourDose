# Active Add-Vial Glow

## Goal

The "Neue Substanz" tile in the My Stack vial carousel must remain visually highlighted whenever it is the centered carousel item. It must stop glowing after another vial becomes centered.

## Design

Reuse the existing `addTileActive` state, which is already updated from the carousel's nearest-item calculation during scrolling. Pass that state into `AddVialTile` as an `active` prop.

When `active` is true, apply the same cyan border, text, background, and shadow treatment currently used for hover and keyboard focus. Hover and focus behavior remain available when the tile is not centered. The parent slide keeps its existing active scale behavior.

## Behavior

- Swiping the add tile into the center activates and keeps the glow visible.
- Swiping to a peptide vial removes the persistent glow.
- Tapping the tile still opens the new-substance flow.
- No carousel selection, snapping, navigation, or liquid animation logic changes.

## Verification

Add a regression test that verifies the active carousel state is passed to `AddVialTile` and controls persistent active styling. Run the focused Peptide tests, the full test suite, and the production build.
