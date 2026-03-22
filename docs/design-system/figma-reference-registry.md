# Figma Reference Registry

This document mirrors the machine-readable registry in `docs/design-system/figma-reference-registry.json`.

Use it to find approved Figma references that agents can export through the local bridge workflow.

## Active references

### Linear Design System Community Root

- Resource name: `linear-design-system-community-root`
- File key: `KWUgG9JAz50HjH0jIrGkpH`
- Node id: `8:2`
- URL: `https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2&p=f&t=weIRY2hJGy82XA7A-0`
- Status: `ready-for-local-bridge`
- Workflow: `docs/design-system/figma-local-bridge.md`
- Notes:
  - Use this root node when validating the newer Linear Design System community file through the repo-native bridge.
  - Prefer the Desktop plugin path from `docs/design-system/figma-local-bridge.md` before any REST fetch or Figma MCP attempt.
  - If you intentionally need a fresh REST snapshot, use `pnpm -C tools/figma bridge:doctor` and `pnpm -C tools/figma bridge:fetch` as maintenance-only commands.
  - Keep the generated raw manifest for provenance.

### Linear UI Community Copy

- Resource name: `linear-ui-community-copy-card-reference`
- File key: `FR8BpWK6jlWrhTLZVtB2Zv`
- Node id: `1:24862`
- URL: `https://www.figma.com/design/FR8BpWK6jlWrhTLZVtB2Zv/Linear-UI---Free-UI-Kit--Recreated---Community---Copy-?node-id=1-24862&t=hFw3G4JBlkGEaVIJ-0`
- Status: `ready-for-local-bridge`
- Workflow: `docs/design-system/figma-local-bridge.md`
- Notes:
  - This resource should be exported through the local bridge, not through Figma MCP.
  - Open the matching duplicated file in Figma Desktop before exporting.
  - This reference is card-scale and should not be treated as a page-level UI audit target.

### Linear UI Community Page

- Resource name: `linear-ui-community-page-reference`
- File key: `FR8BpWK6jlWrhTLZVtB2Zv`
- Node id: `0:1`
- URL: `https://www.figma.com/design/FR8BpWK6jlWrhTLZVtB2Zv/Linear-UI---Free-UI-Kit--Recreated---Community---Copy-?node-id=0-1&t=hFw3G4JBlkGEaVIJ-0`
- Status: `ready-for-local-bridge`
- Workflow: `docs/design-system/figma-local-bridge.md`
- Notes:
  - Use this reference for page-level shell, hierarchy, and density audits.
  - The page title in Figma is `Design - UI Kit`.

### Linear Design System Community Dark Mode Page

- Resource name: `linear-design-system-community-dark-mode-page`
- File key: `KWUgG9JAz50HjH0jIrGkpH`
- Node id: `8:2`
- URL: `https://www.figma.com/design/KWUgG9JAz50HjH0jIrGkpH/Linear-Design-System--Community---Copy-?node-id=8-2&p=f&t=weIRY2hJGy82XA7A-0`
- Status: `ready-for-local-bridge`
- Workflow: `docs/design-system/figma-local-bridge.md`
- Notes:
  - Use this reference for dark-mode token audits, design-system inventory, and shell-level review.
  - Treat this `CANVAS` export as audit-only unless you intentionally force broad codegen.
  - Capture a child component or component set from the same file before generating promotion-ready scaffolds.

### Linear UI Community Settings Shell

- Resource name: `linear-ui-community-settings-shell`
- Node id: `3:25595`
- Use for: shell-level layout, sidebar/content proportion, and dark-surface contrast

### Linear UI Community Settings Sidebar

- Resource name: `linear-ui-community-settings-sidebar`
- Node id: `3:25757`
- Use for: sidebar rail, border treatment, and nav density

### Linear UI Community Settings Content Pane

- Resource name: `linear-ui-community-settings-content-pane`
- Node id: `3:25597`
- Use for: content grouping, section rhythm, and header hierarchy

### Linear UI Community Theme Setting Row

- Resource name: `linear-ui-community-settings-theme-row`
- Node id: `3:25649`
- Use for: setting rows with label, description, divider, and trailing value layout

### Linear UI Community Translucent UI Row

- Resource name: `linear-ui-community-settings-translucent-row`
- Node id: `3:25667`
- Use for: translucent sidebar and modal guidance

### Linear UI Community Theme Value Chip

- Resource name: `linear-ui-community-settings-theme-chip`
- Node id: `3:25655`
- Use for: muted chips, value pills, and badge calibration

### Linear UI Community Sidebar Selected Item

- Resource name: `linear-ui-community-settings-sidebar-selected-item`
- Node id: `3:25813`
- Use for: compact selected-nav state

## Rollout

Use `docs/design-system/figma-node-rollout.md` as the phased implementation plan for these references.

For the page-scale Linear dark-mode design-system file, the current family-level execution queue lives at:

- `docs/design-system/figma-focus-plan.linear-dark-mode.json`

Use that plan with `pnpm -C tools/figma pipeline:focus-fetch` instead of manually adding every child node into the main registry.
