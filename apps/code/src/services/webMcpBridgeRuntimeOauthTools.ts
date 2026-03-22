import type {
  OAuthAccountStatus,
  OAuthAccountUpsertInput,
  OAuthPoolApplyInput,
  OAuthPoolMemberInput,
  OAuthPoolSelectionRequest,
  OAuthPoolStrategy,
  OAuthProviderId,
  OAuthStickyMode,
  OAuthUsageRefreshMode,
} from "@ku0/code-runtime-host-contract";

import {
  invalidInputError,
  methodUnavailableError,
  requiredInputError,
} from "./webMcpBridgeRuntimeToolHelpers";
import {
  type BuildRuntimeToolsOptions,
  type WebMcpToolDescriptor,
} from "./webMcpBridgeRuntimeToolsShared";
import type { RuntimeAgentControl } from "./webMcpBridgeTypes";

type JsonRecord = Record<string, unknown>;

type RuntimeOauthControl = RuntimeAgentControl & {
  listRuntimeOAuthAccounts?: (
    provider?: OAuthProviderId | null,
    options?: { usageRefresh?: OAuthUsageRefreshMode | null }
  ) => Promise<unknown>;
  getRuntimeAccountInfo?: (workspaceId: string) => Promise<unknown>;
  getRuntimeAccountRateLimits?: (workspaceId: string) => Promise<unknown>;
  upsertRuntimeOAuthAccount?: (input: OAuthAccountUpsertInput) => Promise<unknown>;
  removeRuntimeOAuthAccount?: (accountId: string) => Promise<boolean>;
  listRuntimeOAuthPools?: (provider?: OAuthProviderId | null) => Promise<unknown>;
  listRuntimeOAuthPoolMembers?: (poolId: string) => Promise<unknown>;
  applyRuntimeOAuthPool?: (input: OAuthPoolApplyInput) => Promise<unknown>;
  removeRuntimeOAuthPool?: (poolId: string) => Promise<boolean>;
  selectRuntimeOAuthPoolAccount?: (input: OAuthPoolSelectionRequest) => Promise<unknown>;
};

type RuntimeOauthControlMethodName =
  | "listRuntimeOAuthAccounts"
  | "getRuntimeAccountInfo"
  | "getRuntimeAccountRateLimits"
  | "upsertRuntimeOAuthAccount"
  | "removeRuntimeOAuthAccount"
  | "listRuntimeOAuthPools"
  | "listRuntimeOAuthPoolMembers"
  | "applyRuntimeOAuthPool"
  | "removeRuntimeOAuthPool"
  | "selectRuntimeOAuthPoolAccount";

type RuntimeOauthHelpers = Pick<
  BuildRuntimeToolsOptions["helpers"],
  "buildResponse" | "confirmWriteAction" | "toNonEmptyString"
>;

const OAUTH_PROVIDER_VALUES = new Set<OAuthProviderId>(["codex", "gemini", "claude_code"]);
const OAUTH_USAGE_REFRESH_VALUES = new Set<OAuthUsageRefreshMode>(["auto", "force", "off"]);
const OAUTH_ACCOUNT_STATUS_VALUES = new Set<OAuthAccountStatus>([
  "enabled",
  "disabled",
  "forbidden",
  "validation_blocked",
]);
const OAUTH_POOL_STRATEGY_VALUES = new Set<OAuthPoolStrategy>(["round_robin", "p2c"]);
const OAUTH_STICKY_MODE_VALUES = new Set<OAuthStickyMode>([
  "cache_first",
  "balance",
  "performance_first",
]);

function requireRuntimeOauthControlMethod<MethodName extends RuntimeOauthControlMethodName>(
  control: RuntimeOauthControl,
  methodName: MethodName,
  toolName: string
): NonNullable<RuntimeOauthControl[MethodName]> {
  const candidate = control[methodName];
  if (typeof candidate !== "function") {
    throw methodUnavailableError(toolName, String(methodName));
  }
  return candidate as NonNullable<RuntimeOauthControl[MethodName]>;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toCanonicalProvider(value: unknown): OAuthProviderId | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!OAUTH_PROVIDER_VALUES.has(trimmed as OAuthProviderId)) {
    return null;
  }
  return trimmed as OAuthProviderId;
}

