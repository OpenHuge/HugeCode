// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Switch } from "../index";

describe("Switch", () => {
  it("keeps shared switch primitives consumable through @ku0/ui", () => {
    render(
      <Switch
        label="Enable live supervision"
        description="Runs checks while the task is active"
        checked
        onCheckedChange={() => undefined}
      />
    );

    expect(screen.getByRole("switch", { name: "Enable live supervision" })).toBeTruthy();
    expect(screen.getByText("Runs checks while the task is active")).toBeTruthy();
  });
});
