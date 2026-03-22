import type {
  OAuthPoolMember,
  OAuthPoolMemberInput,
} from "../../../../application/runtime/ports/runtimeClient";
import {
  readRuntimeErrorCode,
  readRuntimeErrorMessage,
} from "../../../../application/runtime/ports/runtimeErrorClassifier";
import type {
  OAuthAccountSummary,
  OAuthPoolSummary,
  OAuthProviderId,
} from "../../../../application/runtime/ports/tauriOauth";
import type { RuntimeProviderCatalogEntry } from "../../../../contracts/runtime";
import {
  buildProviderBrandOptionsFromCatalog,
  buildProviderBrandOptionsFromState,
  FALLBACK_PROVIDER_BRAND_OPTIONS,
  type ProviderBrandId,
  type ProviderBrandOption,
} from "../../../app/utils/antiGravityBranding";
import { getDefaultPrimaryPoolIdForProvider } from "../../../../application/runtime/facades/runtimeOauthPrimaryPool";
import { resolveRateLimitsSnapshot } from "../../../../utils/rateLimits";

export type ProviderOption = ProviderBrandOption;

export const FALLBACK_PROVIDER_OPTIONS: ReadonlyArray<ProviderOption> =
  FALLBACK_PROVIDER_BRAND_OPTIONS;

export function buildProviderOptionsFromCatalog(
  entries: ReadonlyArray<RuntimeProviderCatalogEntry>
): ProviderOption[] {
  return buildProviderBrandOptionsFromCatalog(entries);
}

export function buildProviderOptionsFromState(
  accounts: ReadonlyArray<OAuthAccountSummary>,
  pools: ReadonlyArray<OAuthPoolSummary>
): ProviderOption[] {
  const options = buildProviderBrandOptionsFromState(accounts, pools);
  return options.length > 0 ? options : [...FALLBACK_PROVIDER_OPTIONS];
}

export function formatProvider(
  provider: OAuthProviderId,
  options: ReadonlyArray<ProviderOption>
): string {
  return (
    options.find((option) => option.id === provider)?.label ??
    options.find((option) => option.routeProviderId === provider)?.label ??
    provider
  );
}

export function formatProviderBrand(
  provider: ProviderBrandId,
  options: ReadonlyArray<ProviderOption>
): string {
  return options.find((option) => option.id === provider)?.label ?? provider;
}

export function formatProviderOptionLabel(option: ProviderOption): string {
  return option.available ? option.label : `${option.label} (unavailable)`;
}

export function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "pool"
  );
}

export function createLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function canonicalDefaultPoolId(provider: OAuthProviderId): string {
  return getDefaultPrimaryPoolIdForProvider(provider);
}

export function formatTimestamp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "unknown";
  }
  return new Date(value).toLocaleString();
}