function toRequiredProvider(value: unknown, fieldName: string): OAuthProviderId {
  const provider = toCanonicalProvider(value);
  if (!provider) {
    throw invalidInputError(`${fieldName} must be one of: codex, gemini, claude_code.`);
  }
  return provider;
}

function toUsageRefresh(value: unknown): OAuthUsageRefreshMode | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!OAUTH_USAGE_REFRESH_VALUES.has(trimmed as OAuthUsageRefreshMode)) {
    return null;
  }
  return trimmed as OAuthUsageRefreshMode;
}

function toOptionalStatus(value: unknown): OAuthAccountStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw invalidInputError(
      "status must be one of: enabled, disabled, forbidden, validation_blocked."
    );
  }
  const trimmed = value.trim();
  if (!OAUTH_ACCOUNT_STATUS_VALUES.has(trimmed as OAuthAccountStatus)) {
    throw invalidInputError(
      "status must be one of: enabled, disabled, forbidden, validation_blocked."
    );
  }
  return trimmed as OAuthAccountStatus;
}

function toOptionalStrategy(value: unknown): OAuthPoolStrategy | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw invalidInputError("pool.strategy must be one of: round_robin, p2c.");
  }
  const trimmed = value.trim();
  if (!OAUTH_POOL_STRATEGY_VALUES.has(trimmed as OAuthPoolStrategy)) {
    throw invalidInputError("pool.strategy must be one of: round_robin, p2c.");
  }
  return trimmed as OAuthPoolStrategy;
}

function toOptionalStickyMode(value: unknown): OAuthStickyMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw invalidInputError(
      "pool.stickyMode must be one of: cache_first, balance, performance_first."
    );
  }
  const trimmed = value.trim();
  if (!OAUTH_STICKY_MODE_VALUES.has(trimmed as OAuthStickyMode)) {
    throw invalidInputError(
      "pool.stickyMode must be one of: cache_first, balance, performance_first."
    );
  }
  return trimmed as OAuthStickyMode;
}

function toOptionalMetadata(
  value: unknown,
  fieldName: string
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return {};
  }
  const record = asRecord(value);
  if (!record) {
    throw invalidInputError(`${fieldName} must be an object when provided.`);
  }
  return record;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function toOptionalNumber(value: unknown, fieldName: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidInputError(`${fieldName} must be a number when provided.`);
  }
  return value;
}

function toOptionalString(value: unknown, helpers: RuntimeOauthHelpers): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return helpers.toNonEmptyString(value);
}

function toPoolMemberInput(
  value: unknown,
  index: number,
  helpers: RuntimeOauthHelpers
): OAuthPoolMemberInput {
  const member = asRecord(value);
  if (!member) {
    throw invalidInputError(`members[${index}] must be an object.`);
  }
  const accountId = helpers.toNonEmptyString(member.accountId);
  if (!accountId) {
    throw requiredInputError(`members[${index}].accountId is required.`);
  }
  const next: OAuthPoolMemberInput = { accountId };
  if (member.weight !== undefined) {
    if (typeof member.weight !== "number" || !Number.isFinite(member.weight)) {
      throw invalidInputError(`members[${index}].weight must be a number when provided.`);
    }
    next.weight = member.weight;
  }
  if (member.priority !== undefined) {
    if (typeof member.priority !== "number" || !Number.isFinite(member.priority)) {
      throw invalidInputError(`members[${index}].priority must be a number when provided.`);
    }
    next.priority = member.priority;
  }
  if (member.position !== undefined) {
    if (typeof member.position !== "number" || !Number.isFinite(member.position)) {
      throw invalidInputError(`members[${index}].position must be a number when provided.`);
    }
    next.position = member.position;
  }
  if (member.enabled !== undefined) {
    if (typeof member.enabled !== "boolean") {
      throw invalidInputError(`members[${index}].enabled must be a boolean when provided.`);
    }
    next.enabled = member.enabled;
  }
  return next;
}

