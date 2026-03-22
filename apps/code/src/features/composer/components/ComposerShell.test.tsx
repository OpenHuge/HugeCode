/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComposerProps } from "./Composer.types";
import { flushLazyBoundary } from "../../../test/asyncTestUtils";
import { Composer } from "./Composer";

function createComposerProps(overrides: Partial<ComposerProps> = {}): ComposerProps {
  return {
    onSend: vi.fn(),
    onQueue: vi.fn(),
    onStop: vi.fn(),
    canStop: false,
    disabled: false,
    isProcessing: false,
    steerEnabled: false,
    collaborationModes: [],
    selectedCollaborationModeId: null,
    onSelectCollaborationMode: vi.fn(),
    models: [],
    selectedModelId: null,
    onSelectModel: vi.fn(),
    reasoningOptions: [],
    selectedEffort: null,
    onSelectEffort: vi.fn(),
    reasoningSupported: false,
    accessMode: "on-request",
    onSelectAccessMode: vi.fn(),
    executionOptions: [{ value: "runtime", label: "Runtime" }],
    selectedExecutionMode: "runtime",
    onSelectExecutionMode: vi.fn(),
    skills: [],
    prompts: [],
    files: [],
    queuedMessages: [],
    draftText: "",
    onDraftChange: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("Composer shell scaffold", () => {
  it("renders the composer through frame and toolbar markers", () => {
    render(<Composer {...createComposerProps()} />);

    expect(document.querySelector('[data-composer-frame="true"]')).toBeTruthy();
    expect(document.querySelector('[data-composer-toolbar="true"]')).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Composer draft" })).toBeTruthy();
  });

  it("wraps pending user-input chrome in scaffold markers without changing the footer actions", async () => {
    render(
      <Composer
        {...createComposerProps({
          onPendingUserInputSubmit: vi.fn(),
          pendingUserInputRequest: {
            workspace_id: "ws-1",
            request_id: 7,
            params: {
              thread_id: "thread-1",
              turn_id: "turn-1",
              item_id: "item-1",
              questions: [
                {
                  id: "approval_mode",
                  header: "Mode",
                  question: "Choose a mode",
                  options: [
                    { label: "Safe", description: "Safer route." },
                    { label: "Fast", description: "Faster route." },
                  ],
                },
              ],
            },
          },
        })}
      />
    );

    await flushLazyBoundary();

    const pendingPanel = document.querySelector('[data-composer-pending-panel="true"]');
    expect(pendingPanel).toBeTruthy();
    expect(within(pendingPanel as HTMLElement).getByText("Choose a mode")).toBeTruthy();

    const actionRail = document.querySelector('[data-composer-action-rail="true"]');
    expect(actionRail).toBeTruthy();
    expect(
      within(actionRail as HTMLElement).getByRole("button", { name: "Submit answers" })
    ).toBeTruthy();
  });

  it("renders queue and workspace footer through scaffold markers when both surfaces are present", async () => {
    const workspace = {
      id: "workspace-1",
      name: "Workspace 1",
      path: "/tmp/workspace-1",
      connected: true,
      kind: "main" as const,
    };

    render(
      <Composer
        {...createComposerProps({
          queuedMessages: [{ id: "queued-1", text: "Run checks", createdAt: 1, images: [] }],
          workspaceControls: {
            mode: "worktree",
            branchLabel: "feature/free-figma",
            currentBranch: "feature/free-figma",
            branchTriggerLabel: "feature/free-figma",
            repositoryWorkspace: workspace,
            activeWorkspace: workspace,
            workspaces: [workspace],
            onSelectGitWorkflowSelection: vi.fn(),
          },
        })}
      />
    );

    await flushLazyBoundary();

    const footerBar = document.querySelector('[data-composer-footer-bar="true"]');
    expect(document.querySelector('[data-composer-queue-panel="true"]')).toBeTruthy();
    const workspaceFooter = document.querySelector('[data-composer-workspace-footer="true"]');
    expect(workspaceFooter).toBeTruthy();
    expect(footerBar?.contains(workspaceFooter as HTMLElement) ?? false).toBe(false);
    expect(within(workspaceFooter as HTMLElement).getByText("Local")).toBeTruthy();
  });

  it("keeps workspace footer pills on the same muted surface recipe", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "ComposerWorkspaceBar.css.ts"),
      "utf8"
    );

    expect(source).toContain(
      '"color-mix(in srgb, var(--ds-surface-raised) 88%, var(--ds-surface-floating) 12%)"'
    );
    expect(source).toContain('minHeight: "28px"');
    expect(source).toContain('minHeight: "30px"');
    expect(source).toContain('gap: "6px"');
  });
});
