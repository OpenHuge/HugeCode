import { describe, expect, it } from "vitest";
import {
  buildRuntimeContextPrefix,
  buildRuntimeThreadContextPrepareRequest,
} from "./runtimeThreadContextManagement";

describe("runtimeThreadContextManagement", () => {
  it("builds runtime prepare requests with hints and attachment metadata", () => {
    const request = buildRuntimeThreadContextPrepareRequest({
      workspaceId: "ws-1",
      threadId: "thread-1",
      prompt: "Investigate runtime context drift",
      threadTitle: "Context drift",
      accessMode: "on-request",
      executionMode: "runtime",
      executionProfileId: "balanced-delegate",
      preferredBackendIds: ["backend-a", "backend-a", "backend-b"],
      attachments: ["/tmp/spec.md", "https://example.com/image.png"],
      contextHints: ["Memory digest: prior compaction summary.", "Execution state: idle."],
    });

    expect(request).toMatchObject({
      workspaceId: "ws-1",
      threadId: "thread-1",
      title: "Context drift",
      executionMode: "distributed",
      executionProfileId: "balanced-delegate",
      preferredBackendIds: ["backend-a", "backend-b"],
      steps: expect.arrayContaining([
        expect.objectContaining({
          kind: "read",
          input: "Investigate runtime context drift",
        }),
        expect.objectContaining({
          kind: "read",
          input: "Thread context hint: Memory digest: prior compaction summary.",
        }),
        expect.objectContaining({
          kind: "read",
          input: "Attachment context: spec.md (/tmp/spec.md)",
          path: "/tmp/spec.md",
        }),
      ]),
    });
  });

  it("keeps hybrid prepares on single execution mode", () => {
    const request = buildRuntimeThreadContextPrepareRequest({
      workspaceId: "ws-1",
      threadId: "thread-1",
      prompt: "Review local workspace changes",
      executionMode: "hybrid",
    });

    expect(request).toMatchObject({
      executionMode: "single",
    });
  });

  it("renders runtime-owned context prefixes from working sets", () => {
    const prefix = buildRuntimeContextPrefix({
      summary: "Runtime prepared a compact working set.",
      workspaceRoot: "/workspaces/HugeCode",
      selectionPolicy: {
        strategy: "balanced",
        tokenBudgetTarget: 1500,
        toolExposureProfile: "slim",
        preferColdFetch: true,
      },
      contextFingerprint: "work-123",
      stablePrefixFingerprint: "stable-123",
      layers: [
        {
          tier: "hot",
          summary: "Immediate context",
          entries: [
            {
              id: "workspace-root",
              label: "Workspace root",
              kind: "workspace",
              detail: "/workspaces/HugeCode",
              source: "/workspaces/HugeCode",
            },
          ],
        },
        {
          tier: "cold",
          summary: "Deferred context references",
          entries: [
            {
              id: "hint-1",
              label: "Persisted context digest",
              kind: "step",
              detail: "Memory digest: prior compaction summary.",
              source: "read",
            },
          ],
        },
      ],
    });

    expect(prefix).toContain("[RUNTIME_CONTEXT v2]");
    expect(prefix).toContain("strategy=balanced");
    expect(prefix).toContain("Workspace root: /workspaces/HugeCode");
    expect(prefix).toContain("HOT: Immediate context");
    expect(prefix).toContain("COLD: Deferred context references");
    expect(prefix).not.toContain("Persisted context digest");
  });
});
