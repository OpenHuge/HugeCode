/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as projectDesignSystem from "./index";
import {
  ActivityLogRow,
  compactModalCard,
  CoreLoopHeader,
  CoreLoopMetaRail,
  CoreLoopSection,
  CoreLoopStatePanel,
  DiffReviewPanel,
  EmptySurface,
  ExecutionStatusPill,
  formatExecutionStatusLabel,
  InlineActionRow,
  MetadataList,
  MetadataRow,
  ModalShell,
  PanelFrame,
  PanelNavItem,
  PanelSearchField,
  PopoverMenuItem,
  PopoverSurface,
  ReviewActionRail,
  ReviewEvidenceList,
  ReviewLoopHeader,
  ReviewLoopSection,
  ReviewSignalGroup,
  ReviewSummaryCard,
  resolveExecutionStatusPresentation,
  ShellFrame,
  ShellSection,
  ShellToolbar,
  SplitPanel,
  Textarea,
  ToastActions,
  ToastBody,
  ToastCard,
  ToastTitle,
  ToastViewport,
  ToolCallChip,
  WorkspaceChromePill,
  WorkspaceHeaderAction,
  WorkspaceMenuSection,
  WorkspaceSupportMeta,
} from "./index";

describe("app design-system project coverage", () => {
  it("exposes modal, panel, shell adapters, normalized compat bridges, core-loop grammar, review-loop grammar, row/meta, toast, and execution primitives through the root barrel", () => {
    expect([
      ActivityLogRow,
      compactModalCard,
      CoreLoopHeader,
      CoreLoopMetaRail,
      CoreLoopSection,
      CoreLoopStatePanel,
      DiffReviewPanel,
      EmptySurface,
      ExecutionStatusPill,
      formatExecutionStatusLabel,
      InlineActionRow,
      MetadataList,
      MetadataRow,
      ModalShell,
      PanelFrame,
      PanelNavItem,
      PanelSearchField,
      PopoverMenuItem,
      PopoverSurface,
      ReviewActionRail,
      ReviewEvidenceList,
      ReviewLoopHeader,
      ReviewLoopSection,
      ReviewSignalGroup,
      ReviewSummaryCard,
      resolveExecutionStatusPresentation,
      ShellFrame,
      ShellSection,
      ShellToolbar,
      SplitPanel,
      Textarea,
      ToastActions,
      ToastBody,
      ToastCard,
      ToastTitle,
      ToastViewport,
      ToolCallChip,
      WorkspaceChromePill,
      WorkspaceHeaderAction,
      WorkspaceMenuSection,
      WorkspaceSupportMeta,
    ]).toHaveLength(41);
    expect(compactModalCard.length).toBeGreaterThan(0);
    expect(formatExecutionStatusLabel("in_progress")).toBe("In progress");
    expect(resolveExecutionStatusPresentation("review_ready")).toEqual({
      label: "Review ready",
      tone: "success",
    });
  });

  it("renders project-scenario primitives from the root barrel", () => {
    render(
      <>
        <ModalShell ariaLabel="Project coverage dialog">
          <PanelFrame>
            <PanelSearchField aria-label="Search files" placeholder="Search files" />
            <PanelNavItem active>Workspace</PanelNavItem>
            <DiffReviewPanel title="Review diff" files={[{ path: "src/app.tsx", status: "M" }]} />
          </PanelFrame>
        </ModalShell>
        <ShellFrame className="project-shell-frame">
          <ShellToolbar leading={<span>Scope</span>} trailing={<button type="button">Sync</button>}>
            <span>Filters</span>
          </ShellToolbar>
          <ShellSection title="Mission signals" meta="Mission control live">
            <EmptySurface title="No missions" body="Start from the home composer." />
          </ShellSection>
          <MetadataList aria-label="Mission metadata">
            <MetadataRow label="Route" value="Default backend" />
            <MetadataRow label="State" value="Review ready" />
          </MetadataList>
          <InlineActionRow
            label="Review Pack"
            description="Open the latest summary"
            action={<button type="button">Open review</button>}
          />
        </ShellFrame>
        <PopoverSurface role="menu" aria-label="Workspace actions">
          <PopoverMenuItem role="menuitem">Rename workspace</PopoverMenuItem>
        </PopoverSurface>
        <SplitPanel
          className="project-split-panel"
          leading={<nav aria-label="Project sections">Sections</nav>}
          trailing={<section aria-label="Project detail">Detail view</section>}
        />
        <WorkspaceMenuSection label="Workspace menu">
          <WorkspaceChromePill aria-label="Branch" label="main" />
          <WorkspaceHeaderAction aria-label="Toggle terminal" segment="icon" />
          <WorkspaceSupportMeta label="Live" />
        </WorkspaceMenuSection>
        <CoreLoopHeader
          eyebrow="Core loop"
          title="Conversation"
          description="Timeline, composer, and runtime list share the same calm dense rhythm."
        />
        <CoreLoopSection
          title="Thread state"
          description="Loading and empty states use the shared panel grammar."
        >
          <CoreLoopMetaRail>
            <WorkspaceSupportMeta label="timeline" />
          </CoreLoopMetaRail>
          <CoreLoopStatePanel
            eyebrow="New thread"
            title="Start a task"
            description="Describe the work, attach context, and launch the agent."
            steps={[
              { id: "describe-task", label: "Describe the task" },
              { id: "attach-context", label: "Attach context" },
              { id: "pick-mode", label: "Pick execution mode" },
            ]}
          />
        </CoreLoopSection>
        <ReviewLoopHeader
          eyebrow="Review loop"
          title="Mission triage"
          description="Runtime-backed review detail stays observable."
          signals={<ReviewSignalGroup>Signals</ReviewSignalGroup>}
        />
        <ReviewLoopSection title="Summary" description="Operator-facing summary">
          <ReviewSummaryCard label="Needs action" value="2" detail="Approval blocked" />
          <ReviewActionRail>
            <button type="button">Open review</button>
          </ReviewActionRail>
          <ReviewEvidenceList
            items={[
              { id: "trace", label: "Trace", detail: "trace-runtime-1" },
              { id: "checkpoint", label: "Checkpoint", detail: "checkpoint-runtime-1" },
            ]}
          />
        </ReviewLoopSection>
        <ToastViewport role="region" ariaLive="polite">
          <ToastCard role="status">
            <ToastTitle>Saved</ToastTitle>
            <ToastBody>Changes synced</ToastBody>
            <ToastActions>
              <button type="button">Dismiss</button>
            </ToastActions>
          </ToastCard>
        </ToastViewport>
        <Textarea aria-label="Operator notes" defaultValue="Track the next runtime handoff." />
        <ActivityLogRow
          title="Tool call"
          meta={<ExecutionStatusPill tone="success">Complete</ExecutionStatusPill>}
          actions={<ToolCallChip tone="neutral">shell</ToolCallChip>}
        />
      </>
    );

    expect(screen.getByRole("dialog", { name: "Project coverage dialog" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Project coverage dialog" }).className).toContain(
      "app-dialog-root"
    );
    expect(screen.getByRole("searchbox", { name: "Search files" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Workspace" })).toBeTruthy();
    expect(screen.getByText("Review diff")).toBeTruthy();
    expect(screen.getByText("Mission signals")).toBeTruthy();
    expect(screen.getByText("Scope")).toBeTruthy();
    expect(screen.getByText("No missions")).toBeTruthy();
    expect(screen.getByLabelText("Mission metadata")).toBeTruthy();
    expect(screen.getByText("Default backend")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Open review" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Project sections")).toBeTruthy();
    expect(screen.getByLabelText("Project detail")).toBeTruthy();
    expect(screen.getByRole("menu", { name: "Workspace actions" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Rename workspace" })).toBeTruthy();
    expect(screen.getByText("Workspace menu")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Branch" })).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Conversation")).toBeTruthy();
    expect(screen.getByText("Thread state")).toBeTruthy();
    expect(screen.getByText("Start a task")).toBeTruthy();
    expect(screen.getByText("Mission triage")).toBeTruthy();
    expect(screen.getByText("Needs action")).toBeTruthy();
    expect(screen.getByText("trace-runtime-1")).toBeTruthy();
    expect(screen.getByRole("region", { name: "" })).toBeTruthy();
    expect(screen.getByText("Changes synced")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Operator notes" })).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
    expect(screen.getByText("shell")).toBeTruthy();
    expect(document.querySelector(".app-panel-frame")).toBeTruthy();
    expect(document.querySelector(".app-shell-frame")).toBeTruthy();
    expect(document.querySelector(".app-shell-section")).toBeTruthy();
    expect(document.querySelector(".app-shell-toolbar")).toBeTruthy();
    expect(document.querySelector(".app-split-panel")).toBeTruthy();
  });

  it("keeps the root barrel free of theme and token family exports", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        process.cwd().endsWith(`${sep}apps${sep}code`)
          ? "src/design-system/index.ts"
          : "apps/code/src/design-system/index.ts"
      ),
      "utf8"
    );
    const exportedKeys = Object.keys(projectDesignSystem);

    expect(source).toContain("Temporary migration compatibility barrel");
    expect(source).toContain(
      "Do not add new visual primitives, token families, or component families here."
    );
    expect(source).toContain('from "@ku0/design-system";');
    expect(source).not.toContain("export { Dialog,");
    expect(source).not.toContain("export { PanelFrame,");
    expect(source).not.toContain("export { ShellFrame,");
    expect(exportedKeys).not.toContain("semanticThemeVars");
    expect(exportedKeys).not.toContain("componentThemeVars");
    expect(exportedKeys).not.toContain("executionThemeVars");
    expect(exportedKeys).not.toContain("themeValues");
    expect(source).not.toContain("themeSemantics");
    expect(source).not.toContain("themeValues");
  });
});
