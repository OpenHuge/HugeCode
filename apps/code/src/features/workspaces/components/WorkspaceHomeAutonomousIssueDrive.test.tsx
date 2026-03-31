// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceHomeAutonomousIssueDrive } from "./WorkspaceHomeAutonomousIssueDrive";

describe("WorkspaceHomeAutonomousIssueDrive", () => {
  it("starts disabled until an issue URI is provided, then renders the launch summary", async () => {
    const driveIssue = vi.fn(async () => ({
      issue: {
        number: 42,
        title: "Ship autonomous issue drive",
        url: "https://github.com/acme/hugecode/issues/42",
        updatedAt: "2026-03-30T00:00:00.000Z",
      },
      preview: {
        title: "Issue follow-up preview",
        state: "ready" as const,
        summary: "GitHub issue #42 is ready on the governed runtime path.",
        blockedReason: null,
        fields: [
          {
            id: "launch" as const,
            label: "Launch",
            value: "balanced-delegate",
            detail: "on-request · single · validation standard",
          },
        ],
      },
    }));

    render(
      <WorkspaceHomeAutonomousIssueDrive
        launchAllowed
        runtimeLoading={false}
        repositoryExecutionContractStatus="ready"
        driveIssue={driveIssue}
      />
    );

    const button = screen.getByRole("button", { name: "Drive issue" });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("GitHub issue URI"), {
      target: {
        value: "https://github.com/acme/hugecode/issues/42",
      },
    });

    expect((button as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      fireEvent.click(button);
    });

    expect(driveIssue).toHaveBeenCalledWith("https://github.com/acme/hugecode/issues/42");
    expect(screen.getByText("Issue follow-up preview")).toBeTruthy();
    expect(
      screen.getByText("GitHub issue #42 is ready on the governed runtime path.")
    ).toBeTruthy();
    expect(screen.getByText(/Launch: balanced-delegate/)).toBeTruthy();
  });

  it("blocks issue drive when governed launch preflight is not ready", async () => {
    const driveIssue = vi.fn();

    render(
      <WorkspaceHomeAutonomousIssueDrive
        launchAllowed
        runtimeLoading={false}
        repositoryExecutionContractStatus="loading"
        driveIssue={driveIssue}
      />
    );

    fireEvent.change(screen.getByLabelText("GitHub issue URI"), {
      target: {
        value: "https://github.com/acme/hugecode/issues/42",
      },
    });

    expect(screen.getByRole("button", { name: "Drive issue" })).toHaveProperty("disabled", true);
    expect(
      screen.getByText(
        "GitHub source launch is waiting for repository execution defaults to finish loading."
      )
    ).toBeTruthy();
    expect(driveIssue).not.toHaveBeenCalled();
  });
});
