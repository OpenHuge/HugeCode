// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "../index";

describe("StatusBadge", () => {
  it("keeps semantic status tone mapping available through @ku0/ui", () => {
    render(<StatusBadge tone="warning">Needs review</StatusBadge>);

    const badge = screen.getByText("Needs review");
    expect(badge.getAttribute("data-status-tone")).toBe("warning");
    expect(badge.getAttribute("data-tone")).toBe("warning");
    expect(badge.getAttribute("data-shape")).toBe("chip");
  });
});