export function formatError(error: unknown, fallback: string): string {
  const message = readRuntimeErrorMessage(error);
  if (message) {
    return message;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

export function readErrorCode(error: unknown): string | null {
  return readRuntimeErrorCode(error);
}

export const POOL_VERSION_MISMATCH_CODE = "runtime.approval.pool.version_mismatch";

export function isPoolVersionMismatchError(error: unknown): boolean {
  const code = readErrorCode(error);
  return code === POOL_VERSION_MISMATCH_CODE;
}

export function ratioPercent(part: number, whole: number): number {
  if (whole <= 0) {
    return 0;
  }
  const raw = Math.round((part / whole) * 100);
  return Math.max(0, Math.min(100, raw));
}

type JsonRecord = Record<string, unknown>;

type UsageWindowSnapshot = {
  usedPercent: number | null;
  resetsAt: number | null;
};

export type AccountUsageSnapshot = {
  session: UsageWindowSnapshot;
  weekly: UsageWindowSnapshot;
  creditsLabel: string | null;
  planType: string | null;
  checkedAt: number | null;
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePercent(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return Math.min(Math.max(Math.round(value), 0), 100);
}

function normalizeTimestampMs(value: number | null): number | null {
  if (value === null || value <= 0) {
    return null;
  }
  if (value >= 1_000_000_000_000) {
    return Math.round(value);
  }
  return Math.round(value * 1000);
}

function parseUsageWindowSnapshot(rawWindow: unknown): UsageWindowSnapshot {
  const windowRecord = asRecord(rawWindow);
  if (!windowRecord) {
    return {
      usedPercent: null,
      resetsAt: null,
    };
  }
  return {
    usedPercent: normalizePercent(
      asFiniteNumber(windowRecord.usedPercent ?? windowRecord.used_percent)
    ),
    resetsAt: normalizeTimestampMs(asFiniteNumber(windowRecord.resetsAt ?? windowRecord.resets_at)),
  };
}

function parseCreditsLabel(rawCredits: unknown): string | null {
  const credits = asRecord(rawCredits);
  if (!credits) {
    return null;
  }
  const hasCredits = Boolean(credits.hasCredits ?? credits.has_credits);
  if (!hasCredits) {
    return null;
  }
  const unlimited = Boolean(credits.unlimited);
  if (unlimited) {
    return "Credits: Unlimited";
  }
  const balanceRaw = asNonEmptyString(credits.balance);
  if (!balanceRaw) {
    return null;
  }
  const numericBalance = Number(balanceRaw);
  if (Number.isFinite(numericBalance) && numericBalance > 0) {
    return `Credits: ${Math.round(numericBalance)} credits`;
  }
  return `Credits: ${balanceRaw}`;
}

export function readAccountUsageSnapshot(
  account: OAuthAccountSummary
): AccountUsageSnapshot | null {
  const metadata = asRecord(account.metadata);
  if (!metadata) {
    return null;
  }
  const rateLimits = resolveRateLimitsSnapshot(metadata) ?? ({} as JsonRecord);
  const session = parseUsageWindowSnapshot(rateLimits.primary);
  const weekly = parseUsageWindowSnapshot(rateLimits.secondary);
  const creditsLabel = parseCreditsLabel(rateLimits.credits);
  const planType =
    asNonEmptyString(rateLimits.planType ?? rateLimits.plan_type) ??
    asNonEmptyString(metadata.planType ?? metadata.plan_type);
  const checkedAt = normalizeTimestampMs(
    asFiniteNumber(metadata.usageCheckedAt ?? metadata.usage_checked_at)
  );

  const hasUsage =
    session.usedPercent !== null ||
    weekly.usedPercent !== null ||
    creditsLabel !== null ||
    planType !== null ||
    checkedAt !== null;
  if (!hasUsage) {
    return null;
  }

  return {
    session,
    weekly,
    creditsLabel,
    planType,
    checkedAt,
  };
}
export function providerMonogram(label: string): string {
  const tokens = label
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return "?";
  }
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return `${tokens[0]?.[0] ?? ""}${tokens[1]?.[0] ?? ""}`.toUpperCase();
}

export type PoolDraft = {
  name: string;
  strategy: OAuthPoolSummary["strategy"];
  stickyMode: OAuthPoolSummary["stickyMode"];
  preferredAccountId: string;
  memberAccountIds: string[];
  memberPoliciesByAccountId: Record<string, PoolMemberPolicyDraft>;
  enabled: boolean;
};

export type PoolMemberPolicyDraft = {
  weight: number;
  priority: number;
  position: number;
  enabled: boolean;
};

const POOL_MEMBER_WEIGHT_MIN = 1;
const POOL_MEMBER_WEIGHT_MAX = 20;

function toFiniteInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.trunc(value);
}

function clampPoolMemberWeight(value: unknown, fallback: number): number {
  const normalized = toFiniteInteger(value, fallback);
  return Math.min(Math.max(normalized, POOL_MEMBER_WEIGHT_MIN), POOL_MEMBER_WEIGHT_MAX);
}

function clampPoolMemberPriority(value: unknown, fallback: number): number {
  const normalized = toFiniteInteger(value, fallback);
  return Math.max(0, normalized);
}

function clampPoolMemberPosition(value: unknown, fallback: number): number {
  const normalized = toFiniteInteger(value, fallback);
  return Math.max(0, normalized);
}

function normalizeMemberPolicy(
  policy: Partial<PoolMemberPolicyDraft> | null | undefined,
  fallback: PoolMemberPolicyDraft
): PoolMemberPolicyDraft {
  return {
    weight: clampPoolMemberWeight(policy?.weight, fallback.weight),
    priority: clampPoolMemberPriority(policy?.priority, fallback.priority),
    position: clampPoolMemberPosition(policy?.position, fallback.position),
    enabled: policy?.enabled ?? fallback.enabled,
  };
}

function createDefaultMemberPolicy(
  account: OAuthAccountSummary | null,
  index: number
): PoolMemberPolicyDraft {
  return {
    weight: 1,
    priority: Math.max(0, index),
    position: Math.max(0, index),
    enabled: account?.status === "enabled",
  };
}

function normalizeSelectedMemberIds(
  ids: ReadonlyArray<string>,
  providerIdSet: ReadonlySet<string>
): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const rawId of ids) {
    const accountId = rawId.trim();
    if (!accountId || !providerIdSet.has(accountId) || seen.has(accountId)) {
      continue;
    }
    seen.add(accountId);
    normalized.push(accountId);
  }
  return normalized;
}

