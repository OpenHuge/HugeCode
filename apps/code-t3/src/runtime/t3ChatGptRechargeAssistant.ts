export type T3ChatGptAccountStatus = "unknown" | "not_logged_in" | "free" | "subscribed";

export type T3ChatGptSessionAssessment = {
  accountStatus: T3ChatGptAccountStatus;
  hasSensitivePayload: boolean;
  isLoggedIn: boolean;
  safeSummary: string;
  subscriptionSignals: readonly string[];
};

export type T3ChatGptEncryptedSessionEnvelope = {
  ciphertext: string;
  createdAt: number;
  iv: string;
  iterations: number;
  kdf: "PBKDF2-SHA256";
  salt: string;
  version: 1;
};

export const T3_CHATGPT_HOME_URL = "https://chatgpt.com/";
export const T3_CHATGPT_SESSION_URL = "https://chatgpt.com/api/auth/session";
export const T3_CHATGPT_SESSION_VAULT_STORAGE_KEY = "hugecode_t3_chatgpt_session_vault_v1";

const SENSITIVE_KEY_PATTERN =
  /token|cookie|secret|session|email|mail|name|picture|image|phone|authorization|jwt/iu;
const SUBSCRIPTION_KEY_PATTERN =
  /subscription|subscriber|paid|plan|workspace|team|enterprise|plus|pro|billing/iu;
