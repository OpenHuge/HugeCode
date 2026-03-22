export type DesignSystemThemePreference = "dark" | "dim" | "light" | "system";
export type DesignSystemResolvedTheme = "dark" | "dim" | "light";
export type DesignSystemMotionPreference = "no-preference" | "reduce";
export type DesignSystemContrastPreference = "more" | "no-preference";

export const DESIGN_SYSTEM_THEME_STORAGE_KEY = "ku0.theme.preference";
export const DESIGN_SYSTEM_THEME_ATTRIBUTE = "data-theme";
export const DESIGN_SYSTEM_THEME_PREFERENCE_ATTRIBUTE = "data-theme-preference";
export const DESIGN_SYSTEM_THEME_RESOLVED_ATTRIBUTE = "data-theme-resolved";
export const DESIGN_SYSTEM_REDUCED_MOTION_ATTRIBUTE = "data-reduced-motion";
export const DESIGN_SYSTEM_CONTRAST_ATTRIBUTE = "data-contrast";

type ManagedMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

type ThemeRuntimeWindow = Window & typeof globalThis;

export type DesignSystemThemeSnapshot = {
  preference: DesignSystemThemePreference;
  resolved: DesignSystemResolvedTheme;
  motion: DesignSystemMotionPreference;
  contrast: DesignSystemContrastPreference;
};

export type ApplyDesignSystemThemeRuntimeOptions = {
  persist?: boolean;
  preference?: DesignSystemThemePreference | null | undefined;
  window?: ThemeRuntimeWindow | null | undefined;
};

const COLOR_SCHEMES = {
  dark: "dark",
  dim: "dark",
  light: "light",
} as const satisfies Record<DesignSystemResolvedTheme, "dark" | "light">;
const THEME_COLOR_VALUES = {
  dark: "#212121",
  dim: "#15171d",
  light: "#f4f6fa",
} as const satisfies Record<DesignSystemResolvedTheme, string>;

const SYSTEM_PREFERENCE_QUERY = "(prefers-color-scheme: dark)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const CONTRAST_QUERY = "(prefers-contrast: more)";

let releaseMediaBindings: (() => void) | null = null;

function getRuntimeWindow(explicitWindow?: ThemeRuntimeWindow | null | undefined) {
  if (explicitWindow) {
    return explicitWindow;
  }
  if (typeof window === "undefined") {
    return null;
  }
  return window;
}

function listenToMediaQuery(
  query: ManagedMediaQueryList | null,
  listener: (event: MediaQueryListEvent) => void
) {
  if (!query) {
    return () => {};
  }
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }

  if (typeof query.addListener === "function" && typeof query.removeListener === "function") {
    query.addListener(listener);
    return () => query.removeListener(listener);
  }

  return () => {};
}

function getMediaQuery(win: ThemeRuntimeWindow, query: string) {
  try {
    return win.matchMedia(query);
  } catch {
    return null;
  }
}

function getDocumentRoot(win: ThemeRuntimeWindow | null) {
  return win?.document?.documentElement ?? null;
}

function readMediaPreference(win: ThemeRuntimeWindow, query: string) {
  try {
    return win.matchMedia(query).matches;
  } catch {
    return false;
  }
}

export function normalizeThemePreference(
  value: string | null | undefined
): DesignSystemThemePreference {
  if (value === "dark" || value === "dim" || value === "light" || value === "system") {
    return value;
  }
  return "system";
}

export function resolveSystemTheme(
  explicitWindow?: ThemeRuntimeWindow | null | undefined
): DesignSystemResolvedTheme {
  const win = getRuntimeWindow(explicitWindow);
  if (!win) {
    return "light";
  }
  return readMediaPreference(win, SYSTEM_PREFERENCE_QUERY) ? "dark" : "light";
}

export function resolveThemePreference(
  preference: DesignSystemThemePreference,
  explicitWindow?: ThemeRuntimeWindow | null | undefined
): DesignSystemResolvedTheme {
  return preference === "system" ? resolveSystemTheme(explicitWindow) : preference;
}

