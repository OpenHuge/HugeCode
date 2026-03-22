/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRequest } from "../../../types";
import { ComposerApprovalActions } from "./ComposerApprovalActions";

afterEach(() => {
  cleanup();
});

const request: ApprovalRequest = {
  workspace_id: "ws-1",
  request_id: 1,
  method: "exec_command",
  params: { cmd: ["git", "status"] },
};

describe("ComposerApprovalActions", () => {
  it("preserves approval button behavior after migrating to the app design-system adapter", () => {
    const onDecision = vi.fn();
    const onRemember = vi.fn();

    render(
      <ComposerApprovalActions
        request={request}
        commandTokens={["git", "status"]}
        onDecision={onDecision}
        onRemember={onRemember}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Always allow" }));
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(onRemember).toHaveBeenCalledWith(request, ["git", "status"]);
    expect(onDecision).toHaveBeenNthCalledWith(1, request, "decline");
    expect(onDecision).toHaveBeenNthCalledWith(2, request, "accept");
  });
});
