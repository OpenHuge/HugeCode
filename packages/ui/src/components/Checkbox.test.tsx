// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "../index";

describe("Checkbox", () => {
  it("keeps shared checkbox semantics consumable through @ku0/ui", () => {
    render(
      <Checkbox
        label="Enable live supervision"
        description="Runs checks while the task is active"
        checked
        onCheckedChange={() => undefined}
      />
    );

    expect(screen.getByLabelText("Enable live supervision")).toBeTruthy();
    expect(screen.getByText("Runs checks while the task is active")).toBeTruthy();
  });
});
