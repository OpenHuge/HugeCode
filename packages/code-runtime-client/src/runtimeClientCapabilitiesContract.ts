import {
  CODE_RUNTIME_RPC_CONTRACT_VERSION,
  CODE_RUNTIME_RPC_ERROR_CODES,
  CODE_RUNTIME_RPC_FEATURES,
  CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT,
  CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES,
  type CodeRuntimeRpcCapabilities,
  type CodeRuntimeRpcInvocationCompletionMode,
  isCodeRuntimeRpcMethod,
} from "@ku0/code-runtime-host-contract";

const MIN_CODE_RUNTIME_RPC_CONTRACT_VERSION = CODE_RUNTIME_RPC_CONTRACT_VERSION;
const REQUIRED_CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT = CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT;
const EXPECTED_RUNTIME_RPC_ERROR_CODES: ReadonlyMap<string, string> = new Map(
  Object.entries(CODE_RUNTIME_RPC_ERROR_CODES)
);
const OPTIONAL_RUNTIME_RPC_FEATURES: ReadonlySet<string> = new Set(["git_diff_paging_v1"]);
const REQUIRED_RUNTIME_RPC_FEATURES = CODE_RUNTIME_RPC_FEATURES.filter(
  (feature) => !OPTIONAL_RUNTIME_RPC_FEATURES.has(feature)
);
const REQUIRED_RUNTIME_RPC_FROZEN_FEATURE = `contract_frozen_${CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT.replaceAll("-", "_")}`;
const REQUIRED_RUNTIME_RPC_FEATURES_DESKTOP_CORE: readonly string[] = [
  "method_not_found_error_code",
  "rpc_capabilities_handshake",
  REQUIRED_RUNTIME_RPC_FROZEN_FEATURE,
];
const RUNTIME_RPC_CAPABILITY_PROFILE_DESKTOP_CORE = "desktop-core";
const KNOWN_RUNTIME_RPC_CAPABILITY_PROFILES: ReadonlySet<string> = new Set([
  "full-runtime",
  RUNTIME_RPC_CAPABILITY_PROFILE_DESKTOP_CORE,
]);

export type RuntimeRpcCapabilitiesSnapshot = {
  methods: ReadonlySet<string>;
  profile: string | null;
  contractVersion: string | null;
  freezeEffectiveAt: string | null;
  methodSetHash: string | null;
  features: ReadonlySet<string>;
  errorCodes: ReadonlyMap<string, string> | null;
  wsEndpointPath: string | null;
  invocationPolicies?: ReadonlyMap<string, RuntimeRpcMethodInvocationPolicy>;
};

export type RuntimeRpcMethodInvocationPolicy = {
  completionMode: CodeRuntimeRpcInvocationCompletionMode;
  ackTimeoutMs: number | null;
};

export class RuntimeRpcContractVersionMismatchError extends Error {
  readonly expectedMinimum: string;
  readonly actualVersion: string;

  constructor(actualVersion: string, expectedMinimum: string) {
    super(
      `Runtime RPC contract ${actualVersion} is older than required minimum ${expectedMinimum}.`
    );
    this.name = "RuntimeRpcContractVersionMismatchError";
    this.expectedMinimum = expectedMinimum;
    this.actualVersion = actualVersion;
  }
}

export class RuntimeRpcCapabilitiesMethodSetHashMismatchError extends Error {
  readonly expectedMethodSetHash: string;
  readonly actualMethodSetHash: string;

  constructor(actualMethodSetHash: string, expectedMethodSetHash: string) {
    super(
      `Runtime RPC methodSetHash mismatch. expected=${expectedMethodSetHash} actual=${actualMethodSetHash}.`
    );
    this.name = "RuntimeRpcCapabilitiesMethodSetHashMismatchError";
    this.expectedMethodSetHash = expectedMethodSetHash;
    this.actualMethodSetHash = actualMethodSetHash;
  }
}

