export const T3_P0_RUNTIME_ROLE_MODE_CARRIER = "P0_RUNTIME_ROLE_MODE";
export const T3_OPERATOR_LOCAL_PASSWORD_CARRIER = "P0_OPERATOR_LOCAL_PASSWORD";
export const T3_OPERATOR_DEFAULT_LOCAL_PASSWORD = "ku020260506";
export const T3_OPERATOR_UNLOCK_STORAGE_KEY = "hugecode:t3-operator-unlock:v1";

export type T3P0RuntimeRole = "customer" | "operator" | "developer";

export function normalizeT3P0RuntimeRole(value: unknown): T3P0RuntimeRole {
  if (value === "operator" || value === "developer") {
    return value;
  }
  return "customer";
}

export function canReadT3BrowserRoleOverride(
  env: Pick<ImportMetaEnv, "DEV"> = import.meta.env
): boolean {
  return env.DEV === true;
}

function readBrowserRoleOverride(): unknown {
  if (!import.meta.env.DEV) {
    return undefined;
  }
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window.localStorage.getItem(T3_P0_RUNTIME_ROLE_MODE_CARRIER) ?? undefined;
  } catch {
    return undefined;
  }
}

function readOperatorUnlockStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readT3OperatorUnlockState(): boolean {
  return readOperatorUnlockStorage()?.getItem(T3_OPERATOR_UNLOCK_STORAGE_KEY) === "1";
}

export function writeT3OperatorUnlockState(unlocked: boolean): void {
  const storage = readOperatorUnlockStorage();
  if (!storage) {
    return;
  }
  if (unlocked) {
    storage.setItem(T3_OPERATOR_UNLOCK_STORAGE_KEY, "1");
    return;
  }
  storage.removeItem(T3_OPERATOR_UNLOCK_STORAGE_KEY);
}

function readT3OperatorLocalPassword(): string | null {
  const env = import.meta.env as Record<string, unknown>;
  const configured = env[T3_OPERATOR_LOCAL_PASSWORD_CARRIER] ?? env.VITE_P0_OPERATOR_LOCAL_PASSWORD;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }
  return T3_OPERATOR_DEFAULT_LOCAL_PASSWORD;
}

export function verifyT3OperatorLocalPassword(
  input: string,
  configuredPassword = readT3OperatorLocalPassword()
): boolean {
  return Boolean(configuredPassword) && input.trim() === configuredPassword;
}

export function readT3P0RuntimeRoleMode(): T3P0RuntimeRole {
  const roleOverride = readBrowserRoleOverride();
  if (roleOverride !== undefined) {
    return normalizeT3P0RuntimeRole(roleOverride);
  }
  if (readT3OperatorUnlockState()) {
    return "operator";
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
