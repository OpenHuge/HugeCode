// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineActionRow, MetadataList, MetadataRow } from "../index";

describe("Rows", () => {
  it("stays consumable as a promoted row and metadata family through @ku0/ui", () => {
    render(
      <MetadataList aria-label="Runtime metadata">
        <MetadataRow label="Launch readiness" value="Nominal" />
        <MetadataRow label="Backend" value="desktop-runtime-us-west" />
      </MetadataList>
    );

    expect(screen.getByLabelText("Runtime metadata")).toBeTruthy();
    expect(screen.getByText("Launch readiness")).toBeTruthy();
    expect(screen.getByText("desktop-runtime-us-west")).toBeTruthy();
  });

  it("keeps inline action rows readable through @ku0/ui", () => {
    render(
      <InlineActionRow
        label="Checkpoint replay"
        description="Resume the last verified handoff."
        action={<button type="button">Replay</button>}
      />
    );

    expect(screen.getByText("Checkpoint replay")).toBeTruthy();
    expect(screen.getByText("Resume the last verified handoff.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replay" })).toBeTruthy();
  });
});
