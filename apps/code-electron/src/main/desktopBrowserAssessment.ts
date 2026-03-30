import {
  buildDesktopBrowserAssessmentProxyPath,
  type DesktopBrowserAssessmentConsoleEntry,
  type DesktopBrowserAssessmentRequest,
  type DesktopBrowserAssessmentResult,
  type DesktopBrowserAssessmentTraceEntry,
} from "@ku0/code-platform-interfaces";

type BrowserAssessmentWindowLike = {
  close(): void;
  destroy?(): void;
  isDestroyed?(): boolean;
  loadURL(url: string): Promise<unknown> | unknown;
  webContents: {
    executeJavaScript(code: string): Promise<unknown>;
    on(
      event: "console-message",
      listener: (
        event: unknown,
        level: number,
        message: string,
        line: number,
        sourceId: string
      ) => void
    ): void;
  };
};

type BrowserAssessmentProxyState = {
  code?: string | null;
  detail?: string | null;
  state?: string | null;
};

type BrowserAssessmentEvaluationPayload = {
  accessibilityFailures?: DesktopBrowserAssessmentResult["accessibilityFailures"];
  childElementCount?: number;
  html?: string | null;
  selectorMatched?: boolean;
  sourceUrl?: string | null;
  text?: string | null;
  title?: string | null;
};

export type CreateDesktopBrowserAssessmentCapabilityInput = {
  buildRendererUrl(relativePath: string): string;
  createTraceId?(): string;
  createWindow(): BrowserAssessmentWindowLike;
  now?(): string;
  wait?(timeoutMs: number): Promise<void>;
};

const DEFAULT_WAIT_MS = 2_500;
const DEFAULT_POLL_INTERVAL_MS = 50;
const MAX_HTML_CHARACTERS = 8_000;
const MAX_TEXT_CHARACTERS = 4_000;

function defaultCreateTraceId() {
  return `browser-assessment-${Date.now()}`;
}

function defaultWait(timeoutMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeWaitMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_WAIT_MS;
  }
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : DEFAULT_WAIT_MS;
}

function boundString(value: string | null | undefined, maxCharacters: number): string | null {
  const normalized = readNonEmptyString(value);
  if (!normalized) {
    return null;
  }
  return normalized.length > maxCharacters
    ? normalized.slice(0, maxCharacters).trimEnd()
    : normalized;
}

function buildTraceEntry(
  at: string,
  stage: DesktopBrowserAssessmentTraceEntry["stage"],
  message: string,
  detail?: string | null,
  code?: string | null
): DesktopBrowserAssessmentTraceEntry {
  return {
    at,
    stage,
    message,
    code: code ?? null,
    detail: detail ?? null,
  };
}

function toConsoleLevel(level: number): DesktopBrowserAssessmentConsoleEntry["level"] {
  if (level >= 3) {
    return "error";
  }
  if (level === 2) {
    return "warn";
  }
  if (level === 1) {
    return "info";
  }
  return "log";
}

function buildProxyStateExpression() {
  return `(() => {
    const root = document.querySelector("[data-browser-assessment-proxy-state]");
    if (!(root instanceof HTMLElement)) {
      return { state: null, code: null, detail: null };
    }
    return {
      state: root.getAttribute("data-browser-assessment-proxy-state"),
      code: root.getAttribute("data-browser-assessment-proxy-code"),
      detail: typeof root.innerText === "string" ? root.innerText.trim() : null,
    };
  })()`;
}

