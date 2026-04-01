import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

const IGNORED_CONSOLE_WARN_SNIPPETS = [
  "Web runtime oauth/provider endpoint is unstable; using temporary local fallback.",
  "Runtime providers catalog unavailable in web mode; using fallback.",
  "Runtime oauth chatgpt auth token refresh RPC unavailable; falling back to oauth account metadata.",
  "Electron bridge invoke unavailable; using local text-file fallback.",
  "Electron bridge invoke unavailable; using local text-file fallback write.",
  "Electron bridge code_text_file_read_v1 command unavailable; using local text-file fallback.",
  "Electron bridge code_text_file_write_v1 command unavailable; using local text-file fallback.",
  "Electron bridge file_read command unavailable; using local text-file fallback.",
  "Electron bridge file_write command unavailable; using local text-file fallback.",
  "Web runtime backend pool list unavailable; using read-only fallback.",
  "Web runtime distributed task graph unavailable; using read-only fallback.",
  "Web runtime diagnostics export unavailable; using graceful fallback.",
  "Web runtime thread list unavailable; returning empty thread list.",
  "Workspace picker unavailable; returning null selection.",
  "Workspace picker unavailable; returning empty selections.",
  "Image picker unavailable; returning empty image selections.",
  "A suspended resource finished loading inside a test",
];

const IGNORED_STDERR_SNIPPETS = [
  "A suspended resource finished loading inside a test",
  "stderr | pingSuspendedRoot",
];

function extractConsoleMessage(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      if (arg instanceof Error) {
        return arg.message;
      }
      return "";
    })
    .filter((message) => message.length > 0)
    .join(" ");
}

function shouldIgnoreKnownTestConsoleNoise(args: unknown[]): boolean {
  const message = extractConsoleMessage(args);
  return IGNORED_CONSOLE_WARN_SNIPPETS.some((snippet) => message.includes(snippet));
}

function shouldIgnoreKnownTestStderrNoise(chunk: string): boolean {
  return IGNORED_STDERR_SNIPPETS.some((snippet) => chunk.includes(snippet));
}

const consoleInstance = Reflect.get(globalThis, "console") as Console;
const originalConsoleWarn = consoleInstance.warn.bind(consoleInstance);
const originalConsoleError = consoleInstance.error.bind(consoleInstance);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

vi.spyOn(console, "warn").mockImplementation((...args: Parameters<typeof console.warn>) => {
  if (shouldIgnoreKnownTestConsoleNoise(args)) {
    return;
  }
  originalConsoleWarn(...args);
});

vi.spyOn(console, "error").mockImplementation((...args: Parameters<typeof console.error>) => {
  if (shouldIgnoreKnownTestConsoleNoise(args)) {
    return;
  }
  originalConsoleError(...args);
});

process.stderr.write = ((
  chunk: string | Uint8Array,
  encoding?: BufferEncoding | ((error?: Error | null) => void),
  callback?: (error?: Error | null) => void
) => {
  const normalizedChunk = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");

  if (shouldIgnoreKnownTestStderrNoise(normalizedChunk)) {
    const done = typeof encoding === "function" ? encoding : callback;
    done?.(undefined);
    return true;
  }

  return originalStderrWrite(chunk, encoding as BufferEncoding, callback);
}) as typeof process.stderr.write;

afterEach(async () => {
  cleanup();
  await vi.dynamicImportSettled();
  cleanup();
  vi.useRealTimers();
});

if (!("IS_REACT_ACT_ENVIRONMENT" in globalThis)) {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    value: true,
    writable: true,
  });
} else {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

if (!("matchMedia" in globalThis)) {
  Object.defineProperty(globalThis, "matchMedia", {
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }),
  });
}

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverMock {
    observe() {
      return;
    }
    unobserve() {
      return;
    }
    disconnect() {
      return;
    }
  }
  Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock });
}

if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverMock {
    observe() {
      return;
    }
    unobserve() {
      return;
    }
    disconnect() {
      return;
    }
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: IntersectionObserverMock,
  });
}

if (!("requestAnimationFrame" in globalThis)) {
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    value: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    value: (id: number) => clearTimeout(id),
  });
}

if (!("Worker" in globalThis)) {
  class WorkerMock {
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage() {
      return;
    }
    addEventListener() {
      return;
    }
    removeEventListener() {
      return;
    }
    terminate() {
      return;
    }
  }

  Object.defineProperty(globalThis, "Worker", {
    value: WorkerMock,
    writable: true,
    configurable: true,
  });
}

Object.defineProperty(globalThis, "confirm", {
  value: vi.fn(() => true),
  writable: true,
  configurable: true,
});

const hasLocalStorage = "localStorage" in globalThis;
const existingLocalStorage = hasLocalStorage
  ? (globalThis as { localStorage?: Storage }).localStorage
  : null;

if (!existingLocalStorage || typeof existingLocalStorage.clear !== "function") {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorage,
    writable: true,
    configurable: true,
  });
}
