# Figma Node Rollout

This document converts the `Design - UI Kit` page into a small set of implementation anchors.

Use the full page reference for audit only. Use the node-level references below for actual implementation work.

## Selection strategy

The best rollout strategy is:

1. Start from shell-defining nodes instead of isolated decoration.
2. Prefer nodes that map directly to shared primitives in `packages/design-system`.
3. Use page-level references to verify hierarchy and density, not to drive component-level implementation.
4. Promote only a few node references into the registry, then iterate through them in small validated loops.

## Best nodes

| Priority | Resource id                                          | Node id   | Maps to                             | Why it is high signal                                                      |
| -------- | ---------------------------------------------------- | --------- | ----------------------------------- | -------------------------------------------------------------------------- |
| 1        | `linear-ui-community-settings-shell`                 | `3:25595` | page shell, split layout            | Best single reference for sidebar/content proportion and overall contrast. |
| 1        | `linear-ui-community-settings-sidebar`               | `3:25757` | sidebar rail, nav container         | Gives the dark translucent rail and low-contrast border treatment.         |
| 1        | `linear-ui-community-settings-content-pane`          | `3:25597` | section surface, grouped content    | Best reference for content grouping, header spacing, and section rhythm.   |
| 2        | `linear-ui-community-settings-theme-row`             | `3:25649` | settings row, meta row              | Best reference for label, description, divider, and trailing-value layout. |
| 2        | `linear-ui-community-settings-translucent-row`       | `3:25667` | modal/sidebar translucency guidance | Contains the explicit product guidance for translucent UI surfaces.        |
| 2        | `linear-ui-community-settings-theme-chip`            | `3:25655` | badge, chip, pill                   | Best muted-chip reference for small value capsules.                        |
| 2        | `linear-ui-community-settings-sidebar-selected-item` | `3:25813` | selected nav item                   | Best compact selected-state reference for sidebar rows.                    |
| 3        | `linear-ui-community-copy-card-reference`            | `1:24862` | card-scale content module           | Useful after shell alignment is stable. Do not use as page-shell source.   |

## Figma evidence that drives the phases

The current shortlist is not arbitrary. It comes from the actual `Design - UI Kit` export:

- `3:25757` uses a dark fill with a single low-contrast border.
- `3:25649` and `3:25667` are 65px setting rows with restrained dividers and clear label/description structure.
- `3:25672` contains the explicit text rule: `Use transparency in UI elements like the sidebar and modal windows.`
- `3:25655` is a muted trailing chip, which is more useful for badge calibration than a hero CTA card.
- `3:25813` is a compact selected sidebar row with a subtle fill rather than a loud accent treatment.

## Phased implementation

### Phase 1: Shared shell alignment

Target nodes:

- `linear-ui-community-settings-shell`
- `linear-ui-community-settings-sidebar`
- `linear-ui-community-settings-content-pane`

Apply to:

- `Surface`
- `Card`
- page-level panel shells in Home, review, git, and autodrive

Success criteria:

- page shells use the same surface vocabulary
- borders are low-noise and consistent
- shadows are minimal
- page hierarchy matches the Figma shell rather than local one-off chrome

### Phase 2: Row and meta system

Target nodes:

- `linear-ui-community-settings-theme-row`
- `linear-ui-community-settings-sidebar-selected-item`

Apply to:

- `SectionHeader`
- settings-like rows
- action rows
- list-row and meta-row spacing

Success criteria:

- title/meta/action spacing is consistent
- list and settings rows stop carrying bespoke local spacing systems
- selected states are compact and muted

### Phase 3: Chips and status language

Target nodes:

- `linear-ui-community-settings-theme-chip`
- `linear-ui-community-copy-card-reference`

Apply to:

- `Badge`
- compact status pills
- trailing value chips

Success criteria:

- badges read as supporting metadata, not primary calls to action
- chip density, radius, and fill align with the Figma value-chip treatment

### Phase 4: Translucent overlays and modal chrome

Target nodes:

- `linear-ui-community-settings-translucent-row`
- `linear-ui-community-settings-sidebar`

Apply to:

- modal surfaces
- sidebar variants
- overlay-adjacent glass or translucent shells

Success criteria:

- translucency is used intentionally and narrowly
- modal/sidebar transparency follows a shared design-system tone
- translucency does not leak into every default surface

## Recommended execution loop

For each phase:

1. Fetch the exact node through the local bridge.
2. Inspect the raw bundle and preview image.
3. Update only the shared primitive or the smallest set of consuming shells.
4. Validate with targeted tests and a page-level Playwright check.
5. Push a small commit before moving to the next node.

## What not to do

- Do not drive implementation from the full page export alone.
- Do not add many low-value node references just because they exist.
- Do not start with buttons, inputs, or modal internals before shell and row systems are stable.
- Do not use the card-only reference as the main source for page-shell decisions.