export class RuntimeRpcCapabilitiesMethodSetHashMissingError extends Error {
  constructor() {
    super("Runtime RPC methodSetHash is required for frozen contracts.");
    this.name = "RuntimeRpcCapabilitiesMethodSetHashMissingError";
  }
}

export class RuntimeRpcContractProfileMismatchError extends Error {
  readonly actualProfile: string;
  readonly expectedProfiles: readonly string[];

  constructor(actualProfile: string) {
    super(
      `Runtime RPC profile mismatch. expected one of ${[...KNOWN_RUNTIME_RPC_CAPABILITY_PROFILES].join(", ")}; actual=${actualProfile}.`
    );
    this.name = "RuntimeRpcContractProfileMismatchError";
    this.actualProfile = actualProfile;
    this.expectedProfiles = [...KNOWN_RUNTIME_RPC_CAPABILITY_PROFILES];
  }
}

export class RuntimeRpcContractCanonicalMethodsOnlyError extends Error {
  readonly nonCanonicalMethods: readonly string[];

  constructor(nonCanonicalMethods: readonly string[]) {
    super(
      `Runtime RPC capabilities must advertise canonical methods only. invalid methods: ${nonCanonicalMethods.join(", ")}.`
    );
    this.name = "RuntimeRpcContractCanonicalMethodsOnlyError";
    this.nonCanonicalMethods = [...nonCanonicalMethods];
  }
}

export class RuntimeRpcContractFeatureMissingError extends Error {
  readonly missingFeatures: readonly string[];

  constructor(missingFeatures: readonly string[]) {
    super(`Runtime RPC contract missing required features: ${missingFeatures.join(", ")}.`);
    this.name = "RuntimeRpcContractFeatureMissingError";
    this.missingFeatures = [...missingFeatures];
  }
}

export class RuntimeRpcContractFreezeEffectiveAtMismatchError extends Error {
  readonly expectedFreezeEffectiveAt: string;
  readonly actualFreezeEffectiveAt: string | null;

  constructor(actualFreezeEffectiveAt: string | null, expectedFreezeEffectiveAt: string) {
    super(
      `Runtime RPC freezeEffectiveAt mismatch. expected=${expectedFreezeEffectiveAt} actual=${String(actualFreezeEffectiveAt)}.`
    );
    this.name = "RuntimeRpcContractFreezeEffectiveAtMismatchError";
    this.expectedFreezeEffectiveAt = expectedFreezeEffectiveAt;
    this.actualFreezeEffectiveAt = actualFreezeEffectiveAt;
  }
}

export class RuntimeRpcContractErrorCodesMismatchError extends Error {
  readonly expectedErrorCodes: Readonly<Record<string, string>>;
  readonly actualErrorCodes: Readonly<Record<string, string>> | null;

  constructor(actualErrorCodes: Readonly<Record<string, string>> | null) {
    super("Runtime RPC errorCodes mismatch from frozen contract.");
    this.name = "RuntimeRpcContractErrorCodesMismatchError";
    this.expectedErrorCodes = Object.freeze(Object.fromEntries(EXPECTED_RUNTIME_RPC_ERROR_CODES));
    this.actualErrorCodes = actualErrorCodes;
  }
}

export type RuntimeRpcContractGuardError =
  | RuntimeRpcContractVersionMismatchError
  | RuntimeRpcCapabilitiesMethodSetHashMissingError
  | RuntimeRpcCapabilitiesMethodSetHashMismatchError
  | RuntimeRpcContractProfileMismatchError
  | RuntimeRpcContractCanonicalMethodsOnlyError
  | RuntimeRpcContractFeatureMissingError
  | RuntimeRpcContractFreezeEffectiveAtMismatchError
  | RuntimeRpcContractErrorCodesMismatchError;

