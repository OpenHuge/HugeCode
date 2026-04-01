import { describe, expect, it } from "vitest";
import type { AgentCommandCenterSnapshot } from "./webMcpBridgeTypes";
import { buildWebMcpPrompts, buildWebMcpResources } from "./webMcpBridgeContextDescriptors";

const snapshot: AgentCommandCenterSnapshot = {
  workspaceId: "ws-1",
  workspaceName: "workspace-one",
  intent: {
    objective: "Ship runtime improvements",
    constraints: "No regressions",
    successCriteria: "Stable WebMCP bridge",
    deadline: null,
    priority: "high",
    managerNotes: "Watch for API drift",
  },
  tasks: [],
  governance: {
    policy: {
      autoEnabled: true,
      intervalMinutes: 5,
      pauseBlockedInProgress: true,
      reassignUnowned: true,
      terminateOverdueDays: 5,
      ownerPool: ["alice"],
    },
    lastCycle: null,
  },
  auditLog: [],
  updatedAt: Date.now(),
};

describe("@ku0/code-runtime-webmcp-client context descriptors", () => {
  it("builds canonical HugeCode workspace resources", async () => {
    const resources = buildWebMcpResources(snapshot);

    expect(resources).toHaveLength(1);
    expect(resources[0]?.uri).toBe("hugecode://workspace/ws-1/overview");

    const readResult = await resources[0]?.read(new URL(resources[0].uri));
    expect(readResult?.contents[0]?.mimeType).toBe("application/json");
    expect(readResult?.contents[0]?.text).toContain('"workspaceId": "ws-1"');
  });

  it("keeps runtime discovery descriptors for reduced catalogs", async () => {
    const resources = buildWebMcpResources(snapshot, {
      activeModelContext: {
        provider: "openai",
        modelId: "gpt-5.4",
      },
      toolExposureDecision: {
        provider: "openai",
        mode: "minimal",
        visibleToolNames: [
          "get-runtime-capabilities-summary",
          "list-runtime-live-skills",
          "read-workspace-file",
          "start-runtime-run",
        ],
        hiddenToolNames: ["get-runtime-settings", "open-runtime-terminal-session"],
        reasonCodes: ["runtime-prefers-minimal-tool-catalog"],
      },
      runtimeToolNames: [
        "get-runtime-capabilities-summary",
        "list-runtime-live-skills",
        "read-workspace-file",
        "start-runtime-run",
        "get-runtime-settings",
        "open-runtime-terminal-session",
      ],
    });
    const prompts = buildWebMcpPrompts(snapshot, {
      activeModelContext: {
        provider: "openai",
        modelId: "gpt-5.4",
      },
      toolExposureDecision: {
        provider: "openai",
        mode: "minimal",
        visibleToolNames: [
          "get-runtime-capabilities-summary",
          "list-runtime-live-skills",
          "read-workspace-file",
          "start-runtime-run",
        ],
        hiddenToolNames: ["get-runtime-settings", "open-runtime-terminal-session"],
        reasonCodes: ["runtime-prefers-minimal-tool-catalog"],
      },
      runtimeToolNames: [
        "get-runtime-capabilities-summary",
        "list-runtime-live-skills",
        "read-workspace-file",
        "start-runtime-run",
        "get-runtime-settings",
        "open-runtime-terminal-session",
      ],
    });

    const discoveryResource = resources.find(
      (resource) => resource.name === "runtime-tool-discovery"
    );
    const discoveryPrompt = prompts.find(
      (prompt) => prompt.name === "choose-runtime-tooling-strategy"
    );
    const readResult = await discoveryResource?.read(new URL(discoveryResource!.uri));
    const messages = await discoveryPrompt?.get({ task: "inspect runtime support before editing" });

    expect(discoveryResource?.uri).toBe("hugecode://workspace/ws-1/runtime-tool-discovery");
    expect(readResult?.contents[0]?.text).toContain('"catalogMode": "minimal"');
    expect(readResult?.contents[0]?.text).toContain("activation-backed runtime availability");
    expect(messages?.messages[0]?.role).toBe("user");
  });
});
