import { describe, expect, it } from "vitest";
import { componentThemeVars, executionThemeVars, semanticThemeVars } from "./themeSemantics";

describe("@ku0/design-system theme semantics", () => {
  it("exports shared semantic token groups for state, diff, layout, and typography roles", () => {
    expect(semanticThemeVars.color.state).toMatchObject({
      cancelled: expect.any(String),
      danger: expect.any(String),
      info: expect.any(String),
      offline: expect.any(String),
      queued: expect.any(String),
      running: expect.any(String),
      streaming: expect.any(String),
      success: expect.any(String),
      thinking: expect.any(String),
      warning: expect.any(String),
    });

    expect(semanticThemeVars.color.diff).toMatchObject({
      deleteBg: expect.any(String),
      deleteBorder: expect.any(String),
      gutter: expect.any(String),
      inlineHighlight: expect.any(String),
      insertBg: expect.any(String),
      insertBorder: expect.any(String),
      modifiedBg: expect.any(String),
      modifiedBorder: expect.any(String),
    });

    expect(semanticThemeVars.size.layout).toMatchObject({
      composerMaxWidth: expect.any(String),
      composerMinHeight: expect.any(String),
      contentMaxWidth: expect.any(String),
      inspector: expect.any(String),
      sidebar: expect.any(String),
      sidebarCompact: expect.any(String),
      sidebarRail: expect.any(String),
    });

    expect(semanticThemeVars.typography.role).toMatchObject({
      body: expect.any(String),
      caption: expect.any(String),
      heading: expect.any(String),
      label: expect.any(String),
    });
  });

  it("exports shared component token contracts for the high-value interaction families", () => {
    expect(componentThemeVars).toMatchObject({
      button: expect.any(Object),
      diff: expect.any(Object),
      execution: expect.any(Object),
      input: expect.any(Object),
      panel: expect.any(Object),
      tabs: expect.any(Object),
      toast: expect.any(Object),
    });

    expect(componentThemeVars.button).toMatchObject({
      background: expect.any(Object),
      gap: expect.any(Object),
      height: expect.any(Object),
    });
    expect(componentThemeVars.panel).toMatchObject({
      border: expect.any(String),
      headerMinHeight: expect.any(String),
      surface: expect.any(String),
    });
    expect(componentThemeVars.diff).toMatchObject({
      deleteBg: expect.any(String),
      insertBg: expect.any(String),
      modifiedBg: expect.any(String),
    });
    expect(componentThemeVars.execution).toMatchObject({
      neutralBorder: expect.any(String),
      neutralSurface: expect.any(String),
      selectedBorderMix: expect.any(String),
    });
  });

  it("keeps execution primitives derived from shared DS semantics instead of app-local token files", () => {
    expect(executionThemeVars.color.state.running).toBe(semanticThemeVars.color.state.running);
    expect(executionThemeVars.color.state.success).toBe(semanticThemeVars.color.state.success);
    expect(executionThemeVars.color.text.primary).toBe(semanticThemeVars.color.text.primary);
    expect(executionThemeVars.size.layout.inspector).toBe(semanticThemeVars.size.layout.inspector);
    expect(executionThemeVars.typography.role.heading).toBe(
      semanticThemeVars.typography.role.heading
    );
  });
});
