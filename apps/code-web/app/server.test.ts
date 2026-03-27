import { WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY } from "@ku0/shared/runtimeGatewayEnv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GITHUB_WEBHOOK_SECRET_ENV_KEY } from "./github/githubWebhook";
import { createServerEntry } from "./server";

const originalFetch = globalThis.fetch;

async function signPayload(payloadText: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadText));
  return `sha256=${[...new Uint8Array(signature)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function buildWebhookRequest(eventName: string, payload: unknown, secret: string) {
  const payloadText = JSON.stringify(payload);
  const signature = await signPayload(payloadText, secret);
  return new Request("https://hugecode.dev/github/webhooks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": eventName,
      "x-github-delivery": "delivery-1",
      "x-hub-signature-256": signature,
    },
    body: payloadText,
  });
}

function sampleAssignedIssuePayload() {
  return {
    action: "assigned",
    issue: {
      number: 42,
      title: "Stabilize GitHub automation",
      body: "Ship webhook-first delegation.",
      html_url: "https://github.com/OpenHuge/HugeCode/issues/42",
      user: {
        login: "octocat",
        id: 1,
        type: "User",
      },
    },
    repository: {
      full_name: "OpenHuge/HugeCode",
      clone_url: "https://github.com/OpenHuge/HugeCode.git",
    },
    sender: {
      login: "octocat",
      id: 1,
      type: "User",
    },
  };
}

describe("server GitHub webhook route", () => {
  beforeEach(() => {
    process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = "https://runtime.hugecode.dev/rpc";
    process.env[GITHUB_WEBHOOK_SECRET_ENV_KEY] = "super-secret";
  });

  afterEach(() => {
    process.env[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] = "";
    process.env[GITHUB_WEBHOOK_SECRET_ENV_KEY] = "";
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("forwards valid GitHub webhook requests to the runtime gateway", async () => {
    const runtimeFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, result: { deduped: false } }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        })
    );
    globalThis.fetch = runtimeFetch as typeof fetch;

    const server = createServerEntry({
      fetch: vi.fn(async () => new Response("fallback", { status: 200 })),
    });
    const response = await server.fetch(
      await buildWebhookRequest("issues", sampleAssignedIssuePayload(), "super-secret"),
      {} as never
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        deduped: false,
      },
    });
    expect(runtimeFetch).toHaveBeenCalledOnce();
    expect(runtimeFetch.mock.calls[0]?.[0]).toBe("https://runtime.hugecode.dev/rpc");
  });

  it("returns 502 when the runtime gateway request fails", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const server = createServerEntry({
      fetch: vi.fn(async () => new Response("fallback", { status: 200 })),
    });
    const response = await server.fetch(
      await buildWebhookRequest("issues", sampleAssignedIssuePayload(), "super-secret"),
      {} as never
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Runtime gateway request failed during GitHub source ingestion.",
    });
  });

  it("returns 502 when the runtime gateway response is not JSON", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("not-json", {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
        })
    ) as typeof fetch;

    const server = createServerEntry({
      fetch: vi.fn(async () => new Response("fallback", { status: 200 })),
    });
    const response = await server.fetch(
      await buildWebhookRequest("issues", sampleAssignedIssuePayload(), "super-secret"),
      {} as never
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Runtime gateway returned a non-JSON response for GitHub source ingestion.",
    });
  });
});
