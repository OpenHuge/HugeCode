/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Select } from "./Select";

afterEach(() => {
  cleanup();
});

describe("Select adapter", () => {
  it("forwards compact density and placeholder state through the app adapter", () => {
    const { container } = render(
      <Select
        ariaLabel="Priority"
        triggerDensity="compact"
        options={[{ value: "p1", label: "Urgent" }]}
        placeholder="Select priority"
      />
    );

    const trigger = screen.getByRole("button", { name: "Priority" }) as HTMLButtonElement;

    expect(trigger.type).toBe("button");
    expect(trigger.getAttribute("data-placeholder")).toBe("true");
    expect(container.querySelector('[data-trigger-density="compact"]')).not.toBeNull();
  });

  it("forwards selected-value state through the app adapter", () => {
    render(
      <Select
        ariaLabel="Priority"
        triggerDensity="compact"
        options={[{ value: "p1", label: "Urgent" }]}
        value="p1"
      />
    );

    const trigger = screen.getByRole("button", { name: "Priority" }) as HTMLButtonElement;

    expect(trigger.getAttribute("data-placeholder")).toBe("false");
    expect(trigger.getAttribute("data-has-value")).toBe("true");
    expect(trigger.textContent).toContain("Urgent");
  });
});
