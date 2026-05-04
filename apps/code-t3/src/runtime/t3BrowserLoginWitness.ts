import type { BrowserChromeSnapshot, BrowserChromeTabState } from "./t3BrowserChromeBridge";

export const T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY = "hugecode:t3-browser-imported-data-ready";
export const T3_BROWSER_CHATGPT_LOGIN_WITNESS_STORAGE_KEY =
  "hugecode:t3-browser-chatgpt-login-witness:v1";

export type T3BrowserChatGptLoginWitnessStatus =
  | "VERIFIED"
  | "IMPORT_NOT_READY"
  | "BROWSER_LAUNCH_FAILED"
  | "TARGET_LOAD_FAILED"
  | "SESSION_RESTORE_FAILED"
  | "EXTERNAL_SITE_BLOCKED"
  | "MANUAL_WITNESS_REQUIRED";

export type T3BrowserChatGptLoginWitness = {
  checkedAt: number;
  evidence: {
    activeTabId: string | null;
    activeTitle: string | null;
    activeUrl: string | null;
    loading: boolean;
    provider: "chatgpt";
    securityState: BrowserChromeTabState["securityState"] | null;
    targetUrl: string;
  };
  provider: "chatgpt";
  status: T3BrowserChatGptLoginWitnessStatus;
  summary: string;
};

function activeTabFromSnapshot(snapshot: BrowserChromeSnapshot | null | undefined) {
  if (!snapshot) {
    return null;
  }
  return snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId) ?? snapshot.tabs[0] ?? null;
}

function chatGptWitnessEvidence(input: {
  checkedAt: number;
  snapshot?: BrowserChromeSnapshot | null;
  targetUrl: string;
}): T3BrowserChatGptLoginWitness["evidence"] {
  const activeTab = activeTabFromSnapshot(input.snapshot);
  return {
    activeTabId: activeTab?.id ?? null,
    activeTitle: activeTab?.title ?? null,
    activeUrl: activeTab?.url ?? null,
    loading: activeTab?.loading ?? false,
    provider: "chatgpt",
    securityState: activeTab?.securityState ?? null,
    targetUrl: input.targetUrl,
  };
}

function hostnameFor(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function pathnameFor(value: string | null) {
  if (!value) {
    return "";
  }
  try {
    return new URL(value).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function isChatGptWitnessHost(hostname: string | null) {
  return (
    hostname === "chatgpt.com" || hostname === "chat.openai.com" || hostname === "auth.openai.com"
  );
}

function isChatGptLoginRoute(input: { title: string | null; url: string | null }) {
  const hostname = hostnameFor(input.url);
  const pathname = pathnameFor(input.url);
  const title = input.title?.toLowerCase() ?? "";
  return (
    hostname === "auth.openai.com" ||
    pathname.includes("/auth") ||
    pathname.includes("/login") ||
    title.includes("log in") ||
    title.includes("sign in")
  );
}

function chatGptWitness(input: {
  checkedAt: number;
  evidence: T3BrowserChatGptLoginWitness["evidence"];
  status: T3BrowserChatGptLoginWitnessStatus;
  summary: string;
}): T3BrowserChatGptLoginWitness {
  return {
    checkedAt: input.checkedAt,
    evidence: input.evidence,
    provider: "chatgpt",
    status: input.status,
    summary: input.summary,
  };
}

export function buildT3BrowserChatGptLoginWitness(input: {
  importReady: boolean;
  snapshot?: BrowserChromeSnapshot | null;
  targetUrl: string;
  checkedAt?: number;
}): T3BrowserChatGptLoginWitness {
  const checkedAt = input.checkedAt ?? Date.now();
  const evidence = chatGptWitnessEvidence({
    checkedAt,
    snapshot: input.snapshot,
    targetUrl: input.targetUrl,
  });
  if (!input.importReady) {
    return chatGptWitness({
      checkedAt,
      evidence,
      status: "IMPORT_NOT_READY",
      summary: "ChatGPT login witness is blocked because browser account data is not imported.",
    });
  }
  if (!input.snapshot || input.snapshot.tabs.length === 0 || !evidence.activeTabId) {
    return chatGptWitness({
      checkedAt,
      evidence,
      status: "BROWSER_LAUNCH_FAILED",
      summary: "HugeCode Browser did not expose an active ChatGPT tab for witness capture.",
    });
  }
  const activeHost = hostnameFor(evidence.activeUrl);
  if (!isChatGptWitnessHost(activeHost)) {
    return chatGptWitness({
      checkedAt,
      evidence,
      status: "TARGET_LOAD_FAILED",
      summary: "HugeCode Browser is open, but the active tab is not a ChatGPT target.",
    });
  }
  if (evidence.loading) {
    return chatGptWitness({
      checkedAt,
      evidence,
      status: "TARGET_LOAD_FAILED",
      summary: "ChatGPT is still loading in HugeCode Browser; witness is not ready yet.",
    });
  }
  if (evidence.securityState !== "secure") {
    return chatGptWitness({
      checkedAt,
      evidence,
      status: "EXTERNAL_SITE_BLOCKED",
      summary: "ChatGPT did not finish in a secure browser context.",
    });
  }
  if (isChatGptLoginRoute({ title: evidence.activeTitle, url: evidence.activeUrl })) {
    return chatGptWitness({
      checkedAt,
      evidence,
      status: "SESSION_RESTORE_FAILED",
      summary: "ChatGPT opened in HugeCode Browser, but it is still on an authentication route.",
    });
  }
  return chatGptWitness({
    checkedAt,
    evidence,
    status: "MANUAL_WITNESS_REQUIRED",
    summary:
      "ChatGPT loaded in HugeCode Browser after account data import. Record a manual witness if the signed-in ChatGPT UI is visible.",
  });
}

export function buildVerifiedT3BrowserChatGptLoginWitness(input: {
  snapshot?: BrowserChromeSnapshot | null;
  targetUrl: string;
  verifiedAt?: number;
}): T3BrowserChatGptLoginWitness {
  const checkedAt = input.verifiedAt ?? Date.now();
  const evidence = chatGptWitnessEvidence({
    checkedAt,
    snapshot: input.snapshot,
    targetUrl: input.targetUrl,
  });
  return chatGptWitness({
    checkedAt,
    evidence,
    status: "VERIFIED",
    summary:
      "Manual witness recorded: the signed-in ChatGPT UI was visible inside HugeCode Browser.",
  });
}

export function readT3BrowserImportedDataReadyFlag(storage: Pick<Storage, "getItem">) {
  return storage.getItem(T3_BROWSER_IMPORTED_DATA_READY_STORAGE_KEY) === "1";
}

export function writeT3BrowserChatGptLoginWitness(
  storage: Pick<Storage, "setItem">,
  witness: T3BrowserChatGptLoginWitness
) {
  storage.setItem(T3_BROWSER_CHATGPT_LOGIN_WITNESS_STORAGE_KEY, JSON.stringify(witness));
}
