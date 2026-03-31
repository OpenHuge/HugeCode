/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListRow, ShellFrame, ShellSection, ShellToolbar, SplitPanel } from "./ShellPrimitives";

describe("ShellPrimitives", () => {
  it("keeps shared shell and split-panel semantics through the app-owned shell grammar surface", () => {
    const markup = renderToStaticMarkup(
      <ShellFrame className="custom-shell-frame" tone="elevated" padding="lg">
        <ShellToolbar
          className="custom-shell-toolbar"
          leading={<span>Scope</span>}
          trailing={<button type="button">Refresh</button>}
        >
          <span>Filters</span>
        </ShellToolbar>
        <ShellSection
          className="custom-shell-section"
          headerClassName="custom-shell-header"
          titleClassName="custom-shell-title"
          bodyClassName="custom-shell-body"
          title="Mission signals"
          meta="Mission control live"
        >
          <div>Section body</div>
        </ShellSection>
        <SplitPanel
          className="custom-split-panel"
          leading={<nav aria-label="Shell sections">Sections</nav>}
          trailing={<section aria-label="Shell detail">Detail</section>}
        />
      </ShellFrame>
    );

    expect(markup).toContain("app-shell-frame");
    expect(markup).toContain("app-shell-toolbar");
    expect(markup).toContain("app-shell-section");
    expect(markup).toContain("app-shell-section-header");
    expect(markup).toContain("app-shell-section-title");
    expect(markup).toContain("app-shell-section-body");
    expect(markup).toContain("app-split-panel");
    expect(markup).toContain('data-shell-frame="true"');
    expect(markup).toContain('data-shell-toolbar="true"');
    expect(markup).toContain('data-shell-section="true"');
    expect(markup).toContain('data-split-panel="true"');
    expect(markup).toContain("Scope");
    expect(markup).toContain("Mission signals");
    expect(markup).toContain("Shell sections");
  });

  it("keeps list-row semantics through the app-owned shell grammar surface", () => {
    const markup = renderToStaticMarkup(
      <ListRow
        className="custom-list-row"
        title="Browser verification"
        description="Latest extraction candidate"
      />
    );

    expect(markup).toContain("app-list-row");
    expect(markup).toContain("custom-list-row");
    expect(markup).toContain('data-list-row="true"');
    expect(markup).toContain("Browser verification");
  });
});