function buildPolicyByAccountIdFromMembers(
  members: OAuthPoolMember[],
  providerAccountById: ReadonlyMap<string, OAuthAccountSummary>
): Record<string, PoolMemberPolicyDraft> {
  const policies: Record<string, PoolMemberPolicyDraft> = {};
  for (const member of members) {
    const account = providerAccountById.get(member.accountId) ?? null;
    const fallback = createDefaultMemberPolicy(account, member.position);
    policies[member.accountId] = normalizeMemberPolicy(member, fallback);
  }
  return policies;
}

export function buildPoolDrafts(
  nextPools: OAuthPoolSummary[],
  nextAccounts: OAuthAccountSummary[],
  poolMembersByPoolId: Record<string, OAuthPoolMember[]>,
  previousDrafts: Record<string, PoolDraft> = {}
): Record<string, PoolDraft> {
  return Object.fromEntries(
    nextPools.map((pool) => {
      const providerAccounts = nextAccounts.filter((account) => account.provider === pool.provider);
      const providerAccountIds = providerAccounts.map((account) => account.accountId);
      const previous = previousDrafts[pool.poolId];
      const providerIdSet = new Set(providerAccountIds);
      const providerAccountById = new Map(
        providerAccounts.map((account) => [account.accountId, account] as const)
      );
      const remoteMembers = (poolMembersByPoolId[pool.poolId] ?? [])
        .filter((member) => providerIdSet.has(member.accountId))
        .slice()
        .sort(
          (left, right) =>
            left.position - right.position ||
            left.priority - right.priority ||
            left.accountId.localeCompare(right.accountId)
        );
      const hasRemoteMembers = remoteMembers.length > 0;
      const memberAccountIds = hasRemoteMembers
        ? remoteMembers.map((member) => member.accountId)
        : normalizeSelectedMemberIds(
            previous?.memberAccountIds ?? providerAccountIds,
            providerIdSet
          );
      const memberPoliciesByAccountId = hasRemoteMembers
        ? buildPolicyByAccountIdFromMembers(remoteMembers, providerAccountById)
        : {};
      if (!hasRemoteMembers) {
        for (const [index, accountId] of memberAccountIds.entries()) {
          const account = providerAccountById.get(accountId) ?? null;
          const fallback = createDefaultMemberPolicy(account, index);
          memberPoliciesByAccountId[accountId] = normalizeMemberPolicy(
            previous?.memberPoliciesByAccountId?.[accountId] ?? null,
            fallback
          );
        }
      }
      const preferredAccountIdCandidate =
        pool.preferredAccountId ?? previous?.preferredAccountId ?? "";
      const preferredAccountId =
        preferredAccountIdCandidate && !memberAccountIds.includes(preferredAccountIdCandidate)
          ? ""
          : preferredAccountIdCandidate;
      return [
        pool.poolId,
        {
          name: previous?.name?.trim() || pool.name,
          strategy: pool.strategy,
          stickyMode: pool.stickyMode,
          preferredAccountId,
          memberAccountIds,
          memberPoliciesByAccountId,
          enabled: pool.enabled,
        },
      ];
    })
  );
}

