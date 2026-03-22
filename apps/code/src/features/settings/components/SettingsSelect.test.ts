import { describe, expect, it } from "vitest";
import { readRelativeSource } from "../../../test/styleSource";

const sharedSource = readRelativeSource(import.meta.dirname, "./SettingsSelect.css.ts");
const formControlsSource = readRelativeSource(import.meta.dirname, "./SettingsFormControls.css.ts");
const codexSectionSource = readRelativeSource(
  import.meta.dirname,
  "./sections/SettingsCodexSection.css.ts"
);
const openAppsSource = readRelativeSource(
  import.meta.dirname,
  "./sections/SettingsOpenAppsSection.css.ts"
);

describe("SettingsSelect styles", () => {
  it("keeps the shared settings select chrome in a single preset file", () => {
    expect(sharedSource).toContain("export const settingsSelectRoot = style({");
    expect(sharedSource).toContain('"--ds-select-trigger-open-border": "var(--ds-border-accent)"');
    expect(sharedSource).toContain('"--ds-select-trigger-gloss": "none"');
    expect(sharedSource).toContain('"--ds-select-trigger-backdrop": "none"');
    expect(sharedSource).toContain('"--ds-select-menu-bg"');
    expect(sharedSource).toContain('"--ds-select-menu-shadow"');
    expect(sharedSource).toContain('"--ds-select-menu-gloss": "none"');
    expect(sharedSource).toContain('"--ds-select-menu-shadow": overlayValues.menuShadow');
    expect(sharedSource).toContain('"--ds-select-menu-backdrop": overlayValues.menuBackdrop');
    expect(sharedSource).toContain("export const settingsSelectOption = style({");
    expect(sharedSource).toContain("fontSize: statusChipValues.fontSize");
  });

  it("makes settings form controls reuse the shared settings select preset", () => {
    expect(formControlsSource).toContain('from "./SettingsSelect.css"');
    expect(formControlsSource).toContain("export const selectRoot = style([");
    expect(formControlsSource).toContain("settingsSelectRoot,");
    expect(formControlsSource).toContain(
      "export const selectTrigger = style([settingsSelectTrigger"
    );
    expect(formControlsSource).toContain("export const selectMenu = style([settingsSelectMenu");
    expect(formControlsSource).toContain("export const selectOption = style([settingsSelectOption");
  });

  it("makes codex settings reuse the shared settings select preset", () => {
    expect(codexSectionSource).toContain('from "../SettingsSelect.css"');
    expect(codexSectionSource).toContain("export const selectRoot = style([");
    expect(codexSectionSource).toContain("settingsSelectRoot,");
    expect(codexSectionSource).toContain(
      "export const selectTrigger = style([settingsSelectTrigger"
    );
    expect(codexSectionSource).toContain("export const selectMenu = style([settingsSelectMenu");
    expect(codexSectionSource).toContain("export const selectOption = style([settingsSelectOption");
  });

  it("makes open-app settings reuse the shared settings select preset", () => {
    expect(openAppsSource).toContain('from "../SettingsSelect.css"');
    expect(openAppsSource).toContain("export const selectTrigger = style([settingsSelectTrigger");
    expect(openAppsSource).toContain("export const selectMenu = style([settingsSelectMenu");
    expect(openAppsSource).toContain("export const selectOption = style([settingsSelectOption");
  });
});
