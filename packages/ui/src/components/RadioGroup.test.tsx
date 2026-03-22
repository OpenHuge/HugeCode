// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadioGroup } from "../index";

describe("RadioGroup", () => {
  it("keeps shared radio-group primitives consumable through @ku0/ui", () => {
    render(
      <RadioGroup
        ariaLabel="Execution path"
        value="remote"
        options={[
          { value: "local", label: "Local runtime" },
          { value: "remote", label: "Remote runtime" },
        ]}
      />
    );

    expect(screen.getByRole("radiogroup", { name: "Execution path" })).toBeTruthy();
    expect(screen.getByLabelText("Remote runtime")).toBeTruthy();
  });
});
