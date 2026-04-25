import type { BrowserWindowConstructorOptions } from "electron";
import type {
  AiWebLabProviderId,
  DesktopAiWebLabArtifact,
  DesktopAiWebLabCatalog,
  DesktopAiWebLabNavigationInput,
  DesktopAiWebLabOpenInput,
  DesktopAiWebLabProviderSupport,
  DesktopAiWebLabSessionMode,
  DesktopAiWebLabState,
  DesktopAiWebLabViewMode,
  LocalChromeDebuggerEndpointDescriptor,
} from "@ku0/code-platform-interfaces";

export const DEFAULT_AI_WEB_LAB_PROVIDER: AiWebLabProviderId = "chatgpt";

type AiWebLabWindowOpenHandlerResult = {
  action: "deny";
};

type AiWebLabBrowserWindowLike = {
  close(): void;
  focus(): void;
  getTitle?(): string;
  isDestroyed(): boolean;
  isVisible(): boolean;
  loadURL(url: string): Promise<unknown> | unknown;
  once(event: "ready-to-show", listener: () => void): void;
  on(event: "closed", listener: () => void): void;
  show(): void;
  webContents: {
    executeJavaScript(code: string): Promise<unknown>;
    getURL?(): string;
    on?(event: string, listener: (...args: unknown[]) => unknown): void;
    setWindowOpenHandler(
      handler: (details: { url: string }) => AiWebLabWindowOpenHandlerResult
    ): void;
  };
};

type AiWebLabBrowserWindowFacade = {
  create(options: BrowserWindowConstructorOptions): AiWebLabBrowserWindowLike;
};

type CreateDesktopAiWebLabControllerInput = {
  browserWindow: AiWebLabBrowserWindowFacade;
  ensureManagedSessionSecurity?(providerId: AiWebLabProviderId, partitionKey?: string | null): void;
  getDefaultProvider?(): AiWebLabProviderId;
  isSafeExternalUrl(url: string): boolean;
  listLocalChromeDebuggerEndpoints():
    | Promise<LocalChromeDebuggerEndpointDescriptor[]>
    | LocalChromeDebuggerEndpointDescriptor[];
  openExternalUrl(url: string): Promise<void> | void;
};

export type DesktopAiWebLabController = {
  closeSession(): Promise<DesktopAiWebLabState>;
  extractArtifact(): Promise<DesktopAiWebLabArtifact>;
  focusSession(): Promise<DesktopAiWebLabState>;
  getCatalog(): Promise<DesktopAiWebLabCatalog>;
  getState(): Promise<DesktopAiWebLabState>;
  navigate(input: DesktopAiWebLabNavigationInput): Promise<DesktopAiWebLabState>;
  openEntrypoint(
    providerId: AiWebLabProviderId,
    entrypointId: string
  ): Promise<DesktopAiWebLabState>;
  openSession(input?: DesktopAiWebLabOpenInput): Promise<DesktopAiWebLabState>;
  setSessionMode(mode: DesktopAiWebLabSessionMode): Promise<DesktopAiWebLabState>;
  setViewMode(mode: DesktopAiWebLabViewMode): Promise<DesktopAiWebLabState>;
};

type ExtractedAiWebLabPayload = {
  content?: string | null;
  errorMessage?: string | null;
  pageTitle?: string | null;
  sourceUrl?: string | null;
  status?: DesktopAiWebLabArtifact["status"];
};

type ProviderDefinition = {
  defaultEntrypointId: string;
  defaultUrl: string;
  displayName: string;
  entrypoints: DesktopAiWebLabProviderSupport["entrypoints"];
  providerId: AiWebLabProviderId;
};

