// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RightPanelCollapseButton,
  RightPanelExpandButton,
  type SidebarToggleProps,
} from "./SidebarToggleControls";

function createProps(overrides: Partial<SidebarToggleProps> = {}): SidebarToggleProps {
  return {
    isCompact: false,
    sidebarCollapsed: false,
    rightPanelCollapsed: false,
    onCollapseSidebar: vi.fn(),
    onExpandSidebar: vi.fn(),
    onCollapseRightPanel: vi.fn(),
    onExpandRightPanel: vi.fn(),
    ...overrides,
  };
}

describe("RightPanelCollapseButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders hide action when right panel is expanded", () => {
    const props = createProps({ rightPanelCollapsed: false });
    render(<RightPanelCollapseButton {...props} />);

    const button = screen.getByRole("button", { name: "Hide context rail" }) as HTMLButtonElement;
    expect(button.type).toBe("button");
    fireEvent.click(button);

    expect(props.onCollapseRightPanel).toHaveBeenCalledTimes(1);
    expect(props.onExpandRightPanel).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("does not render in the header when right panel is collapsed", () => {
    const props = createProps({ rightPanelCollapsed: true });
    render(<RightPanelCollapseButton {...props} />);

    expect(screen.queryByRole("button", { name: "Show context rail" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hide context rail" })).toBeNull();
  });

  it("renders the detached show action when the right panel is collapsed", () => {
    const props = createProps({ rightPanelCollapsed: true });
    render(<RightPanelExpandButton {...props} />);

    const button = screen.getByRole("button", { name: "Show context rail" }) as HTMLButtonElement;
    expect(button.type).toBe("button");
    fireEvent.click(button);

    expect(props.onExpandRightPanel).toHaveBeenCalledTimes(1);
  });

  it("does not render in compact layouts", () => {
    const props = createProps({ isCompact: true });
    render(
      <>
        <RightPanelCollapseButton {...props} />
        <RightPanelExpandButton {...props} />
      </>
    );

    expect(screen.queryByRole("button", { name: "Hide context rail" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show context rail" })).toBeNull();
  });
});
