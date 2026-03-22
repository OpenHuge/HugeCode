// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../index";

describe("Badge", () => {
  it("keeps the promoted badge wrapper consumable through @ku0/ui", () => {
    render(<Badge variant="warning">Needs attention</Badge>);

    const badge = screen.getByText("Needs attention");
    expect(badge.getAttribute("data-tone")).toBe("warning");
    expect(badge.getAttribute("data-shape")).toBe("pill");
    expect(badge.getAttribute("data-size")).toBe("sm");
  });
});
