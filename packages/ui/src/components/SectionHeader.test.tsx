// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "../index";

describe("SectionHeader", () => {
  it("stays consumable as a promoted shared header primitive through @ku0/ui", () => {
    render(
      <SectionHeader
        title="Launch readiness"
        meta="Blocked"
        actions={<button type="button">Inspect</button>}
      />
    );

    expect(screen.getByText("Launch readiness")).toBeTruthy();
    expect(screen.getByText("Blocked")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inspect" })).toBeTruthy();
  });
});