function buildAssessmentEvaluationExpression(selector: string | null) {
  return `(() => {
    const iframe = document.querySelector("[data-browser-assessment-frame]");
    if (!(iframe instanceof HTMLIFrameElement)) {
      return {
        selectorMatched: false,
        sourceUrl: null,
        title: null,
        html: null,
        text: null,
        childElementCount: 0,
        accessibilityFailures: [{ code: "BROWSER_ASSESSMENT_FRAME_MISSING", message: "Browser assessment proxy did not render the assessment iframe.", selector: null }],
      };
    }
    const targetWindow = iframe.contentWindow;
    const targetDocument = iframe.contentDocument;
    if (!targetWindow || !targetDocument) {
      return {
        selectorMatched: false,
        sourceUrl: null,
        title: null,
        html: null,
        text: null,
        childElementCount: 0,
        accessibilityFailures: [{ code: "BROWSER_ASSESSMENT_DOCUMENT_UNAVAILABLE", message: "Browser assessment target document is unavailable.", selector: null }],
      };
    }
    const requestedSelector = ${JSON.stringify(selector)};
    const root = requestedSelector
      ? targetDocument.querySelector(requestedSelector)
      : targetDocument.querySelector("main") ?? targetDocument.body ?? targetDocument.documentElement;
    const normalizeText = (value) =>
      typeof value === "string" ? value.replace(/\\s+/g, " ").trim() : "";
    const describeElement = (element) => {
      if (!(element instanceof Element)) {
        return null;
      }
      const tagName = element.tagName.toLowerCase();
      const id = typeof element.id === "string" && element.id.length > 0 ? "#" + element.id : "";
      return tagName + id;
    };
    const resolveAccessibleName = (element) => {
      if (!(element instanceof Element)) {
        return "";
      }
      const ariaLabel = normalizeText(element.getAttribute("aria-label"));
      if (ariaLabel) {
        return ariaLabel;
      }
      const labelledBy = normalizeText(element.getAttribute("aria-labelledby"));
      if (labelledBy) {
        const parts = labelledBy
          .split(/\\s+/)
          .map((id) => normalizeText(targetDocument.getElementById(id)?.textContent ?? ""))
          .filter(Boolean);
        if (parts.length > 0) {
          return parts.join(" ");
        }
      }
      const labels = "labels" in element && element.labels ? Array.from(element.labels) : [];
      const labelText = labels
        .map((label) => normalizeText(label.textContent ?? ""))
        .filter(Boolean)
        .join(" ");
      if (labelText) {
        return labelText;
      }
      return normalizeText(element.textContent ?? "");
    };
    const failures = [];
    if (!targetDocument.querySelector("main")) {
      failures.push({
        code: "main-landmark-missing",
        message: "Assessed surface is missing a main landmark.",
        selector: "main",
      });
    }
    if (!targetDocument.querySelector("h1")) {
      failures.push({
        code: "heading-level-one-missing",
        message: "Assessed surface is missing a level-one heading.",
        selector: "h1",
      });
    }
    for (const element of targetDocument.querySelectorAll("button, a[href], input:not([type='hidden']), textarea, select")) {
      if (resolveAccessibleName(element).length > 0) {
        continue;
      }
      failures.push({
        code: "interactive-name-missing",
        message: "Interactive element is missing an accessible name.",
        selector: describeElement(element),
      });
    }
    for (const image of targetDocument.querySelectorAll("img")) {
      if (typeof image.getAttribute("alt") === "string") {
        continue;
      }
      failures.push({
        code: "image-alt-missing",
        message: "Image is missing alternate text.",
        selector: describeElement(image),
      });
    }
    return {
      selectorMatched: requestedSelector ? root instanceof Element : true,
      sourceUrl: typeof targetWindow.location?.href === "string" ? targetWindow.location.href : null,
      title: normalizeText(targetDocument.title),
      html: root instanceof Element ? root.outerHTML : null,
      text: root ? normalizeText(root.textContent ?? "") : null,
      childElementCount: root instanceof Element ? root.childElementCount : 0,
      accessibilityFailures: failures,
    };
  })()`;
}

async function waitForProxyState(input: {
  assessmentWindow: BrowserAssessmentWindowLike;
  now(): string;
  trace: DesktopBrowserAssessmentTraceEntry[];
  timeoutMs: number;
  wait(timeoutMs: number): Promise<void>;
}) {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() <= deadline) {
    const state = (await input.assessmentWindow.webContents.executeJavaScript(
      buildProxyStateExpression()
    )) as BrowserAssessmentProxyState;
    if (state.state === "ready") {
      input.trace.push(
        buildTraceEntry(
          input.now(),
          "render",
          "Browser assessment proxy reported that the localized renderer is ready."
        )
      );
      return state;
    }
    if (state.state === "blocked") {
      input.trace.push(
        buildTraceEntry(
          input.now(),
          "proxy",
          "Browser assessment proxy blocked the requested target.",
          readNonEmptyString(state.detail),
          readNonEmptyString(state.code)
        )
      );
      return state;
    }
    await input.wait(DEFAULT_POLL_INTERVAL_MS);
  }

  input.trace.push(
    buildTraceEntry(
      input.now(),
      "render",
      "Browser assessment proxy did not become ready before the timeout elapsed.",
      null,
      "BROWSER_ASSESSMENT_RENDER_TIMEOUT"
    )
  );
  return {
    state: "timeout",
    code: "BROWSER_ASSESSMENT_RENDER_TIMEOUT",
    detail: "Browser assessment proxy did not become ready before the timeout elapsed.",
  };
}

function closeAssessmentWindow(assessmentWindow: BrowserAssessmentWindowLike) {
  if (assessmentWindow.isDestroyed?.()) {
    return;
  }
  if (assessmentWindow.destroy) {
    assessmentWindow.destroy();
    return;
  }
  assessmentWindow.close();
}

