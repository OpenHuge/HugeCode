// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AcpBackendEditorDialog } from "./AcpBackendEditorDialog";
import { createEmptyAcpBackendFormState } from "./acpBackendForm";

describe("AcpBackendEditorDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders through settings grammar without legacy field wrappers", () => {
    const draft = createEmptyAcpBackendFormState();

    render(
      <AcpBackendEditorDialog
        open
        mode="add"
        draft={draft}
        onClose={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Add ACP backend" });

    expect(dialog.querySelector('[data-settings-footer-bar="true"]')).toBeTruthy();
    expect(dialog.querySelector(".settings-field-label")).toBeNull();
    expect(dialog.querySelector(".settings-field-row")).toBeNull();
    expect(dialog.querySelector(".settings-field-actions")).toBeNull();
  });

  it("disables submit and shows the validation message for invalid stdio environment entries", () => {
    const draft = {
      ...createEmptyAcpBackendFormState(),
      envEntries: [{ id: "env-1", key: "API_KEY", value: "" }],
    };

    render(
      <AcpBackendEditorDialog
        open
        mode="add"
        draft={draft}
        onClose={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getAllByText('Environment key "API_KEY" is missing a value.').length).toBe(2);
    expect(screen.getByRole("button", { name: "Add ACP backend" }).hasAttribute("disabled")).toBe(
      true
    );
  });

  it("keeps probe controls disabled when probe is unavailable", () => {
    const draft = createEmptyAcpBackendFormState();

    render(
      <AcpBackendEditorDialog
        open
        mode="edit"
        draft={{ ...draft, integrationId: "agent-a" }}
        onClose={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onProbe={vi.fn()}
        probeEnabled={false}
      />
    );

    expect(screen.getByRole("button", { name: "Probe now" }).hasAttribute("disabled")).toBe(true);
  });
});
