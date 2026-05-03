import {
  getT3BrowserProfileSyncState,
  providerUrl,
  type T3BrowserProfileDescriptor,
  type T3BrowserProfileSyncState,
  type T3BrowserProvider,
} from "./t3BrowserProfiles";

export type T3BrowserOperationsStatus = "ready" | "attention" | "blocked";
export type T3BrowserOperationsActionStatus = "available" | "needs-sync" | "host-managed";

export type T3BrowserOperationsCheck = {
  id: string;
  label: string;
  status: T3BrowserOperationsStatus;
  summary: string;
};

export type T3BrowserOperationsAction = {
  id: string;
  label: string;
  status: T3BrowserOperationsActionStatus;
  summary: string;
};

export type T3BrowserProfileOperationsReport = {
  batchActions: T3BrowserOperationsAction[];
  checks: T3BrowserOperationsCheck[];
  credentialPolicy: string;
  proxyPolicy: string;
  status: T3BrowserOperationsStatus;
  statusLabel: string;
  summary: string;
  teamPolicy: string;
};

function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProductUrl(value: string): string {
  const parsed = new URL(value);
  if (!matchesHttpProtocol(parsed.protocol)) {
    throw new Error("Web product URL must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Web product URL must not include embedded credentials.");
  }
  parsed.hash = "";
  return parsed.toString();
}

function matchesHttpProtocol(protocol: string) {
  return protocol === "http:" || protocol === "https:";
}

function providerDisplayName(providerId: T3BrowserProvider) {
  if (providerId === "chatgpt") return "ChatGPT";
  if (providerId === "gemini") return "Gemini";
  if (providerId === "hugerouter") return "Hugerouter";
  return "Custom";
}

function reduceOperationsStatus(
  checks: readonly T3BrowserOperationsCheck[]
): T3BrowserOperationsStatus {
  if (checks.some((check) => check.status === "blocked")) {
    return "blocked";
  }
  if (checks.some((check) => check.status === "attention")) {
    return "attention";
  }
  return "ready";
}

function operationsStatusLabel(status: T3BrowserOperationsStatus) {
  if (status === "blocked") {
    return "Blocked";
  }
  if (status === "attention") {
    return "Needs review";
  }
  return "Ready";
}

function buildT3BrowserTargetCheck(input: {
  customUrl?: string | null;
  providerId: T3BrowserProvider;
}): T3BrowserOperationsCheck {
  if (input.providerId !== "custom") {
    const targetUrl = providerUrl(input.providerId);
    return {
      id: "target",
      label: "Target URL",
      status: "ready",
      summary: `${providerDisplayName(input.providerId)} opens through ${new URL(targetUrl).origin}.`,
    };
  }
  const customUrl = readText(input.customUrl);
  if (!customUrl) {
    return {
      id: "target",
      label: "Target URL",
      status: "blocked",
      summary: "Enter an http or https site URL before opening a custom browser session.",
    };
  }
  try {
    const normalizedUrl = normalizeProductUrl(customUrl);
    const parsed = new URL(normalizedUrl);
    return {
      id: "target",
      label: "Target URL",
      status: parsed.protocol === "https:" ? "ready" : "attention",
      summary:
        parsed.protocol === "https:"
          ? `Custom site resolves to ${parsed.origin}.`
          : `Custom site resolves to ${parsed.origin}; plain HTTP should be used only for trusted local workflows.`,
    };
  } catch (error) {
    return {
      id: "target",
      label: "Target URL",
      status: "blocked",
      summary: error instanceof Error ? error.message : "Custom web product URL is invalid.",
    };
  }
}

function buildT3BrowserEndpointCheck(
  profile: T3BrowserProfileDescriptor
): T3BrowserOperationsCheck {
  if (profile.source !== "remote-devtools") {
    return {
      id: "endpoint",
      label: "Profile source",
      status: "ready",
      summary:
        "Current browser profile is attached; browser-state capture must run through an authorized host/cloud sync path.",
    };
  }
  if (!profile.endpointUrl) {
    return {
      id: "endpoint",
      label: "Remote endpoint",
      status: "blocked",
      summary: "Remote DevTools profile is missing its sanitized endpoint reference.",
    };
  }
  const endpoint = new URL(profile.endpointUrl);
  return {
    id: "endpoint",
    label: "Remote endpoint",
    status: endpoint.protocol === "https:" ? "ready" : "attention",
    summary:
      endpoint.protocol === "https:"
        ? `Remote DevTools endpoint is stored as a credential-free HTTPS reference to ${endpoint.host}.`
        : `Remote DevTools endpoint uses loopback HTTP at ${endpoint.host}; keep it local and protected.`,
  };
}

