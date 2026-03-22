// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("keeps legacy label and error props wired through the shared primitive", () => {
    const onValueChange = vi.fn();
    render(
      <Select
        label="Shared select"
        error="Pick one"
        options={[
          { value: "alpha", label: "Alpha" },
          { value: "beta", label: "Beta" },
        ]}
        value="alpha"
        onValueChange={onValueChange}
      />
    );

    const trigger = screen.getByRole("button", { name: "Shared select" });

    expect(trigger.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Pick one")).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox", { name: "Shared select" })).toBeTruthy();
  });

  it("supports legacy uncontrolled defaultValue plus onChange wiring", () => {
    const onChange = vi.fn();

    render(
      <Select
        ariaLabel="Fruit"
        defaultValue="alpha"
        options={[
          { value: "alpha", label: "Alpha" },
          { value: "beta", label: "Beta" },
        ]}
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("button", { name: "Fruit" });
    expect(trigger.textContent).toContain("Alpha");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: /Beta/i }));

    expect(onChange).toHaveBeenCalledWith("beta");
    expect(screen.getByRole("button", { name: "Fruit" }).textContent).toContain("Beta");
  });
});
