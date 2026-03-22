type PlatformKind = "mac" | "windows" | "linux" | "unknown";
type ArchitectureKind = "x64" | "arm64" | "x86" | "unknown";
type DesktopPlatformTag = "macos" | "windows" | "linux" | "unknown";

function readNavigatorPlatform() {
  if (typeof navigator === "undefined") {
    return "";
  }
  return (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    ""
  );
}

function readNavigatorUserAgent() {
  if (typeof navigator === "undefined") {
    return "";
  }
  return navigator.userAgent ?? "";
}

function readNavigatorArchitectureHint() {
  if (typeof navigator === "undefined") {
    return "";
  }
  return (
    (
      navigator as Navigator & {
        userAgentData?: {
          architecture?: string;
        };
      }
    ).userAgentData?.architecture ?? ""
  );
}

function readNavigatorBitnessHint() {
  if (typeof navigator === "undefined") {
    return "";
  }
  return (
    (
      navigator as Navigator & {
        userAgentData?: {
          bitness?: string;
        };
      }
    ).userAgentData?.bitness ?? ""
  );
}

function platformKind(): PlatformKind {
  const platform = readNavigatorPlatform();
  const userAgent = readNavigatorUserAgent();
  const combined = `${platform} ${userAgent}`;
  const normalized = combined.toLowerCase();
  if (normalized.includes("mac")) {
    return "mac";
  }
  if (normalized.includes("win")) {
    return "windows";
  }
  if (normalized.includes("linux")) {
    return "linux";
  }
  return "unknown";
}

function inferArchitectureFromText(value: string): ArchitectureKind {
  const normalized = value.toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  if (
    normalized.includes("arm64") ||
    normalized.includes("arm64e") ||
    normalized.includes("aarch64") ||
    normalized.includes("armv9") ||
    normalized.includes("armv8") ||
    normalized.includes("apple silicon")
  ) {
    return "arm64";
  }
  if (
    normalized.includes("x86_64") ||
    normalized.includes("amd64") ||
    normalized.includes("x64") ||
    normalized.includes("intel64") ||
    normalized.includes("win64") ||
    normalized.includes("wow64") ||
    normalized.includes("intel")
  ) {
    return "x64";
  }
  if (
    normalized.includes("i386") ||
    normalized.includes("i686") ||
    normalized.includes("x86") ||
    normalized.includes("win32")
  ) {
    return "x86";
  }
  return "unknown";
}

function architectureKind(): ArchitectureKind {
  const architectureHint = readNavigatorArchitectureHint();
  const bitnessHint = readNavigatorBitnessHint().trim();
  const normalizedArchitectureHint = architectureHint.trim().toLowerCase();
  if (
    (normalizedArchitectureHint === "x86" ||
      normalizedArchitectureHint === "ia32" ||
      normalizedArchitectureHint === "i386" ||
      normalizedArchitectureHint === "i686") &&
    bitnessHint === "64"
  ) {
    return "x64";
  }
  if (
    (normalizedArchitectureHint === "arm" || normalizedArchitectureHint === "armv8") &&
    bitnessHint === "64"
  ) {
    return "arm64";
  }

  const fromHint = inferArchitectureFromText(architectureHint);
  if (fromHint !== "unknown") {
    return fromHint;
  }
  // userAgent often carries explicit architecture tokens (for example Win64/x64)
  // while navigator.platform can be a coarse label such as "Win32".
  const fromUserAgent = inferArchitectureFromText(readNavigatorUserAgent());
  if (fromUserAgent !== "unknown") {
    return fromUserAgent;
  }
  return inferArchitectureFromText(readNavigatorPlatform());
}

export function isMacPlatform(): boolean {
  return platformKind() === "mac";
}

export function isWindowsPlatform(): boolean {
  return platformKind() === "windows";
}

