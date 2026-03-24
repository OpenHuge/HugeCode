// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSecondaryNodes } from "./buildSecondaryNodes";
import {
  createLayoutNodesOptions,
  type LayoutNodesFieldRegistry,
  type LayoutNodesOptions,
} from "./types";

function createSecondaryOptions(
  overrides: Partial<LayoutNodesFieldRegistry> = {}
): LayoutNodesOptions {
  return createLayoutNodesOptions({
    activeThreadId: null,
    activeItems: [],
    isProcessing: false,
    isPhone: false,
    rightPanelCollapsed: false,
    plan: null,
    terminalOpen: false,
    terminalState: null,
    terminalTabs: [],
    activeTerminalId: null,
    onSelectTerminal: vi.fn(),
    onNewTerminal: vi.fn(),
    onCloseTerminal: vi.fn(),
    onClearTerminal: vi.fn(),
    onRestartTerminal: vi.fn(),
    onInterruptTerminal: vi.fn(),
    canClearTerminal: false,
    canRestartTerminal: false,
    canInterruptTerminal: false,
    onResizeTerminal: vi.fn(),
    debugEntries: [],
    debugOpen: false,
    activeWorkspaceId: null,
    onClearDebug: vi.fn(),
    onCopyDebug: vi.fn(),
    workspaceLoadError: null,
    selectedDiffPath: null,
    gitDiffs: [],
    turnDiffByThread: {},
    approvals: [],
    userInputRequests: [],
    toolCallRequests: [],
    centerMode: "chat",
    onBackFromDiff: vi.fn(),
    onShowSelectedDiff: vi.fn(),
    onGoProjects: vi.fn(),
    ...overrides,
  } as unknown as LayoutNodesFieldRegistry);
}

describe("buildSecondaryNodes compact empty CTAs", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps compact empty actions on button semantics", () => {
    const onGoProjects = vi.fn();
    const options = createSecondaryOptions({ onGoProjects });
    const nodes = buildSecondaryNodes(options);

    render(
      <div>
        {nodes.compactEmptyCodexNode}
        {nodes.compactEmptyGitNode}
      </div>
    );

    const buttons = screen.getAllByRole("button", { name: "Open Projects" }) as HTMLButtonElement[];

    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => {
      expect(button.type).toBe("button");
      fireEvent.click(button);
    });

    expect(onGoProjects).toHaveBeenCalledTimes(2);
  });

  it("does not mount a placeholder detail shell when the right rail has no inspectable detail content", () => {
    const nodes = buildSecondaryNodes(createSecondaryOptions());

    expect(nodes.hasRightPanelDetailContent).toBe(false);
    expect(nodes.rightPanelDetailsNode).toBeNull();
  });

  it("mounts the detail rail node only when inspectable detail content exists", () => {
    const nodes = buildSecondaryNodes(
      createSecondaryOptions({
        activeThreadId: "thread-1",
        selectedDiffPath: "apps/code/src/App.tsx",
        gitDiffs: [
          {
            path: "apps/code/src/App.tsx",
            status: "modified",
            diff: "@@ -1 +1 @@",
          },
        ],
      })
    );

    expect(nodes.hasRightPanelDetailContent).toBe(true);
    expect(nodes.rightPanelDetailsNode).toBeTruthy();
  });
});
