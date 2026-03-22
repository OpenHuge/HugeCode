import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DialogButton,
  Dialog,
  DialogDescription,
  DialogDivider,
  DialogError,
  DialogFooter,
  DialogHeader,
  DialogInput,
  DialogLabel,
  DialogLabelText,
  DialogTextarea,
  DialogTitle,
  PanelFrame,
  PanelNavItem,
  PanelSearchField,
  ToastBody,
  ToastCard,
  ToastTitle,
  ToastViewport,
} from "../index";

describe("shared chrome primitives", () => {
  it("exports a shared dialog primitive with overlay markers", () => {
    const markup = renderToStaticMarkup(
      <Dialog open={true} onOpenChange={() => undefined} ariaLabel="Shared dialog">
        <DialogHeader>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>Dialog body</DialogDescription>
        </DialogHeader>
        <DialogLabel htmlFor="dialog-input">Name</DialogLabel>
        <DialogInput id="dialog-input" value="Alpha" readOnly />
        <DialogLabelText>Notes</DialogLabelText>
        <DialogTextarea value="Ready" readOnly />
        <DialogDivider />
        <DialogError>Needs review</DialogError>
        <DialogFooter>
          <DialogButton size="sm">Close</DialogButton>
        </DialogFooter>
      </Dialog>
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-label="Shared dialog"');
    expect(markup).toContain("ds-modal");
    expect(markup).toContain("ds-modal-backdrop");
    expect(markup).toContain("ds-modal-card");
    expect(markup).toContain("ds-modal-title");
    expect(markup).toContain("ds-modal-subtitle");
    expect(markup).toContain("ds-modal-label");
    expect(markup).toContain("ds-modal-input");
    expect(markup).toContain("ds-modal-textarea");
    expect(markup).toContain("ds-modal-divider");
    expect(markup).toContain("ds-modal-error");
    expect(markup).toContain("ds-modal-actions");
    expect(markup).toContain("ds-modal-button");
    expect(markup).toContain('data-overlay-root="dialog"');
    expect(markup).toContain('data-overlay-phase="backdrop"');
    expect(markup).toContain('data-overlay-phase="surface"');
    expect(markup).toContain(">Dialog title<");
    expect(markup).toContain(">Dialog body<");
    expect(markup).toContain(">Needs review<");
  });

  it("exports shared panel primitives through the root barrel", () => {
    const markup = renderToStaticMarkup(
      <PanelFrame>
        <PanelSearchField aria-label="Search files" placeholder="Search files" />
        <PanelNavItem active showDisclosure>
          Workspace
        </PanelNavItem>
      </PanelFrame>
    );

    expect(markup).toContain(" ds-panel");
    expect(markup).toContain(" ds-panel-search");
    expect(markup).toContain(" ds-panel-search-input");
    expect(markup).toContain(" ds-panel-nav-item");
    expect(markup).toContain(" ds-panel-nav-item-main");
    expect(markup).toContain(" ds-panel-nav-item-label");
    expect(markup).toContain(" ds-panel-nav-item-disclosure");
    expect(markup).toContain('type="search"');
    expect(markup).toContain('aria-label="Search files"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain(">Workspace<");
  });

  it("exports shared toast primitives through the root barrel", () => {
    const markup = renderToStaticMarkup(
      <ToastViewport role="region" ariaLive="polite">
        <ToastCard role="status">
          <ToastTitle>Saved</ToastTitle>
          <ToastBody>Changes synced</ToastBody>
        </ToastCard>
      </ToastViewport>
    );

    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain(">Saved<");
    expect(markup).toContain(">Changes synced<");
  });

  it("sources shared panel and toast component tokens from theme semantics", () => {
    const panelSource = readFileSync(new URL("./Panel.css.ts", import.meta.url), "utf8");
    const toastSource = readFileSync(new URL("./Toast.css.ts", import.meta.url), "utf8");

    expect(panelSource).toContain('from "../themeSemantics"');
    expect(panelSource).toContain("componentThemeVars.panel");
    expect(toastSource).toContain('from "../themeSemantics"');
    expect(toastSource).toContain("componentThemeVars.toast");
  });
});