function parseIsoDateContractVersion(version: string): number | null {
  const trimmed = version.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const day = Number.parseInt(dayRaw, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return year * 10000 + month * 100 + day;
}

function isRuntimeRpcContractVersionAtLeastMinimum(contractVersion: string | null): boolean {
  if (!contractVersion) {
    return false;
  }
  const required = parseIsoDateContractVersion(MIN_CODE_RUNTIME_RPC_CONTRACT_VERSION);
  const actual = parseIsoDateContractVersion(contractVersion);
  if (required === null || actual === null) {
    return false;
  }
  return actual >= required;
}

function computeRuntimeRpcMethodSetHash(methods: ReadonlySet<string>): string {
  const entries = [...methods].sort((left, right) => left.localeCompare(right));
  const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK_64 = 0xffffffffffffffffn;

  let hash = FNV_OFFSET_BASIS;
  for (const method of entries) {
    const bytes = new TextEncoder().encode(method);
    for (const byte of bytes) {
      hash ^= BigInt(byte);
      hash = (hash * FNV_PRIME) & MASK_64;
    }
    hash ^= 0xffn;
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}

function toSortedRecord(
  value: ReadonlyMap<string, string> | null
): Readonly<Record<string, string>> | null {
  if (!value) {
    return null;
  }
  const sortedEntries = [...value.entries()].sort(([left], [right]) => left.localeCompare(right));
  return Object.freeze(Object.fromEntries(sortedEntries));
}

function normalizeStringRecordMap(value: unknown): ReadonlyMap<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const normalizedEntries = Object.entries(record)
    .map(([key, rawValue]) => {
      const normalizedKey = key.trim();
      const normalizedValue = typeof rawValue === "string" ? rawValue.trim() : "";
      return [normalizedKey, normalizedValue] as const;
    })
    .filter(([key, normalizedValue]) => key.length > 0 && normalizedValue.length > 0);

  return new Map(normalizedEntries);
}

function areStringMapsEqual(
  left: ReadonlyMap<string, string> | null,
  right: ReadonlyMap<string, string>
): boolean {
  if (!left || left.size !== right.size) {
    return false;
  }
  for (const [key, value] of right.entries()) {
    if (left.get(key) !== value) {
      return false;
    }
  }
  return true;
}

function normalizeInvocationPolicies(
  value: unknown
): ReadonlyMap<string, RuntimeRpcMethodInvocationPolicy> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const normalizedEntries = Object.entries(record)
    .map(([method, rawPolicy]) => {
      const normalizedMethod = method.trim();
      if (normalizedMethod.length === 0) {
        return null;
      }
      if (typeof rawPolicy !== "object" || rawPolicy === null || Array.isArray(rawPolicy)) {
        return null;
      }
      const policy = rawPolicy as Record<string, unknown>;
      const rawCompletionMode = policy.completionMode ?? policy.completion_mode;
      if (
        rawCompletionMode !== CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES.RPC &&
        rawCompletionMode !== CODE_RUNTIME_RPC_INVOCATION_COMPLETION_MODES.EVENTS
      ) {
        return null;
      }

      const rawAckTimeoutMs = policy.ackTimeoutMs ?? policy.ack_timeout_ms;
      const ackTimeoutMs =
        rawAckTimeoutMs === null
          ? null
          : typeof rawAckTimeoutMs === "number" &&
              Number.isFinite(rawAckTimeoutMs) &&
              rawAckTimeoutMs >= 0
            ? Math.trunc(rawAckTimeoutMs)
            : null;

      return [
        normalizedMethod,
        {
          completionMode: rawCompletionMode,
          ackTimeoutMs,
        },
      ] as const;
    })
    .filter(
      (entry): entry is readonly [string, RuntimeRpcMethodInvocationPolicy] => entry !== null
    );

  return normalizedEntries.length > 0 ? new Map(normalizedEntries) : undefined;
}

function resolveRequiredRuntimeRpcFeatures(
  snapshot: RuntimeRpcCapabilitiesSnapshot
): readonly string[] {
  if (snapshot.profile === RUNTIME_RPC_CAPABILITY_PROFILE_DESKTOP_CORE) {
    return REQUIRED_RUNTIME_RPC_FEATURES_DESKTOP_CORE;
  }
  return REQUIRED_RUNTIME_RPC_FEATURES;
}

