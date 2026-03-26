// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DebugRuntimeProbesSection,
  type DebugRuntimeProbesSectionProps,
} from "./DebugRuntimeProbesSection";

function createProps(overrides: Partial<DebugRuntimeProbesSectionProps> = {}) {
  return {
    isRuntimeProbeBusy: false,
    runtimeProbeBusyLabel: null,
    runtimeProbeError: null,
    runtimeProbeResult: null,
    liveSkillId: "core-bash",
    liveSkillInput: "pwd",
    liveSkillPath: ".",
    liveSkillQuery: "",
    liveSkillMaxDepth: "2",
    liveSkillMaxResults: "10",
    liveSkillIncludeHidden: false,
    isCoreTreeSkillSelected: false,
    onLiveSkillIdChange: vi.fn(),
    onLiveSkillInputChange: vi.fn(),
    onLiveSkillPathChange: vi.fn(),
    onLiveSkillQueryChange: vi.fn(),
    onLiveSkillMaxDepthChange: vi.fn(),
    onLiveSkillMaxResultsChange: vi.fn(),
    onLiveSkillIncludeHiddenChange: vi.fn(),
    onRunHealthProbe: vi.fn(),
    onRunToolMetricsProbe: vi.fn(),
    onRunRemoteStatusProbe: vi.fn(),
    onRunTerminalStatusProbe: vi.fn(),
    onRunSettingsProbe: vi.fn(),
    onRunBootstrapProbe: vi.fn(),
    onRunToolLifecycleProbe: vi.fn(),
    onRunLiveSkillProbe: vi.fn(),
    ...overrides,
  };
}

describe("DebugRuntimeProbesSection", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders core-tree controls only when the core-tree skill is selected", () => {
    const { rerender } = render(
      <DebugRuntimeProbesSection {...createProps({ isCoreTreeSkillSelected: false })} />
    );

    expect(screen.queryByLabelText("Live skill path")).toBeNull();

    rerender(<DebugRuntimeProbesSection {...createProps({ isCoreTreeSkillSelected: true })} />);

    expect(screen.getByLabelText("Live skill path")).toBeTruthy();
    expect(screen.getByLabelText("Live skill max depth")).toBeTruthy();
    expect(screen.getByLabelText("Live skill include hidden")).toBeTruthy();
  });

  it("wires actions, field changes, and status output", () => {
    const props = createProps({
      isCoreTreeSkillSelected: true,
      runtimeProbeBusyLabel: "health",
      runtimeProbeError: "probe failed",
      runtimeProbeResult: '{"ok":true}',
    });

    render(<DebugRuntimeProbesSection {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Health" }));
    fireEvent.click(screen.getByRole("button", { name: "Metrics" }));
    fireEvent.click(screen.getByRole("button", { name: "Lifecycle" }));
    fireEvent.click(screen.getByRole("button", { name: "Run skill" }));
    fireEvent.change(screen.getByLabelText("Live skill id"), { target: { value: "core-tree" } });
    fireEvent.change(screen.getByLabelText("Live skill input"), { target: { value: "list" } });
    fireEvent.change(screen.getByLabelText("Live skill path"), { target: { value: "src" } });
    fireEvent.change(screen.getByLabelText("Live skill query"), { target: { value: "debug" } });
    fireEvent.change(screen.getByLabelText("Live skill max depth"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Live skill max results"), { target: { value: "20" } });
    fireEvent.click(screen.getByLabelText("Live skill include hidden"));

    expect(props.onRunHealthProbe).toHaveBeenCalledTimes(1);
    expect(props.onRunToolMetricsProbe).toHaveBeenCalledTimes(1);
    expect(props.onRunToolLifecycleProbe).toHaveBeenCalledTimes(1);
    expect(props.onRunLiveSkillProbe).toHaveBeenCalledTimes(1);
    expect(props.onLiveSkillIdChange).toHaveBeenCalledWith("core-tree");
    expect(props.onLiveSkillInputChange).toHaveBeenCalledWith("list");
    expect(props.onLiveSkillPathChange).toHaveBeenCalledWith("src");
    expect(props.onLiveSkillQueryChange).toHaveBeenCalledWith("debug");
    expect(props.onLiveSkillMaxDepthChange).toHaveBeenCalledWith("4");
    expect(props.onLiveSkillMaxResultsChange).toHaveBeenCalledWith("20");
    expect(props.onLiveSkillIncludeHiddenChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("debug-runtime-probe-status").textContent).toContain(
      "Running health..."
    );
    expect(screen.getByTestId("debug-runtime-probe-error").textContent).toBe("probe failed");
    expect(screen.getByTestId("debug-runtime-probe-result").textContent).toContain('"ok"');
  });

  it("disables interactive controls while a probe is running", () => {
    render(<DebugRuntimeProbesSection {...createProps({ isRuntimeProbeBusy: true })} />);

    expect(screen.getByRole("button", { name: "Health" }).getAttribute("disabled")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Run skill" }).getAttribute("disabled")
    ).not.toBeNull();
    expect(screen.getByLabelText("Live skill id").getAttribute("disabled")).not.toBeNull();
    expect(screen.getByLabelText("Live skill input").getAttribute("disabled")).not.toBeNull();
  });
});
