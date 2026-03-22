const MATERIAL_ICONS_BASE_URL = "/assets/material-icons";
const iconUrlCache = new Map<string, string>();
let fileIconModulePromise: Promise<typeof import("vscode-material-icons")> | null = null;

function normalizeFileTypeIconPath(path: string) {
  return path.replace(/\\/g, "/");
}

async function loadFileIconModule() {
  fileIconModulePromise ??= import("vscode-material-icons");
  return fileIconModulePromise;
}

export function getCachedFileTypeIconUrl(path: string): string | null {
  const normalizedPath = normalizeFileTypeIconPath(path);
  return iconUrlCache.get(normalizedPath) ?? null;
}

export async function preloadFileTypeIconUrl(path: string): Promise<string> {
  const normalizedPath = normalizeFileTypeIconPath(path);
  const cached = iconUrlCache.get(normalizedPath);
  if (cached) {
    return cached;
  }
  const { getIconUrlForFilePath } = await loadFileIconModule();
  const iconUrl = getIconUrlForFilePath(normalizedPath, MATERIAL_ICONS_BASE_URL);
  iconUrlCache.set(normalizedPath, iconUrl);
  return iconUrl;
}

export function resetFileTypeIconCacheForTests() {
  iconUrlCache.clear();
  fileIconModulePromise = null;
}