const PROVIDER_DEFINITIONS: Record<AiWebLabProviderId, ProviderDefinition> = {
  chatgpt: {
    providerId: "chatgpt",
    displayName: "ChatGPT",
    defaultEntrypointId: "prompt_refinement",
    defaultUrl: "https://chatgpt.com/",
    entrypoints: [
      {
        id: "prompt_refinement",
        label: "Prompt refinement",
        capabilityId: "editable_canvas",
        url: "https://chatgpt.com/",
      },
      {
        id: "project",
        label: "Project workspace",
        capabilityId: "persistent_project",
        url: "https://chatgpt.com/",
      },
      {
        id: "decision_lab",
        label: "Decision compare",
        capabilityId: "artifact_export",
        url: "https://chatgpt.com/",
      },
    ],
  },
  gemini: {
    providerId: "gemini",
    displayName: "Gemini",
    defaultEntrypointId: "canvas",
    defaultUrl: "https://gemini.google.com/app",
    entrypoints: [
      {
        id: "canvas",
        label: "Canvas",
        capabilityId: "editable_canvas",
        url: "https://gemini.google.com/app",
      },
      {
        id: "deep_research",
        label: "Deep Research",
        capabilityId: "deep_research",
        url: "https://gemini.google.com/app",
      },
      {
        id: "github_import",
        label: "GitHub import",
        capabilityId: "repo_context_import",
        url: "https://gemini.google.com/app",
      },
      {
        id: "gems",
        label: "Gems",
        capabilityId: "reusable_workflow",
        url: "https://gemini.google.com/app",
      },
    ],
  },
};

function readTrimmedText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getProviderDefinition(providerId: AiWebLabProviderId): ProviderDefinition {
  return PROVIDER_DEFINITIONS[providerId];
}

function normalizePartitionKey(value: string | null | undefined): string | null {
  const trimmed = readTrimmedText(value);
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 96);
  return normalized.length > 0 ? normalized : null;
}

export function getAiWebLabManagedPartition(
  providerId: AiWebLabProviderId,
  partitionKey?: string | null
): string {
  const normalizedPartitionKey = normalizePartitionKey(partitionKey);
  return normalizedPartitionKey
    ? `persist:hugecode-ai-web-lab:${providerId}:${normalizedPartitionKey}`
    : `persist:hugecode-ai-web-lab:${providerId}`;
}

export function normalizeAiWebLabUrl(
  providerId: AiWebLabProviderId,
  value: string | null | undefined,
  fallback?: string
): string {
  const nextFallback = fallback ?? getProviderDefinition(providerId).defaultUrl;
  const trimmed = readTrimmedText(value);
  if (!trimmed) {
    return nextFallback;
  }
  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/u.test(parsed.protocol)) {
      return nextFallback;
    }
    return isAiWebLabAllowedUrl(parsed.toString()) ? parsed.toString() : nextFallback;
  } catch {
    return nextFallback;
  }
}

export function isAiWebLabAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === "chatgpt.com" ||
      hostname.endsWith(".chatgpt.com") ||
      hostname === "openai.com" ||
      hostname.endsWith(".openai.com") ||
      hostname === "help.openai.com" ||
      hostname === "gemini.google.com" ||
      hostname.endsWith(".gemini.google.com") ||
      hostname === "support.google.com" ||
      hostname === "accounts.google.com" ||
      hostname === "github.com" ||
      hostname.endsWith(".github.com")
    );
  } catch {
    return false;
  }
}

function createCatalog(defaultProviderId: AiWebLabProviderId): DesktopAiWebLabCatalog {
  return {
    defaultProviderId,
    providers: Object.values(PROVIDER_DEFINITIONS).map((provider) => ({
      available: true,
      capabilities: [
        ...new Set(provider.entrypoints.flatMap((entrypoint) => entrypoint.capabilityId ?? [])),
      ],
      defaultEntrypointId: provider.defaultEntrypointId,
      displayName: provider.displayName,
      entrypoints: provider.entrypoints,
      providerId: provider.providerId,
    })),
  };
}

