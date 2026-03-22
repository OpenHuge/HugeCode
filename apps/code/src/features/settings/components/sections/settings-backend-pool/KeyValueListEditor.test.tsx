// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeyValueListEditor } from "./KeyValueListEditor";

describe("KeyValueListEditor", () => {
  it("renders the empty state and adds a new entry", () => {
    const onChange = vi.fn();

    render(
      <KeyValueListEditor
        entries={[]}
        emptyState="No environment overrides configured."
        addLabel="Add environment variable"
        keyLabel="Environment key"
        valueLabel="Environment value"
        onChange={onChange}
      />
    );

    expect(screen.getByText("No environment overrides configured.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add environment variable" }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: expect.stringMatching(/^kv-/),
        key: "",
        value: "",
      }),
    ]);
  });

  it("removes an existing entry", () => {
    const onChange = vi.fn();

    render(
      <KeyValueListEditor
        entries={[{ id: "env-1", key: "API_KEY", value: "secret" }]}
        emptyState="No environment overrides configured."
        addLabel="Add environment variable"
        keyLabel="Environment key"
        valueLabel="Environment value"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove environment key 1" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("renders validation issues for the matching entry", () => {
    render(
      <KeyValueListEditor
        entries={[{ id: "env-1", key: "API_KEY", value: "" }]}
        emptyState="No environment overrides configured."
        addLabel="Add environment variable"
        keyLabel="Environment key"
        valueLabel="Environment value"
        validationIssues={[
          {
            entryId: "env-1",
            field: "value",
            message: 'Environment key "API_KEY" is missing a value.',
          },
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Environment key "API_KEY" is missing a value.')).toBeTruthy();
  });
});
