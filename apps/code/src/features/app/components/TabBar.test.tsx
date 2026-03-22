import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("TabBar", () => {
  it("marks mission and review tabs unavailable and routes tap to workspaces without workspace", () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();

    render(<TabBar activeTab="home" hasActiveWorkspace={false} onSelect={onSelect} />);

    const missionsButton = screen.getByRole("button", { name: "Missions" });
    const reviewButton = screen.getByRole("button", { name: "Review" });
    const homeButton = screen.getByRole("button", { name: "Home" });

    expect(missionsButton.getAttribute("data-gated")).toBe("true");
    expect(reviewButton.getAttribute("data-gated")).toBe("true");
    expect(homeButton.getAttribute("data-gated")).toBeNull();
    expect(missionsButton.querySelector(".tabbar-lock")).toBeTruthy();
    expect(reviewButton.querySelector(".tabbar-lock")).toBeTruthy();
    expect(homeButton.querySelector(".tabbar-lock")).toBeNull();
    expect(missionsButton.getAttribute("title")).toBe(
      "Select or connect a workspace to use this tab."
    );
    expect(reviewButton.getAttribute("title")).toBe(
      "Select or connect a workspace to use this tab."
    );

    fireEvent.click(missionsButton);
    expect(onSelect).toHaveBeenCalledWith("workspaces");
    expect(screen.getByRole("status").textContent).toContain(
      "Select or connect a workspace to use this tab."
    );

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("resets the gated hint timeout when users tap gated tabs repeatedly", () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();

    render(<TabBar activeTab="home" hasActiveWorkspace={false} onSelect={onSelect} />);

    const missionsButton = screen.getByRole("button", { name: "Missions" });
    const reviewButton = screen.getByRole("button", { name: "Review" });

    fireEvent.click(missionsButton);
    expect(screen.getByRole("status")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    fireEvent.click(reviewButton);
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByRole("status")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(onSelect).toHaveBeenNthCalledWith(1, "workspaces");
    expect(onSelect).toHaveBeenNthCalledWith(2, "workspaces");
  });

  it("keeps tabs interactive when workspace is active", () => {
    const onSelect = vi.fn();

    render(<TabBar activeTab="home" hasActiveWorkspace onSelect={onSelect} />);

    const missionsButton = screen.getByRole("button", { name: "Missions" });
    expect(missionsButton.getAttribute("data-gated")).toBeNull();
    expect(missionsButton.getAttribute("title")).toBeNull();

    fireEvent.click(missionsButton);
    expect(onSelect).toHaveBeenCalledWith("missions");
  });
});
