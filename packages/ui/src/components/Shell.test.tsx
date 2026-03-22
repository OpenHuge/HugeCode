// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptySurface, ShellFrame, ShellSection, ShellToolbar } from "../index";

describe("Shell", () => {
  it("keeps shared shell primitives consumable through @ku0/ui", () => {
    render(
      <ShellFrame role="region" aria-label="Workspace shell" tone="elevated" padding="lg">
        <ShellToolbar leading={<span>Scope</span>} trailing={<button type="button">Sync</button>}>
          <span>Filters</span>
        </ShellToolbar>
        <ShellSection title="Mission signals" meta="Review ready">
          <EmptySurface title="No missions" body="Start from the composer." />
        </ShellSection>
      </ShellFrame>
    );

    expect(screen.getByRole("region", { name: "Workspace shell" })).toBeTruthy();
    expect(screen.getByText("Scope")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sync" })).toBeTruthy();
    expect(screen.getByText("Mission signals")).toBeTruthy();
    expect(screen.getByText("Review ready")).toBeTruthy();
    expect(screen.getByText("No missions")).toBeTruthy();
  });
});