export function assertRuntimeRpcContractVersionSupported(contractVersion: string): void {
  const required = parseIsoDateContractVersion(MIN_CODE_RUNTIME_RPC_CONTRACT_VERSION);
  const actual = parseIsoDateContractVersion(contractVersion);
  if (required === null) {
    return;
  }
  if (actual === null || actual < required) {
    throw new RuntimeRpcContractVersionMismatchError(
      contractVersion,
      MIN_CODE_RUNTIME_RPC_CONTRACT_VERSION
    );
  }
}

export function assertRuntimeRpcMethodSetHashSupported(
  snapshot: RuntimeRpcCapabilitiesSnapshot
): void {
  if (!isRuntimeRpcContractVersionAtLeastMinimum(snapshot.contractVersion)) {
    return;
  }
  if (!snapshot.methodSetHash) {
    throw new RuntimeRpcCapabilitiesMethodSetHashMissingError();
  }
  const expectedMethodSetHash = computeRuntimeRpcMethodSetHash(snapshot.methods);
  if (expectedMethodSetHash !== snapshot.methodSetHash) {
    throw new RuntimeRpcCapabilitiesMethodSetHashMismatchError(
      snapshot.methodSetHash,
      expectedMethodSetHash
    );
  }
}

export function assertRuntimeRpcProfileSupported(snapshot: RuntimeRpcCapabilitiesSnapshot): void {
  if (!isRuntimeRpcContractVersionAtLeastMinimum(snapshot.contractVersion)) {
    return;
  }
  if (snapshot.profile === null) {
    return;
  }
  if (KNOWN_RUNTIME_RPC_CAPABILITY_PROFILES.has(snapshot.profile)) {
    return;
  }
  throw new RuntimeRpcContractProfileMismatchError(snapshot.profile);
}

export function assertRuntimeRpcCanonicalMethodsSupported(
  snapshot: RuntimeRpcCapabilitiesSnapshot
): void {
  if (!isRuntimeRpcContractVersionAtLeastMinimum(snapshot.contractVersion)) {
    return;
  }
  const nonCanonicalMethods = [...snapshot.methods].filter(
    (method) => !isCodeRuntimeRpcMethod(method)
  );
  if (nonCanonicalMethods.length > 0) {
    throw new RuntimeRpcContractCanonicalMethodsOnlyError(nonCanonicalMethods);
  }
}

export function assertRuntimeRpcContractFeaturesSupported(
  snapshot: RuntimeRpcCapabilitiesSnapshot
): void {
  if (!isRuntimeRpcContractVersionAtLeastMinimum(snapshot.contractVersion)) {
    return;
  }
  const requiredFeatures = resolveRequiredRuntimeRpcFeatures(snapshot);
  const missingFeatures = requiredFeatures.filter((feature) => !snapshot.features.has(feature));
  if (missingFeatures.length > 0) {
    throw new RuntimeRpcContractFeatureMissingError(missingFeatures);
  }
}

export function assertRuntimeRpcFreezeEffectiveAtSupported(
  snapshot: RuntimeRpcCapabilitiesSnapshot
): void {
  if (!isRuntimeRpcContractVersionAtLeastMinimum(snapshot.contractVersion)) {
    return;
  }
  if (snapshot.freezeEffectiveAt !== REQUIRED_CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT) {
    throw new RuntimeRpcContractFreezeEffectiveAtMismatchError(
      snapshot.freezeEffectiveAt,
      REQUIRED_CODE_RUNTIME_RPC_FREEZE_EFFECTIVE_AT
    );
  }
}

export function assertRuntimeRpcContractMetadataSupported(
  snapshot: RuntimeRpcCapabilitiesSnapshot
): void {
  if (!isRuntimeRpcContractVersionAtLeastMinimum(snapshot.contractVersion)) {
    return;
  }
  if (!areStringMapsEqual(snapshot.errorCodes, EXPECTED_RUNTIME_RPC_ERROR_CODES)) {
    throw new RuntimeRpcContractErrorCodesMismatchError(toSortedRecord(snapshot.errorCodes));
  }
}

