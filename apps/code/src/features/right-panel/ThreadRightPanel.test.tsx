/** @vitest-environment jsdom */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getExportedStyleBlock, readRelativeSource } from "../../test/styleSource";
import {
  type RightPanelSelectionKind,
  RightPanelInspectorProvider,
  useRightPanelInspector,
} from "./RightPanelInspectorContext";
import { ThreadRightPanel } from "./ThreadRightPanel";

afterEach(() => {
  cleanup();
});

function SelectionButton({
  selection,
}: {
  selection: {
    kind: RightPanelSelectionKind;
    itemId: string;
  } | null;
}) {
  const inspector = useRightPanelInspector();
  return (
    <button
      type="button"
      onClick={() => {
        if (!selection) {
          inspector.clearSelection();
          return;
        }
        inspector.selectItem(selection.kind, selection.itemId);
      }}
    >
      Select item
    </button>
  );
}

describe("ThreadRightPanel", () => {
  it("defaults to the diff tab when a diff surface is available", () => {
    render(
      <ThreadRightPanel
        interruptNode={null}
        detailNode={null}
        gitNode={<div data-testid="git-node">git</div>}
        filesNode={<div data-testid="files-node">files</div>}
        promptsNode={null}
        planNode={<div data-testid="plan-node">plan</div>}
        diffNode={<div data-testid="diff-node">diff</div>}
        hasDiffContent
        hasActivePlan
        hasDetailContent={false}
      />
    );

    expect(screen.getByRole("tab", { name: "Diff" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("diff-node")).toBeTruthy();
    expect(screen.queryByTestId("git-node")).toBeNull();
    expect(screen.getByTestId("right-panel-primary-artifact").dataset.artifactMode).toBe("diff");
  });

  it("keeps all four rail tabs visible while avoiding an automatic jump into loading diff content", () => {
    render(
      <ThreadRightPanel
        interruptNode={null}
        detailNode={null}
        gitNode={<div data-testid="git-node">git</div>}
        filesNode={<div data-testid="files-node">files</div>}
        promptsNode={null}
        planNode={null}
        diffNode={<div data-testid="diff-placeholder">Loading diff...</div>}
        hasDiffContent={false}
        hasActivePlan={false}
        hasDetailContent={false}
      />
    );

    expect(screen.getByRole("tab", { name: "Diff" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Git" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Context" })).toBeTruthy();
    expect(screen.getByTestId("git-node")).toBeTruthy();
    expect(screen.queryByTestId("diff-placeholder")).toBeNull();
  });

  it("defaults to git when diff is unavailable and keeps the tab visible across empty states", () => {
    const { rerender } = render(
      <ThreadRightPanel
        interruptNode={null}
        detailNode={null}
        gitNode={<div data-testid="git-node">git</div>}
        filesNode={<div data-testid="files-node">files</div>}
        promptsNode={null}
        planNode={null}
        diffNode={null}
        hasActivePlan={false}
        hasDetailContent={false}
      />
    );

    expect(screen.getByRole("tab", { name: "Git" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("git-node")).toBeTruthy();

    rerender(
      <ThreadRightPanel
        interruptNode={null}
        detailNode={null}
        gitNode={null}
        filesNode={<div data-testid="files-node">files</div>}
        promptsNode={null}
        planNode={null}
        diffNode={null}
        hasActivePlan={false}
        hasDetailContent={false}
      />
    );

    expect(screen.getByRole("tab", { name: "Git" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Git details unavailable")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy();
  });

  it("opens the context tab when the shared plan-panel event is dispatched", () => {
    render(
      <ThreadRightPanel
        interruptNode={null}
        detailNode={null}
        gitNode={<div data-testid="git-node">git</div>}
        filesNode={null}
        promptsNode={<div data-testid="prompts-node">prompts</div>}
        planNode={<div data-testid="plan-node">plan</div>}
        diffNode={<div data-testid="diff-node">diff</div>}
        hasDiffContent
        hasActivePlan
        hasDetailContent={false}
      />
    );

    expect(screen.getByRole("tab", { name: "Diff" }).getAttribute("aria-selected")).toBe("true");

    act(() => {
      window.dispatchEvent(new Event("hugecode:show-plan-panel"));
    });

    expect(screen.getByRole("tab", { name: "Context" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("plan-node")).toBeTruthy();
    expect(screen.getByTestId("prompts-node")).toBeTruthy();
  });

  it("switches to the context tab when a timeline selection becomes active", async () => {
    render(
      <RightPanelInspectorProvider scopeKey="selection-context">
        <SelectionButton selection={{ kind: "tool", itemId: "tool-1" }} />
        <ThreadRightPanel
          interruptNode={null}
          detailNode={<div data-testid="detail-node">detail</div>}
          gitNode={<div data-testid="git-node">git</div>}
          filesNode={null}
          promptsNode={null}
          planNode={null}
          diffNode={<div data-testid="diff-node">diff</div>}
          hasActivePlan={false}
          hasDetailContent
        />
      </RightPanelInspectorProvider>
    );

    act(() => {
      screen.getByRole("button", { name: "Select item" }).click();
    });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Context" }).getAttribute("aria-selected")).toBe(
        "true"
      );
    });
    expect(screen.getByTestId("detail-node")).toBeTruthy();
    expect(screen.queryByTestId("diff-node")).toBeNull();
  });

  it("keeps the diff tab active while surfacing blocking runtime state in a dedicated strip", () => {
    render(
      <ThreadRightPanel
        interruptNode={<div data-testid="interrupt-node">interrupt</div>}
        detailNode={null}
        gitNode={<div data-testid="git-node">git</div>}
        filesNode={<div data-testid="files-node">files</div>}
        promptsNode={null}
        planNode={null}
        diffNode={<div data-testid="diff-node">diff</div>}
        hasDiffContent
        hasActivePlan={false}
        hasDetailContent={false}
      />
    );

    expect(screen.getByRole("tab", { name: "Diff" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("interrupt-node")).toBeTruthy();
    expect(screen.getByTestId("right-panel-interrupt-strip")).toBeTruthy();
  });

  it("exposes the context tab when fallback detail content exists without an explicit selection", () => {
    render(
      <ThreadRightPanel
        interruptNode={null}
        detailNode={<div data-testid="detail-node">detail</div>}
        gitNode={null}
        filesNode={null}
        promptsNode={null}
        planNode={null}
        diffNode={null}
        hasActivePlan={false}
        hasDetailContent
      />
    );

    expect(screen.getByRole("tab", { name: "Context" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("detail-node")).toBeTruthy();
  });

  it("keeps the four-tab rail IA visible even before context content exists", () => {
    render(
      <ThreadRightPanel
        interruptNode={null}
        detailNode={null}
        gitNode={<div>git</div>}
        filesNode={<div>files</div>}
        promptsNode={null}
        planNode={null}
        diffNode={null}
        hasActivePlan={false}
        hasDetailContent={false}
      />
    );

    expect(screen.getByRole("tab", { name: "Diff" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Git" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Context" })).toBeTruthy();
  });

  it("caps the top-level rail IA at four tabs and removes legacy rail tabs", () => {
    render(
      <ThreadRightPanel
        interruptNode={<div>interrupt</div>}
        detailNode={<div>details</div>}
        gitNode={<div>git</div>}
        filesNode={<div>files</div>}
        promptsNode={<div>prompts</div>}
        planNode={<div>plan</div>}
        diffNode={<div>diff</div>}
        hasDiffContent
        hasActivePlan
        hasDetailContent
      />
    );

    expect(screen.getByRole("tab", { name: "Diff" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Git" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Files" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Context" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Action" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Plan" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Details" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Changes" })).toBeNull();
  });

  it("creates unique tab and panel ids per panel instance and keeps aria-controls resolvable", () => {
    const { container } = render(
      <>
        <ThreadRightPanel
          interruptNode={null}
          detailNode={null}
          gitNode={<div>git</div>}
          filesNode={<div>files</div>}
          promptsNode={<div>prompts</div>}
          planNode={<div>plan</div>}
          diffNode={<div>diff</div>}
          hasDiffContent
          hasActivePlan
          hasDetailContent
        />
        <ThreadRightPanel
          interruptNode={null}
          detailNode={null}
          gitNode={<div>git</div>}
          filesNode={<div>files</div>}
          promptsNode={<div>prompts</div>}
          planNode={<div>plan</div>}
          diffNode={<div>diff</div>}
          hasDiffContent
          hasActivePlan
          hasDetailContent
        />
      </>
    );

    const diffTabs = screen.getAllByRole("tab", { name: "Diff" });
    expect(diffTabs).toHaveLength(2);
    expect(diffTabs[0]?.id).not.toBe(diffTabs[1]?.id);

    diffTabs.forEach((tab) => {
      const panelId = tab.getAttribute("aria-controls");
      expect(panelId).toBeTruthy();
      expect(container.querySelector(`#${panelId}`)).toBeTruthy();
    });
  });

  it("keeps the right-panel shell visually distinct from the primary thread surface", () => {
    const source = readRelativeSource(import.meta.dirname, "RightPanelPrimitives.css.ts");
    const shellRule = getExportedStyleBlock(source, "shell");
    const topBarRule = getExportedStyleBlock(source, "topBar");

    expect(shellRule).toContain("borderLeft:");
    expect(shellRule).toContain('backdropFilter: "blur(14px) saturate(1.04)"');
    expect(topBarRule).toContain('position: "sticky"');
    expect(topBarRule).toContain("top: 0");
  });
});