const PAID_VALUE_PATTERN = /\b(plus|pro|team|enterprise|paid|subscribed|active)\b/iu;
const FREE_VALUE_PATTERN = /\b(free|none|inactive|not[_-]?subscribed|no[_-]?subscription)\b/iu;
const SESSION_VAULT_ITERATIONS = 210_000;
type T3ChatGptSessionSignalSummary = {
  hasSensitivePayload: boolean;
  hasUser: boolean;
  subscriptionSignals: string[];
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function parseSessionPayload(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function visitSessionSignals(input: unknown, path: string[] = []): T3ChatGptSessionSignalSummary {
  if (input === null || input === undefined) {
    return {
      hasSensitivePayload: false,
      hasUser: false,
      subscriptionSignals: [],
    };
  }
  if (typeof input !== "object") {
    const text = String(input);
    const keyPath = path.join(".");
    return {
      hasSensitivePayload: false,
      hasUser: false,
      subscriptionSignals:
        SUBSCRIPTION_KEY_PATTERN.test(keyPath) ||
        PAID_VALUE_PATTERN.test(text) ||
        FREE_VALUE_PATTERN.test(text)
          ? [`${keyPath || "value"}=${text}`]
          : [],
    };
  }
  const record = input as Record<string, unknown>;
  return Object.entries(record).reduce<T3ChatGptSessionSignalSummary>(
    (summary, [key, value]) => {
      const nextPath = [...path, key];
      const keyPath = nextPath.join(".");
      const child = visitSessionSignals(value, nextPath);
      const valueText =
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : "";
      return {
        hasSensitivePayload:
          summary.hasSensitivePayload ||
          SENSITIVE_KEY_PATTERN.test(key) ||
          child.hasSensitivePayload,
        hasUser: summary.hasUser || key === "user" || keyPath.endsWith(".user") || child.hasUser,
        subscriptionSignals: [
          ...summary.subscriptionSignals,
          ...(SUBSCRIPTION_KEY_PATTERN.test(key) && valueText ? [`${keyPath}=${valueText}`] : []),
          ...child.subscriptionSignals,
        ],
      };
    },
    {
      hasSensitivePayload: false,
      hasUser: false,
      subscriptionSignals: [] as string[],
    }
  );
}

function readAccountStatus(input: {
  hasUser: boolean;
  subscriptionSignals: readonly string[];
}): T3ChatGptAccountStatus {
  if (!input.hasUser) {
    return "not_logged_in";
  }
  const signalText = input.subscriptionSignals.join(" ");
  if (PAID_VALUE_PATTERN.test(signalText) && !FREE_VALUE_PATTERN.test(signalText)) {
    return "subscribed";
  }
  if (FREE_VALUE_PATTERN.test(signalText) || input.subscriptionSignals.length === 0) {
    return "free";
  }
  return "unknown";
}

export function assessT3ChatGptSession(input: string): T3ChatGptSessionAssessment {
  const payload = parseSessionPayload(input);
  const signals = visitSessionSignals(payload);
  const accountStatus = readAccountStatus(signals);
  const isLoggedIn = accountStatus !== "not_logged_in";
  return {
    accountStatus,
    hasSensitivePayload: signals.hasSensitivePayload,
    isLoggedIn,
    safeSummary:
      accountStatus === "free"
        ? "Logged-in free ChatGPT account detected. It can proceed to CDK redemption."
        : accountStatus === "subscribed"
          ? "Logged-in subscribed ChatGPT account detected. Do not redeem a free-account CDK here."
          : accountStatus === "not_logged_in"
            ? "No logged-in ChatGPT user was detected. Open ChatGPT and sign in first."
            : "ChatGPT login was detected, but subscription status is unclear.",
    subscriptionSignals: signals.subscriptionSignals.slice(0, 6),
  };
}

export function buildT3ChatGptRechargeActions(
  assessment: T3ChatGptSessionAssessment,
  cdkCode: string
): string[] {
  if (!assessment.isLoggedIn) {
    return ["Open chatgpt.com in this browser and sign in before checking the session endpoint."];
  }
  if (assessment.accountStatus === "subscribed") {
    return ["Stop: this account already appears subscribed. Use a free account for this CDK."];
  }
  if (assessment.accountStatus === "unknown") {
    return ["Review the session page manually; subscription status is not safe to infer."];
  }
  const trimmedCdk = cdkCode.trim();
  return [
    "Open the CDK redemption page in the same browser session.",
    trimmedCdk
      ? `Redeem CDK after user confirmation: ${trimmedCdk}`
      : "Paste the CDK code before redemption.",
    "After redemption, reopen /api/auth/session and verify the account is no longer free.",
  ];
}

async function deriveSessionVaultKey(input: {
  passphrase: string;
  salt: Uint8Array<ArrayBuffer>;
  subtle: SubtleCrypto;
}) {
  const passphrase = input.passphrase.trim();
  if (passphrase.length < 8) {
    throw new Error("Use at least 8 characters for the local session vault passphrase.");
  }
  const keyMaterial = await input.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return input.subtle.deriveKey(
    {
      hash: "SHA-256",
      iterations: SESSION_VAULT_ITERATIONS,
      name: "PBKDF2",
      salt: input.salt,
    },
    keyMaterial,
    {
      length: 256,
      name: "AES-GCM",
    },
    false,
    ["decrypt", "encrypt"]
  );
}

export async function encryptT3ChatGptSessionVault(input: {
  passphrase: string;
  plaintextSession: string;
  crypto: Crypto;
}): Promise<T3ChatGptEncryptedSessionEnvelope> {
  const plaintextSession = input.plaintextSession.trim();
  if (!plaintextSession) {
    throw new Error("Paste the ChatGPT session JSON before encrypting it.");
  }
  if (!input.crypto.subtle) {
    throw new Error("WebCrypto is required for encrypted session storage.");
  }
  const salt = input.crypto.getRandomValues(new Uint8Array(16));
  const iv = input.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSessionVaultKey({
    passphrase: input.passphrase,
    salt,
    subtle: input.crypto.subtle,
  });
  const ciphertext = await input.crypto.subtle.encrypt(
    {
      iv,
      name: "AES-GCM",
    },
    key,
    new TextEncoder().encode(plaintextSession)
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    createdAt: Date.now(),
    iv: bytesToBase64(iv),
    iterations: SESSION_VAULT_ITERATIONS,
    kdf: "PBKDF2-SHA256",
    salt: bytesToBase64(salt),
    version: 1,
  };
}

export async function decryptT3ChatGptSessionVault(input: {
  envelope: T3ChatGptEncryptedSessionEnvelope;
  passphrase: string;
  crypto: Crypto;
}): Promise<string> {
  if (input.envelope.version !== 1 || input.envelope.kdf !== "PBKDF2-SHA256") {
    throw new Error("Unsupported ChatGPT session vault format.");
  }
  if (!input.crypto.subtle) {
    throw new Error("WebCrypto is required for encrypted session storage.");
  }
  const salt = base64ToBytes(input.envelope.salt);
  const iv = base64ToBytes(input.envelope.iv);
  const ciphertext = base64ToBytes(input.envelope.ciphertext);
  const key = await deriveSessionVaultKey({
    passphrase: input.passphrase,
    salt,
    subtle: input.crypto.subtle,
  });
  const plaintext = await input.crypto.subtle.decrypt(
    {
      iv,
      name: "AES-GCM",
    },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

export function assessEncryptedT3ChatGptSessionEnvelope(
  envelope: T3ChatGptEncryptedSessionEnvelope | null
) {
  if (!envelope) {
    return "No encrypted ChatGPT session is saved locally.";
  }
  return `Encrypted ChatGPT session saved locally with ${envelope.kdf}, ${envelope.iterations} iterations.`;
}
