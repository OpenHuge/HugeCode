# Runtime Compat Cleanup 2026-03-25

This note records the runtime compatibility cleanup that removes retired
`apps/connectors` paths while keeping the active HugeCode extension model on a
single canonical path.

## Canonical Path Strengthened

- Runtime extension lifecycle stays on the v2 extension contract:
  - `code_extension_catalog_list_v2`
  - `code_extension_get_v2`
  - `code_extension_install_v2`
  - `code_extension_update_v2`
  - `code_extension_set_state_v2`
  - `code_extension_remove_v2`
- Web publishing stays on the canonical `web:*` root scripts.
- Desktop runtime discovery stays on the extension catalog and MCP/runtime
  inspection surfaces, not on a revived `/apps` or connector catalog.

## Deleted Paths And Logic

- Removed `code_apps_list_v1` from:
  - TypeScript runtime host contract
  - Rust runtime service dispatch/capabilities
  - desktop host codex command surface
  - frozen runtime spec snapshots and desktop-host gap allowlists
- Removed legacy native-plugin backfill into the runtime extension catalog.
- Removed `code_extension_ui_apps_list_v2`; callers now read `uiApps` from the
  canonical extension catalog / extension record.
- Removed frontend `AppMention` / `appMentions` connector-state compatibility
  from compose, queue, home, and PR flows.
- Removed duplicate root aliases:
  - `experimental:web:dev`
  - `experimental:web:build`
  - `experimental:web:typecheck`

## Compat Layers Retained

- Retained instruction-skill overlay import through the extension catalog.
  - Why: workspace and bundled instruction skills are still an active extension
    source and still need to appear in the unified extension catalog until their
    storage path is fully runtime-native.
- Retained `uiApps` on extension records.
  - Why: these descriptors are still part of the active extension metadata
    shape and now live only on the canonical extension record path.

## Exit Conditions And Removal Window

- Instruction-skill overlay import should be removed when runtime-owned skill
  records are the only remaining source for bundled/workspace instruction skills
  and no caller depends on native-skill overlay backfill.
- `uiApps` can be renamed or folded into a narrower extension-inspection field
  only if the runtime extension metadata contract itself is revised.
- Target deletion window for retained compat in this note:
  - remove in the first frozen-contract refresh after the exit conditions are
    met
  - do not leave these retained layers in place beyond `2026-06-30` without a
    fresh follow-up note that names the blocker
