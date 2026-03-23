export const allowedRuntimeCompatStyleImports = new Set([
  "./ds-modal.css",
  "./ds-toast.css",
  "./ds-diff.css",
]);

export const retiredRuntimeCompatStyleImports = new Set([
  "./design-system.css",
  "./ds-panel.css",
  "./ds-popover.css",
]);

export const retiredRuntimeCompatStyleFiles = [
  "apps/code/src/styles/design-system.css.ts",
  "apps/code/src/styles/ds-panel.css.ts",
  "apps/code/src/styles/ds-popover.css.ts",
];

export const restrictedCompatClassRules = [
  {
    label: "dialog-form-compat",
    pattern: String.raw`(?<!--)\bds-modal-(title|subtitle|actions|label|input|textarea|button|error|divider)\b`,
    allowedPaths: new Set(["packages/design-system/src/components/Dialog.tsx"]),
    guidance:
      "import the shared Dialog* helpers instead of using raw compat classes in feature code.",
  },
  {
    label: "panel-structure-compat",
    pattern: String.raw`(?<!--)\bds-panel(?:-header|-meta|-search|-search-icon|-search-input|-nav|-nav-item|-nav-item-main|-nav-item-icon|-nav-item-label|-nav-item-disclosure)?\b`,
    allowedPaths: new Set(["packages/design-system/src/components/Panel.tsx"]),
    guidance:
      "import the shared Panel* primitives instead of using raw compat classes in feature code.",
  },
  {
    label: "popover-structure-compat",
    pattern: String.raw`(?<!--)\bds-popover(?:-item|-item-icon|-item-label)?\b`,
    allowedPaths: new Set(["packages/design-system/src/components/Popover.tsx"]),
    guidance:
      "import the shared Popover* primitives or use local refs/data hooks instead of raw compat classes in feature code.",
  },
  {
    label: "select-structure-compat",
    pattern: String.raw`(?<!--)\bds-select(?!-anchor)(?:-trigger|-trigger-label|-trigger-caret|-menu|-option|-option-label|-option-check)?\b`,
    allowedPaths: new Set(["packages/design-system/src/components/Select.tsx"]),
    guidance:
      "use the shared Select component plus stable data-ui-select-* hooks instead of raw compat classes in feature code.",
  },
  {
    label: "legacy-settings-controls",
    pattern: String.raw`\bsettings-(?:input(?:--[a-z-]+)?|select(?:--[a-z-]+)?)\b`,
    allowedPaths: new Set(),
    guidance:
      "use design-system Input/Select/Textarea primitives or module-scoped native control styles instead of legacy settings control classes.",
  },
  {
    label: "legacy-settings-toggle-and-editor",
    pattern: String.raw`\bsettings-(?:toggle(?:-knob)?|agents-textarea)\b`,
    allowedPaths: new Set(),
    guidance:
      "use design-system Switch/Textarea primitives with module-scoped tokens instead of legacy settings toggle or editor classes.",
  },
  {
    label: "legacy-account-pool-controls",
    pattern: String.raw`\bapm-(?:input(?:--[a-z-]+)?|select(?:--[a-z-]+)?)\b`,
    allowedPaths: new Set(),
    guidance:
      "use design-system Input/Select primitives with account-pool-scoped token classes instead of legacy apm input/select classes.",
  },
];

export const restrictedCompatVarRules = [
  {
    label: "select-visual-override-compat",
    pattern: String.raw`--ds-select-(?:trigger-(?:border|bg|gloss|shadow|backdrop|hover-border|hover-bg|hover-shadow|open-border|open-bg|open-shadow)|menu-(?:border|bg|gloss|shadow|backdrop)|option-(?:hover-shadow|selected-shadow))`,
    allowedPaths: new Set([
      "packages/design-system/src/components/Select.css.ts",
      "packages/code-workspace-client/src/workspace-shell/SharedWorkspaceSelectChrome.css.ts",
      "apps/code/src/features/composer/components/ComposerAccessDropdown.styles.css.ts",
      "apps/code/src/features/composer/components/ComposerMetaBar.styles.css.ts",
      "apps/code/src/features/app/components/OpenAppMenu.css.ts",
      "apps/code/src/features/composer/components/ComposerSelectMenu.css.ts",
      "apps/code/src/features/home/components/HomeThreadControls.css.ts",
      "apps/code/src/features/settings/components/SettingsSelect.css.ts",
      "apps/code/src/features/settings/components/sections/settings-codex-accounts-card/CodexAccountControls.css.ts",
    ]),
    guidance:
      "keep Select chrome overrides centralized in shared presets or explicitly registered exception files before adding new visual protocols.",
  },
];

export const allowedCompatAliasExactNames = new Set([
  "--radius",
  "--font-sans",
  "--font-mono",
  "--ui-font-family",
  "--select-caret",
]);

export const compatAliasFamilies = [
  { family: "--ds-color-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-space-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-radius-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-shadow-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-elevation-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-motion-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-surface-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-border-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-text-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-brand-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-state-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-syntax-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-focus-ring", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-gradient-", owner: "@ku0/design-system", status: "shared-runtime-primitive" },
  { family: "--ds-hover-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-modal-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-toast-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-panel-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-popover-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-button-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-input-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-card-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-select-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-sidebar-", owner: "apps/code", status: "approved-app-compat" },
  { family: "--ds-inspector-", owner: "apps/code", status: "approved-app-compat" },
  { family: "--ds-composer-", owner: "apps/code", status: "approved-app-compat" },
  { family: "--ds-content-", owner: "apps/code", status: "approved-app-compat" },
  { family: "--ds-shell-", owner: "apps/code", status: "approved-app-compat" },
  { family: "--ds-status-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-diff-", owner: "@ku0/design-system", status: "approved-app-compat" },
  { family: "--ds-scrollbar-", owner: "apps/code", status: "approved-app-compat" },
  { family: "--font-size-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--line-height-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--shadow-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--duration-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--ease-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--z-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--control-height-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--focus-ring-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--status-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--color-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--space-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--radius-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--surface-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--text-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--brand-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--border-", owner: "apps/code", status: "legacy-crosswalk" },
  { family: "--elevation-", owner: "apps/code", status: "legacy-crosswalk" },
];

export function classifyCompatAliasFamily(aliasName) {
  if (allowedCompatAliasExactNames.has(aliasName)) {
    return aliasName;
  }

  for (const entry of compatAliasFamilies) {
    if (aliasName.startsWith(entry.family)) {
      return entry.family;
    }
  }

  return null;
}