export function buildPoolMembersFromAccounts(
  providerAccountsSnapshot: OAuthAccountSummary[],
  selectedAccountIds: ReadonlyArray<string> | null = null
) {
  return buildPoolMembersFromDraft(providerAccountsSnapshot, null, selectedAccountIds);
}

export function applyMemberSelectionToPoolDraft(
  draft: PoolDraft,
  providerAccounts: OAuthAccountSummary[],
  selectedAccountIds: ReadonlyArray<string>
): PoolDraft {
  const providerIdSet = new Set(providerAccounts.map((account) => account.accountId));
  const providerAccountById = new Map(
    providerAccounts.map((account) => [account.accountId, account] as const)
  );
  const nextMemberAccountIds = normalizeSelectedMemberIds(selectedAccountIds, providerIdSet);
  const nextMemberPoliciesByAccountId: Record<string, PoolMemberPolicyDraft> = {};
  for (const [index, accountId] of nextMemberAccountIds.entries()) {
    const account = providerAccountById.get(accountId) ?? null;
    const fallback = createDefaultMemberPolicy(account, index);
    nextMemberPoliciesByAccountId[accountId] = normalizeMemberPolicy(
      draft.memberPoliciesByAccountId[accountId] ?? null,
      fallback
    );
  }
  return {
    ...draft,
    memberAccountIds: nextMemberAccountIds,
    memberPoliciesByAccountId: nextMemberPoliciesByAccountId,
    preferredAccountId: nextMemberAccountIds.includes(draft.preferredAccountId)
      ? draft.preferredAccountId
      : "",
  };
}

export function updatePoolDraftMemberPolicy(
  draft: PoolDraft,
  accountId: string,
  patch: Partial<PoolMemberPolicyDraft>
): PoolDraft {
  if (!draft.memberAccountIds.includes(accountId)) {
    return draft;
  }
  const index = draft.memberAccountIds.indexOf(accountId);
  const fallback = createDefaultMemberPolicy(null, index);
  const currentPolicy = normalizeMemberPolicy(draft.memberPoliciesByAccountId[accountId], fallback);
  const nextPolicy = normalizeMemberPolicy({ ...currentPolicy, ...patch }, currentPolicy);
  return {
    ...draft,
    memberPoliciesByAccountId: {
      ...draft.memberPoliciesByAccountId,
      [accountId]: nextPolicy,
    },
  };
}

export function buildPoolMembersFromDraft(
  providerAccountsSnapshot: OAuthAccountSummary[],
  draft: Pick<PoolDraft, "memberAccountIds" | "memberPoliciesByAccountId"> | null,
  selectedAccountIds: ReadonlyArray<string> | null = null
): OAuthPoolMemberInput[] {
  const providerAccountById = new Map(
    providerAccountsSnapshot.map((account) => [account.accountId, account] as const)
  );
  const providerIdSet = new Set(providerAccountsSnapshot.map((account) => account.accountId));
  const selectedSource =
    selectedAccountIds ??
    draft?.memberAccountIds ??
    providerAccountsSnapshot.map((a) => a.accountId);
  const selectedIds = normalizeSelectedMemberIds(selectedSource, providerIdSet);
  const members = selectedIds.map((accountId, index) => {
    const account = providerAccountById.get(accountId) ?? null;
    const fallback = createDefaultMemberPolicy(account, index);
    const policy = normalizeMemberPolicy(draft?.memberPoliciesByAccountId?.[accountId], fallback);
    return {
      accountId,
      ...policy,
      selectedIndex: index,
    };
  });
  members.sort(
    (left, right) =>
      left.priority - right.priority ||
      left.position - right.position ||
      left.selectedIndex - right.selectedIndex ||
      left.accountId.localeCompare(right.accountId)
  );
  return members.map((member, index) => ({
    accountId: member.accountId,
    weight: member.weight,
    priority: member.priority,
    position: index,
    enabled: member.enabled,
  }));
}

export function readMultiSelectValues(target: HTMLSelectElement): string[] {
  return Array.from(target.selectedOptions)
    .map((option) => option.value)
    .filter((value) => value.trim().length > 0);
}
