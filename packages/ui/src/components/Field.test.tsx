// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field, Input } from "../index";

describe("Field", () => {
  it("stays consumable as a promoted public primitive through @ku0/ui", () => {
    render(
      <Field
        label="Thread title"
        htmlFor="thread-title"
        description="Shown in the mission list and review queue."
        errorMessage="Thread title is required."
      >
        <Input id="thread-title" value="" onChange={() => undefined} />
      </Field>
    );

    expect(screen.getByLabelText("Thread title")).toBeTruthy();
    expect(screen.getByText("Shown in the mission list and review queue.")).toBeTruthy();
    expect(screen.getByText("Thread title is required.")).toBeTruthy();
  });
});