export function isMobilePlatform(): boolean {
  const platform = readNavigatorPlatform();
  const normalizedPlatform = platform.toLowerCase();
  const userAgent = readNavigatorUserAgent().toLowerCase();
  if (typeof navigator === "undefined") {
    return false;
  }
  const maxTouchPoints =
    typeof (navigator as Navigator).maxTouchPoints === "number"
      ? (navigator as Navigator).maxTouchPoints
      : 0;
  const hasTouch = maxTouchPoints > 0;
  const hasMobileUserAgentToken =
    userAgent.includes("mobile") ||
    userAgent.includes("iphone") ||
    userAgent.includes("ipad") ||
    userAgent.includes("ipod") ||
    userAgent.includes("android");
  const iPadDesktopMode =
    normalizedPlatform.includes("mac") &&
    hasTouch &&
    (hasMobileUserAgentToken || userAgent.includes("like mac os x"));
  return (
    normalizedPlatform.includes("iphone") ||
    normalizedPlatform.includes("ipad") ||
    normalizedPlatform.includes("android") ||
    hasMobileUserAgentToken ||
    iPadDesktopMode
  );
}

export function fileManagerName(): string {
  const platform = platformKind();
  if (platform === "mac") {
    return "Finder";
  }
  if (platform === "windows") {
    return "Explorer";
  }
  return "File Manager";
}

export function revealInFileManagerLabel(): string {
  const platform = platformKind();
  if (platform === "mac") {
    return "Reveal in Finder";
  }
  if (platform === "windows") {
    return "Show in Explorer";
  }
  return "Reveal in File Manager";
}

export function openInFileManagerLabel(): string {
  return `Open in ${fileManagerName()}`;
}

export function getDesktopPlatformTag(): DesktopPlatformTag {
  switch (platformKind()) {
    case "mac":
      return "macos";
    case "windows":
      return "windows";
    case "linux":
      return "linux";
    default:
      return "unknown";
  }
}

export function getDesktopArchitectureTag(): ArchitectureKind {
  return architectureKind();
}

export function getDesktopPlatformArchitectureTag(): string {
  return `${getDesktopPlatformTag()}-${getDesktopArchitectureTag()}`;
}

function looksLikeWindowsAbsolutePath(value: string): boolean {
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return true;
  }
  if (value.startsWith("\\\\") || value.startsWith("//")) {
    return true;
  }
  if (value.startsWith("\\\\?\\")) {
    return true;
  }
  return false;
}

export function isAbsolutePath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return true;
  }
  return looksLikeWindowsAbsolutePath(trimmed);
}

function stripTrailingSeparators(value: string) {
  return value.replace(/[\\/]+$/, "");
}

function stripLeadingSeparators(value: string) {
  return value.replace(/^[\\/]+/, "");
}

function looksLikeWindowsPathPrefix(value: string): boolean {
  const trimmed = value.trim();
  return looksLikeWindowsAbsolutePath(trimmed) || trimmed.includes("\\");
}

export function normalizePathForDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith("\\?\\UNC\\")) {
    return `\\\\${trimmed.slice("\\?\\UNC\\".length)}`;
  }
  if (trimmed.startsWith("\\\\?\\UNC\\")) {
    return `\\\\${trimmed.slice("\\\\?\\UNC\\".length)}`;
  }
  if (trimmed.startsWith("//?/UNC/")) {
    return `//${trimmed.slice("//?/UNC/".length)}`;
  }
  if (trimmed.startsWith("\\?\\")) {
    return trimmed.slice("\\?\\".length);
  }
  if (trimmed.startsWith("\\\\?\\")) {
    return trimmed.slice("\\\\?\\".length);
  }
  if (trimmed.startsWith("\\??\\")) {
    return trimmed.slice("\\??\\".length);
  }
  if (trimmed.startsWith("//?/")) {
    return trimmed.slice("//?/".length);
  }
  return trimmed;
}

export function joinWorkspacePath(base: string, path: string): string {
  const trimmedBase = base.trim();
  const trimmedPath = path.trim();
  if (!trimmedBase) {
    return trimmedPath;
  }
  if (!trimmedPath || isAbsolutePath(trimmedPath)) {
    return trimmedPath;
  }

  const isWindows = looksLikeWindowsPathPrefix(trimmedBase);
  const baseWithoutTrailing = stripTrailingSeparators(trimmedBase);
  const pathWithoutLeading = stripLeadingSeparators(trimmedPath);
  if (isWindows) {
    const normalizedBase = baseWithoutTrailing.replace(/\//g, "\\");
    const normalizedRelative = pathWithoutLeading.replace(/\//g, "\\");
    return `${normalizedBase}\\${normalizedRelative}`;
  }
  const normalizedRelative = pathWithoutLeading.replace(/\\/g, "/");
  return `${baseWithoutTrailing}/${normalizedRelative}`;
}