function createEmptyArtifact(
  providerId: AiWebLabProviderId,
  status: DesktopAiWebLabArtifact["status"],
  errorMessage: string,
  artifactKind: DesktopAiWebLabArtifact["artifactKind"],
  input: { pageTitle?: string | null; sourceUrl?: string | null } = {}
): DesktopAiWebLabArtifact {
  return {
    artifactKind,
    content: null,
    entrypointId: null,
    extractedAt: new Date().toISOString(),
    format: artifactKind === "share_link" ? "url" : "markdown",
    pageTitle: input.pageTitle ?? null,
    providerId,
    sourceUrl: input.sourceUrl ?? null,
    status,
    errorMessage,
  };
}

function buildChatgptExtractionScript(): string {
  return `(() => {
    const normalizeText = (value) => typeof value === "string" ? value.replace(/\\r\\n/g, "\\n").trim() : "";
    const buttons = Array.from(document.querySelectorAll("button"));
    const buttonText = (button) => normalizeText(button?.getAttribute?.("aria-label") || button?.textContent || "");
    const stopStreaming = buttons.find((button) => /stop streaming/i.test(buttonText(button)));
    if (stopStreaming) {
      return {
        status: "blocked",
        content: null,
        errorMessage: "ChatGPT is still generating a response. Wait for completion before extracting the final artifact.",
        sourceUrl: window.location.href,
        pageTitle: document.title,
      };
    }
    const messageRoots = Array.from(document.querySelectorAll("article, [data-message-author-role='assistant'], div[data-message-author-role='assistant']"));
    const latestRoot = messageRoots.at(-1) || document.body;
    const latestCode = Array.from(latestRoot.querySelectorAll("pre code")).at(-1) || null;
    if (!latestCode) {
      return {
        status: "format_failed",
        content: null,
        errorMessage: "The latest ChatGPT response does not contain a fenced code block yet.",
        sourceUrl: window.location.href,
        pageTitle: document.title,
      };
    }
    const extracted = normalizeText(latestCode.textContent || "");
    if (!extracted) {
      return {
        status: "format_failed",
        content: null,
        errorMessage: "The latest ChatGPT code block is empty.",
        sourceUrl: window.location.href,
        pageTitle: document.title,
      };
    }
    const fence = String.fromCharCode(96, 96, 96);
    return {
      status: "succeeded",
      content: fence + "markdown\\n" + extracted + "\\n" + fence,
      errorMessage: null,
      sourceUrl: window.location.href,
      pageTitle: document.title,
    };
  })();`;
}

function buildGeminiExtractionScript(): string {
  return `(() => {
    const normalizeText = (value) => typeof value === "string" ? value.replace(/\\r\\n/g, "\\n").trim() : "";
    const main = document.querySelector("main") || document.body;
    const latestCode = Array.from(main.querySelectorAll("pre code")).at(-1) || null;
    if (latestCode) {
      const code = normalizeText(latestCode.textContent || "");
      if (code) {
        const fence = String.fromCharCode(96, 96, 96);
        return {
          status: "succeeded",
          content: fence + "markdown\\n" + code + "\\n" + fence,
          errorMessage: null,
          sourceUrl: window.location.href,
          pageTitle: document.title,
        };
      }
    }
    const text = normalizeText(main.innerText || "");
    if (!text) {
      return {
        status: "format_failed",
        content: null,
        errorMessage: "Gemini did not expose extractable content on the current page.",
        sourceUrl: window.location.href,
        pageTitle: document.title,
      };
    }
    return {
      status: "succeeded",
      content: text,
      errorMessage: null,
      sourceUrl: window.location.href,
      pageTitle: document.title,
    };
  })();`;
}

async function listAttachedEndpoints(
  input: CreateDesktopAiWebLabControllerInput
): Promise<LocalChromeDebuggerEndpointDescriptor[]> {
  const result = await input.listLocalChromeDebuggerEndpoints();
  return Array.isArray(result) ? result : [];
}

