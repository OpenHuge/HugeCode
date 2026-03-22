import { describe, expect, it, vi } from "vitest";
import { buildRuntimeOauthTools } from "./webMcpBridgeRuntimeOauthTools";
import { createAgentCommandCenterSnapshot } from "./webMcpBridgeRuntimeTestUtils";

describe("webMcpBridgeRuntimeOauthTools", () => {
  it("registers read-only oauth tools without approval and enforces canonical providers", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const listRuntimeOAuthAccounts = vi.fn(async () => [
      {
        accountId: "acc-1",
        provider: "codex",
        email: "user@example.com",
        displayName: "User",
        externalAccountId: null,
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
    const listRuntimeOAuthPools = vi.fn(async () => [
      {
        poolId: "pool-1",
        provider: "codex",
        name: "Primary Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "acc-1",
        enabled: true,
        metadata: {},
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
    const listRuntimeOAuthPoolMembers = vi.fn(async () => [
      {
        poolId: "pool-1",
        accountId: "acc-1",
        weight: 1,
        priority: 0,
        position: 0,
        enabled: true,
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
    const selectRuntimeOAuthPoolAccount = vi.fn(async () => ({
      poolId: "pool-1",
      reason: "preferred_account",
      account: {
        accountId: "acc-1",
        provider: "codex",
        email: "user@example.com",
        displayName: "User",
        externalAccountId: null,
        status: "enabled",
        disabledReason: null,
        metadata: {},
        createdAt: 1,
        updatedAt: 2,
      },
    }));
    const tools = buildRuntimeOauthTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimeOAuthAccounts,
        getRuntimeAccountInfo: vi.fn(async () => ({ result: { account: null } })),
        getRuntimeAccountRateLimits: vi.fn(async () => ({ result: { rateLimits: {} } })),
        upsertRuntimeOAuthAccount: vi.fn(async () => null),
        removeRuntimeOAuthAccount: vi.fn(async () => false),
        listRuntimeOAuthPools,
        listRuntimeOAuthPoolMembers,
        applyRuntimeOAuthPool: vi.fn(async () => null),
        removeRuntimeOAuthPool: vi.fn(async () => false),
        selectRuntimeOAuthPoolAccount,
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
      "list-runtime-oauth-accounts",
      "get-runtime-account-info",
      "get-runtime-account-rate-limits",
      "upsert-runtime-oauth-account",
      "remove-runtime-oauth-account",
      "list-runtime-oauth-pools",
      "list-runtime-oauth-pool-members",
      "apply-runtime-oauth-pool",
      "remove-runtime-oauth-pool",
      "select-runtime-oauth-pool-account",
    ]);

    const listAccountsTool = tools.find((tool) => tool.name === "list-runtime-oauth-accounts");
    expect(listAccountsTool?.annotations?.readOnlyHint).toBe(true);
    await expect(listAccountsTool?.execute({ provider: "openai" }, null)).rejects.toMatchObject({
      code: "runtime.validation.input.invalid",
    });

    const listAccountsResponse = await listAccountsTool?.execute(
      { provider: "codex", usageRefresh: "force" },
      null
    );
    expect(confirmWriteAction).not.toHaveBeenCalled();
    expect(listRuntimeOAuthAccounts).toHaveBeenCalledWith("codex", {
      usageRefresh: "force",
    });
    expect(listAccountsResponse).toMatchObject({
      ok: true,
      message: "Runtime OAuth accounts retrieved.",
      data: {
        total: 1,
      },
    });

    const listPoolsTool = tools.find((tool) => tool.name === "list-runtime-oauth-pools");
    expect(listPoolsTool?.annotations?.readOnlyHint).toBe(true);
    await listPoolsTool?.execute({ provider: "codex" }, null);
    expect(listRuntimeOAuthPools).toHaveBeenCalledWith("codex");

    const listPoolMembersTool = tools.find(
      (tool) => tool.name === "list-runtime-oauth-pool-members"
    );
    expect(listPoolMembersTool?.annotations?.readOnlyHint).toBe(true);
    await listPoolMembersTool?.execute({ poolId: "pool-1" }, null);
    expect(listRuntimeOAuthPoolMembers).toHaveBeenCalledWith("pool-1");

    const selectPoolAccountTool = tools.find(
      (tool) => tool.name === "select-runtime-oauth-pool-account"
    );
    expect(selectPoolAccountTool?.annotations?.readOnlyHint).toBe(true);
    await selectPoolAccountTool?.execute({ poolId: "pool-1", modelId: "gpt-5.3-codex" }, null);
    expect(selectRuntimeOAuthPoolAccount).toHaveBeenCalledWith({
      poolId: "pool-1",
      modelId: "gpt-5.3-codex",
      sessionId: null,
      workspaceId: null,
    });
  });

  it("routes oauth mutations through write confirmation and preserves pool conflict codes", async () => {
    const confirmWriteAction = vi.fn(async () => undefined);
    const upsertRuntimeOAuthAccount = vi.fn(async (input: Record<string, unknown>) => ({
      ...input,
      createdAt: 1,
      updatedAt: 2,
    }));
    const removeRuntimeOAuthAccount = vi.fn(async () => true);
    const applyRuntimeOAuthPool = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("Pool revision mismatch."), {
          code: "runtime.approval.pool.version_mismatch",
        })
      )
      .mockResolvedValueOnce({
        pool: {
          poolId: "pool-1",
          provider: "codex",
          name: "Primary Pool",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: "acc-1",
          enabled: true,
          metadata: {},
          createdAt: 1,
          updatedAt: 3,
        },
        members: [
          {
            poolId: "pool-1",
            accountId: "acc-1",
            weight: 2,
            priority: 0,
            position: 0,
            enabled: true,
            createdAt: 1,
            updatedAt: 3,
          },
        ],
      });
    const removeRuntimeOAuthPool = vi.fn(async () => true);
    const onApprovalRequest = vi.fn(async () => true);
    const tools = buildRuntimeOauthTools({
      snapshot: createAgentCommandCenterSnapshot(),
      runtimeControl: {
        listTasks: vi.fn(),
        getTaskStatus: vi.fn(),
        startTask: vi.fn(),
        interruptTask: vi.fn(),
        submitTaskApprovalDecision: vi.fn(),
        listRuntimeOAuthAccounts: vi.fn(async () => []),
        getRuntimeAccountInfo: vi.fn(async () => ({ result: { account: null } })),
        getRuntimeAccountRateLimits: vi.fn(async () => ({ result: { rateLimits: {} } })),
        upsertRuntimeOAuthAccount,
        removeRuntimeOAuthAccount,
        listRuntimeOAuthPools: vi.fn(async () => []),
        listRuntimeOAuthPoolMembers: vi.fn(async () => []),
        applyRuntimeOAuthPool,
        removeRuntimeOAuthPool,
        selectRuntimeOAuthPoolAccount: vi.fn(async () => null),
      },
      requireUserApproval: true,
      onApprovalRequest,
      helpers: {
        buildResponse: (message, data) => ({ ok: true, message, data }),
        toNonEmptyString: (value) =>
          typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
        confirmWriteAction,
      },
    });

    const upsertAccountTool = tools.find((tool) => tool.name === "upsert-runtime-oauth-account");
    const removeAccountTool = tools.find((tool) => tool.name === "remove-runtime-oauth-account");
    const applyPoolTool = tools.find((tool) => tool.name === "apply-runtime-oauth-pool");
    const removePoolTool = tools.find((tool) => tool.name === "remove-runtime-oauth-pool");

    expect(removeAccountTool?.annotations?.destructiveHint).toBe(true);
    expect(removePoolTool?.annotations?.destructiveHint).toBe(true);

    await upsertAccountTool?.execute(
      {
        accountId: "acc-1",
        provider: "codex",
        email: "user@example.com",
        displayName: "User",
        status: "enabled",
      },
      null
    );
    expect(confirmWriteAction).toHaveBeenCalledWith(
      null,
      true,
      "Upsert runtime OAuth account acc-1 for provider codex.",
      onApprovalRequest
    );
    expect(upsertRuntimeOAuthAccount).toHaveBeenCalledWith({
      accountId: "acc-1",
      provider: "codex",
      email: "user@example.com",
      displayName: "User",
      status: "enabled",
    });

    await removeAccountTool?.execute({ accountId: "acc-1" }, null);
    expect(removeRuntimeOAuthAccount).toHaveBeenCalledWith("acc-1");

    await expect(
      applyPoolTool?.execute(
        {
          pool: {
            poolId: "pool-1",
            provider: "codex",
            name: "Primary Pool",
            strategy: "round_robin",
            stickyMode: "cache_first",
            preferredAccountId: "acc-1",
            enabled: true,
            metadata: {},
          },
          members: [{ accountId: "acc-1", weight: 1 }],
          expectedUpdatedAt: 2,
        },
        null
      )
    ).rejects.toMatchObject({
      code: "runtime.approval.pool.version_mismatch",
    });

    const applyPoolResponse = await applyPoolTool?.execute(
      {
        pool: {
          poolId: "pool-1",
          provider: "codex",
          name: "Primary Pool",
          strategy: "round_robin",
          stickyMode: "cache_first",
          preferredAccountId: "acc-1",
          enabled: true,
          metadata: {},
        },
        members: [{ accountId: "acc-1", weight: 2, priority: 0, position: 0, enabled: true }],
        expectedUpdatedAt: 2,
      },
      null
    );
    expect(applyRuntimeOAuthPool).toHaveBeenLastCalledWith({
      pool: {
        poolId: "pool-1",
        provider: "codex",
        name: "Primary Pool",
        strategy: "round_robin",
        stickyMode: "cache_first",
        preferredAccountId: "acc-1",
        enabled: true,
        metadata: {},
      },
      members: [{ accountId: "acc-1", weight: 2, priority: 0, position: 0, enabled: true }],
      expectedUpdatedAt: 2,
    });
    expect(applyPoolResponse).toMatchObject({
      ok: true,
      message: "Runtime OAuth pool applied.",
    });

    await removePoolTool?.execute({ poolId: "pool-1" }, null);
    expect(removeRuntimeOAuthPool).toHaveBeenCalledWith("pool-1");
  });
});