function toPoolApplyInput(input: JsonRecord, helpers: RuntimeOauthHelpers): OAuthPoolApplyInput {
  const pool = asRecord(input.pool);
  if (!pool) {
    throw requiredInputError("pool is required.");
  }
  const poolId = helpers.toNonEmptyString(pool.poolId);
  if (!poolId) {
    throw requiredInputError("pool.poolId is required.");
  }
  const name = helpers.toNonEmptyString(pool.name);
  if (!name) {
    throw requiredInputError("pool.name is required.");
  }
  const provider = toRequiredProvider(pool.provider, "pool.provider");
  const next: OAuthPoolApplyInput = {
    pool: {
      poolId,
      provider,
      name,
    },
    members: asArray(input.members).map((member, index) =>
      toPoolMemberInput(member, index, helpers)
    ),
  };
  const strategy = toOptionalStrategy(pool.strategy);
  if (strategy) {
    next.pool.strategy = strategy;
  }
  const stickyMode = toOptionalStickyMode(pool.stickyMode);
  if (stickyMode) {
    next.pool.stickyMode = stickyMode;
  }
  const preferredAccountId = toOptionalString(pool.preferredAccountId, helpers);
  if (preferredAccountId !== undefined) {
    next.pool.preferredAccountId = preferredAccountId;
  }
  const enabled = toOptionalBoolean(pool.enabled);
  if (enabled !== undefined) {
    next.pool.enabled = enabled;
  }
  const metadata = toOptionalMetadata(pool.metadata, "pool.metadata");
  if (metadata !== undefined) {
    next.pool.metadata = metadata;
  }
  const expectedUpdatedAt = toOptionalNumber(input.expectedUpdatedAt, "expectedUpdatedAt");
  if (expectedUpdatedAt !== undefined) {
    next.expectedUpdatedAt = expectedUpdatedAt;
  }
  return next;
}

