/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DynamicToolCallRequest } from "../../../types";
import { ToolCallRequestMessage } from "./ToolCallRequestMessage";

const request: DynamicToolCallRequest = {
  workspace_id: "ws-1",
  request_id: 12,
  params: {
    thread_id: "thread-1",
    turn_id: "turn-1",
    call_id: "call-1",
    tool: "web.search",
    arguments: {
      q: "Button migration status",
    },
  },
};

describe("ToolCallRequestMessage", () => {
  it("submits output through a non-submit app design-system button", () => {
    const onSubmit = vi.fn();

    render(
      <ToolCallRequestMessage
        requests={[request]}
        activeThreadId="thread-1"
        activeWorkspaceId="ws-1"
        onSubmit={onSubmit}
      />
    );

    const submitButton = screen.getByRole("button", { name: "Submit output" });
    expect((submitButton as HTMLButtonElement).type).toBe("button");

    fireEvent.change(screen.getByLabelText("Tool call output"), {
      target: { value: "ok" },
    });
    expect(
      screen.getByText("Uncheck this if the tool failed or should return an error outcome.")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Mark call successful" }));
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith(request, {
      contentItems: [{ type: "inputText", text: "ok" }],
      success: false,
    });
  });
});
