// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebugPanelViewModel } from "../hooks/useDebugPanelViewModel";
import { createDebugEntries, createDebugPanelViewModel } from "../test/debugPanelComponentFixtures";
import { DebugPanel } from "./DebugPanel";

vi.mock("../hooks/useDebugPanelViewModel", () => ({
  useDebugPanelViewModel: vi.fn(),
}));

vi.mock("./DebugPanelShell", () => ({
  DebugPanelShell: (props: { diagnosticsExportStatus: string | null; children: ReactNode }) => (
    <section data-testid="debug-panel-shell">
      <span data-testid="debug-panel-shell-status">{props.diagnosticsExportStatus}</span>
      {props.children}
    </section>
  ),
}));

vi.mock("./DebugPanelBody", () => ({
  DebugPanelBody: (props: { runtimeProbeBusyLabel: string | null }) => (
    <div data-testid="debug-panel-body">{props.runtimeProbeBusyLabel}</div>
  ),
}));

const useDebugPanelViewModelMock = vi.mocked(useDebugPanelViewModel);

describe("DebugPanel", () => {
  beforeEach(() => {
    useDebugPanelViewModelMock.mockReturnValue(createDebugPanelViewModel());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("passes incoming props to the debug panel view model", () => {
    const entries = createDebugEntries();
    const onClear = vi.fn();
    const onCopy = vi.fn();
    const onResizeStart = vi.fn();

    render(
      <DebugPanel
        entries={entries}
        isOpen
        workspaceId="workspace-1"
        onClear={onClear}
        onCopy={onCopy}
        onResizeStart={onResizeStart}
        variant="full"
      />
    );

    expect(useDebugPanelViewModelMock).toHaveBeenCalledWith({
      entries,
      isOpen: true,
      workspaceId: "workspace-1",
      onClear,
      onCopy,
      onResizeStart,
      variant: "full",
    });
  });

  it("renders shell and body with the composed view model props", () => {
    render(<DebugPanel entries={createDebugEntries()} isOpen onClear={vi.fn()} onCopy={vi.fn()} />);

    expect(screen.getByTestId("debug-panel-shell-status").textContent).toBe("ready");
    expect(screen.getByTestId("debug-panel-body").textContent).toBe("idle");
  });

  it("returns null when the view model marks the panel hidden", () => {
    useDebugPanelViewModelMock.mockReturnValue(
      createDebugPanelViewModel({
        isVisible: false,
        shellProps: {
          isOpen: false,
          diagnosticsExportSupported: false,
          diagnosticsExportCapabilityResolved: false,
          diagnosticsExportStatus: null,
        },
        bodyProps: {
          isOpen: false,
          observabilityCapabilityEnabled: false,
          runtimeProbeBusyLabel: null,
        },
      })
    );

    const { container } = render(
      <DebugPanel
        entries={createDebugEntries()}
        isOpen={false}
        onClear={vi.fn()}
        onCopy={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
