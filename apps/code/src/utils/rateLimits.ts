type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasOwn(source: JsonRecord, key: string): boolean {
  return Object.hasOwn(source, key);
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function looksLikeRateLimitSnapshot(source: JsonRecord): boolean {
  return (
    hasOwn(source, "primary") ||
    hasOwn(source, "secondary") ||
    hasOwn(source, "credits") ||
    hasOwn(source, "planType") ||
    hasOwn(source, "plan_type") ||
    hasOwn(source, "limitId") ||
    hasOwn(source, "limit_id") ||
    hasOwn(source, "limitName") ||
    hasOwn(source, "limit_name")
  );
}

function looksLikeRawUsagePayload(source: JsonRecord): boolean {
  if (
    hasOwn(source, "rate_limit") ||
    hasOwn(source, "rateLimit") ||
    hasOwn(source, "plan_type") ||
    hasOwn(source, "plan")
  ) {
    return true;
  }
  const credits = isRecord(source.credits) ? source.credits : null;
  return Boolean(
    credits &&
    (hasOwn(credits, "has_credits") ||
      (typeof credits.balance === "number" && Number.isFinite(credits.balance)))
  );
}

function readResultRecord(source: JsonRecord): JsonRecord | null {
  return isRecord(source.result) ? source.result : null;
}

function readDirectRateLimits(source: JsonRecord | null): JsonRecord | null {
  if (!source) {
    return null;
  }
  if (isRecord(source.rateLimits)) {
    return source.rateLimits;
  }
  if (isRecord(source.rate_limits)) {
    return source.rate_limits;
  }
  return null;
}

function readRateLimitsByLimitId(source: JsonRecord | null): JsonRecord | null {
  if (!source) {
    return null;
  }
  if (isRecord(source.rateLimitsByLimitId)) {
    return source.rateLimitsByLimitId;
  }
  if (isRecord(source.rate_limits_by_limit_id)) {
    return source.rate_limits_by_limit_id;
  }
  return null;
}

function readObservedAtMs(source: JsonRecord | null): number | null {
  if (!source) {
    return null;
  }
  const direct = asFiniteNumber(source.usageCheckedAt ?? source.usage_checked_at);
  if (direct !== null) {
    return direct >= 1_000_000_000_000 ? Math.round(direct) : Math.round(direct * 1000);
  }
  const result = readResultRecord(source);
  if (!result) {
    return null;
  }
  const nested = asFiniteNumber(result.usageCheckedAt ?? result.usage_checked_at);
  if (nested === null) {
    return null;
  }
  return nested >= 1_000_000_000_000 ? Math.round(nested) : Math.round(nested * 1000);
}

function normalizeUsageWindow(source: unknown, observedAtMs: number | null): JsonRecord | null {
  if (!isRecord(source)) {
    return null;
  }
  const directUsed = asFiniteNumber(source.usedPercent ?? source.used_percent);
  const remaining = asFiniteNumber(
    source.remainingPercent ?? source.remaining_percent ?? source.remaining
  );
  const usedPercent =
    directUsed !== null
      ? clampPercent(directUsed)
      : remaining !== null
        ? clampPercent(100 - remaining)
        : null;
  if (usedPercent === null) {
    return null;
  }

  const windowDurationMins =
    asFiniteNumber(source.windowDurationMins ?? source.window_duration_mins) ??
    (() => {
      const windowSeconds = asFiniteNumber(
        source.limitWindowSeconds ?? source.limit_window_seconds
      );
      return windowSeconds !== null ? windowSeconds / 60 : null;
    })();
  const resetAtRaw = asFiniteNumber(source.resetsAt ?? source.reset_at ?? source.resetAt);
  const resetAfterSeconds = asFiniteNumber(source.resetAfterSeconds ?? source.reset_after_seconds);
  const resetsAt =
    resetAtRaw !== null
      ? resetAtRaw >= 1_000_000_000_000
        ? Math.round(resetAtRaw)
        : Math.round(resetAtRaw * 1000)
      : resetAfterSeconds !== null && observedAtMs !== null
        ? Math.round(observedAtMs + resetAfterSeconds * 1000)
        : null;

  return {
    usedPercent,
    ...(windowDurationMins !== null ? { windowDurationMins } : {}),
    ...(resetsAt !== null ? { resetsAt } : {}),
  };
}

function normalizeCreditsSnapshot(source: unknown): JsonRecord | null {
  if (!isRecord(source)) {
    return null;
  }
  const hasCredits =
    typeof source.hasCredits === "boolean"
      ? source.hasCredits
      : typeof source.has_credits === "boolean"
        ? source.has_credits
        : null;
  const unlimited = typeof source.unlimited === "boolean" ? source.unlimited : null;
  const balance =
    typeof source.balance === "string"
      ? source.balance.trim() || null
      : typeof source.balance === "number" && Number.isFinite(source.balance)
        ? String(source.balance)
        : null;

  if (hasCredits === null && unlimited === null && balance === null) {
    return null;
  }

  return {
    ...(hasCredits !== null ? { hasCredits } : {}),
    ...(unlimited !== null ? { unlimited } : {}),
    ...(balance !== null ? { balance } : {}),
  };
}

function normalizeRawUsagePayload(
  source: JsonRecord | null,
  observedAtMs: number | null
): JsonRecord | null {
  if (!source || !looksLikeRawUsagePayload(source)) {
    return null;
  }
  const rateLimit = isRecord(source.rate_limit)
    ? source.rate_limit
    : isRecord(source.rateLimit)
      ? source.rateLimit
      : null;
  const primary = normalizeUsageWindow(
    rateLimit?.primary_window ?? rateLimit?.primaryWindow ?? null,
    observedAtMs
  );
  const secondary = normalizeUsageWindow(
    rateLimit?.secondary_window ?? rateLimit?.secondaryWindow ?? null,
    observedAtMs
  );
  const credits = normalizeCreditsSnapshot(source.credits);
  const planType =
    asNonEmptyString(source.planType) ??
    asNonEmptyString(source.plan_type) ??
    asNonEmptyString(source.plan);

  if (!primary && !secondary && !credits && !planType) {
    return null;
  }

  return {
    ...(primary ? { primary } : {}),
    ...(secondary ? { secondary } : {}),
    ...(credits ? { credits } : {}),
    ...(planType ? { planType } : {}),
  };
}

function normalizeLimitSnapshotIdentity(
  snapshot: JsonRecord,
  fallbackLimitId: string | null,
  fallbackLimitName: string | null
): JsonRecord {
  const limitId =
    asNonEmptyString(snapshot.limitId) ?? asNonEmptyString(snapshot.limit_id) ?? fallbackLimitId;
  const limitName =
    asNonEmptyString(snapshot.limitName) ??
    asNonEmptyString(snapshot.limit_name) ??
    fallbackLimitName;
  if (!limitId && !limitName) {
    return snapshot;
  }
  return {
    ...snapshot,
    ...(limitId ? { limitId, limit_id: limitId } : {}),
    ...(limitName ? { limitName, limit_name: limitName } : {}),
  };
}

function readSnapshotFromLimitBucket(bucketKey: string, rawBucket: unknown): JsonRecord | null {
  if (!isRecord(rawBucket)) {
    return null;
  }
  const nestedSnapshot = readDirectRateLimits(rawBucket);
  const snapshot = nestedSnapshot ?? rawBucket;
  const observedAtMs = readObservedAtMs(rawBucket) ?? readObservedAtMs(snapshot);
  const normalizedRawUsage = normalizeRawUsagePayload(snapshot, observedAtMs);
  if (normalizedRawUsage) {
    return normalizeLimitSnapshotIdentity(
      normalizedRawUsage,
      asNonEmptyString(bucketKey),
      asNonEmptyString(rawBucket.limitName) ??
        asNonEmptyString(rawBucket.limit_name) ??
        asNonEmptyString(snapshot.limitName) ??
        asNonEmptyString(snapshot.limit_name)
    );
  }
  if (!looksLikeRateLimitSnapshot(snapshot)) {
    return null;
  }
  const fallbackLimitId = asNonEmptyString(bucketKey);
  const fallbackLimitName =
    asNonEmptyString(rawBucket.limitName) ??
    asNonEmptyString(rawBucket.limit_name) ??
    asNonEmptyString(snapshot.limitName) ??
    asNonEmptyString(snapshot.limit_name);
  return normalizeLimitSnapshotIdentity(snapshot, fallbackLimitId, fallbackLimitName);
}

export function resolveRateLimitsByLimitIdSnapshot(raw: unknown): JsonRecord | null {
  if (!isRecord(raw)) {
    return null;
  }
  const entries = Object.entries(raw);
  const codexEntry = entries.find(([bucketKey]) => bucketKey.trim().toLowerCase() === "codex");
  if (codexEntry) {
    const codexSnapshot = readSnapshotFromLimitBucket(codexEntry[0], codexEntry[1]);
    if (codexSnapshot) {
      return codexSnapshot;
    }
  }
  for (const [bucketKey, bucketValue] of entries) {
    const snapshot = readSnapshotFromLimitBucket(bucketKey, bucketValue);
    if (snapshot) {
      return snapshot;
    }
  }
  return null;
}

export function resolveRateLimitsByLimitIdMap(raw: unknown): JsonRecord | null {
  if (!isRecord(raw)) {
    return null;
  }
  const result = readResultRecord(raw);
  return readRateLimitsByLimitId(result) ?? readRateLimitsByLimitId(raw);
}

export function resolveRateLimitsSnapshot(raw: unknown): JsonRecord | null {
  if (!isRecord(raw)) {
    return null;
  }
  const result = readResultRecord(raw);
  const direct = readDirectRateLimits(result) ?? readDirectRateLimits(raw);
  if (direct) {
    return (
      normalizeRawUsagePayload(direct, readObservedAtMs(result) ?? readObservedAtMs(raw)) ?? direct
    );
  }
  const byLimitId =
    resolveRateLimitsByLimitIdSnapshot(readRateLimitsByLimitId(result)) ??
    resolveRateLimitsByLimitIdSnapshot(readRateLimitsByLimitId(raw));
  if (byLimitId) {
    return byLimitId;
  }
  const normalizedResultUsage = normalizeRawUsagePayload(result, readObservedAtMs(result));
  if (normalizedResultUsage) {
    return normalizedResultUsage;
  }
  const normalizedRawUsage = normalizeRawUsagePayload(raw, readObservedAtMs(raw));
  if (normalizedRawUsage) {
    return normalizedRawUsage;
  }
  if (result && looksLikeRateLimitSnapshot(result)) {
    return result;
  }
  if (looksLikeRateLimitSnapshot(raw)) {
    return raw;
  }
  return null;
}
