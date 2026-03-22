import { describe, expect, it, vi } from "vitest";
import { buildRuntimeExtensionTools } from "./webMcpBridgeRuntimeExtensionTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

describe("webMcpBridgeRuntimeExtensionTools", () => {
  it("registers read-only extension tools and reads extension lists without approval", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const listRuntimeExtensions = vi.fn(async () => [
      {
        extensionId: "ext-1",
        name: "Extension One",
        transport: "builtin",
        enabled: true,
        workspaceId: "ws-1",
        config: {},
        installedAt: 1,
        updatedAt: 1,
      },
    ]);
    const tools = buildRuntimeExtensionTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimeExtensions,
        installRuntimeExtension: vi.fn(async () => null),
        removeRuntimeExtension: vi.fn(async () => false),
        listRuntimeExtensionTools: vi.fn(async () => []),
        readRuntimeExtensionResource: vi.fn(async () => null),
        getRuntimeExtensionsConfig: vi.fn(async () => ({ extensions: [], warnings: [] })),
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
      "list-runtime-extensions",
      "install-runtime-extension",
      "remove-runtime-extension",
      "list-runtime-extension-tools",
      "read-runtime-extension-resource",
      "get-runtime-extensions-config",
    ]);

    const listExtensionsTool = tools.find((tool) => tool.name === "list-runtime-extensions");
    expect(listExtensionsTool?.annotations?.readOnlyHint).toBe(true);
    const response = await listExtensionsTool?.execute({}, null);

    expect(confirmWriteAction).not.toHaveBeenCalled();
    expect(listRuntimeExtensions).toHaveBeenCalledWith("ws-1");
    expect(response).toMatchObject({
      ok: true,
      message: "Runtime extensions retrieved.",
      data: {
        total: 1,
      },
    });
  });

  it("raises resource-not-found when an extension resource is unavailable", async () => {
    const tools = buildRuntimeExtensionTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimeExtensions: vi.fn(async () => []),
        installRuntimeExtension: vi.fn(async () => null),
        removeRuntimeExtension: vi.fn(async () => false),
        listRuntimeExtensionTools: vi.fn(async () => []),
        readRuntimeExtensionResource: vi.fn(async () => null),
        getRuntimeExtensionsConfig: vi.fn(async () => ({ extensions: [], warnings: [] })),
      },
      requireUserApproval: true,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        confirmWriteAction: vi.fn(async () => undefined),
      },
    });

    const readResourceTool = tools.find((tool) => tool.name === "read-runtime-extension-resource");
    await expect(
      readResourceTool?.execute({ extensionId: "ext-1", resourceId: "resource-a" }, null)
    ).rejects.toMatchObject({
      code: "runtime.validation.resource.not_found",
    });
  });

  it("routes extension install and remove through write confirmation", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const installRuntimeExtension = vi.fn(async (input: Record<string, unknown>) => ({
      ...input,
      enabled: true,
      installedAt: 1,
      updatedAt: 2,
    }));
    const removeRuntimeExtension = vi.fn(async () => true);
    const onApprovalRequest = vi.fn(async () => true);
    const tools = buildRuntimeExtensionTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimeExtensions: vi.fn(async () => []),
        installRuntimeExtension,
        removeRuntimeExtension,
        listRuntimeExtensionTools: vi.fn(async () => []),
        readRuntimeExtensionResource: vi.fn(async () => null),
        getRuntimeExtensionsConfig: vi.fn(async () => ({ extensions: [], warnings: [] })),
      },
      requireUserApproval: false,
      onApprovalRequest,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        confirmWriteAction,
      },
    });

    const installTool = tools.find((tool) => tool.name === "install-runtime-extension");
    await expect(
      installTool?.execute(
        {
          extensionId: "ext-1",
          name: "Extension One",
          transport: "builtin",
          config: [],
        },
        null
      )
    ).rejects.toMatchObject({
      code: "runtime.validation.input.invalid",
    });

    const installResponse = await installTool?.execute(
      {
        extensionId: "ext-1",
        name: "Extension One",
        transport: "builtin",
        enabled: true,
        config: { profile: "default" },
      },
      null
    );
    expect(confirmWriteAction).toHaveBeenCalledTimes(1);
    expect(confirmWriteAction).toHaveBeenCalledWith(
      null,
      false,
      "Install runtime extension ext-1 into workspace ws-1.",
      onApprovalRequest
    );
    expect(installRuntimeExtension).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext-1",
      name: "Extension One",
      transport: "builtin",
      enabled: true,
      config: { profile: "default" },
    });
    expect(installResponse).toMatchObject({
      ok: true,
      message: "Runtime extension installed.",
      data: {
        extension: {
          extensionId: "ext-1",
          name: "Extension One",
        },
      },
    });

    const removeTool = tools.find((tool) => tool.name === "remove-runtime-extension");
    expect(removeTool?.annotations?.destructiveHint).toBe(true);
    const removeResponse = await removeTool?.execute({ extensionId: "ext-1" }, null);
    expect(confirmWriteAction).toHaveBeenCalledTimes(2);
    expect(confirmWriteAction).toHaveBeenLastCalledWith(
      null,
      false,
      "Remove runtime extension ext-1 from workspace ws-1.",
      onApprovalRequest
    );
    expect(removeRuntimeExtension).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext-1",
    });
    expect(removeResponse).toMatchObject({
      ok: true,
      message: "Runtime extension removed.",
      data: {
        removed: true,
      },
    });
  });
});
