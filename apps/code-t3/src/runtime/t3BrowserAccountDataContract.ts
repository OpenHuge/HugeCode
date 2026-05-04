export const T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V1 = "hugecode.t3-browser-static-data/v1";
export const T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2 = "hugecode.t3-browser-account-data/v2";
export const T3_BROWSER_HOST_BOUND_PAYLOAD_POLICY = "host-encrypted-browser-state";
export const T3_BROWSER_METADATA_ONLY_PAYLOAD_POLICY = "metadata-only-no-raw-credentials";
export const T3_BROWSER_PORTABLE_PAYLOAD_POLICY = "portable-browser-account-state";
export const T3_BROWSER_PORTABLE_ENCRYPTION = "portable-aes-256-gcm-pbkdf2-sha256";
export const T3_BROWSER_SAFE_STORAGE_ENCRYPTION = "electron-safe-storage";
export const T3_BROWSER_PORTABLE_CONTRACT_VERSION = "hugecode.browser-account-portable/v2";

export const T3_BROWSER_CHATGPT_ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://auth.openai.com",
] as const;

export type T3BrowserStaticDataSchemaVersion =
  | typeof T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V1
  | typeof T3_BROWSER_STATIC_DATA_SCHEMA_VERSION_V2;

export type T3BrowserStaticDataPayloadPolicy =
  | typeof T3_BROWSER_HOST_BOUND_PAYLOAD_POLICY
  | typeof T3_BROWSER_METADATA_ONLY_PAYLOAD_POLICY
  | typeof T3_BROWSER_PORTABLE_PAYLOAD_POLICY;

export type T3BrowserLoginStateEncryption =
  | typeof T3_BROWSER_SAFE_STORAGE_ENCRYPTION
  | typeof T3_BROWSER_PORTABLE_ENCRYPTION;

export type T3BrowserPortableLoginStateContract = {
  allowedOrigins: readonly string[];
  algorithm: "AES-256-GCM";
  credentialMode: "import-code";
  importSecretRequired: true;
  kdf: "PBKDF2-SHA256";
  kdfIterations: number;
  payloadEncoding: "json";
  rawCredentialPolicy: "forbidden";
  schemaVersion: typeof T3_BROWSER_PORTABLE_CONTRACT_VERSION;
};

export type T3BrowserPortableLoginStateCrypto = {
  authTagBase64: string;
  ivBase64: string;
  saltBase64: string;
};

export function normalizeT3BrowserAllowedOrigins(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...T3_BROWSER_CHATGPT_ALLOWED_ORIGINS];
  }
  const allowed = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    try {
      const parsed = new URL(entry.trim());
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        continue;
      }
      parsed.pathname = "/";
      parsed.search = "";
      parsed.hash = "";
      const origin = parsed.origin;
      if (T3_BROWSER_CHATGPT_ALLOWED_ORIGINS.some((allowedOrigin) => allowedOrigin === origin)) {
        allowed.add(origin);
      }
    } catch {
      continue;
    }
  }
  return allowed.size > 0 ? [...allowed] : [...T3_BROWSER_CHATGPT_ALLOWED_ORIGINS];
}

export function buildT3BrowserPortableLoginStateContract(input?: {
  allowedOrigins?: readonly string[];
  kdfIterations?: number;
}): T3BrowserPortableLoginStateContract {
  return {
    allowedOrigins: normalizeT3BrowserAllowedOrigins(input?.allowedOrigins),
    algorithm: "AES-256-GCM",
    credentialMode: "import-code",
    importSecretRequired: true,
    kdf: "PBKDF2-SHA256",
    kdfIterations: input?.kdfIterations ?? 210_000,
    payloadEncoding: "json",
    rawCredentialPolicy: "forbidden",
    schemaVersion: T3_BROWSER_PORTABLE_CONTRACT_VERSION,
  };
}

export function isT3BrowserPortableLoginStateEncryption(
  value: unknown
): value is typeof T3_BROWSER_PORTABLE_ENCRYPTION {
  return value === T3_BROWSER_PORTABLE_ENCRYPTION;
}

export function isT3BrowserHostBoundLoginStateEncryption(
  value: unknown
): value is typeof T3_BROWSER_SAFE_STORAGE_ENCRYPTION {
  return value === T3_BROWSER_SAFE_STORAGE_ENCRYPTION;
}
