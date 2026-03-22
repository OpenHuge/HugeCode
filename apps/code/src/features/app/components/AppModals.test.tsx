// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsLoadingFallback } from "./AppModals";

describe("SettingsLoadingFallback", () => {
  it("renders shared status-badge chrome while the settings view is loading", () => {
    render(<SettingsLoadingFallback />);

    expect(
      document.body.querySelector('.settings-overlay--chatgpt[data-overlay-root="dialog"]')
    ).toBeTruthy();
    expect(
      document.body.querySelector(
        '.settings-window--chatgpt[data-overlay-phase="surface"][data-overlay-treatment="translucent"]'
      )
    ).toBeTruthy();
    expect(
      document.body.querySelector('.settings-kicker[data-status-tone="default"][data-size="md"]')
    ).toBeTruthy();
    expect(
      document.body.querySelector(
        '.settings-context-chip[data-status-tone="progress"][data-shape="chip"]'
      )
    ).toBeTruthy();
  });
});