export function createDesktopAiWebLabController(
  input: CreateDesktopAiWebLabControllerInput
): DesktopAiWebLabController {
  let managedWindow: AiWebLabBrowserWindowLike | null = null;
  const managedWindowsByPartition = new Map<string, AiWebLabBrowserWindowLike>();
  let activeEntrypointId: string | null = null;
  let actualUrl: string | null = null;
  let pageTitle: string | null = null;
  let lastArtifact: DesktopAiWebLabArtifact | null = null;
  let preferredViewMode: DesktopAiWebLabViewMode = "docked";
  let providerId = input.getDefaultProvider?.() ?? DEFAULT_AI_WEB_LAB_PROVIDER;
  let sessionMode: DesktopAiWebLabSessionMode = "managed";
  let activePartitionKey: string | null = null;
  let statusMessage = "AI Web Lab is ready.";
  let targetUrl = getProviderDefinition(providerId).defaultUrl;
  const catalog = createCatalog(providerId);

  function syncManagedWindowMetadata() {
    if (!managedWindow || managedWindow.isDestroyed()) {
      actualUrl = null;
      pageTitle = null;
      return;
    }
    actualUrl = readTrimmedText(managedWindow.webContents.getURL?.()) ?? targetUrl;
    pageTitle = readTrimmedText(managedWindow.getTitle?.());
  }

  function buildState(attachedEndpointCount: number): DesktopAiWebLabState {
    return {
      actualUrl,
      activeEntrypointId,
      attachedEndpointCount,
      available: true,
      catalog,
      lastArtifact,
      managedWindowOpen: [...managedWindowsByPartition.values()].some(
        (window) => !window.isDestroyed()
      ),
      modeSupport: {
        attached: true,
        docked: true,
        managed: true,
        window: true,
      },
      pageTitle,
      preferredViewMode,
      providerId,
      sessionMode,
      statusMessage,
      targetUrl,
    };
  }

  function detachManagedWindow() {
    managedWindow = null;
    actualUrl = null;
    pageTitle = null;
  }

  function detachManagedWindowForPartition(partition: string, window: AiWebLabBrowserWindowLike) {
    if (managedWindowsByPartition.get(partition) === window) {
      managedWindowsByPartition.delete(partition);
    }
    if (managedWindow === window) {
      detachManagedWindow();
    }
  }

  function closeManagedWindows() {
    const windows = [...managedWindowsByPartition.values()];
    managedWindowsByPartition.clear();
    for (const window of windows) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
    detachManagedWindow();
  }

  function ensureManagedWindow(): AiWebLabBrowserWindowLike {
    const nextPartition = getAiWebLabManagedPartition(providerId, activePartitionKey);
    const existingWindow = managedWindowsByPartition.get(nextPartition);
    if (existingWindow && !existingWindow.isDestroyed()) {
      managedWindow = existingWindow;
      return existingWindow;
    }
    input.ensureManagedSessionSecurity?.(providerId, activePartitionKey);
    const nextWindow = input.browserWindow.create({
      width: 1240,
      height: 900,
      minWidth: 960,
      minHeight: 720,
      show: false,
      title: "HugeCode AI Web Lab",
      backgroundColor: "#0f1115",
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        partition: nextPartition,
        sandbox: true,
      },
    });
    nextWindow.once("ready-to-show", () => {
      nextWindow.show();
    });
    nextWindow.on("closed", () => {
      if (managedWindow === nextWindow) {
        detachManagedWindow();
        statusMessage = "AI Web Lab window closed.";
      }
      detachManagedWindowForPartition(nextPartition, nextWindow);
    });
    nextWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isAiWebLabAllowedUrl(url) || input.isSafeExternalUrl(url)) {
        void input.openExternalUrl(url);
      }
      return { action: "deny" };
    });
    nextWindow.webContents.on?.("did-navigate", (_event, url) => {
      actualUrl = readTrimmedText(typeof url === "string" ? url : null) ?? targetUrl;
    });
    managedWindow = nextWindow;
    managedWindowsByPartition.set(nextPartition, nextWindow);
    return nextWindow;
  }

  function resolveEntrypointUrl(
    nextProviderId: AiWebLabProviderId,
    nextEntrypointId?: string | null
  ): string {
    if (!nextEntrypointId) {
      return getProviderDefinition(nextProviderId).defaultUrl;
    }
    return (
      getProviderDefinition(nextProviderId).entrypoints.find(
        (entrypoint) => entrypoint.id === nextEntrypointId
      )?.url ?? getProviderDefinition(nextProviderId).defaultUrl
    );
  }

  async function resolveState() {
    syncManagedWindowMetadata();
    const endpoints = await listAttachedEndpoints(input);
    return buildState(endpoints.length);
  }

  async function navigateToCurrentTarget(): Promise<void> {
    if (sessionMode === "attached") {
      await input.openExternalUrl(targetUrl);
      return;
    }
    const window = ensureManagedWindow();
    const currentUrl = readTrimmedText(window.webContents.getURL?.());
    if (currentUrl !== targetUrl) {
      await window.loadURL(targetUrl);
    }
    if (!window.isVisible()) {
      window.show();
    }
    window.focus();
    syncManagedWindowMetadata();
  }

  return {
    async getCatalog() {
      return catalog;
    },
    async getState() {
      return resolveState();
    },
    async openSession(nextInput) {
      providerId = nextInput?.providerId ?? providerId;
      activePartitionKey = normalizePartitionKey(nextInput?.partitionKey);
      preferredViewMode = nextInput?.preferredViewMode ?? preferredViewMode;
      sessionMode = nextInput?.preferredSessionMode ?? sessionMode;
      activeEntrypointId =
        nextInput?.entrypointId ??
        activeEntrypointId ??
        getProviderDefinition(providerId).defaultEntrypointId;
      targetUrl = normalizeAiWebLabUrl(
        providerId,
        nextInput?.url ?? resolveEntrypointUrl(providerId, activeEntrypointId)
      );

      if (sessionMode === "attached") {
        closeManagedWindows();
        await input.openExternalUrl(targetUrl);
        const endpoints = await listAttachedEndpoints(input);
        statusMessage =
          endpoints.length > 0
            ? "AI Web Lab attached mode is using local Chrome targets while HugeCode keeps the control surface docked."
            : "AI Web Lab attached mode opened the provider externally. Start Chrome with remote debugging to unlock deeper MCP-driven flows.";
        return buildState(endpoints.length);
      }

      await navigateToCurrentTarget();
      statusMessage =
        preferredViewMode === "docked"
          ? "AI Web Lab is open. HugeCode keeps the main workspace as the docked control surface and uses a managed window for the live provider session."
          : "AI Web Lab is open in a managed HugeCode window.";
      return resolveState();
    },
    async openEntrypoint(nextProviderId, nextEntrypointId) {
      providerId = nextProviderId;
      activePartitionKey = null;
      activeEntrypointId = nextEntrypointId;
      targetUrl = normalizeAiWebLabUrl(
        providerId,
        resolveEntrypointUrl(providerId, nextEntrypointId)
      );
      await navigateToCurrentTarget();
      statusMessage = `AI Web Lab opened ${providerId} ${nextEntrypointId}.`;
      return resolveState();
    },
    async focusSession() {
      if (sessionMode === "attached") {
        await input.openExternalUrl(targetUrl);
        statusMessage =
          "AI Web Lab re-focused the attached provider session in the external browser.";
        return resolveState();
      }
      const window = ensureManagedWindow();
      if (!window.isVisible()) {
        window.show();
      }
      window.focus();
      syncManagedWindowMetadata();
      statusMessage = "AI Web Lab window focused.";
      return resolveState();
    },
    async closeSession() {
      closeManagedWindows();
      statusMessage = "AI Web Lab session closed.";
      return resolveState();
    },
    async setViewMode(mode) {
      preferredViewMode = mode;
      statusMessage =
        mode === "docked"
          ? "AI Web Lab now prefers the docked HugeCode control surface."
          : "AI Web Lab now prefers the dedicated window.";
      return resolveState();
    },
    async setSessionMode(mode) {
      sessionMode = mode;
      if (mode === "attached") {
        closeManagedWindows();
      }
      statusMessage =
        mode === "attached"
          ? "AI Web Lab switched to attached mode."
          : "AI Web Lab switched to the HugeCode-managed provider session.";
      return resolveState();
    },
    async navigate(navigationInput) {
      providerId = navigationInput.providerId ?? providerId;
      activeEntrypointId = navigationInput.entrypointId ?? activeEntrypointId;
      targetUrl = normalizeAiWebLabUrl(providerId, navigationInput.url, targetUrl);
      await navigateToCurrentTarget();
      statusMessage = "AI Web Lab navigated to the requested URL.";
      return resolveState();
    },
    async extractArtifact() {
      const artifactKind =
        providerId === "gemini"
          ? activeEntrypointId === "deep_research"
            ? "research_brief"
            : activeEntrypointId === "gems"
              ? "workflow_instructions"
              : "canvas_document"
          : "prompt_markdown";
      if (sessionMode === "attached") {
        lastArtifact = createEmptyArtifact(
          providerId,
          "blocked",
          "Artifact extraction is only available for the HugeCode-managed AI Web Lab session.",
          artifactKind,
          {
            pageTitle,
            sourceUrl: targetUrl,
          }
        );
        statusMessage = lastArtifact.errorMessage ?? "AI Web Lab extraction blocked.";
        return lastArtifact;
      }

      if (!managedWindow || managedWindow.isDestroyed()) {
        lastArtifact = createEmptyArtifact(
          providerId,
          "blocked",
          "Open the managed AI Web Lab session before extracting an artifact.",
          artifactKind,
          {
            pageTitle,
            sourceUrl: targetUrl,
          }
        );
        statusMessage = lastArtifact.errorMessage ?? "AI Web Lab extraction blocked.";
        return lastArtifact;
      }

      syncManagedWindowMetadata();
      const extracted = (await managedWindow.webContents.executeJavaScript(
        providerId === "gemini" ? buildGeminiExtractionScript() : buildChatgptExtractionScript()
      )) as ExtractedAiWebLabPayload | null;

      if (!extracted || typeof extracted !== "object") {
        lastArtifact = createEmptyArtifact(
          providerId,
          "failed",
          "AI Web Lab could not read the latest provider response from the managed session.",
          artifactKind,
          {
            pageTitle,
            sourceUrl: actualUrl ?? targetUrl,
          }
        );
        statusMessage = lastArtifact.errorMessage ?? "AI Web Lab extraction failed.";
        return lastArtifact;
      }

      lastArtifact = {
        artifactKind,
        content: readTrimmedText(extracted.content),
        entrypointId: activeEntrypointId,
        extractedAt: new Date().toISOString(),
        format: artifactKind === "prompt_markdown" ? "markdown" : "text",
        pageTitle: readTrimmedText(extracted.pageTitle) ?? pageTitle,
        providerId,
        sourceUrl: readTrimmedText(extracted.sourceUrl) ?? actualUrl ?? targetUrl,
        status: extracted.status ?? "failed",
        errorMessage: readTrimmedText(extracted.errorMessage),
      };
      statusMessage =
        lastArtifact.status === "succeeded"
          ? "AI Web Lab extracted the latest provider artifact."
          : (lastArtifact.errorMessage ?? "AI Web Lab could not extract the latest artifact.");
      return lastArtifact;
    },
  };
}