export function createDesktopBrowserAssessmentCapability(
  input: CreateDesktopBrowserAssessmentCapabilityInput
) {
  const createTraceId = input.createTraceId ?? defaultCreateTraceId;
  const now = input.now ?? (() => new Date().toISOString());
  const wait = input.wait ?? defaultWait;
  let lastResult: DesktopBrowserAssessmentResult | null = null;

  return {
    async assess(
      request: DesktopBrowserAssessmentRequest
    ): Promise<DesktopBrowserAssessmentResult> {
      const traceId = createTraceId();
      const trace: DesktopBrowserAssessmentTraceEntry[] = [];
      const timeoutMs = normalizeWaitMs(request.waitForMs);
      const consoleEntries: DesktopBrowserAssessmentConsoleEntry[] = [];
      const assessmentWindow = input.createWindow();
      assessmentWindow.webContents.on(
        "console-message",
        (_event, level, message, line, sourceId) => {
          const normalizedMessage = readNonEmptyString(message);
          if (!normalizedMessage) {
            return;
          }
          consoleEntries.push({
            level: toConsoleLevel(level),
            message: normalizedMessage,
            line: Number.isFinite(line) ? line : null,
            sourceId: readNonEmptyString(sourceId),
          });
        }
      );

      const proxyPath = buildDesktopBrowserAssessmentProxyPath(request);
      trace.push(
        buildTraceEntry(
          now(),
          "proxy",
          "Loading the canonical browser assessment proxy.",
          proxyPath
        )
      );

      try {
        await assessmentWindow.loadURL(input.buildRendererUrl(proxyPath));
        const proxyState = await waitForProxyState({
          assessmentWindow,
          now,
          timeoutMs,
          trace,
          wait,
        });

        if (proxyState.state !== "ready") {
          lastResult = {
            status: "error",
            target: request.target,
            domSnapshot: null,
            consoleEntries,
            accessibilityFailures: [],
            errorCode: readNonEmptyString(proxyState.code) ?? "BROWSER_ASSESSMENT_PROXY_BLOCKED",
            errorMessage:
              readNonEmptyString(proxyState.detail) ??
              "Browser assessment proxy could not render the requested target.",
            traceId,
            trace,
          };
          return lastResult;
        }

        const payload = (await assessmentWindow.webContents.executeJavaScript(
          buildAssessmentEvaluationExpression(readNonEmptyString(request.selector))
        )) as BrowserAssessmentEvaluationPayload;
        const accessibilityFailures = Array.isArray(payload.accessibilityFailures)
          ? payload.accessibilityFailures
          : [];
        trace.push(
          buildTraceEntry(
            now(),
            "collect",
            "Collected DOM and console state from the localized browser assessment target.",
            readNonEmptyString(payload.sourceUrl)
          )
        );
        trace.push(
          buildTraceEntry(
            now(),
            "audit",
            accessibilityFailures.length > 0
              ? "Accessibility failures were detected in the assessed surface."
              : "Accessibility audit completed without detected failures.",
            accessibilityFailures.length > 0 ? (accessibilityFailures[0]?.message ?? null) : null,
            accessibilityFailures.length > 0 ? "BROWSER_A11Y_FAILURES_DETECTED" : null
          )
        );

        const selectorMatched = payload.selectorMatched !== false;
        const hasConsoleErrors = consoleEntries.some((entry) => entry.level === "error");
        const domSnapshot = {
          childElementCount:
            typeof payload.childElementCount === "number" &&
            Number.isFinite(payload.childElementCount)
              ? Math.max(0, Math.trunc(payload.childElementCount))
              : 0,
          html: boundString(payload.html ?? null, MAX_HTML_CHARACTERS),
          selector: readNonEmptyString(request.selector),
          selectorMatched,
          text: boundString(payload.text ?? null, MAX_TEXT_CHARACTERS),
        };
        const failed = !selectorMatched || accessibilityFailures.length > 0 || hasConsoleErrors;
        lastResult = {
          status: failed ? "failed" : "passed",
          target: request.target,
          domSnapshot,
          consoleEntries,
          accessibilityFailures,
          sourceUrl: readNonEmptyString(payload.sourceUrl),
          title: readNonEmptyString(payload.title),
          errorCode: !selectorMatched
            ? "BROWSER_ASSESSMENT_SELECTOR_NOT_FOUND"
            : accessibilityFailures.length > 0
              ? "BROWSER_A11Y_FAILURES_DETECTED"
              : hasConsoleErrors
                ? "BROWSER_CONSOLE_ERRORS_DETECTED"
                : null,
          errorMessage: !selectorMatched
            ? `The selector ${request.selector} was not found on the assessed browser surface.`
            : accessibilityFailures.length > 0
              ? "Accessibility failures were detected in the assessed browser surface."
              : hasConsoleErrors
                ? "Console errors were detected in the assessed browser surface."
                : null,
          traceId,
          trace,
        };
        return lastResult;
      } catch (error) {
        trace.push(
          buildTraceEntry(
            now(),
            "transport",
            "Browser assessment transport failed before the surface could be collected.",
            error instanceof Error ? error.message : null,
            "BROWSER_ASSESSMENT_TRANSPORT_ERROR"
          )
        );
        lastResult = {
          status: "error",
          target: request.target,
          domSnapshot: null,
          consoleEntries,
          accessibilityFailures: [],
          errorCode: "BROWSER_ASSESSMENT_TRANSPORT_ERROR",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Browser assessment failed before the surface could be collected.",
          traceId,
          trace,
        };
        return lastResult;
      } finally {
        closeAssessmentWindow(assessmentWindow);
      }
    },
    async getLastResult(): Promise<DesktopBrowserAssessmentResult | null> {
      return lastResult;
    },
  };
}
