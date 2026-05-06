export type T3DeliveryStatus =
  | "exported"
  | "expired"
  | "failed"
  | "fileUnavailable"
  | "prepared"
  | "redeemed"
  | "revoked"
  | "unavailable";

export type T3DeliveryProjection = {
  activationCode: string | null;
  browserFileUnlockCode: string | null;
  deliveryId: string | null;
  entitlementSummary: string | null;
  fileHash: string | null;
  status: T3DeliveryStatus;
  summary: string;
  updatedAt: string | null;
};

export type T3DeliveryExportWitness = {
  byteLength: number;
  exportedAt: string;
  fileHash: string;
  fileName: string;
};

export type T3DeliveryArtifactUpload = {
  serialized: string;
  witness: T3DeliveryExportWitness;
};

export type T3DeliveryRemoteArtifact = {
  byteLength: number | null;
  fileHash: string | null;
  fileName: string;
  serialized: string;
};

export type T3DeliveryRedeemResult = {
  artifact: T3DeliveryRemoteArtifact | null;
  projection: T3DeliveryProjection;
};

export type T3OpenHugeDeliveryConfig = {
  authToken: string | null;
  baseUrl: string;
  projectId: string;
  provider: "chatgpt";
  serviceDays: number;
  serviceKind: string;
  tenantId: string;
};

type T3DeliveryTransportOperation =
  | "prepare"
  | "readStatus"
  | "redeem"
  | "submitExportWitness"
  | "uploadArtifact";

type T3DeliveryTransport = (input: {
  body: unknown;
  operation: T3DeliveryTransportOperation;
}) => Promise<unknown>;

type T3DeliveryFetch = (url: string, init?: RequestInit) => Promise<Response>;

const defaultOpenHugeDeliveryFetch: T3DeliveryFetch = (url, init) =>
  fetch.call(globalThis, url, init);

function normalizeOpenHugeDeliveryFetch(fetcher: T3DeliveryFetch): T3DeliveryFetch {
  return fetcher === globalThis.fetch ? defaultOpenHugeDeliveryFetch : fetcher;
}

type OpenHugeDeliveryProjectionOptions = {
  fileHash?: string | null;
  status?: T3DeliveryStatus;
  summary?: string;
};

export type T3DeliveryService = {
  prepare(input: { provider: "chatgpt" }): Promise<T3DeliveryProjection>;
  readStatus(input: {
    activationCode?: string;
    deliveryId?: string;
  }): Promise<T3DeliveryProjection>;
  redeem(input: { activationCode: string }): Promise<T3DeliveryRedeemResult>;
  submitExportWitness(input: {
    deliveryId: string;
    witness: T3DeliveryExportWitness;
  }): Promise<T3DeliveryProjection>;
  uploadArtifact(input: {
    artifact: T3DeliveryArtifactUpload;
    deliveryId: string;
  }): Promise<T3DeliveryProjection>;
};

const OPENHUGE_DEFAULT_PROVIDER = "chatgpt";
const OPENHUGE_DEFAULT_SERVICE_DAYS = 30;
const OPENHUGE_DEFAULT_SERVICE_KIND = "manual_browser_account";
const OPENHUGE_ARTIFACT_KIND = "browser_account_bundle";
const OPENHUGE_ARTIFACT_CONTENT_TYPE = "application/octet-stream";
const DAY_IN_MS = 86_400_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function readArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function readEnvString(env: Record<string, unknown>, names: readonly string[]): string | null {
  for (const name of names) {
    const value = readString(env[name]);
    if (value) {
      return value;
    }
  }
  return null;
}

