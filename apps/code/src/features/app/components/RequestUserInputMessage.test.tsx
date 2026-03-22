/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RequestUserInputRequest } from "../../../types";
import { RequestUserInputMessage } from "./RequestUserInputMessage";

afterEach(() => {
  cleanup();
});

const request: RequestUserInputRequest = {
  workspace_id: "ws-1",
  request_id: 7,
  params: {
    thread_id: "thread-1",
    turn_id: "turn-1",
    item_id: "item-1",
    questions: [
      {
        id: "approval_mode",
        header: "Mode",
        question: "Choose how to continue.",
        options: [
          { label: "Safe path", description: "Keep the stricter route." },
          { label: "Fast path", description: "Use the quicker route." },
        ],
      },
    ],
  },
};

describe("RequestUserInputMessage", () => {
  it("submits the selected answer through the app design-system button adapter", () => {
    const onSubmit = vi.fn();

    render(
      <RequestUserInputMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: "Fast path" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(onSubmit).toHaveBeenCalledWith(request, {
      answers: {
        approval_mode: {
          answers: ["Fast path"],
        },
      },
    });
  });
});
