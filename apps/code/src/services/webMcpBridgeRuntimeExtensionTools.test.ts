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
        permissions: [],
        uiApps: [],
        installedAt: 1,
        updatedAt: 1,
      },
    ]);
    const getRuntimeExtension = vi.fn(async () => ({
      extensionId: "ext-1",
      displayName: "Extension One",
      uiApps: [],
    }));
    const searchRuntimeExtensionRegistry = vi.fn(async () => ({
      query: "",
      results: [{ extensionId: "ext-1" }],
      sources: [{ sourceId: "workspace" }],
    }));
    const listRuntimeExtensionRegistrySources = vi.fn(async () => [{ sourceId: "workspace" }]);
    const evaluateRuntimeExtensionPermissions = vi.fn(async () => ({
      extensionId: "ext-1",
      permissions: ["network"],
      decision: "ask",
      warnings: ["derived"],
    }));
    const readRuntimeExtensionHealth = vi.fn(async () => ({
      extensionId: "ext-1",
      lifecycleState: "enabled",
      healthy: true,
      warnings: [],
      checkedAt: 1,
    }));
    const listRuntimeExtensionUiApps = vi.fn(async () => ({
      workspaceId: "ws-1",
      apps: [{ appId: "app-1", title: "App One", route: "/extensions/app-one" }],
    }));
    const tools = buildRuntimeExtensionTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimeExtensions,
        getRuntimeExtension,
        installRuntimeExtension: vi.fn(async () => null),
        updateRuntimeExtension: vi.fn(async () => null),
        setRuntimeExtensionState: vi.fn(async () => null),
        removeRuntimeExtension: vi.fn(async () => false),
        searchRuntimeExtensionRegistry,
        listRuntimeExtensionRegistrySources,
        listRuntimeExtensionTools: vi.fn(async () => []),
        evaluateRuntimeExtensionPermissions,
        readRuntimeExtensionResource: vi.fn(async () => null),
        readRuntimeExtensionHealth,
        listRuntimeExtensionUiApps,
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
      "get-runtime-extension",
      "install-runtime-extension",
      "update-runtime-extension",
      "set-runtime-extension-state",
      "remove-runtime-extension",
      "search-runtime-extension-registry",
      "list-runtime-extension-registry-sources",
      "list-runtime-extension-tools",
      "evaluate-runtime-extension-permissions",
      "read-runtime-extension-resource",
      "get-runtime-extension-health",
      "list-runtime-extension-ui-apps",
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

    const getExtensionTool = tools.find((tool) => tool.name === "get-runtime-extension");
    const getExtensionResponse = await getExtensionTool?.execute({ extensionId: "ext-1" }, null);
    expect(getRuntimeExtension).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext-1",
    });
    expect(getExtensionResponse).toMatchObject({
      ok: true,
      message: "Runtime extension retrieved.",
    });

    const searchRegistryTool = tools.find(
      (tool) => tool.name === "search-runtime-extension-registry"
    );
    const searchRegistryResponse = await searchRegistryTool?.execute({ query: "ext" }, null);
    expect(searchRuntimeExtensionRegistry).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      query: "ext",
      kinds: null,
      sourceIds: null,
    });
    expect(searchRegistryResponse).toMatchObject({
      ok: true,
      message: "Runtime extension registry search completed.",
      data: {
        total: 1,
      },
    });

    const registrySourcesTool = tools.find(
      (tool) => tool.name === "list-runtime-extension-registry-sources"
    );
    const registrySourcesResponse = await registrySourcesTool?.execute({}, null);
    expect(listRuntimeExtensionRegistrySources).toHaveBeenCalledWith("ws-1");
    expect(registrySourcesResponse).toMatchObject({
      ok: true,
      message: "Runtime extension registry sources retrieved.",
      data: {
        total: 1,
      },
    });

    const evaluatePermissionsTool = tools.find(
      (tool) => tool.name === "evaluate-runtime-extension-permissions"
    );
    const evaluatePermissionsResponse = await evaluatePermissionsTool?.execute(
      { extensionId: "ext-1" },
      null
    );
    expect(evaluateRuntimeExtensionPermissions).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext-1",
    });
    expect(evaluatePermissionsResponse).toMatchObject({
      ok: true,
      message: "Runtime extension permissions evaluated.",
      data: {
        warnings: ["derived"],
      },
    });

    const healthTool = tools.find((tool) => tool.name === "get-runtime-extension-health");
    const healthResponse = await healthTool?.execute({ extensionId: "ext-1" }, null);
    expect(readRuntimeExtensionHealth).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext-1",
    });
    expect(healthResponse).toMatchObject({
      ok: true,
      message: "Runtime extension health retrieved.",
    });

    const uiAppsTool = tools.find((tool) => tool.name === "list-runtime-extension-ui-apps");
    const uiAppsResponse = await uiAppsTool?.execute({}, null);
    expect(listRuntimeExtensionUiApps).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: null,
    });
    expect(uiAppsResponse).toMatchObject({
      ok: true,
      message: "Runtime extension UI app descriptors retrieved.",
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
        getRuntimeExtension: vi.fn(async () => null),
        installRuntimeExtension: vi.fn(async () => null),
        updateRuntimeExtension: vi.fn(async () => null),
        setRuntimeExtensionState: vi.fn(async () => null),
        removeRuntimeExtension: vi.fn(async () => false),
        searchRuntimeExtensionRegistry: vi.fn(async () => ({
          query: "",
          results: [],
          sources: [],
        })),
        listRuntimeExtensionRegistrySources: vi.fn(async () => []),
        listRuntimeExtensionTools: vi.fn(async () => []),
        evaluateRuntimeExtensionPermissions: vi.fn(async () => ({
          extensionId: "ext-1",
          permissions: [],
          decision: "allow",
          warnings: [],
        })),
        readRuntimeExtensionResource: vi.fn(async () => null),
        readRuntimeExtensionHealth: vi.fn(async () => ({
          extensionId: "ext-1",
          lifecycleState: "blocked",
          healthy: false,
          warnings: [],
          checkedAt: 1,
        })),
        listRuntimeExtensionUiApps: vi.fn(async () => ({ workspaceId: "ws-1", apps: [] })),
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
    const updateRuntimeExtension = vi.fn(async (input: Record<string, unknown>) => ({
      ...input,
      updatedAt: 3,
    }));
    const setRuntimeExtensionState = vi.fn(async (input: Record<string, unknown>) => ({
      ...input,
      lifecycleState: "enabled",
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
        getRuntimeExtension: vi.fn(async () => null),
        installRuntimeExtension,
        updateRuntimeExtension,
        setRuntimeExtensionState,
        removeRuntimeExtension,
        searchRuntimeExtensionRegistry: vi.fn(async () => ({
          query: "",
          results: [],
          sources: [],
        })),
        listRuntimeExtensionRegistrySources: vi.fn(async () => []),
        listRuntimeExtensionTools: vi.fn(async () => []),
        evaluateRuntimeExtensionPermissions: vi.fn(async () => ({
          extensionId: "ext-1",
          permissions: [],
          decision: "allow",
          warnings: [],
        })),
        readRuntimeExtensionResource: vi.fn(async () => null),
        readRuntimeExtensionHealth: vi.fn(async () => ({
          extensionId: "ext-1",
          lifecycleState: "enabled",
          healthy: true,
          warnings: [],
          checkedAt: 1,
        })),
        listRuntimeExtensionUiApps: vi.fn(async () => ({ workspaceId: "ws-1", apps: [] })),
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

    const updateTool = tools.find((tool) => tool.name === "update-runtime-extension");
    await expect(
      updateTool?.execute(
        {
          extensionId: "ext-1",
          provenance: [],
        },
        null
      )
    ).rejects.toMatchObject({
      code: "runtime.validation.input.invalid",
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

    const updateResponse = await updateTool?.execute(
      {
        extensionId: "ext-1",
        displayName: "Extension One Updated",
        enabled: false,
        capabilities: ["tools"],
        permissions: ["network"],
        config: { profile: "strict" },
        provenance: { sourceId: "workspace" },
      },
      null
    );
    expect(confirmWriteAction).toHaveBeenCalledTimes(2);
    expect(confirmWriteAction).toHaveBeenLastCalledWith(
      null,
      false,
      "Update runtime extension ext-1 in workspace ws-1.",
      onApprovalRequest
    );
    expect(updateRuntimeExtension).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext-1",
      version: null,
      displayName: "Extension One Updated",
      publisher: null,
      summary: null,
      kind: null,
      distribution: null,
      transport: null,
      enabled: false,
      capabilities: ["tools"],
      permissions: ["network"],
      config: { profile: "strict" },
      provenance: { sourceId: "workspace" },
    });
    expect(updateResponse).toMatchObject({
      ok: true,
      message: "Runtime extension updated.",
    });

    const setStateTool = tools.find((tool) => tool.name === "set-runtime-extension-state");
    const setStateResponse = await setStateTool?.execute(
      {
        extensionId: "ext-1",
        enabled: false,
      },
      null
    );
    expect(confirmWriteAction).toHaveBeenCalledTimes(3);
    expect(confirmWriteAction).toHaveBeenLastCalledWith(
      null,
      false,
      "Disable runtime extension ext-1 in workspace ws-1.",
      onApprovalRequest
    );
    expect(setRuntimeExtensionState).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      extensionId: "ext-1",
      enabled: false,
    });
    expect(setStateResponse).toMatchObject({
      ok: true,
      message: "Runtime extension state updated.",
    });

    const removeTool = tools.find((tool) => tool.name === "remove-runtime-extension");
    expect(removeTool?.annotations?.destructiveHint).toBe(true);
    const removeResponse = await removeTool?.execute({ extensionId: "ext-1" }, null);
    expect(confirmWriteAction).toHaveBeenCalledTimes(4);
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