export function normalizeRpcCapabilitiesPayload(
  value: unknown
): RuntimeRpcCapabilitiesSnapshot | null {
  const fromArray = (methods: unknown[]): ReadonlySet<string> | null => {
    const normalized = methods
      .map((method) => (typeof method === "string" ? method.trim() : ""))
      .filter((method) => method.length > 0);
    if (normalized.length === 0) {
      return new Set<string>();
    }
    return new Set(normalized);
  };

  if (Array.isArray(value)) {
    const methods = fromArray(value);
    if (methods === null) {
      return null;
    }
    return {
      methods,
      profile: null,
      contractVersion: null,
      freezeEffectiveAt: null,
      methodSetHash: null,
      features: new Set<string>(),
      errorCodes: null,
      wsEndpointPath: null,
    };
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const readStringField = (record: Record<string, unknown>, ...keys: string[]): string | null => {
    for (const key of keys) {
      const rawValue = record[key];
      if (typeof rawValue !== "string") {
        continue;
      }
      const normalized = rawValue.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
    return null;
  };

  const readRecordField = (
    record: Record<string, unknown>,
    ...keys: string[]
  ): Record<string, unknown> | null => {
    for (const key of keys) {
      const rawValue = record[key];
      if (typeof rawValue !== "object" || rawValue === null || Array.isArray(rawValue)) {
        continue;
      }
      return rawValue as Record<string, unknown>;
    }
    return null;
  };

  const record = value as Partial<CodeRuntimeRpcCapabilities>;
  if (!Array.isArray(record.methods)) {
    return null;
  }
  const methods = fromArray(record.methods);
  if (methods === null) {
    return null;
  }
  const recordObject = value as Record<string, unknown>;
  const profile = readStringField(recordObject, "profile");
  const contractVersion = readStringField(recordObject, "contractVersion", "contract_version");
  const freezeEffectiveAt = readStringField(
    recordObject,
    "freezeEffectiveAt",
    "freeze_effective_at"
  );
  const methodSetHash = readStringField(recordObject, "methodSetHash", "method_set_hash");
  const features = new Set(
    Array.isArray(record.features)
      ? record.features
          .map((feature) => (typeof feature === "string" ? feature.trim() : ""))
          .filter((feature) => feature.length > 0)
      : []
  );
  const errorCodes = normalizeStringRecordMap(
    readRecordField(recordObject, "errorCodes", "error_codes")
  );
  const transports = readRecordField(recordObject, "transports");
  const wsTransport = transports ? readRecordField(transports, "ws") : null;
  const wsEndpointPath = wsTransport
    ? readStringField(wsTransport, "endpointPath", "endpoint_path")
    : null;
  const capabilities = readRecordField(recordObject, "capabilities");
  const rpcCapabilities = capabilities ? readRecordField(capabilities, "rpc") : null;
  const invocationPolicies = rpcCapabilities
    ? normalizeInvocationPolicies(
        readRecordField(rpcCapabilities, "invocationPolicies", "invocation_policies")
      )
    : undefined;
  return {
    methods,
    profile,
    contractVersion,
    freezeEffectiveAt,
    methodSetHash,
    features,
    errorCodes,
    wsEndpointPath,
    invocationPolicies,
  };
}

export function isRuntimeRpcContractGuardError(
  cause: unknown
): cause is RuntimeRpcContractGuardError {
  return (
    cause instanceof RuntimeRpcContractVersionMismatchError ||
    cause instanceof RuntimeRpcCapabilitiesMethodSetHashMissingError ||
    cause instanceof RuntimeRpcCapabilitiesMethodSetHashMismatchError ||
    cause instanceof RuntimeRpcContractProfileMismatchError ||
    cause instanceof RuntimeRpcContractCanonicalMethodsOnlyError ||
    cause instanceof RuntimeRpcContractFeatureMissingError ||
    cause instanceof RuntimeRpcContractFreezeEffectiveAtMismatchError ||
    cause instanceof RuntimeRpcContractErrorCodesMismatchError
  );
}
