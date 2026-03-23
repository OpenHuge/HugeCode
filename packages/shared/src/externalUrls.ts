const ALLOWED_EXTERNAL_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function toSafeExternalUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_EXTERNAL_URL_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

export function isSafeExternalUrl(url: string): boolean {
  return toSafeExternalUrl(url) !== null;
}