export function buildT3BrowserProfileOperationsReport(input: {
  customUrl?: string | null;
  profile: T3BrowserProfileDescriptor;
  providerId: T3BrowserProvider;
  syncState?: T3BrowserProfileSyncState | null;
}): T3BrowserProfileOperationsReport {
  const syncState = input.syncState ?? getT3BrowserProfileSyncState(input.profile);
  const remoteSessionAvailable =
    syncState.accountPortability === "remote-session" && syncState.remoteSessionAvailable;
  const targetCheck = buildT3BrowserTargetCheck(input);
  const checks: T3BrowserOperationsCheck[] = [
    buildT3BrowserEndpointCheck(input.profile),
    targetCheck,
    {
      id: "fingerprint",
      label: "Fingerprint",
      status: "ready",
      summary:
        "Native fingerprint transparency is active; HugeCode does not spoof or randomize browser attributes.",
    },
    {
      id: "credentials",
      label: "Encrypted state",
      status: "ready",
      summary:
        "Cookies, Local Storage, IndexedDB, extensions, and settings may sync only inside encrypted same-user cloud bundles.",
    },
    {
      id: "proxy",
      label: "Proxy hygiene",
      status: input.profile.source === "remote-devtools" ? "ready" : "attention",
      summary:
        input.profile.source === "remote-devtools"
          ? "Proxy, VPN, and IP leak checks are owned by the remote browser profile before launch."
          : "The current browser profile uses the host browser network path; configure and verify proxy state outside HugeCode.",
    },
    {
      id: "continuity",
      label: "Continuity",
      status: remoteSessionAvailable ? "ready" : "attention",
      summary: remoteSessionAvailable
        ? "Hugerouter remote-session metadata is available for cross-device continuity."
        : "Sync the profile mock before creating team passes or cross-device handoff metadata.",
    },
  ];
  const status = reduceOperationsStatus(checks);
  const canOpenTarget = targetCheck.status !== "blocked";
  return {
    batchActions: [
      {
        id: "open-selected-profile",
        label: "Open selected profile",
        status: canOpenTarget ? "available" : "host-managed",
        summary: canOpenTarget
          ? "Launch the selected provider or custom site with the chosen profile reference."
          : "Fix the target URL before launch.",
      },
      {
        id: "sync-profile-metadata",
        label: "Sync profile metadata",
        status: "available",
        summary: "Record device, health, and remote-session metadata without credential payloads.",
      },
      {
        id: "create-isolated-app",
        label: "Create isolated app",
        status: canOpenTarget ? "available" : "host-managed",
        summary:
          "Create an app-scoped launch context; storage isolation is bound by the host when available.",
      },
      {
        id: "create-guest-pass",
        label: "Create guest pass",
        status: remoteSessionAvailable ? "available" : "needs-sync",
        summary:
          "Grant revocable supervised remote-session access with sensitive actions blocked by default.",
      },
      {
        id: "metadata-import-export",
        label: "Version snapshots",
        status: "host-managed",
        summary:
          "Browser-state versions are portable through authorized encrypted cloud restore, not raw local export.",
      },
    ],
    checks,
    credentialPolicy:
      "Browser state can sync for the same user only as encrypted cloud-managed profile versions; raw credential export remains blocked.",
    proxyPolicy:
      input.profile.source === "remote-devtools"
        ? "Remote profile owns proxy configuration and leak testing; HugeCode stores only the endpoint reference."
        : "Current-browser networking is host-managed. Use a browser or OS profile for proxy routing and verify externally.",
    status,
    statusLabel: operationsStatusLabel(status),
    summary:
      status === "blocked"
        ? "Resolve blocked profile or target checks before opening this browser workflow."
        : status === "attention"
          ? "Workflow can proceed after reviewing network, continuity, or sync gaps."
          : "Profile, target, credential, and continuity checks are ready for launch.",
    teamPolicy:
      "Team access uses supervised Guest Pass or seat-pool metadata with owner approval for sensitive actions.",
  };
}
