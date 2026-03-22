/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { ApprovalRequest, ConversationItem } from "../../types";
import { RightPanelInspectorProvider, useRightPanelInspector } from "./RightPanelInspectorContext";
import { ThreadRightPanelDetails } from "./ThreadRightPanelDetails";

afterEach(() => {
  cleanup();
});

function SelectionRegistrar({
  onReady,
  children,
}: {
  onReady: (selectItem: ReturnType<typeof useRightPanelInspector>["selectItem"]) => void;
  children: ReactNode;
}) {
  const { selectItem } = useRightPanelInspector();

  useEffect(() => {
    onReady(selectItem);
  }, [onReady, selectItem]);

  return children;
}

function SelectionStatus() {
  const { selection } = useRightPanelInspector();
  return (
    <div data-testid="selection-status">
      {selection ? `${selection.kind}:${selection.itemId}` : "none"}
    </div>
  );
}

describe("ThreadRightPanelDetails", () => {
  it("renders the v2 tool detail view with evidence sections", async () => {
    const items: ConversationItem[] = [
      {
        id: "tool-1",
        kind: "tool",
        toolType: "exec",
        title: "Run validation",
        detail: "pnpm validate:fast",
        status: "completed",
        output: "All checks passed",
        changes: [{ path: "apps/code/src/App.tsx", kind: "modified" }],
      },
    ];

    let selectItem: ReturnType<typeof useRightPanelInspector>["selectItem"] | null = null;

    render(
      <RightPanelInspectorProvider scopeKey="tool-detail">
        <SelectionRegistrar
          onReady={(nextSelectItem) => {
            selectItem = nextSelectItem;
          }}
        >
          <ThreadRightPanelDetails
            section="detail"
            items={items}
            threadId="thread-1"
            workspaceLoadError={null}
            selectedDiffPath={null}
            gitDiffs={[]}
            turnDiff={null}
            approvalRequests={[]}
            userInputRequests={[]}
            toolCallRequests={[]}
          />
        </SelectionRegistrar>
      </RightPanelInspectorProvider>
    );

    act(() => {
      selectItem?.("tool", "tool-1");
    });

    expect(await screen.findByText("Tool execution")).toBeTruthy();
    expect(screen.getByText("Invocation")).toBeTruthy();
    expect(screen.getByText("Changed files")).toBeTruthy();
    expect(screen.getByText("apps/code/src/App.tsx")).toBeTruthy();
  });

  it("renders the v2 approval interrupt view", () => {
    const approvalRequests: ApprovalRequest[] = [
      {
        workspace_id: "workspace-web",
        request_id: "approval-1",
        method: "shell.exec",
        params: { command: ["pnpm", "validate:fast"] },
      },
    ];

    render(
      <RightPanelInspectorProvider scopeKey="approval-detail">
        <ThreadRightPanelDetails
          section="interrupt"
          items={[]}
          threadId="thread-1"
          workspaceLoadError={null}
          selectedDiffPath={null}
          gitDiffs={[]}
          turnDiff={null}
          approvalRequests={approvalRequests}
          userInputRequests={[]}
          toolCallRequests={[]}
        />
      </RightPanelInspectorProvider>
    );

    expect(screen.getByText("Approval queue")).toBeTruthy();
    expect(screen.getByText("Approval detail")).toBeTruthy();
    expect(screen.getByText("command")).toBeTruthy();
    expect(screen.getByText("pnpm, validate:fast")).toBeTruthy();
  });

  it("falls back to the selected diff path when no timeline item is explicitly selected", () => {
    render(
      <RightPanelInspectorProvider scopeKey="no-selection">
        <ThreadRightPanelDetails
          section="detail"
          items={[]}
          threadId="thread-1"
          workspaceLoadError={null}
          selectedDiffPath="apps/code/src/App.tsx"
          gitDiffs={[
            {
              path: "apps/code/src/App.tsx",
              status: "modified",
              diff: "@@ -1 +1 @@",
            },
          ]}
          turnDiff={null}
          approvalRequests={[]}
          userInputRequests={[]}
          toolCallRequests={[]}
        />
      </RightPanelInspectorProvider>
    );

    expect(screen.getByText("File focus")).toBeTruthy();
    expect(screen.getByText("App.tsx")).toBeTruthy();
    expect(screen.getByText("Context diff selection")).toBeTruthy();
  });

  it("falls back to the latest inspectable timeline item when nothing is selected", () => {
    render(
      <RightPanelInspectorProvider scopeKey="latest-item">
        <ThreadRightPanelDetails
          section="detail"
          items={[
            {
              id: "tool-1",
              kind: "tool",
              toolType: "exec",
              title: "Run lint",
              detail: "pnpm lint",
              status: "completed",
              output: "lint clean",
            },
            {
              id: "review-1",
              kind: "review",
              state: "completed",
              text: "Ship the cleaner right-rail shell.",
            },
          ]}
          threadId="thread-1"
          workspaceLoadError={null}
          selectedDiffPath={null}
          gitDiffs={[]}
          turnDiff={null}
          approvalRequests={[]}
          userInputRequests={[]}
          toolCallRequests={[]}
        />
      </RightPanelInspectorProvider>
    );

    expect(screen.getByText("Review note")).toBeTruthy();
    expect(screen.getByText("Diff review")).toBeTruthy();
    expect(screen.getAllByText("Ship the cleaner right-rail shell.")).toHaveLength(2);
  });

  it("replaces stale timeline selections with the latest inspectable item after refresh", async () => {
    let selectItem: ReturnType<typeof useRightPanelInspector>["selectItem"] | null = null;

    const { rerender } = render(
      <RightPanelInspectorProvider scopeKey="stale-selection">
        <SelectionRegistrar
          onReady={(nextSelectItem) => {
            selectItem = nextSelectItem;
          }}
        >
          <SelectionStatus />
          <ThreadRightPanelDetails
            section="detail"
            items={[
              {
                id: "tool-1",
                kind: "tool",
                toolType: "exec",
                title: "Run lint",
                detail: "pnpm lint",
                status: "completed",
                output: "lint clean",
              },
            ]}
            threadId="thread-1"
            workspaceLoadError={null}
            selectedDiffPath={null}
            gitDiffs={[]}
            turnDiff={null}
            approvalRequests={[]}
            userInputRequests={[]}
            toolCallRequests={[]}
          />
        </SelectionRegistrar>
      </RightPanelInspectorProvider>
    );

    act(() => {
      selectItem?.("tool", "tool-1");
    });

    expect(screen.getByTestId("selection-status").textContent).toBe("tool:tool-1");

    rerender(
      <RightPanelInspectorProvider scopeKey="stale-selection">
        <SelectionRegistrar
          onReady={(nextSelectItem) => {
            selectItem = nextSelectItem;
          }}
        >
          <SelectionStatus />
          <ThreadRightPanelDetails
            section="detail"
            items={[
              {
                id: "review-1",
                kind: "review",
                state: "completed",
                text: "Inspect the latest diff output.",
              },
            ]}
            threadId="thread-1"
            workspaceLoadError={null}
            selectedDiffPath={null}
            gitDiffs={[]}
            turnDiff={null}
            approvalRequests={[]}
            userInputRequests={[]}
            toolCallRequests={[]}
          />
        </SelectionRegistrar>
      </RightPanelInspectorProvider>
    );

    expect(await screen.findByText("Review note")).toBeTruthy();
    expect(screen.getByTestId("selection-status").textContent).toBe("review:review-1");
    expect(screen.getAllByText("Inspect the latest diff output.").length).toBeGreaterThan(0);
  });
});
