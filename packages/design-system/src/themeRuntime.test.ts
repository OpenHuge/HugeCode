import { describe, expect, it } from "vitest";

import {
  DESIGN_SYSTEM_THEME_STORAGE_KEY,
  applyDesignSystemThemeRuntime,
  normalizeThemePreference,
  resolveSystemTheme,
  syncDesignSystemThemePreference,
} from "./themeRuntime";

type MockMediaQueryEvent = { matches: boolean };
type QueryKey =
  | "(prefers-color-scheme: dark)"
  | "(prefers-reduced-motion: reduce)"
  | "(prefers-contrast: more)";

type MockMediaQuery = {
  matches: boolean;
  addEventListener?: (event: string, listener: (event: MockMediaQueryEvent) => void) => void;
  removeEventListener?: (event: string, listener: (event: MockMediaQueryEvent) => void) => void;
  addListener?: (listener: (event: MockMediaQueryEvent) => void) => void;
  removeListener?: (listener: (event: MockMediaQueryEvent) => void) => void;
  dispatch: (matches: boolean) => void;
};

function createMockMediaQuery(initialMatches: boolean): MockMediaQuery {
  const listeners = new Set<(event: MockMediaQueryEvent) => void>();

  const notify = (matches: boolean) => {
    for (const listener of Array.from(listeners)) {
      listener({ matches });
    }
  };

  return {
    matches: initialMatches,
    addEventListener(_: string, listener: (event: MockMediaQueryEvent) => void) {
      listeners.add(listener);
    },
    removeEventListener(_: string, listener: (event: MockMediaQueryEvent) => void) {
      listeners.delete(listener);
    },
    addListener(listener: (event: MockMediaQueryEvent) => void) {
      listeners.add(listener);
    },
    removeListener(listener: (event: MockMediaQueryEvent) => void) {
      listeners.delete(listener);
    },
    dispatch(matches: boolean) {
      this.matches = matches;
      notify(matches);
    },
  };
}

type MockWindow = Window &
  typeof globalThis & {
    document: {
      documentElement: {
        attrs: Record<string, string>;
        style: { colorScheme: string };
        setAttribute: (key: string, value: string) => void;
      };
    };
    matchMedia: (query: string) => MockMediaQuery;
    localStorage: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
    };
  };

function createMockWindow({
  systemMatches = true,
  reducedMotionMatches = false,
  contrastMatches = false,
} = {}): {
  window: MockWindow;
  queries: Record<QueryKey, MockMediaQuery>;
  storage: Record<string, string>;
} {
  const systemQuery = createMockMediaQuery(systemMatches);
  const reducedMotionQuery = createMockMediaQuery(reducedMotionMatches);
  const contrastQuery = createMockMediaQuery(contrastMatches);

  const queries: Record<QueryKey, MockMediaQuery> = {
    "(prefers-color-scheme: dark)": systemQuery,
    "(prefers-reduced-motion: reduce)": reducedMotionQuery,
    "(prefers-contrast: more)": contrastQuery,
  };

  const storage: Record<string, string> = {};

  const rootElement = {
    attrs: {} as Record<string, string>,
    style: { colorScheme: "" },
    setAttribute(key: string, value: string) {
      this.attrs[key] = value;
    },
  };

  const mockWindow = {
    document: {
      documentElement: rootElement,
    },
    matchMedia(query: string) {
      return queries[query as QueryKey] ?? createMockMediaQuery(false);
    },
    localStorage: {
      getItem(key: string) {
        return key in storage ? storage[key] : null;
      },
      setItem(key: string, value: string) {
        storage[key] = value;
      },
    },
  } as unknown as MockWindow;

  return { window: mockWindow, queries, storage };
}

describe("@ku0/design-system themeRuntime", () => {
  it("normalizes invalid preferences to system and keeps valid ones", () => {
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(normalizeThemePreference("dim")).toBe("dim");
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("system")).toBe("system");
    expect(normalizeThemePreference("invalid")).toBe("system");
    expect(normalizeThemePreference(null)).toBe("system");
  });

  it("resolves system preference according to matchMedia", () => {
    const { window } = createMockWindow({ systemMatches: true });
    expect(resolveSystemTheme(window)).toBe("dark");

    const { window: lightWindow } = createMockWindow({ systemMatches: false });
    expect(resolveSystemTheme(lightWindow)).toBe("light");
  });

  it("applies attributes to the DOM root and persists preference", () => {
    const { window, storage } = createMockWindow({ systemMatches: false });
    const snapshot = applyDesignSystemThemeRuntime({
      preference: "dim",
      window,
      persist: true,
    });

    expect(snapshot?.resolved).toBe("dim");
    const rootAttrs = window.document.documentElement.attrs;
    expect(rootAttrs["data-theme"]).toBe("dim");
    expect(rootAttrs["data-theme-resolved"]).toBe("dim");
    expect(rootAttrs["data-theme-preference"]).toBe("dim");
    expect(rootAttrs["data-reduced-motion"]).toBe("no-preference");
    expect(rootAttrs["data-contrast"]).toBe("no-preference");
    expect(window.document.documentElement.style.colorScheme).toBe("dark");
    expect(storage[DESIGN_SYSTEM_THEME_STORAGE_KEY]).toBe("dim");
  });

  it("reacts to system preference changes when preference is system", () => {
    const { window, queries } = createMockWindow({ systemMatches: true });
    const snapshot = applyDesignSystemThemeRuntime({
      preference: "system",
      window,
      persist: false,
    });

    expect(snapshot?.resolved).toBe("dark");
    expect(window.document.documentElement.attrs["data-theme"]).toBe("dark");

    queries["(prefers-color-scheme: dark)"].dispatch(false);
    expect(window.document.documentElement.attrs["data-theme"]).toBe("light");
    expect(window.document.documentElement.style.colorScheme).toBe("light");

    queries["(prefers-color-scheme: dark)"].dispatch(true);
    expect(window.document.documentElement.attrs["data-theme"]).toBe("dark");
  });

  it("syncDesignSystemThemePreference persists and updates DOM", () => {
    const { window, storage } = createMockWindow({ systemMatches: true });
    syncDesignSystemThemePreference("light", { window, persist: true });

    expect(window.document.documentElement.attrs["data-theme"]).toBe("light");
    expect(window.document.documentElement.style.colorScheme).toBe("light");
    expect(storage[DESIGN_SYSTEM_THEME_STORAGE_KEY]).toBe("light");
  });
});
