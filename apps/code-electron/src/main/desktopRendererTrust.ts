const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export type CreateDesktopRendererTrustInput = {
  rendererDevServerUrl?: string | null;
};

export type DesktopRendererTrust = {
  isSafeExternalUrl(url: string): boolean;
  isTrustedRendererUrl(url: string): boolean;
};

function parseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function createDesktopRendererTrust(
  input: CreateDesktopRendererTrustInput
): DesktopRendererTrust {
  const trustedDevServerOrigin = (() => {
    const parsedUrl = parseUrl(input.rendererDevServerUrl?.trim() ?? "");
    return parsedUrl?.origin ?? null;
  })();

  return {
    isSafeExternalUrl(url: string) {
      const parsedUrl = parseUrl(url);
      if (!parsedUrl) {
        return false;
      }

      return SAFE_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol);
    },
    isTrustedRendererUrl(url: string) {
      const parsedUrl = parseUrl(url);
      if (!parsedUrl) {
        return false;
      }

      if (parsedUrl.protocol === "file:") {
        return true;
      }

      if (trustedDevServerOrigin) {
        return parsedUrl.origin === trustedDevServerOrigin;
      }

      return false;
    },
  };
}
