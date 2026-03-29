import type {
  DesktopBrowserExtractionRequest,
  DesktopBrowserExtractionResult,
  DesktopBrowserExtractionTraceEntry,
  LocalChromeDebuggerEndpointDescriptor,
} from "@ku0/code-platform-interfaces";

type BrowserPageTargetDescriptor = {
  id?: string;
  title?: string;
  type?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
};

type BrowserExtractionEvaluationPayload = {
  selectorMatched?: boolean;
  sourceUrl?: string | null;
  text?: string | null;
  title?: string | null;
};

type PageTargetSession = {
  close(): void;
  evaluate<T>(expression: string): Promise<T>;
};

export type CreateDesktopBrowserExtractionCapabilityInput = {
  connectToPageTarget?(webSocketDebuggerUrl: string): Promise<PageTargetSession>;
  createTraceId?(): string;
  fetchJson?(url: string, options?: RequestInit): Promise<unknown>;
  listLocalChromeDebuggerEndpoints(): LocalChromeDebuggerEndpointDescriptor[];
  now?(): string;
};

const DEFAULT_MAX_CHARACTERS = 4_000;
const DEFAULT_SNIPPET_CHARACTERS = 280;

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampMaxCharacters(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MAX_CHARACTERS;
  }
  return Math.max(1, Math.trunc(value));
}

function buildSnippet(normalizedText: string): string {
  return normalizedText.slice(0, DEFAULT_SNIPPET_CHARACTERS).trim();
}

function buildTraceEntry(
  at: string,
  stage: DesktopBrowserExtractionTraceEntry["stage"],
  message: string,
  detail?: string | null,
  code?: string | null
): DesktopBrowserExtractionTraceEntry {
  return {
    at,
    stage,
    message,
    code: code ?? null,
    detail: detail ?? null,
  };
}

function buildResult(input: {
  errorCode?: string | null;
  errorMessage?: string | null;
  normalizedText: string | null;
  snippet: string | null;
  sourceUrl?: string | null;
  status: DesktopBrowserExtractionResult["status"];
  title?: string | null;
  trace: DesktopBrowserExtractionTraceEntry[];
  traceId: string;
}): DesktopBrowserExtractionResult {
  return {
    status: input.status,
    normalizedText: input.normalizedText,
    snippet: input.snippet,
    sourceUrl: input.sourceUrl ?? null,
    title: input.title ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    traceId: input.traceId,
    trace: input.trace,
  };
}

function selectDebuggerEndpoint(
  endpoints: readonly LocalChromeDebuggerEndpointDescriptor[]
): LocalChromeDebuggerEndpointDescriptor | null {
  return endpoints.find((endpoint) => readNonEmptyString(endpoint.httpBaseUrl) !== null) ?? null;
}

function selectPageTarget(
  targets: readonly BrowserPageTargetDescriptor[],
  sourceUrl: string | null
): BrowserPageTargetDescriptor | null {
  const debuggablePages = targets.filter(
    (target) =>
      target.type === "page" &&
      readNonEmptyString(target.webSocketDebuggerUrl) !== null &&
      readNonEmptyString(target.url) !== null
  );
  if (debuggablePages.length === 0) {
    return null;
  }

  if (sourceUrl) {
    return (
      debuggablePages.find((target) => {
        const targetUrl = readNonEmptyString(target.url);
        return targetUrl === sourceUrl;
      }) ?? null
    );
  }

  return debuggablePages[0] ?? null;
}

function buildExtractionExpression(selector: string | null): string {
  return `(() => {
    const selector = ${JSON.stringify(selector)};
    const root = selector ? document.querySelector(selector) : (document.body ?? document.documentElement);
    const readText = (value) => {
      if (!value) {
        return "";
      }
      const innerText = typeof value.innerText === "string" ? value.innerText : "";
      const textContent = typeof value.textContent === "string" ? value.textContent : "";
      return innerText || textContent;
    };
    return {
      title: typeof document.title === "string" && document.title.trim().length > 0 ? document.title.trim() : null,
      sourceUrl: typeof window.location?.href === "string" && window.location.href.length > 0 ? window.location.href : null,
      selectorMatched: selector ? root instanceof Element : true,
      text: readText(root),
    };
  })()`;
}

