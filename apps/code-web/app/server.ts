import {
  createStartHandler,
  defaultStreamHandler,
  type RequestHandler,
} from "@tanstack/react-start/server";
import type { Register } from "@tanstack/react-router";
import {
  normalizeGitHubWebhookEvent,
  readConfiguredGitHubWebhookSecret,
  readConfiguredServerRuntimeGatewayEndpoint,
  resolveServerRuntimeGatewayEndpoint,
  verifyGitHubWebhookSignature,
} from "./github/githubWebhook";

const startFetch = createStartHandler(defaultStreamHandler);

export type ServerEntry = { fetch: RequestHandler<Register> };

export function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    async fetch(request, options) {
      const url = new URL(request.url);
      if (url.pathname === "/github/webhooks") {
        return await forwardGitHubWebhookToRuntime(request);
      }
      return await entry.fetch(request, options);
    },
  };
}

async function forwardGitHubWebhookToRuntime(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        allow: "POST",
      },
    });
  }

  const runtimeGatewayEndpoint = resolveServerRuntimeGatewayEndpoint(
    request.url,
    readConfiguredServerRuntimeGatewayEndpoint()
  );
  if (!runtimeGatewayEndpoint) {
    return Response.json(
      {
        ok: false,
        error: "Web runtime gateway endpoint is not configured for GitHub source ingestion.",
      },
      { status: 503 }
    );
  }

  const webhookSecret = readConfiguredGitHubWebhookSecret();
  if (!webhookSecret) {
    return Response.json(
      {
        ok: false,
        error: "GitHub webhook secret is not configured.",
      },
      { status: 503 }
    );
  }

  const payloadText = await request.text();
  const signatureValid = await verifyGitHubWebhookSignature(
    payloadText,
    request.headers.get("x-hub-signature-256"),
    webhookSecret
  );
  if (!signatureValid) {
    return Response.json(
      {
        ok: false,
        error: "GitHub webhook signature verification failed.",
      },
      { status: 401 }
    );
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = payloadText.length > 0 ? JSON.parse(payloadText) : {};
  } catch {
    return Response.json(
      {
        ok: false,
        error: "GitHub webhook body must be valid JSON.",
      },
      { status: 400 }
    );
  }

  const normalization = normalizeGitHubWebhookEvent(
    request.headers.get("x-github-event"),
    request.headers.get("x-github-delivery"),
    parsedPayload
  );

  if (normalization.kind !== "ingest") {
    return Response.json(
      {
        ok: normalization.kind === "ignored",
        status: normalization.kind,
        reason: normalization.reason,
      },
      { status: normalization.status }
    );
  }

  let runtimeResponse: Response;
  try {
    runtimeResponse = await fetch(runtimeGatewayEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hugecode-source-provider": "github",
      },
      body: JSON.stringify({
        method: "code_task_source_ingest_v1",
        params: normalization.request,
      }),
    });
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Runtime gateway request failed during GitHub source ingestion.",
      },
      { status: 502 }
    );
  }

  if (!runtimeResponse.ok) {
    return Response.json(
      {
        ok: false,
        error: `Runtime gateway rejected GitHub source ingestion with HTTP ${runtimeResponse.status}.`,
      },
      { status: 502 }
    );
  }

  let body: {
    ok?: boolean;
    result?: unknown;
    error?: { message?: string };
  };
  try {
    body = (await runtimeResponse.json()) as {
      ok?: boolean;
      result?: unknown;
      error?: { message?: string };
    };
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Runtime gateway returned a non-JSON response for GitHub source ingestion.",
      },
      { status: 502 }
    );
  }
  if (!body.ok) {
    return Response.json(
      {
        ok: false,
        error: body.error?.message ?? "Runtime gateway rejected GitHub source ingestion.",
      },
      { status: 502 }
    );
  }

  return Response.json(
    {
      ok: true,
      result: body.result,
    },
    { status: 202 }
  );
}

export default createServerEntry({ fetch: startFetch });
