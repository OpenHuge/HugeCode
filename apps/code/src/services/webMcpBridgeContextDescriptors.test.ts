import { describe, expect, it } from "vitest";
import { buildWebMcpPrompts, buildWebMcpResources } from "./webMcpBridgeContextDescriptors";
import type { AgentCommandCenterSnapshot } from "@ku0/code-runtime-webmcp-client/webMcpBridgeTypes";

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
  tasks: [
    {
      id: "task-1",
      title: "Implement context descriptors",
      owner: "alice",
      status: "in_progress",
      priority: "high",
      blocked: false,
      dueDate: null,
      notes: "",
      updatedAt: Date.now(),
    },
  ],
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
  auditLog: [
    {
      id: "audit-1",
      at: Date.now(),
      category: "task",
      level: "info",
      message: "Task updated",
      details: null,
    },
  ],
  updatedAt: Date.now(),
};

describe("webMcpBridgeContextDescriptors", () => {
  it("builds stable resources with JSON payloads", async () => {
    const resources = buildWebMcpResources(snapshot);
    expect(resources).toHaveLength(1);
    expect(resources.map((resource) => resource.name)).toEqual(["workspace-overview"]);

    const readResult = await resources[0].read(new URL(resources[0].uri));
    expect(readResult.contents).toHaveLength(1);
    expect(readResult.contents[0].mimeType).toBe("application/json");
    expect(readResult.contents[0].text).toContain("workspaceId");
  });

  it("adds a runtime discovery resource for slim runtime catalogs", async () => {
    const resources = buildWebMcpResources(snapshot, {
      activeModelContext: {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
      },
      toolExposureDecision: {
        provider: "anthropic",
        mode: "slim",
        visibleToolNames: [
          "get-project-overview",
          "get-runtime-capabilities-summary",
          "list-runtime-live-skills",
          "read-workspace-file",
          "run-runtime-live-skill",
        ],
        hiddenToolNames: ["get-runtime-settings", "open-runtime-terminal-session"],
        reasonCodes: ["provider-prefers-slim-tool-catalog"],
      },
      runtimeToolNames: [
        "get-runtime-capabilities-summary",
        "list-runtime-live-skills",
        "read-workspace-file",
        "run-runtime-live-skill",
        "get-runtime-settings",
        "open-runtime-terminal-session",
      ],
    });

    expect(resources.map((resource) => resource.name)).toContain("runtime-tool-discovery");
    const discoveryResource = resources.find(
      (resource) => resource.name === "runtime-tool-discovery"
    );
    const readResult = await discoveryResource?.read(new URL(discoveryResource.uri));
    expect(readResult?.contents[0].text).toContain('"catalogMode": "slim"');
    expect(readResult?.contents[0].text).toContain('"deferredRuntimeToolCount": 2');
    expect(readResult?.contents[0].text).toContain('"list-runtime-live-skills"');
  });

  it("builds prompts that return user messages", async () => {
    const prompts = buildWebMcpPrompts(snapshot);
    expect(prompts).toHaveLength(1);
    expect(prompts.map((prompt) => prompt.name)).toEqual(["summarize-workspace-status"]);

    const messages = await prompts[0].get({ audience: "runtime safety review" });
    expect(messages.messages).toHaveLength(1);
    expect(messages.messages[0].role).toBe("user");
    if (!Array.isArray(messages.messages[0].content)) {
      expect(messages.messages[0].content.type).toBe("text");
      expect(messages.messages[0].content.text).toContain("runtime safety review");
      expect(messages.messages[0].content.text).toContain(
        "Local project-task board, governance automation, and audit log are not part of the active command-center surface."
      );
    }
  });

  it("adds a runtime tooling strategy prompt for slim runtime catalogs", async () => {
    const prompts = buildWebMcpPrompts(snapshot, {
      activeModelContext: {
        provider: "anthropic",
        modelId: "claude-sonnet-4-5",
      },
      toolExposureDecision: {
        provider: "anthropic",
        mode: "slim",
        visibleToolNames: [
          "get-runtime-capabilities-summary",
          "list-runtime-live-skills",
          "search-workspace-files",
          "run-runtime-live-skill",
          "start-runtime-run",
        ],
        hiddenToolNames: ["get-runtime-settings"],
        reasonCodes: ["provider-prefers-slim-tool-catalog"],
      },
      runtimeToolNames: [
        "get-runtime-capabilities-summary",
        "list-runtime-live-skills",
        "search-workspace-files",
        "run-runtime-live-skill",
        "start-runtime-run",
        "get-runtime-settings",
      ],
    });

    expect(prompts.map((prompt) => prompt.name)).toContain("choose-runtime-tooling-strategy");
    const prompt = prompts.find((entry) => entry.name === "choose-runtime-tooling-strategy");
    const messages = await prompt?.get({ task: "inspect runtime support before editing" });
    expect(messages?.messages[0].role).toBe("user");
    if (messages && !Array.isArray(messages.messages[0].content)) {
      expect(messages.messages[0].content.text).toContain("list-runtime-live-skills");
      expect(messages.messages[0].content.text).toContain("run-runtime-live-skill");
    }
  });
});