async function defaultFetchJson(url: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Browser extraction request failed with status ${response.status}.`);
  }
  return response.json();
}

async function defaultConnectToPageTarget(
  webSocketDebuggerUrl: string
): Promise<PageTargetSession> {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let closed = false;
  let nextMessageId = 0;
  const pending = new Map<
    number,
    {
      reject(reason?: unknown): void;
      resolve(value: unknown): void;
    }
  >();

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error("Unable to connect to the browser DevTools target.")),
      { once: true }
    );
  });

  socket.addEventListener("message", (event) => {
    let payload: unknown;
    try {
      payload =
        typeof event.data === "string" ? JSON.parse(event.data) : JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (typeof payload !== "object" || payload === null || !("id" in payload)) {
      return;
    }

    const messageId = typeof payload.id === "number" ? payload.id : null;
    if (messageId === null) {
      return;
    }

    const entry = pending.get(messageId);
    if (!entry) {
      return;
    }
    pending.delete(messageId);

    const messageRecord = payload as {
      error?: { message?: string };
      result?: unknown;
    };
    if (messageRecord.error) {
      entry.reject(
        new Error(readNonEmptyString(messageRecord.error.message) ?? "Browser CDP command failed.")
      );
      return;
    }

    entry.resolve(messageRecord.result ?? null);
  });

  socket.addEventListener("close", () => {
    closed = true;
    for (const entry of pending.values()) {
      entry.reject(new Error("Browser DevTools connection closed before the command completed."));
    }
    pending.clear();
  });

  return {
    close() {
      if (closed) {
        return;
      }
      closed = true;
      socket.close();
    },
    async evaluate<T>(expression: string) {
      if (closed) {
        throw new Error("Browser DevTools connection is already closed.");
      }

      nextMessageId += 1;
      const id = nextMessageId;
      const payload = await new Promise<{
        exceptionDetails?: {
          exception?: {
            description?: string;
          };
          text?: string;
        };
        result?: {
          value?: unknown;
        };
      }>((resolve, reject) => {
        pending.set(id, {
          reject,
          resolve(value) {
            resolve(value as Parameters<typeof resolve>[0]);
          },
        });
        socket.send(
          JSON.stringify({
            id,
            method: "Runtime.evaluate",
            params: {
              awaitPromise: true,
              expression,
              returnByValue: true,
            },
          })
        );
      });

      if (payload.exceptionDetails) {
        throw new Error(
          readNonEmptyString(payload.exceptionDetails.exception?.description) ??
            readNonEmptyString(payload.exceptionDetails.text) ??
            "Browser page evaluation failed."
        );
      }

      return (payload.result?.value ?? null) as T;
    },
  };
}

function defaultCreateTraceId(): string {
  return `browser-extract-${Date.now()}`;
}

export function createDesktopBrowserExtractionCapability(
  input: CreateDesktopBrowserExtractionCapabilityInput
) {
  const connectToPageTarget = input.connectToPageTarget ?? defaultConnectToPageTarget;
  const fetchJson = input.fetchJson ?? defaultFetchJson;
  const createTraceId = input.createTraceId ?? defaultCreateTraceId;
  const now = input.now ?? (() => new Date().toISOString());
  let lastResult: DesktopBrowserExtractionResult | null = null;

  return {
    async extract(
      request: DesktopBrowserExtractionRequest = {}
    ): Promise<DesktopBrowserExtractionResult> {
      const traceId = createTraceId();
      const requestedSourceUrl = readNonEmptyString(request.sourceUrl);
      const selector = readNonEmptyString(request.selector);
      const maxCharacters = clampMaxCharacters(request.maxCharacters);
      const availabilityAt = now();
      const endpoints = input.listLocalChromeDebuggerEndpoints();
      const endpoint = selectDebuggerEndpoint(endpoints);

      if (!endpoint) {
        lastResult = buildResult({
          status: "failed",
          normalizedText: null,
          snippet: null,
          errorCode: "LOCAL_CHROME_DEBUGGER_UNAVAILABLE",
          errorMessage:
            "Local Chrome DevTools is unavailable. Start a Chromium-based browser with remote debugging enabled and retry.",
          traceId,
          trace: [
            buildTraceEntry(
              availabilityAt,
              "availability",
              "No local Chrome DevTools endpoint with an HTTP base URL is available.",
              null,
              "LOCAL_CHROME_DEBUGGER_UNAVAILABLE"
            ),
          ],
        });
        return lastResult;
      }

      const availabilityTrace = buildTraceEntry(
        availabilityAt,
        "availability",
        "Resolved a local Chrome DevTools endpoint for browser extraction.",
        endpoint.httpBaseUrl ?? null
      );

      try {
        const targetsPayload = await fetchJson(`${endpoint.httpBaseUrl}/json/list`);
        const targets = Array.isArray(targetsPayload)
          ? targetsPayload.filter(
              (value): value is BrowserPageTargetDescriptor =>
                typeof value === "object" && value !== null
            )
          : [];
        const captureAt = now();
        const target = selectPageTarget(targets, requestedSourceUrl);

        if (!target) {
          lastResult = buildResult({
            status: "empty",
            normalizedText: null,
            snippet: null,
            sourceUrl: requestedSourceUrl,
            errorCode: requestedSourceUrl
              ? "BROWSER_SOURCE_URL_NOT_FOUND"
              : "BROWSER_PAGE_TARGET_UNAVAILABLE",
            errorMessage: requestedSourceUrl
              ? `No debuggable browser page matched ${requestedSourceUrl}.`
              : "No debuggable browser page target is currently available for extraction.",
            traceId,
            trace: [
              availabilityTrace,
              buildTraceEntry(
                captureAt,
                "capture",
                "No debuggable browser page target was available for extraction.",
                requestedSourceUrl ?? null,
                requestedSourceUrl
                  ? "BROWSER_SOURCE_URL_NOT_FOUND"
                  : "BROWSER_PAGE_TARGET_UNAVAILABLE"
              ),
            ],
          });
          return lastResult;
        }

        const pageTargetUrl = readNonEmptyString(target.webSocketDebuggerUrl);
        if (!pageTargetUrl) {
          lastResult = buildResult({
            status: "failed",
            normalizedText: null,
            snippet: null,
            sourceUrl: readNonEmptyString(target.url) ?? requestedSourceUrl,
            title: readNonEmptyString(target.title),
            errorCode: "BROWSER_PAGE_TARGET_NOT_DEBUGGABLE",
            errorMessage: "The selected browser page target is not debuggable.",
            traceId,
            trace: [
              availabilityTrace,
              buildTraceEntry(
                captureAt,
                "capture",
                "Selected browser page target did not expose a DevTools page socket.",
                readNonEmptyString(target.url) ?? null,
                "BROWSER_PAGE_TARGET_NOT_DEBUGGABLE"
              ),
            ],
          });
          return lastResult;
        }

        const session = await connectToPageTarget(pageTargetUrl);
        try {
          const extractionAt = now();
          const extracted = await session.evaluate<BrowserExtractionEvaluationPayload>(
            buildExtractionExpression(selector)
          );
          const targetTitle =
            readNonEmptyString(extracted.title) ?? readNonEmptyString(target.title);
          const targetSourceUrl =
            readNonEmptyString(extracted.sourceUrl) ??
            readNonEmptyString(target.url) ??
            requestedSourceUrl;
          const rawText = readNonEmptyString(extracted.text) ?? "";
          const extractTrace = buildTraceEntry(
            extractionAt,
            "extract",
            "Evaluated the selected browser page target for text extraction.",
            selector ?? targetSourceUrl
          );

          if (selector && extracted.selectorMatched === false) {
            lastResult = buildResult({
              status: "empty",
              normalizedText: null,
              snippet: null,
              sourceUrl: targetSourceUrl,
              title: targetTitle,
              errorCode: "BROWSER_SELECTOR_NOT_FOUND",
              errorMessage: `The selector ${selector} was not found on the selected browser page.`,
              traceId,
              trace: [
                availabilityTrace,
                buildTraceEntry(
                  captureAt,
                  "capture",
                  "Selected a debuggable browser page target for extraction.",
                  targetSourceUrl
                ),
                buildTraceEntry(
                  extractionAt,
                  "extract",
                  "The requested selector was not found on the selected browser page.",
                  selector,
                  "BROWSER_SELECTOR_NOT_FOUND"
                ),
              ],
            });
            return lastResult;
          }

          const normalizedText = normalizeWhitespace(rawText);
          const normalizedAt = now();
          if (normalizedText.length === 0) {
            lastResult = buildResult({
              status: "empty",
              normalizedText: null,
              snippet: null,
              sourceUrl: targetSourceUrl,
              title: targetTitle,
              errorCode: "BROWSER_TEXT_EMPTY",
              errorMessage: "The selected browser page did not yield any extractable text.",
              traceId,
              trace: [
                availabilityTrace,
                buildTraceEntry(
                  captureAt,
                  "capture",
                  "Selected a debuggable browser page target for extraction.",
                  targetSourceUrl
                ),
                extractTrace,
                buildTraceEntry(
                  normalizedAt,
                  "normalize",
                  "Browser extraction produced no text after whitespace normalization.",
                  null,
                  "BROWSER_TEXT_EMPTY"
                ),
              ],
            });
            return lastResult;
          }

          const truncated = normalizedText.length > maxCharacters;
          const boundedText = truncated
            ? normalizedText.slice(0, maxCharacters).trimEnd()
            : normalizedText;
          lastResult = buildResult({
            status: truncated ? "partial" : "succeeded",
            normalizedText: boundedText,
            snippet: buildSnippet(boundedText),
            sourceUrl: targetSourceUrl,
            title: targetTitle,
            errorCode: truncated ? "BROWSER_TEXT_TRUNCATED" : null,
            errorMessage: truncated
              ? `Browser extraction was truncated to ${maxCharacters} characters.`
              : null,
            traceId,
            trace: [
              availabilityTrace,
              buildTraceEntry(
                captureAt,
                "capture",
                "Selected a debuggable browser page target for extraction.",
                targetSourceUrl
              ),
              extractTrace,
              buildTraceEntry(
                normalizedAt,
                "normalize",
                truncated
                  ? `Normalized browser text and truncated it to ${maxCharacters} characters.`
                  : "Normalized browser text without truncation.",
                boundedText.length.toString(),
                truncated ? "BROWSER_TEXT_TRUNCATED" : null
              ),
            ],
          });
          return lastResult;
        } finally {
          session.close();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : "Browser extraction failed unexpectedly.";
        lastResult = buildResult({
          status: "failed",
          normalizedText: null,
          snippet: null,
          sourceUrl: requestedSourceUrl,
          errorCode: "BROWSER_EXTRACTION_FAILED",
          errorMessage,
          traceId,
          trace: [
            availabilityTrace,
            buildTraceEntry(
              now(),
              "transport",
              "Browser extraction failed while talking to the DevTools transport.",
              errorMessage,
              "BROWSER_EXTRACTION_FAILED"
            ),
          ],
        });
        return lastResult;
      }
    },
    async getLastResult(): Promise<DesktopBrowserExtractionResult | null> {
      return lastResult;
    },
  };
}
