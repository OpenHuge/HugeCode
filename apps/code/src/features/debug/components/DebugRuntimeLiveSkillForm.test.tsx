// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DebugRuntimeLiveSkillForm } from "./DebugRuntimeLiveSkillForm";
import type { DebugRuntimeLiveSkillFormProps } from "./DebugRuntimeProbes.types";

function createProps(overrides: Partial<DebugRuntimeLiveSkillFormProps> = {}) {
  return {
    isRuntimeProbeBusy: false,
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
    onRunLiveSkillProbe: vi.fn(),
    ...overrides,
  };
}

describe("DebugRuntimeLiveSkillForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders core-tree options only for the core-tree skill", () => {
    const { rerender } = render(
      <DebugRuntimeLiveSkillForm {...createProps({ isCoreTreeSkillSelected: false })} />
    );

    expect(screen.queryByLabelText("Live skill path")).toBeNull();

    rerender(<DebugRuntimeLiveSkillForm {...createProps({ isCoreTreeSkillSelected: true })} />);

    expect(screen.getByLabelText("Live skill path")).toBeTruthy();
    expect(screen.getByLabelText("Live skill query")).toBeTruthy();
    expect(screen.getByLabelText("Live skill max depth")).toBeTruthy();
    expect(screen.getByLabelText("Live skill max results")).toBeTruthy();
    expect(screen.getByLabelText("Live skill include hidden")).toBeTruthy();
  });

  it("wires field changes and run action", () => {
    const props = createProps({ isCoreTreeSkillSelected: true });

    render(<DebugRuntimeLiveSkillForm {...props} />);

    fireEvent.change(screen.getByLabelText("Live skill id"), { target: { value: "core-tree" } });
    fireEvent.change(screen.getByLabelText("Live skill input"), { target: { value: "list" } });
    fireEvent.change(screen.getByLabelText("Live skill path"), { target: { value: "src" } });
    fireEvent.change(screen.getByLabelText("Live skill query"), { target: { value: "debug" } });
    fireEvent.change(screen.getByLabelText("Live skill max depth"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Live skill max results"), { target: { value: "20" } });
    fireEvent.click(screen.getByLabelText("Live skill include hidden"));
    fireEvent.click(screen.getByRole("button", { name: "Run skill" }));

    expect(props.onLiveSkillIdChange).toHaveBeenCalledWith("core-tree");
    expect(props.onLiveSkillInputChange).toHaveBeenCalledWith("list");
    expect(props.onLiveSkillPathChange).toHaveBeenCalledWith("src");
    expect(props.onLiveSkillQueryChange).toHaveBeenCalledWith("debug");
    expect(props.onLiveSkillMaxDepthChange).toHaveBeenCalledWith("4");
    expect(props.onLiveSkillMaxResultsChange).toHaveBeenCalledWith("20");
    expect(props.onLiveSkillIncludeHiddenChange).toHaveBeenCalledWith(true);
    expect(props.onRunLiveSkillProbe).toHaveBeenCalledTimes(1);
  });
});
