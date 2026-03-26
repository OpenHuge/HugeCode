import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export const DESKTOP_APP_PROTOCOL_SCHEME = "hugecode-app";
export const DESKTOP_APP_PROTOCOL_HOST = "app";

type ProtocolRequestLike = {
  url: string;
};

type PrivilegedSchemeRegistrarLike = {
  registerSchemesAsPrivileged(
    customSchemes: Array<{
      privileges: {
        secure: boolean;
        standard: boolean;
        stream: boolean;
        supportFetchAPI: boolean;
      };
      scheme: string;
    }>
  ): void;
};

type ProtocolLike = {
  handle(
    scheme: string,
    handler: (request: ProtocolRequestLike) => Promise<Response> | Response
  ): void;
  isProtocolHandled?(scheme: string): boolean;
};

type SessionLike = {
  protocol: ProtocolLike;
};

export type ResolveDesktopAppProtocolAssetPathInput = {
  rendererRoot: string;
  url: string;
};

export type RegisterDesktopAppProtocolHandlerInput = {
  logger?: Pick<Console, "warn">;
  rendererRoot: string;
  session: SessionLike;
};

let privilegedSchemeRegistered = false;

function parseDesktopAppProtocolUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isPathWithinRoot(rootPath: string, candidatePath: string) {
  if (candidatePath === rootPath) {
    return true;
  }

  return candidatePath.startsWith(`${rootPath}${sep}`);
}

function resolveContentType(path: string) {
  switch (extname(path).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".gif":
      return "image/gif";
    case ".html":
      return "text/html; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

export function createDesktopAppRendererUrl(relativePath = "index.html") {
  const normalizedPath = relativePath.replace(/^\/+/u, "") || "index.html";
  return `${DESKTOP_APP_PROTOCOL_SCHEME}://${DESKTOP_APP_PROTOCOL_HOST}/${normalizedPath}`;
}

export function isDesktopAppProtocolUrl(url: string) {
  const parsedUrl = parseDesktopAppProtocolUrl(url);
  return (
    parsedUrl?.protocol === `${DESKTOP_APP_PROTOCOL_SCHEME}:` &&
    parsedUrl.hostname === DESKTOP_APP_PROTOCOL_HOST
  );
}

export function resolveDesktopAppProtocolAssetPath(input: ResolveDesktopAppProtocolAssetPathInput) {
  const parsedUrl = parseDesktopAppProtocolUrl(input.url);
  if (
    parsedUrl?.protocol !== `${DESKTOP_APP_PROTOCOL_SCHEME}:` ||
    parsedUrl.hostname !== DESKTOP_APP_PROTOCOL_HOST
  ) {
    return null;
  }

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(parsedUrl.pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPathname.replace(/^\/+/u, "") || "index.html";
  const relativeSegments = relativePath.split("/").filter(Boolean);
  if (relativeSegments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  const rootPath = resolve(input.rendererRoot);
  const candidatePath = resolve(rootPath, relativePath);

  if (!isPathWithinRoot(rootPath, candidatePath)) {
    return null;
  }

  return candidatePath;
}

export function registerDesktopAppProtocolScheme(protocol: PrivilegedSchemeRegistrarLike) {
  if (privilegedSchemeRegistered) {
    return;
  }

  protocol.registerSchemesAsPrivileged([
    {
      privileges: {
        secure: true,
        standard: true,
        stream: true,
        supportFetchAPI: true,
      },
      scheme: DESKTOP_APP_PROTOCOL_SCHEME,
    },
  ]);
  privilegedSchemeRegistered = true;
}

export function resetDesktopAppProtocolSchemeRegistrationForTests() {
  privilegedSchemeRegistered = false;
}

export function createDesktopAppProtocolHandler(
  input: Pick<RegisterDesktopAppProtocolHandlerInput, "logger" | "rendererRoot">
) {
  const logger = input.logger ?? console;

  return async (request: ProtocolRequestLike) => {
    const assetPath = resolveDesktopAppProtocolAssetPath({
      rendererRoot: input.rendererRoot,
      url: request.url,
    });
    if (!assetPath) {
      return new Response("Not Found", {
        status: 404,
      });
    }

    try {
      const body = await readFile(assetPath);
      return new Response(body, {
        headers: {
          "content-type": resolveContentType(assetPath),
        },
        status: 200,
      });
    } catch (error) {
      logger.warn(`Failed to serve HugeCode desktop asset for ${request.url}`, error);
      return new Response("Not Found", {
        status: 404,
      });
    }
  };
}

export function registerDesktopAppProtocolHandler(input: RegisterDesktopAppProtocolHandlerInput) {
  if (input.session.protocol.isProtocolHandled?.(DESKTOP_APP_PROTOCOL_SCHEME)) {
    return;
  }

  input.session.protocol.handle(
    DESKTOP_APP_PROTOCOL_SCHEME,
    createDesktopAppProtocolHandler({
      logger: input.logger,
      rendererRoot: input.rendererRoot,
    })
  );
}
