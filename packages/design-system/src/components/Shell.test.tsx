import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptySurface, ListRow, ShellFrame, ShellSection, ShellToolbar } from "../index";

describe("shared shell primitives", () => {
  it("renders a shell frame with surface semantics and className passthrough", () => {
    const markup = renderToStaticMarkup(
      <ShellFrame className="home-shell-frame" tone="elevated" padding="lg">
        Dashboard
      </ShellFrame>
    );

    expect(markup).toContain("Dashboard");
    expect(markup).toContain("home-shell-frame");
    expect(markup).toContain('data-shell-frame="true"');
  });

  it("renders a shell section with header and body slots", () => {
    const markup = renderToStaticMarkup(
      <ShellSection
        title="Mission signals"
        meta="Mission control live"
        actions={<button type="button">Sync</button>}
      >
        <div>Section body</div>
      </ShellSection>
    );

    expect(markup).toContain('data-shell-section="true"');
    expect(markup).toContain('data-shell-slot="header"');
    expect(markup).toContain('data-shell-slot="body"');
    expect(markup).toContain("Mission signals");
    expect(markup).toContain("Mission control live");
    expect(markup).toContain("Sync");
    expect(markup).toContain("Section body");
  });

  it("renders a shell toolbar with leading, center, and trailing slots", () => {
    const markup = renderToStaticMarkup(
      <ShellToolbar
        className="home-shell-toolbar"
        leading={<span>Scope</span>}
        trailing={<button type="button">Refresh</button>}
      >
        <span>Filters</span>
      </ShellToolbar>
    );

    expect(markup).toContain("home-shell-toolbar");
    expect(markup).toContain('data-shell-toolbar="true"');
    expect(markup).toContain('data-shell-slot="leading"');
    expect(markup).toContain('data-shell-slot="center"');
    expect(markup).toContain('data-shell-slot="trailing"');
    expect(markup).toContain("Scope");
    expect(markup).toContain("Filters");
    expect(markup).toContain("Refresh");
  });

  it("renders an empty surface with empty-state content and className passthrough", () => {
    const markup = renderToStaticMarkup(
      <EmptySurface
        className="home-empty-surface"
        title="No recent missions yet."
        body="Start from the composer to create one."
        actions={<button type="button">Open composer</button>}
      />
    );

    expect(markup).toContain("home-empty-surface");
    expect(markup).toContain('data-empty-surface="true"');
    expect(markup).toContain("No recent missions yet.");
    expect(markup).toContain("Start from the composer to create one.");
    expect(markup).toContain("Open composer");
  });

  it("renders interactive and static list rows with shared shell row semantics", () => {
    const interactiveMarkup = renderToStaticMarkup(
      <ListRow
        title="Review ready"
        description="Open the latest validation summary."
        leading={<span>!</span>}
        trailing={<span>Open</span>}
        onClick={() => undefined}
      />
    );
    const staticMarkup = renderToStaticMarkup(
      <ListRow title="Background sync" description="Idle until the next refresh window." />
    );

    expect(interactiveMarkup).toContain("<button");
    expect(interactiveMarkup).toContain('data-list-row="true"');
    expect(interactiveMarkup).toContain("Review ready");
    expect(interactiveMarkup).toContain("Open the latest validation summary.");
    expect(interactiveMarkup).toContain("Open");
    expect(staticMarkup).toContain("<div");
    expect(staticMarkup).toContain("Background sync");
  });

  it("sources shared shell fallback tokens from component theme semantics", () => {
    const shellSource = readFileSync(new URL("./Shell.css.ts", import.meta.url), "utf8");

    expect(shellSource).toContain('from "../themeSemantics"');
    expect(shellSource).toContain("componentThemeVars.surface");
    expect(shellSource).toContain("componentThemeVars.emptyState");
    expect(shellSource).toContain("componentThemeVars.sectionHeader");
  });
});
