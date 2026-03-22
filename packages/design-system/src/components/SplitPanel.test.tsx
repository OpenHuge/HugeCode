import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SplitPanel } from "../index";

describe("SplitPanel", () => {
  it("renders leading and trailing slots with className passthrough", () => {
    const markup = renderToStaticMarkup(
      <SplitPanel
        className="settings-split-panel"
        leading={<nav aria-label="Settings sections">Sections</nav>}
        trailing={<section aria-label="Settings detail">Detail</section>}
      />
    );

    expect(markup).toContain("settings-split-panel");
    expect(markup).toContain('data-split-panel="true"');
    expect(markup).toContain('data-split-slot="leading"');
    expect(markup).toContain('data-split-slot="trailing"');
    expect(markup).toContain("Settings sections");
    expect(markup).toContain("Settings detail");
  });

  it("sources split panel fallback tokens from component theme semantics", () => {
    const splitPanelSource = readFileSync(new URL("./SplitPanel.css.ts", import.meta.url), "utf8");

    expect(splitPanelSource).toContain('from "../themeSemantics"');
    expect(splitPanelSource).toContain("componentThemeVars.surface");
  });
});
