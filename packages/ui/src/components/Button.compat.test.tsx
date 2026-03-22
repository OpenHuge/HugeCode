// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Input } from "./Input";

describe("@ku0/ui compatibility wrappers", () => {
  it("maps legacy destructive aliases onto shared button variants", () => {
    render(<Button variant="destructive">Delete</Button>);

    expect(screen.getByRole("button", { name: "Delete" }).getAttribute("data-variant")).toBe(
      "danger"
    );
  });

  it("keeps the legacy onChange and helper/error props wired through the shared input", () => {
    const onChange = vi.fn();
    render(
      <Input
        label="Workspace"
        helperText="Used in stories"
        onChange={onChange}
        placeholder="name"
      />
    );

    fireEvent.change(screen.getByLabelText("Workspace"), { target: { value: "next" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Used in stories")).toBeTruthy();
  });
});
