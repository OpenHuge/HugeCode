/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRequest } from "../../../types";
import type { TimelineStatusBanner } from "../utils/timelineSurface";
import { TimelineStatusBannerPanel } from "./MessageTimelinePanels";
import { TimelineApprovalPanel } from "./TimelineApprovalPanel";

afterEach(() => {
  cleanup();
});

const request: ApprovalRequest = {
  workspace_id: "ws-1",
  request_id: 42,
  method: "exec_command",
  params: { cmd: ["git", "status"] },
};

describe("MessageTimelinePanels", () => {
  it("preserves status banner action buttons after migrating to the app design-system adapter", () => {
    const onAction = vi.fn();
    const banner: TimelineStatusBanner = {
      title: "Runtime offline",
      body: "Reconnect the runtime.",
      tone: "runtime",
      actionLabel: "Open settings",
    };

    render(<TimelineStatusBannerPanel banner={banner} onAction={onAction} />);

    expect(screen.getByTestId("timeline-status-banner").getAttribute("data-artifact-kind")).toBe(
      "status-banner"
    );
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("preserves approval actions after migrating to the app design-system adapter", () => {
    const onDecision = vi.fn();
    const onRemember = vi.fn();

    render(
      <TimelineApprovalPanel
        request={request}
        onDecision={onDecision}
        onRemember={onRemember}
        interactive
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
