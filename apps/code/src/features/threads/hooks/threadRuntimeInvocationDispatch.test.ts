import { describe, expect, it, vi } from "vitest";
import { dispatchThreadRuntimeInvocationSlashCommand } from "./threadRuntimeInvocationDispatch";

describe("threadRuntimeInvocationDispatch", () => {
  it("surfaces runtime blocking reasons from invocation evidence", async () => {
    const pushThreadErrorMessage = vi.fn();
    const safeMessageActivity = vi.fn();

    const handled = await dispatchThreadRuntimeInvocationSlashCommand({
      workspace: {
        id: "ws-1",
        name: "Workspace",
        path: "/tmp/ws-1",
        connected: true,
        settings: {},
      } as never,
      threadId: "thread-1",
      messageText: "/summarize TARGET=diff",
      images: [],
      resolveInvocationCatalog: () =>
        ({
          publishActiveCatalog: vi.fn(async () => ({
            items: [
              {
                id: "session:prompt:prompt.summarize",
                kind: "session_command",
                metadata: {
                  slashCommand: {
                    primaryTrigger: "/summarize",
                    insertText: 'summarize TARGET=""',
                    shadowedByBuiltin: false,
                  },
                },
              },
            ],
          })),
        }) as never,
      resolveInvocationExecute: () =>
        ({
          invoke: vi.fn(async () => ({
            invocationId: "session:prompt:prompt.summarize",
            kind: "blocked",
            ok: false,
            payload: null,
            message: "Generic blocked message",
            evidence: {
              outcome: {
                status: "blocked",
                summary: "Dispatch blocked by runtime approval policy.",
              },
              placementRationale: {
                summary: "Runtime dispatch rejected the invocation.",
                reason: "Approval required by runtime policy.",
              },
            },
          })),
        }) as never,
      pushThreadErrorMessage,
      safeMessageActivity,
      sendMessageToThread: vi.fn(async () => undefined),
    });

    expect(handled).toBe(true);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Approval required by runtime policy."
    );
    expect(safeMessageActivity).toHaveBeenCalledOnce();
  });

  it("sends resolved compose patch text back through thread messaging", async () => {
    const sendMessageToThread = vi.fn(async () => undefined);

    const handled = await dispatchThreadRuntimeInvocationSlashCommand({
      workspace: {
        id: "ws-1",
        name: "Workspace",
        path: "/tmp/ws-1",
        connected: true,
        settings: {},
      } as never,
      threadId: "thread-1",
      messageText: "/summarize TARGET=diff",
      images: ["image-1"],
      resolveInvocationCatalog: () =>
        ({
          publishActiveCatalog: vi.fn(async () => ({
            items: [
              {
                id: "session:prompt:prompt.summarize",
                kind: "session_command",
                metadata: {
                  slashCommand: {
                    primaryTrigger: "/summarize",
                    insertText: 'summarize TARGET=""',
                    shadowedByBuiltin: false,
                  },
                },
              },
            ],
          })),
        }) as never,
      resolveInvocationExecute: () =>
        ({
          invoke: vi.fn(async () => ({
            invocationId: "session:prompt:prompt.summarize",
            kind: "compose_patch_resolved",
            ok: true,
            payload: {
              text: "Summarize diff",
            },
            message: null,
            evidence: null,
          })),
        }) as never,
      pushThreadErrorMessage: vi.fn(),
      safeMessageActivity: vi.fn(),
      sendMessageToThread,
    });

    expect(handled).toBe(true);
    expect(sendMessageToThread).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ws-1" }),
      "thread-1",
      "Summarize diff",
      ["image-1"],
      expect.objectContaining({ skipPromptExpansion: true })
    );
  });
});