export function readStoredThemePreference(
  explicitWindow?: ThemeRuntimeWindow | null | undefined
): DesignSystemThemePreference | null {
  const win = getRuntimeWindow(explicitWindow);
  if (!win) {
    return null;
  }

  try {
    const storedValue = win.localStorage.getItem(DESIGN_SYSTEM_THEME_STORAGE_KEY);
    if (!storedValue) {
      return null;
    }
    return normalizeThemePreference(storedValue);
  } catch {
    return null;
  }
}

export function persistThemePreference(
  preference: DesignSystemThemePreference,
  explicitWindow?: ThemeRuntimeWindow | null | undefined
) {
  const win = getRuntimeWindow(explicitWindow);
  if (!win) {
    return;
  }

  try {
    win.localStorage.setItem(DESIGN_SYSTEM_THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore localStorage write failures in locked-down browser contexts.
  }
}

function buildThemeSnapshot(
  win: ThemeRuntimeWindow,
  preference: DesignSystemThemePreference
): DesignSystemThemeSnapshot {
  return {
    preference,
    resolved: resolveThemePreference(preference, win),
    motion: readMediaPreference(win, REDUCED_MOTION_QUERY) ? "reduce" : "no-preference",
    contrast: readMediaPreference(win, CONTRAST_QUERY) ? "more" : "no-preference",
  };
}

function applyThemeSnapshot(root: HTMLElement, snapshot: DesignSystemThemeSnapshot) {
  root.setAttribute(DESIGN_SYSTEM_THEME_ATTRIBUTE, snapshot.resolved);
  root.setAttribute(DESIGN_SYSTEM_THEME_PREFERENCE_ATTRIBUTE, snapshot.preference);
  root.setAttribute(DESIGN_SYSTEM_THEME_RESOLVED_ATTRIBUTE, snapshot.resolved);
  root.setAttribute(DESIGN_SYSTEM_REDUCED_MOTION_ATTRIBUTE, snapshot.motion);
  root.setAttribute(DESIGN_SYSTEM_CONTRAST_ATTRIBUTE, snapshot.contrast);
  root.style.colorScheme = COLOR_SCHEMES[snapshot.resolved];
  root.ownerDocument
    ?.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR_VALUES[snapshot.resolved]);
}

function bindRuntimeMediaListeners(
  win: ThemeRuntimeWindow,
  preference: DesignSystemThemePreference,
  persist: boolean
) {
  releaseMediaBindings?.();
  releaseMediaBindings = null;

  const root = getDocumentRoot(win);
  if (!root) {
    return;
  }

  const refreshSnapshot = () => {
    const nextSnapshot = buildThemeSnapshot(win, preference);
    applyThemeSnapshot(root, nextSnapshot);
    if (persist) {
      persistThemePreference(preference, win);
    }
  };

  const removers = [
    listenToMediaQuery(getMediaQuery(win, REDUCED_MOTION_QUERY), refreshSnapshot),
    listenToMediaQuery(getMediaQuery(win, CONTRAST_QUERY), refreshSnapshot),
  ];

  if (preference === "system") {
    removers.push(listenToMediaQuery(getMediaQuery(win, SYSTEM_PREFERENCE_QUERY), refreshSnapshot));
  }

  releaseMediaBindings = () => {
    for (const remove of removers) {
      remove();
    }
    releaseMediaBindings = null;
  };
}

export function applyDesignSystemThemeRuntime(
  options: ApplyDesignSystemThemeRuntimeOptions = {}
): DesignSystemThemeSnapshot | null {
  const win = getRuntimeWindow(options.window);
  if (!win) {
    return null;
  }

  const root = getDocumentRoot(win);
  if (!root) {
    return null;
  }

  const preference = normalizeThemePreference(
    options.preference ?? readStoredThemePreference(win) ?? "system"
  );
  const persist = options.persist ?? true;
  const snapshot = buildThemeSnapshot(win, preference);

  applyThemeSnapshot(root, snapshot);
  if (persist) {
    persistThemePreference(preference, win);
  }
  bindRuntimeMediaListeners(win, preference, persist);

  return snapshot;
}

export function syncDesignSystemThemePreference(
  preference: DesignSystemThemePreference,
  options: Omit<ApplyDesignSystemThemeRuntimeOptions, "preference"> = {}
) {
  return applyDesignSystemThemeRuntime({
    ...options,
    persist: options.persist ?? true,
    preference,
  });
}
