export const T3_P0_RUNTIME_ROLE_MODE_CARRIER = "P0_RUNTIME_ROLE_MODE";

export type T3P0RuntimeRole = "customer" | "operator" | "developer";

export function normalizeT3P0RuntimeRole(value: unknown): T3P0RuntimeRole {
  if (value === "operator" || value === "developer") {
    return value;
  }
  return "customer";
}

function readBrowserRoleOverride(): unknown {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage.getItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER) ?? undefined;
  } catch {
    return undefined;
  }
}

export function readT3P0RuntimeRoleMode(): T3P0RuntimeRole {
  const roleOverride = readBrowserRoleOverride();
  if (roleOverride !== undefined) {
    return normalizeT3P0RuntimeRole(roleOverride);
  }
  const env = import.meta.env as Record<string, unknown>;
  return normalizeT3P0RuntimeRole(
    env[T3_P0_RUNTIME_ROLE_MODE_CARRIER] ?? env.VITE_P0_RUNTIME_ROLE_MODE
  );
}

export function canUseT3P0UnreleasedAssistantSurfaces(role: T3P0RuntimeRole): boolean {
  return role === "developer";
}

export function canExportT3P0BrowserAccountData(role: T3P0RuntimeRole): boolean {
  return role === "operator" || role === "developer";
}
