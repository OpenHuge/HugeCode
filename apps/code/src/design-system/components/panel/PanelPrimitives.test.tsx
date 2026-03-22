/** @vitest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PanelFrame,
  PanelHeader,
  PanelMeta,
  PanelNavItem,
  PanelNavList,
  PanelSearchField,
} from "./PanelPrimitives";

describe("PanelPrimitives", () => {
  it("keeps shared panel semantics through the app-owned panel grammar surface", () => {
    const markup = renderToStaticMarkup(
      <PanelFrame className="custom-frame">
        <PanelHeader className="custom-header">
          Workspace
          <PanelMeta className="custom-meta">Live</PanelMeta>
        </PanelHeader>
        <PanelSearchField
          aria-label="Search files"
          placeholder="Search files"
          className="custom-search"
          inputClassName="custom-search-input"
        />
        <PanelNavList className="custom-nav-list">
          <PanelNavItem active showDisclosure className="custom-nav-item">
            Files
          </PanelNavItem>
        </PanelNavList>
      </PanelFrame>
    );

    expect(markup).toContain("app-panel-frame");
    expect(markup).toContain("app-panel-header");
    expect(markup).toContain("app-panel-meta");
    expect(markup).toContain("app-panel-search");
    expect(markup).toContain("app-panel-search-input");
    expect(markup).toContain("app-panel-nav-list");
    expect(markup).toContain("app-panel-nav-item");
    expect(markup).toContain("ds-panel");
    expect(markup).toContain("ds-panel-header");
    expect(markup).toContain("ds-panel-meta");
    expect(markup).toContain("ds-panel-search");
    expect(markup).toContain("ds-panel-nav");
    expect(markup).toContain("ds-panel-nav-item");
    expect(markup).toContain(">Files<");
  });
});