export function buildRuntimeOauthTools(
  options: Pick<
    BuildRuntimeToolsOptions,
    "snapshot" | "runtimeControl" | "requireUserApproval" | "onApprovalRequest"
  > & {
    helpers: RuntimeOauthHelpers;
  }
): WebMcpToolDescriptor[] {
  const { snapshot, runtimeControl, requireUserApproval, onApprovalRequest, helpers } = options;
  const control = runtimeControl as RuntimeOauthControl;

  return [
    {
      name: "list-runtime-oauth-accounts",
      description: "List runtime OAuth accounts for a provider or across all providers.",
      inputSchema: {
        type: "object",
        properties: {
          provider: { type: "string", enum: ["codex", "gemini", "claude_code"] },
          usageRefresh: { type: "string", enum: ["auto", "force", "off"] },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const listRuntimeOAuthAccounts = requireRuntimeOauthControlMethod(
          control,
          "listRuntimeOAuthAccounts",
          "list-runtime-oauth-accounts"
        );
        const provider =
          input.provider === undefined ? null : toRequiredProvider(input.provider, "provider");
        const usageRefresh =
          input.usageRefresh === undefined ? null : toUsageRefresh(input.usageRefresh);
        if (input.usageRefresh !== undefined && !usageRefresh) {
          throw invalidInputError("usageRefresh must be one of: auto, force, off.");
        }
        const accounts = asArray(
          await listRuntimeOAuthAccounts(provider, { usageRefresh: usageRefresh ?? null })
        );
        return helpers.buildResponse("Runtime OAuth accounts retrieved.", {
          workspaceId: snapshot.workspaceId,
          provider,
          usageRefresh,
          total: accounts.length,
          accounts,
        });
      },
    },
    {
      name: "get-runtime-account-info",
      description:
        "Read the effective runtime account info for the current workspace routing view.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const getRuntimeAccountInfo = requireRuntimeOauthControlMethod(
          control,
          "getRuntimeAccountInfo",
          "get-runtime-account-info"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const accountInfo = await getRuntimeAccountInfo(workspaceId);
        return helpers.buildResponse("Runtime account info retrieved.", {
          workspaceId,
          accountInfo,
        });
      },
    },
    {
      name: "get-runtime-account-rate-limits",
      description: "Read runtime account rate limit state for the current workspace routing view.",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const getRuntimeAccountRateLimits = requireRuntimeOauthControlMethod(
          control,
          "getRuntimeAccountRateLimits",
          "get-runtime-account-rate-limits"
        );
        const workspaceId = helpers.toNonEmptyString(input.workspaceId) ?? snapshot.workspaceId;
        const rateLimits = await getRuntimeAccountRateLimits(workspaceId);
        return helpers.buildResponse("Runtime account rate limits retrieved.", {
          workspaceId,
          rateLimits,
        });
      },
    },
    {
      name: "upsert-runtime-oauth-account",
      description: "Create or update a runtime OAuth account record.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string" },
          provider: { type: "string", enum: ["codex", "gemini", "claude_code"] },
          externalAccountId: { type: "string" },
          email: { type: "string" },
          displayName: { type: "string" },
          status: {
            type: "string",
            enum: ["enabled", "disabled", "forbidden", "validation_blocked"],
          },
          disabledReason: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
        },
        required: ["accountId", "provider"],
      },
      execute: async (input, agent) => {
        const upsertRuntimeOAuthAccount = requireRuntimeOauthControlMethod(
          control,
          "upsertRuntimeOAuthAccount",
          "upsert-runtime-oauth-account"
        );
        const accountId = helpers.toNonEmptyString(input.accountId);
        if (!accountId) {
          throw requiredInputError("accountId is required.");
        }
        const provider = toRequiredProvider(input.provider, "provider");
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Upsert runtime OAuth account ${accountId} for provider ${provider}.`,
          onApprovalRequest
        );
        const nextInput: OAuthAccountUpsertInput = {
          accountId,
          provider,
        };
        const externalAccountId = toOptionalString(input.externalAccountId, helpers);
        if (externalAccountId !== undefined) {
          nextInput.externalAccountId = externalAccountId;
        }
        const email = toOptionalString(input.email, helpers);
        if (email !== undefined) {
          nextInput.email = email;
        }
        const displayName = toOptionalString(input.displayName, helpers);
        if (displayName !== undefined) {
          nextInput.displayName = displayName;
        }
        const status = toOptionalStatus(input.status);
        if (status !== undefined) {
          nextInput.status = status;
        }
        const disabledReason = toOptionalString(input.disabledReason, helpers);
        if (disabledReason !== undefined) {
          nextInput.disabledReason = disabledReason;
        }
        const metadata = toOptionalMetadata(input.metadata, "metadata");
        if (metadata !== undefined) {
          nextInput.metadata = metadata;
        }
        const account = await upsertRuntimeOAuthAccount(nextInput);
        return helpers.buildResponse("Runtime OAuth account upserted.", {
          account,
        });
      },
    },
    {
      name: "remove-runtime-oauth-account",
      description: "Remove a runtime OAuth account record.",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string" },
        },
        required: ["accountId"],
      },
      annotations: { destructiveHint: true },
      execute: async (input, agent) => {
        const removeRuntimeOAuthAccount = requireRuntimeOauthControlMethod(
          control,
          "removeRuntimeOAuthAccount",
          "remove-runtime-oauth-account"
        );
        const accountId = helpers.toNonEmptyString(input.accountId);
        if (!accountId) {
          throw requiredInputError("accountId is required.");
        }
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Remove runtime OAuth account ${accountId}.`,
          onApprovalRequest
        );
        const removed = await removeRuntimeOAuthAccount(accountId);
        return helpers.buildResponse("Runtime OAuth account removed.", {
          accountId,
          removed,
        });
      },
    },
    {
      name: "list-runtime-oauth-pools",
      description: "List runtime OAuth pools for a provider or across all providers.",
      inputSchema: {
        type: "object",
        properties: {
          provider: { type: "string", enum: ["codex", "gemini", "claude_code"] },
        },
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const listRuntimeOAuthPools = requireRuntimeOauthControlMethod(
          control,
          "listRuntimeOAuthPools",
          "list-runtime-oauth-pools"
        );
        const provider =
          input.provider === undefined ? null : toRequiredProvider(input.provider, "provider");
        const pools = asArray(await listRuntimeOAuthPools(provider));
        return helpers.buildResponse("Runtime OAuth pools retrieved.", {
          provider,
          total: pools.length,
          pools,
        });
      },
    },
    {
      name: "list-runtime-oauth-pool-members",
      description: "List runtime OAuth pool members by pool id.",
      inputSchema: {
        type: "object",
        properties: {
          poolId: { type: "string" },
        },
        required: ["poolId"],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const listRuntimeOAuthPoolMembers = requireRuntimeOauthControlMethod(
          control,
          "listRuntimeOAuthPoolMembers",
          "list-runtime-oauth-pool-members"
        );
        const poolId = helpers.toNonEmptyString(input.poolId);
        if (!poolId) {
          throw requiredInputError("poolId is required.");
        }
        const members = asArray(await listRuntimeOAuthPoolMembers(poolId));
        return helpers.buildResponse("Runtime OAuth pool members retrieved.", {
          poolId,
          total: members.length,
          members,
        });
      },
    },
    {
      name: "apply-runtime-oauth-pool",
      description:
        "Apply runtime OAuth pool configuration and member state with optimistic concurrency.",
      inputSchema: {
        type: "object",
        properties: {
          pool: { type: "object", additionalProperties: true },
          members: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          expectedUpdatedAt: { type: "number" },
        },
        required: ["pool", "members"],
      },
      execute: async (input, agent) => {
        const applyRuntimeOAuthPool = requireRuntimeOauthControlMethod(
          control,
          "applyRuntimeOAuthPool",
          "apply-runtime-oauth-pool"
        );
        const nextInput = toPoolApplyInput(input, helpers);
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Apply runtime OAuth pool ${nextInput.pool.poolId} for provider ${nextInput.pool.provider}.`,
          onApprovalRequest
        );
        const result = await applyRuntimeOAuthPool(nextInput);
        return helpers.buildResponse("Runtime OAuth pool applied.", {
          poolId: nextInput.pool.poolId,
          result,
        });
      },
    },
    {
      name: "remove-runtime-oauth-pool",
      description: "Remove a runtime OAuth pool definition.",
      inputSchema: {
        type: "object",
        properties: {
          poolId: { type: "string" },
        },
        required: ["poolId"],
      },
      annotations: { destructiveHint: true },
      execute: async (input, agent) => {
        const removeRuntimeOAuthPool = requireRuntimeOauthControlMethod(
          control,
          "removeRuntimeOAuthPool",
          "remove-runtime-oauth-pool"
        );
        const poolId = helpers.toNonEmptyString(input.poolId);
        if (!poolId) {
          throw requiredInputError("poolId is required.");
        }
        await helpers.confirmWriteAction(
          agent,
          requireUserApproval,
          `Remove runtime OAuth pool ${poolId}.`,
          onApprovalRequest
        );
        const removed = await removeRuntimeOAuthPool(poolId);
        return helpers.buildResponse("Runtime OAuth pool removed.", {
          poolId,
          removed,
        });
      },
    },
    {
      name: "select-runtime-oauth-pool-account",
      description:
        "Resolve the runtime OAuth account selected for a pool and optional model/session.",
      inputSchema: {
        type: "object",
        properties: {
          poolId: { type: "string" },
          sessionId: { type: "string" },
          workspaceId: { type: "string" },
          modelId: { type: "string" },
        },
        required: ["poolId"],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const selectRuntimeOAuthPoolAccount = requireRuntimeOauthControlMethod(
          control,
          "selectRuntimeOAuthPoolAccount",
          "select-runtime-oauth-pool-account"
        );
        const poolId = helpers.toNonEmptyString(input.poolId);
        if (!poolId) {
          throw requiredInputError("poolId is required.");
        }
        const selection = await selectRuntimeOAuthPoolAccount({
          poolId,
          modelId: helpers.toNonEmptyString(input.modelId),
          sessionId: helpers.toNonEmptyString(input.sessionId),
          workspaceId: helpers.toNonEmptyString(input.workspaceId),
        });
        return helpers.buildResponse("Runtime OAuth pool account selected.", {
          poolId,
          selection,
        });
      },
    },
  ];
}
