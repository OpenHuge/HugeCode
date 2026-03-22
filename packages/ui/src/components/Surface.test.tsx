// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Surface } from "../index";

describe("Surface", () => {
  it("stays consumable as a promoted shared surface through @ku0/ui", () => {
    render(
      <Surface role="region" aria-label="Translucent panel" tone="translucent" padding="lg">
        Overlay-ready content
      </Surface>
    );

    expect(screen.getByRole("region", { name: "Translucent panel" })).toBeTruthy();
    expect(screen.getByText("Overlay-ready content")).toBeTruthy();
  });
});