function readEnvInteger(env: Record<string, unknown>, names: readonly string[]): number | null {
  for (const name of names) {
    const raw = env[name];
    if (typeof raw === "number") {
      const value = readPositiveInteger(raw);
      if (value !== null) {
        return value;
      }
    }
    const parsed = Number.parseInt(readString(raw) ?? "", 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function readStatus(value: unknown): T3DeliveryStatus {
  if (
    value === "exported" ||
    value === "expired" ||
    value === "failed" ||
    value === "fileUnavailable" ||
    value === "prepared" ||
    value === "redeemed" ||
    value === "revoked" ||
    value === "unavailable"
  ) {
    return value;
  }
  throw new Error("Delivery service returned an unsupported status.");
}

function projectionStatusRequiresDeliveryId(status: T3DeliveryStatus) {
  return status === "exported" || status === "prepared" || status === "redeemed";
}

function normalizeSha256Hex(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) {
    return null;
  }
  const normalized = raw.toLowerCase().startsWith("sha256:") ? raw.slice("sha256:".length) : raw;
  if (!/^[a-f0-9]{64}$/u.test(normalized)) {
    throw new Error("Delivery artifact file hash must be a SHA-256 hex digest when provided.");
  }
  return normalized;
}

function createDeliveryProjection(input: {
  activationCode?: string | null;
  browserFileUnlockCode?: string | null;
  deliveryId?: string | null;
  entitlementSummary?: string | null;
  fileHash?: string | null;
  status: T3DeliveryStatus;
  summary: string;
  updatedAt?: string | null;
}): T3DeliveryProjection {
  return {
    activationCode: input.activationCode ?? null,
    browserFileUnlockCode: input.browserFileUnlockCode ?? null,
    deliveryId: input.deliveryId ?? null,
    entitlementSummary: input.entitlementSummary ?? null,
    fileHash: input.fileHash ?? null,
    status: input.status,
    summary: input.summary,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

function createUnavailableDeliveryProjection(): T3DeliveryProjection {
  return createDeliveryProjection({
    status: "unavailable",
    summary: "OpenHuge delivery backend is not configured for this client.",
  });
}

function createFailedDeliveryProjection(summary?: string): T3DeliveryProjection {
  return createDeliveryProjection({
    status: "failed",
    summary: summary ?? "Delivery adapter request failed. Remote delivery remains fail-closed.",
  });
}

export function normalizeT3DeliveryProjection(value: unknown): T3DeliveryProjection {
  if (!isRecord(value)) {
    throw new Error("Delivery service returned an invalid projection.");
  }
  const status = readStatus(value.status);
  const deliveryId = readString(value.deliveryId);
  if (!deliveryId && projectionStatusRequiresDeliveryId(status)) {
    throw new Error("Delivery service did not return a delivery id.");
  }
  return {
    activationCode: readString(value.activationCode),
    browserFileUnlockCode: readString(value.browserFileUnlockCode),
    deliveryId,
    entitlementSummary: readString(value.entitlementSummary),
    fileHash: normalizeSha256Hex(value.fileHash),
    status,
    summary: readString(value.summary) ?? "Delivery projection updated.",
    updatedAt: readString(value.updatedAt),
  };
}

function readOptionalByteLength(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const byteLength = readPositiveNumber(value);
  if (byteLength !== null) {
    return byteLength;
  }
  throw new Error("Delivery artifact byte length must be positive when provided.");
}

function normalizeT3DeliveryRemoteArtifact(value: unknown): T3DeliveryRemoteArtifact | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error("Delivery service returned an invalid artifact.");
  }
  const fileName = readString(value.fileName);
  const serialized = readString(value.serialized);
  if (!fileName || !fileName.endsWith(".hcbrowser")) {
    throw new Error("Delivery artifact did not return a .hcbrowser file name.");
  }
  if (!serialized) {
    throw new Error("Delivery artifact did not return encrypted account data.");
  }
  return {
    byteLength: readOptionalByteLength(value.byteLength),
    fileHash: normalizeSha256Hex(value.fileHash),
    fileName,
    serialized,
  };
}

export function normalizeT3DeliveryRedeemResult(value: unknown): T3DeliveryRedeemResult {
  if (!isRecord(value)) {
    throw new Error("Delivery service returned an invalid redemption result.");
  }
  const projection = normalizeT3DeliveryProjection(
    value.projection === undefined ? value : value.projection
  );
  const artifact = normalizeT3DeliveryRemoteArtifact(value.artifact);
  if (projection.status === "redeemed" && !artifact) {
    throw new Error("Redeemed delivery did not return an encrypted account data artifact.");
  }
  return { artifact, projection };
}

function findOpenHugeCode(
  codes: readonly unknown[],
  codeType: "browser_file_unlock_code" | "redemption_code"
) {
  for (const code of codes) {
    const record = readRecord(code);
    if (record && readString(record.code_type) === codeType) {
      const prefix = readString(record.code_prefix);
      const lastFour = readString(record.code_last_four);
      return prefix && lastFour ? `${prefix}${lastFour}` : null;
    }
  }
  return null;
}

function formatOpenHugeEntitlementSummary(entitlement: Record<string, unknown> | null) {
  if (!entitlement) {
    return null;
  }
  const status = readString(entitlement.status);
  const serviceDays = readPositiveInteger(entitlement.service_days);
  const serviceEndsAt = readString(entitlement.service_ends_at) ?? readString(entitlement.ends_at);
  const parts = [
    status ? `status=${status}` : null,
    serviceDays !== null ? `service_days=${serviceDays}` : null,
    serviceEndsAt ? `ends_at=${serviceEndsAt}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function mapOpenHugeStatus(value: string | null, fallback: T3DeliveryStatus): T3DeliveryStatus {
  const status = value?.toLowerCase();
  if (!status) {
    return fallback;
  }
  if (status.includes("expired")) {
    return "expired";
  }
  if (status.includes("revoked")) {
    return "revoked";
  }
  if (
    status.includes("artifact_required") ||
    status.includes("artifact_not_found") ||
    status.includes("file_unavailable")
  ) {
    return "fileUnavailable";
  }
  if (
    status.includes("failed") ||
    status.includes("invalid") ||
    status.includes("rejected") ||
    status.includes("error")
  ) {
    return "failed";
  }
  if (status === "activated" || status === "redeemed") {
    return "redeemed";
  }
  if (status === "accepted" || status === "active" || status === "exported") {
    return "exported";
  }
  if (status === "queued" || status === "processing" || status === "pending") {
    return "prepared";
  }
  if (status === "prepared" || status === "created" || status === "ready") {
    return "prepared";
  }
  return fallback;
}

function summarizeOpenHugeProjection(status: T3DeliveryStatus, fallback?: string) {
  if (fallback) {
    return fallback;
  }
  switch (status) {
    case "exported":
      return "OpenHuge accepted the encrypted browser account artifact.";
    case "expired":
      return "OpenHuge delivery is expired.";
    case "fileUnavailable":
      return "OpenHuge delivery artifact is unavailable.";
    case "prepared":
      return "OpenHuge delivery is prepared or still processing.";
    case "redeemed":
      return "OpenHuge redeemed the delivery and returned encrypted account data.";
    case "revoked":
      return "OpenHuge delivery is revoked.";
    case "unavailable":
      return "OpenHuge delivery backend is unavailable.";
    case "failed":
    default:
      return "OpenHuge delivery request failed.";
  }
}

export function normalizeOpenHugeDeliveryProjection(
  value: unknown,
  options: OpenHugeDeliveryProjectionOptions = {}
): T3DeliveryProjection {
  if (!isRecord(value)) {
    throw new Error("OpenHuge delivery response was not an object.");
  }
  const data = readRecord(value.data) ?? value;
  const delivery = readRecord(data.delivery) ?? data;
  const entitlement = readRecord(data.entitlement);
  const activation = readString(data.activation_id) ? data : null;
  const artifact = readRecord(data.artifact);
  const oneTimeCodes = readRecord(value.one_time_codes) ?? readRecord(data.one_time_codes);
  const codes = readArray(data.codes);
  const deliveryId =
    readString(delivery.delivery_id) ??
    readString(data.delivery_id) ??
    readString(activation?.delivery_id);
  const activationCode =
    readString(oneTimeCodes?.redemption_code) ?? findOpenHugeCode(codes, "redemption_code");
  const browserFileUnlockCode =
    readString(oneTimeCodes?.browser_file_unlock_code) ??
    findOpenHugeCode(codes, "browser_file_unlock_code");
  const artifactHash =
    normalizeSha256Hex(artifact?.sha256) ??
    normalizeSha256Hex(data.payload_sha256) ??
    normalizeSha256Hex(options.fileHash);
  const statusSource =
    readString(data.status) ?? readString(delivery.status) ?? readString(artifact?.status);
  const status = options.status ?? mapOpenHugeStatus(statusSource, "prepared");
  const updatedAt =
    readString(data.updated_at) ??
    readString(delivery.updated_at) ??
    readString(artifact?.updated_at) ??
    null;
  return normalizeT3DeliveryProjection({
    activationCode,
    browserFileUnlockCode,
    deliveryId,
    entitlementSummary: formatOpenHugeEntitlementSummary(entitlement),
    fileHash: artifactHash,
    status,
    summary: summarizeOpenHugeProjection(status, options.summary),
    updatedAt,
  });
}

function rejectSensitiveWitnessValue(value: string) {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("cookie") ||
    normalized.includes("auth.json") ||
    normalized.includes("token") ||
    normalized.includes("password") ||
    normalized.includes("storage")
  ) {
    throw new Error("Export witness must not contain sensitive browser or credential data.");
  }
}

function assertSafeExportWitness(witness: T3DeliveryExportWitness) {
  rejectSensitiveWitnessValue(witness.fileHash);
  rejectSensitiveWitnessValue(witness.fileName);
  if (!/^[a-f0-9]{64}$/u.test(witness.fileHash)) {
    throw new Error("Export witness file hash must be a SHA-256 hex digest.");
  }
  if (!Number.isFinite(witness.byteLength) || witness.byteLength <= 0) {
    throw new Error("Export witness byte length must be positive.");
  }
}

function assertSafeArtifactUpload(artifact: T3DeliveryArtifactUpload) {
  assertSafeExportWitness(artifact.witness);
  if (!artifact.serialized.trim()) {
    throw new Error("Encrypted delivery artifact must not be empty.");
  }
}

function readOpenHugeDeliveryEnv(): Record<string, unknown> {
  return import.meta.env as Record<string, unknown>;
}

export function readOpenHugeDeliveryConfig(
  env: Record<string, unknown> = readOpenHugeDeliveryEnv()
): T3OpenHugeDeliveryConfig | null {
  const baseUrl = readEnvString(env, [
    "VITE_OPENHUGE_CONTROL_PLANE_BASE_URL",
    "VITE_OPENHUGE_API_BASE_URL",
    "OPENHUGE_CONTROL_PLANE_BASE_URL",
  ]);
  const tenantId = readEnvString(env, [
    "VITE_OPENHUGE_TENANT_ID",
    "VITE_OPENHUGE_DELIVERY_TENANT_ID",
    "OPENHUGE_TENANT_ID",
  ]);
  const projectId = readEnvString(env, [
    "VITE_OPENHUGE_PROJECT_ID",
    "VITE_OPENHUGE_DELIVERY_PROJECT_ID",
    "OPENHUGE_PROJECT_ID",
  ]);
  if (!baseUrl || !tenantId || !projectId) {
    return null;
  }
  return {
    authToken: readEnvString(env, [
      "VITE_OPENHUGE_CONTROL_PLANE_TOKEN",
      "VITE_OPENHUGE_API_TOKEN",
      "OPENHUGE_CONTROL_PLANE_TOKEN",
    ]),
    baseUrl,
    projectId,
    provider: OPENHUGE_DEFAULT_PROVIDER,
    serviceDays:
      readEnvInteger(env, [
        "VITE_OPENHUGE_DELIVERY_SERVICE_DAYS",
        "VITE_OPENHUGE_SERVICE_DAYS",
        "OPENHUGE_DELIVERY_SERVICE_DAYS",
      ]) ?? OPENHUGE_DEFAULT_SERVICE_DAYS,
    serviceKind:
      readEnvString(env, [
        "VITE_OPENHUGE_DELIVERY_SERVICE_KIND",
        "VITE_OPENHUGE_SERVICE_KIND",
        "OPENHUGE_DELIVERY_SERVICE_KIND",
      ]) ?? OPENHUGE_DEFAULT_SERVICE_KIND,
    tenantId,
  };
}

class OpenHugeRequestError extends Error {
  readonly code: string | null;
  readonly statusCode: number;

  constructor(input: { code: string | null; message: string; statusCode: number }) {
    super(input.message);
    this.code = input.code;
    this.statusCode = input.statusCode;
  }
}

function openHugeUrl(config: T3OpenHugeDeliveryConfig, path: string) {
  return `${config.baseUrl.replace(/\/+$/u, "")}${path}`;
}

function openHugeHeaders(config: T3OpenHugeDeliveryConfig, bearerToken?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json, application/octet-stream",
  };
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  } else if (config.authToken) {
    headers.Authorization = `Bearer ${config.authToken}`;
  }
  return headers;
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  if (!text.trim()) {
    return null;
  }
  try {
    return readRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

async function readOpenHugeJson(response: Response): Promise<unknown> {
  const text = await readResponseText(response);
  return parseJsonObject(text) ?? {};
}

function readOpenHugeErrorCode(parsed: Record<string, unknown> | null) {
  return (
    readString(parsed?.code) ??
    readString(readRecord(parsed?.error)?.code) ??
    readString(readRecord(parsed?.data)?.code)
  );
}

function readOpenHugeErrorMessage(parsed: Record<string, unknown> | null, fallback: string) {
  return (
    readString(parsed?.message) ??
    readString(readRecord(parsed?.error)?.message) ??
    readString(readRecord(parsed?.data)?.message) ??
    fallback
  );
}

async function openHugeJsonRequest(input: {
  body?: unknown;
  config: T3OpenHugeDeliveryConfig;
  fetcher: T3DeliveryFetch;
  method: "GET" | "POST";
  path: string;
}) {
  const headers = openHugeHeaders(input.config);
  const init: RequestInit = {
    credentials: "include",
    headers:
      input.body === undefined
        ? headers
        : {
            ...headers,
            "Content-Type": "application/json",
          },
    method: input.method,
  };
  if (input.body !== undefined) {
    init.body = JSON.stringify(input.body);
  }
  const response = await input.fetcher(openHugeUrl(input.config, input.path), init);
  if (!response.ok) {
    const text = await readResponseText(response);
    const parsed = parseJsonObject(text);
    throw new OpenHugeRequestError({
      code: readOpenHugeErrorCode(parsed),
      message: readOpenHugeErrorMessage(parsed, `OpenHuge request failed with ${response.status}.`),
      statusCode: response.status,
    });
  }
  return readOpenHugeJson(response);
}

async function openHugeArtifactRequest(input: {
  config: T3OpenHugeDeliveryConfig;
  fetcher: T3DeliveryFetch;
  token: string;
}) {
  const response = await input.fetcher(
    openHugeUrl(input.config, "/v1/delivery-downloads/artifact"),
    {
      credentials: "include",
      headers: openHugeHeaders(input.config, input.token),
      method: "GET",
    }
  );
  const text = await readResponseText(response);
  if (!response.ok) {
    const parsed = parseJsonObject(text);
    throw new OpenHugeRequestError({
      code: readOpenHugeErrorCode(parsed),
      message: readOpenHugeErrorMessage(parsed, `OpenHuge artifact download failed.`),
      statusCode: response.status,
    });
  }
  return { response, text };
}

function encodeUtf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeUtf8Base64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function readSerializedArtifactPayload(text: string) {
  const parsed = parseJsonObject(text);
  const data = readRecord(parsed?.data) ?? parsed;
  const serialized = readString(data?.serialized) ?? readString(data?.ciphertext);
  if (serialized) {
    return serialized;
  }
  const payloadBase64 = readString(data?.payload_base64);
  if (payloadBase64) {
    return decodeUtf8Base64(payloadBase64);
  }
  return text;
}

function contentDispositionFileName(value: string | null) {
  if (!value) {
    return null;
  }
  const utf8Match = /filename\*=UTF-8''([^;]+)/iu.exec(value);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const quotedMatch = /filename="([^"]+)"/iu.exec(value);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }
  const bareMatch = /filename=([^;]+)/iu.exec(value);
  return bareMatch?.[1]?.trim() ?? null;
}

function createOpenHugeErrorProjection(error: unknown): T3DeliveryProjection {
  if (!(error instanceof OpenHugeRequestError)) {
    return createFailedDeliveryProjection();
  }
  const code = error.code?.toLowerCase() ?? "";
  const messageStatus = mapOpenHugeStatus(error.message, "failed");
  if (code === "redemption_code_expired" || code === "download_token_expired") {
    return createDeliveryProjection({ status: "expired", summary: error.message });
  }
  if (code === "redemption_code_revoked") {
    return createDeliveryProjection({ status: "revoked", summary: error.message });
  }
  if (code === "delivery_entitlement_not_active") {
    return createDeliveryProjection({
      status: messageStatus === "failed" ? "fileUnavailable" : messageStatus,
      summary: error.message,
    });
  }
  if (
    code === "delivery_artifact_required" ||
    code === "delivery_artifact_not_found" ||
    code === "delivery_artifact_not_available" ||
    code === "download_token_used" ||
    code === "download_token_revoked" ||
    code === "download_token_invalid" ||
    code === "download_token_not_active" ||
    code === "download_token_required"
  ) {
    return createDeliveryProjection({
      status:
        messageStatus === "expired" || messageStatus === "revoked"
          ? messageStatus
          : "fileUnavailable",
      summary: error.message,
    });
  }
  if (code === "redemption_code_used") {
    return createDeliveryProjection({ status: "failed", summary: error.message });
  }
  if (error.statusCode === 404) {
    return createDeliveryProjection({ status: "fileUnavailable", summary: error.message });
  }
  return createFailedDeliveryProjection(error.message);
}

function readDeliveryIdFromBody(body: unknown) {
  const deliveryId = readString(readRecord(body)?.deliveryId);
  if (!deliveryId) {
    throw new Error("Delivery id is required.");
  }
  return deliveryId;
}

function readActivationCodeFromBody(body: unknown) {
  const activationCode = readString(readRecord(body)?.activationCode);
  if (!activationCode) {
    throw new Error("Redemption code is required.");
  }
  return activationCode;
}

function readUploadFromBody(body: unknown) {
  const record = readRecord(body);
  const artifact = readRecord(record?.artifact);
  const witness = readRecord(record?.witness);
  const deliveryId = readString(record?.deliveryId);
  const fileName = readString(artifact?.fileName);
  const serialized = readString(artifact?.serialized);
  const fileHash = normalizeSha256Hex(witness?.fileHash);
  if (!deliveryId || !fileName || !serialized || !fileHash) {
    throw new Error("Delivery artifact upload body is incomplete.");
  }
  return { deliveryId, fileHash, fileName, serialized };
}

function openHugeCarrierValidUntil(config: T3OpenHugeDeliveryConfig) {
  if (!Number.isInteger(config.serviceDays) || config.serviceDays <= 0) {
    return null;
  }
  return new Date(Date.now() + config.serviceDays * DAY_IN_MS).toISOString();
}

async function openHugePrepare(
  config: T3OpenHugeDeliveryConfig,
  fetcher: T3DeliveryFetch,
  body: unknown
) {
  const provider = readString(readRecord(body)?.provider) ?? config.provider;
  const response = await openHugeJsonRequest({
    body: {
      customer_label: "HugeCode browser handoff",
      project_id: config.projectId,
      provider,
      service_days: config.serviceDays,
      service_kind: config.serviceKind,
      tenant_id: config.tenantId,
    },
    config,
    fetcher,
    method: "POST",
    path: "/v1/deliveries/prepare",
  });
  return normalizeOpenHugeDeliveryProjection(response, {
    status: "prepared",
    summary: "OpenHuge prepared delivery and returned one-time delivery codes.",
  });
}

function readBatchId(response: unknown) {
  const data = readRecord(readRecord(response)?.data) ?? readRecord(response);
  return readString(data?.batch_id);
}

function uploadItemProjection(input: {
  deliveryId: string;
  item: Record<string, unknown>;
  witnessHash: string;
}) {
  const rawStatus = readString(input.item.status);
  const status = mapOpenHugeStatus(rawStatus, "prepared");
  const fileHash = normalizeSha256Hex(input.item.payload_sha256) ?? input.witnessHash;
  if (status === "exported") {
    return normalizeT3DeliveryProjection({
      deliveryId: input.deliveryId,
      fileHash,
      status: "exported",
      summary: "OpenHuge accepted the encrypted browser account artifact.",
      updatedAt: readString(input.item.updated_at),
    });
  }
  if (status === "failed") {
    return normalizeT3DeliveryProjection({
      deliveryId: input.deliveryId,
      fileHash,
      status: "failed",
      summary: "OpenHuge rejected the encrypted browser account artifact.",
      updatedAt: readString(input.item.updated_at),
    });
  }
  return normalizeT3DeliveryProjection({
    deliveryId: input.deliveryId,
    fileHash,
    status: "prepared",
    summary: "OpenHuge artifact upload is queued or processing.",
    updatedAt: readString(input.item.updated_at),
  });
}

async function openHugeUploadArtifact(
  config: T3OpenHugeDeliveryConfig,
  fetcher: T3DeliveryFetch,
  body: unknown
) {
  const upload = readUploadFromBody(body);
  const carrierValidUntil = openHugeCarrierValidUntil(config);
  const batch = await openHugeJsonRequest({
    body: {
      idempotency_key: `${upload.deliveryId}:${upload.fileHash}`,
      items: [
        {
          artifact_kind: OPENHUGE_ARTIFACT_KIND,
          ...(carrierValidUntil ? { carrier_valid_until: carrierValidUntil } : {}),
          content_type: OPENHUGE_ARTIFACT_CONTENT_TYPE,
          delivery_id: upload.deliveryId,
          file_name: upload.fileName,
          payload_base64: encodeUtf8Base64(upload.serialized),
          row_index: 1,
        },
      ],
      project_id: config.projectId,
      provider: config.provider,
      source_file_name: `${upload.deliveryId}.jsonl`,
      tenant_id: config.tenantId,
    },
    config,
    fetcher,
    method: "POST",
    path: "/v1/delivery-uploads",
  });
  const batchId = readBatchId(batch);
  if (!batchId) {
    return normalizeT3DeliveryProjection({
      deliveryId: upload.deliveryId,
      fileHash: upload.fileHash,
      status: "prepared",
      summary: "OpenHuge queued artifact upload, but no batch id was returned.",
    });
  }
  const items = await openHugeJsonRequest({
    config,
    fetcher,
    method: "GET",
    path: `/v1/delivery-uploads/${encodeURIComponent(batchId)}/items`,
  });
  const item = readArray(readRecord(items)?.data)
    .map(readRecord)
    .find((candidate) => readString(candidate?.delivery_id) === upload.deliveryId);
  if (!item) {
    return normalizeT3DeliveryProjection({
      deliveryId: upload.deliveryId,
      fileHash: upload.fileHash,
      status: "prepared",
      summary: "OpenHuge artifact upload is queued; item status is not available yet.",
    });
  }
  return uploadItemProjection({
    deliveryId: upload.deliveryId,
    item,
    witnessHash: upload.fileHash,
  });
}

async function openHugeReadStatus(
  config: T3OpenHugeDeliveryConfig,
  fetcher: T3DeliveryFetch,
  body: unknown
) {
  const deliveryId = readDeliveryIdFromBody(body);
  const response = await openHugeJsonRequest({
    config,
    fetcher,
    method: "GET",
    path: `/v1/deliveries/${encodeURIComponent(deliveryId)}`,
  });
  return normalizeOpenHugeDeliveryProjection(response);
}

function activationProjection(response: unknown) {
  const projection = normalizeOpenHugeDeliveryProjection(response, {
    status: "redeemed",
    summary: "OpenHuge redeemed the delivery activation.",
  });
  return {
    activationId: readString(readRecord(readRecord(response)?.data)?.activation_id),
    artifact: readRecord(readRecord(readRecord(response)?.data)?.artifact),
    projection: {
      ...projection,
      browserFileUnlockCode: null,
    },
  };
}

function downloadGrantToken(response: unknown) {
  const token = readString(readRecord(response)?.download_token);
  if (!token) {
    throw new OpenHugeRequestError({
      code: "download_token_required",
      message: "OpenHuge did not return a download token.",
      statusCode: 409,
    });
  }
  return token;
}

function artifactFileNameFromResponse(
  response: Response,
  artifact: Record<string, unknown> | null
) {
  return (
    contentDispositionFileName(response.headers.get("content-disposition")) ??
    readString(artifact?.file_name) ??
    "hugecode-browser-data.hcbrowser"
  );
}

async function openHugeRedeem(
  config: T3OpenHugeDeliveryConfig,
  fetcher: T3DeliveryFetch,
  body: unknown
): Promise<T3DeliveryRedeemResult> {
  const activationCode = readActivationCodeFromBody(body);
  const activation = await openHugeJsonRequest({
    body: {
      redemption_code: activationCode,
    },
    config,
    fetcher,
    method: "POST",
    path: "/v1/delivery-activations/redeem",
  });
  const redeemed = activationProjection(activation);
  if (!redeemed.activationId) {
    throw new OpenHugeRequestError({
      code: "delivery_activation_id_required",
      message: "OpenHuge activation response did not include activation_id.",
      statusCode: 409,
    });
  }
  const grant = await openHugeJsonRequest({
    body: {
      activation_id: redeemed.activationId,
      redemption_code: activationCode,
    },
    config,
    fetcher,
    method: "POST",
    path: "/v1/delivery-download-grants",
  });
  const token = downloadGrantToken(grant);
  const grantArtifact =
    readRecord(readRecord(readRecord(grant)?.data)?.artifact) ?? redeemed.artifact;
  const download = await openHugeArtifactRequest({ config, fetcher, token });
  const serialized = readSerializedArtifactPayload(download.text);
  const headerHash = normalizeSha256Hex(
    download.response.headers.get("x-openhuge-artifact-sha256")
  );
  const fileHash = headerHash ?? normalizeSha256Hex(grantArtifact?.sha256);
  const fileName = artifactFileNameFromResponse(download.response, grantArtifact);
  const byteLength =
    readPositiveNumber(Number(download.response.headers.get("content-length"))) ??
    readPositiveNumber(new TextEncoder().encode(serialized).byteLength);
  return {
    artifact: {
      byteLength,
      fileHash,
      fileName,
      serialized,
    },
    projection: normalizeT3DeliveryProjection({
      ...redeemed.projection,
      browserFileUnlockCode: null,
      fileHash,
      status: "redeemed",
      summary:
        "OpenHuge redeemed delivery, issued a download grant, and returned encrypted account data.",
    }),
  };
}

async function unavailableT3DeliveryTransport() {
  return createUnavailableDeliveryProjection();
}

export function createOpenHugeDeliveryTransport(
  config: T3OpenHugeDeliveryConfig | null = readOpenHugeDeliveryConfig(),
  fetcher: T3DeliveryFetch = defaultOpenHugeDeliveryFetch
): T3DeliveryTransport {
  if (!config) {
    return unavailableT3DeliveryTransport;
  }
  const openHugeFetch = normalizeOpenHugeDeliveryFetch(fetcher);
  return async ({ body, operation }) => {
    try {
      if (operation === "prepare") {
        return await openHugePrepare(config, openHugeFetch, body);
      }
      if (operation === "uploadArtifact") {
        return await openHugeUploadArtifact(config, openHugeFetch, body);
      }
      if (operation === "redeem") {
        return await openHugeRedeem(config, openHugeFetch, body);
      }
      if (operation === "readStatus" || operation === "submitExportWitness") {
        return await openHugeReadStatus(config, openHugeFetch, body);
      }
      return createFailedDeliveryProjection();
    } catch (error) {
      return operation === "redeem"
        ? { artifact: null, projection: createOpenHugeErrorProjection(error) }
        : createOpenHugeErrorProjection(error);
    }
  };
}

async function requestProjection(
  transport: T3DeliveryTransport,
  operation: T3DeliveryTransportOperation,
  body: unknown
) {
  try {
    return normalizeT3DeliveryProjection(await transport({ body, operation }));
  } catch {
    return createFailedDeliveryProjection();
  }
}

async function requestRedeemResult(
  transport: T3DeliveryTransport,
  operation: T3DeliveryTransportOperation,
  body: unknown
): Promise<T3DeliveryRedeemResult> {
  try {
    return normalizeT3DeliveryRedeemResult(await transport({ body, operation }));
  } catch {
    return {
      artifact: null,
      projection: createFailedDeliveryProjection(),
    };
  }
}

export function createT3DeliveryService(
  transport: T3DeliveryTransport = unavailableT3DeliveryTransport
): T3DeliveryService {
  return {
    async prepare(input) {
      return requestProjection(transport, "prepare", { provider: input.provider });
    },
    async readStatus(input) {
      return requestProjection(transport, "readStatus", input);
    },
    async redeem(input) {
      const activationCode = input.activationCode.trim();
      if (activationCode.length < 8) {
        return {
          artifact: null,
          projection: createDeliveryProjection({
            status: "failed",
            summary: "Redemption code must contain at least 8 characters.",
          }),
        };
      }
      return requestRedeemResult(transport, "redeem", { activationCode });
    },
    async submitExportWitness(input) {
      assertSafeExportWitness(input.witness);
      return requestProjection(transport, "submitExportWitness", {
        deliveryId: input.deliveryId,
        witness: input.witness,
      });
    },
    async uploadArtifact(input) {
      assertSafeArtifactUpload(input.artifact);
      return requestProjection(transport, "uploadArtifact", {
        artifact: {
          fileName: input.artifact.witness.fileName,
          serialized: input.artifact.serialized,
        },
        deliveryId: input.deliveryId,
        witness: input.artifact.witness,
      });
    },
  };
}

export const T3_DELIVERY_SERVICE = createT3DeliveryService(createOpenHugeDeliveryTransport());

export async function createT3DeliveryExportWitness(input: {
  fileName: string;
  serialized: string;
}): Promise<T3DeliveryExportWitness> {
  const bytes = new TextEncoder().encode(input.serialized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fileHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return {
    byteLength: bytes.byteLength,
    exportedAt: new Date().toISOString(),
    fileHash,
    fileName: input.fileName,
  };
}

export async function prepareT3Delivery(input: { provider: "chatgpt" }) {
  return T3_DELIVERY_SERVICE.prepare(input);
}

export async function submitT3DeliveryExportWitness(input: {
  deliveryId: string;
  witness: T3DeliveryExportWitness;
}) {
  return T3_DELIVERY_SERVICE.submitExportWitness(input);
}

export async function uploadT3DeliveryArtifact(input: {
  artifact: T3DeliveryArtifactUpload;
  deliveryId: string;
}) {
  return T3_DELIVERY_SERVICE.uploadArtifact(input);
}

export async function redeemT3Delivery(input: { activationCode: string }) {
  return T3_DELIVERY_SERVICE.redeem(input);
}

export async function readT3DeliveryStatus(input: {
  activationCode?: string;
  deliveryId?: string;
}) {
  return T3_DELIVERY_SERVICE.readStatus(input);
}
