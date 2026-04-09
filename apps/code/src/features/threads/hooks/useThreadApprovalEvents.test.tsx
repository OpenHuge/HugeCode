// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalRequest } from "../../../types";
import { getApprovalCommandInfo, matchesCommandPrefix } from "../../../utils/approvalRules";
import { useThreadApprovalEvents } from "./useThreadApprovalEvents";

const invokeRuntimeInvocation = vi.hoisted(() => vi.fn());

vi.mock("../../../application/runtime/facades/runtimeInvocationExecuteFacadeHooks", () => ({
  useRuntimeInvocationExecuteResolver: () => (workspaceId: string) => ({
    invoke: (input: Record<string, unknown>) => invokeRuntimeInvocation(workspaceId, input),
  }),
}));

vi.mock("../../../utils/approvalRules", () => ({
  getApprovalCommandInfo: vi.fn(),
  matchesCommandPrefix: vi.fn(),
}));

describe("useThreadApprovalEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeRuntimeInvocation.mockResolvedValue({
      ok: true,
      kind: "approval_resolved",
      payload: null,
      message: null,
      evidence: null,
    });
  });

  it("auto-accepts allowlisted approvals", () => {
    const dispatch = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-1": [["git", "status"]] },
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: 42,
      method: "approval/request",
      params: { argv: ["git", "status"] },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "status"],
      preview: "git status",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(true);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({ dispatch, approvalAllowlistRef })
    );

    act(() => {
      result.current(approval);
    });

    expect(invokeRuntimeInvocation).toHaveBeenCalledWith("ws-1", {
      invocationId: "session:respond-to-approval",
      arguments: {
        requestId: 42,
        decision: "accept",
      },
      caller: "operator",
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches approvals that do not match the allowlist", () => {
    const dispatch = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-1": [["git", "status"]] },
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: 7,
      method: "approval/request",
      params: { argv: ["git", "pull"] },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "pull"],
      preview: "git pull",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(false);

    const { result } = renderHook(() =>
      useThreadApprovalEvents({ dispatch, approvalAllowlistRef })
    );

    act(() => {
      result.current(approval);
    });

    expect(invokeRuntimeInvocation).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "addApproval", approval });
  });

  it("falls back to the approval queue when invocation execution is blocked", async () => {
    const dispatch = vi.fn();
    const approvalAllowlistRef = {
      current: { "ws-1": [["git", "status"]] },
    };
    const approval: ApprovalRequest = {
      workspace_id: "ws-1",
      request_id: 99,
      method: "approval/request",
      params: { argv: ["git", "status"] },
    };

    vi.mocked(getApprovalCommandInfo).mockReturnValue({
      tokens: ["git", "status"],
      preview: "git status",
    });
    vi.mocked(matchesCommandPrefix).mockReturnValue(true);
    invokeRuntimeInvocation.mockResolvedValue({
      ok: false,
      kind: "blocked",
      payload: null,
      message: "approval still needs operator confirmation",
      evidence: null,
    });

    const { result } = renderHook(() =>
      useThreadApprovalEvents({ dispatch, approvalAllowlistRef })
    );

    act(() => {
      result.current(approval);
    });

    await Promise.resolve();

    expect(dispatch).toHaveBeenCalledWith({ type: "addApproval", approval });
  });
});
