// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("wraps plain text triggers so focus and hover still work", () => {
    render(<Tooltip content="Launch mission">Open runtime</Tooltip>);

    const textNode = screen.getByText("Open runtime");
    const trigger = textNode.closest("span");

    expect(trigger).toBeTruthy();
    expect(trigger?.getAttribute("tabindex")).toBe("0");
    expect(screen.queryByRole("tooltip")).toBeNull();

    if (!trigger) {
      throw new Error("Expected tooltip wrapper span");
    }

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip").textContent).toContain("Launch mission");

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
