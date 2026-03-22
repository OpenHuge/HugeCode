import { describe, expect, it, vi } from "vitest";
import { buildRuntimePromptTools } from "./webMcpBridgeRuntimePromptTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

describe("webMcpBridgeRuntimePromptTools", () => {
  it("registers prompt tools, keeps list read-only, and supports explicit global scope", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const listRuntimePrompts = vi.fn(async (workspaceId?: string | null) =>
      workspaceId === null
        ? [
            {
              id: "prompt-global-1",
              title: "Global Prompt",
              description: "global description",
              content: "global content",
              scope: "global",
            },
          ]
        : [
            {
              id: "prompt-workspace-1",
              title: "Workspace Prompt",
              description: "workspace description",
              content: "workspace content",
              scope: "workspace",
            },
          ]
    );
    const tools = buildRuntimePromptTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimePrompts,
        createRuntimePrompt: vi.fn(async () => ({})),
        updateRuntimePrompt: vi.fn(async () => ({})),
        deleteRuntimePrompt: vi.fn(async () => true),
        moveRuntimePrompt: vi.fn(async () => ({})),
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        confirmWriteAction,
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "list-runtime-prompts",
      "create-runtime-prompt",
      "update-runtime-prompt",
      "delete-runtime-prompt",
      "move-runtime-prompt",
    ]);
    expect(tools.find((tool) => tool.name === "list-runtime-prompts")?.annotations).toMatchObject({
      readOnlyHint: true,
    });
    expect(tools.find((tool) => tool.name === "delete-runtime-prompt")?.annotations).toMatchObject({
      destructiveHint: true,
    });

    const listTool = tools.find((tool) => tool.name === "list-runtime-prompts");
    const workspaceResponse = await listTool?.execute({}, null);
    expect(listRuntimePrompts).toHaveBeenNthCalledWith(1, "ws-1");
    expect(workspaceResponse).toMatchObject({
      ok: true,
      message: "Runtime prompts retrieved.",
      data: {
        workspaceId: "ws-1",
        total: 1,
      },
    });

    const globalResponse = await listTool?.execute({ workspaceId: null }, null);
    expect(listRuntimePrompts).toHaveBeenNthCalledWith(2, null);
    expect(confirmWriteAction).not.toHaveBeenCalled();
    expect(globalResponse).toMatchObject({
      ok: true,
      message: "Runtime prompts retrieved.",
      data: {
        workspaceId: null,
        total: 1,
      },
    });
  });

  it("routes create update move delete through write confirmation and rejects legacy aliases", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const createRuntimePrompt = vi.fn(async () => ({
      id: "prompt-1",
      title: "Prompt One",
      description: "desc",
      content: "content",
      scope: "workspace",
    }));
    const updateRuntimePrompt = vi.fn(async () => ({
      id: "prompt-1",
      title: "Prompt One Updated",
      description: "desc updated",
      content: "content updated",
      scope: "workspace",
    }));
    const deleteRuntimePrompt = vi.fn(async () => true);
    const moveRuntimePrompt = vi.fn(async () => ({
      id: "prompt-1",
      title: "Prompt One Updated",
      description: "desc updated",
      content: "content updated",
      scope: "global",
    }));

    const tools = buildRuntimePromptTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimePrompts: vi.fn(async () => []),
        createRuntimePrompt,
        updateRuntimePrompt,
        deleteRuntimePrompt,
        moveRuntimePrompt,
      },
      requireUserApproval: true,
      onApprovalRequest: vi.fn(async () => true),
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        confirmWriteAction,
      },
    });

    const createTool = tools.find((tool) => tool.name === "create-runtime-prompt");
    const createResponse = await createTool?.execute(
      {
        scope: "workspace",
        title: "Prompt One",
        description: "desc",
        content: "content",
      },
      null
    );
    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(createRuntimePrompt).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      scope: "workspace",
      title: "Prompt One",
      description: "desc",
      content: "content",
    });
    expect(createResponse).toMatchObject({
      ok: true,
      message: "Runtime prompt created.",
    });

    const updateTool = tools.find((tool) => tool.name === "update-runtime-prompt");
    await updateTool?.execute(
      {
        workspaceId: null,
        promptId: "prompt-1",
        title: "Prompt One Updated",
        description: "desc updated",
        content: "content updated",
      },
      null
    );
    expect(updateRuntimePrompt).toHaveBeenCalledWith({
      workspaceId: null,
      promptId: "prompt-1",
      title: "Prompt One Updated",
      description: "desc updated",
      content: "content updated",
    });

    const moveTool = tools.find((tool) => tool.name === "move-runtime-prompt");
    await moveTool?.execute(
      {
        promptId: "prompt-1",
        targetScope: "global",
      },
      null
    );
    expect(moveRuntimePrompt).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      promptId: "prompt-1",
      targetScope: "global",
    });

    const deleteTool = tools.find((tool) => tool.name === "delete-runtime-prompt");
    const deleteResponse = await deleteTool?.execute({ promptId: "prompt-1" }, null);
    expect(deleteRuntimePrompt).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      promptId: "prompt-1",
    });
    expect(deleteResponse).toMatchObject({
      ok: true,
      message: "Runtime prompt deleted.",
    });

    await expect(
      createTool?.execute(
        {
          scope: "workspace",
          title: "Prompt Alias",
          description: "desc",
          content: "content",
          argumentHint: "legacy",
        },
        null
      )
    ).rejects.toMatchObject({
      code: "runtime.validation.input.invalid",
    });
  });
});
