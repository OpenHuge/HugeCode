import { describe, expect, it } from "vitest";
import {
  normalizeGitHubWebhookEvent,
  resolveServerRuntimeGatewayEndpoint,
  verifyGitHubWebhookSignature,
} from "./githubWebhook";

describe("githubWebhook", () => {
  it("normalizes assigned issues into runtime ingest requests", () => {
    const result = normalizeGitHubWebhookEvent("issues", "delivery-1", {
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
    });

    expect(result.kind).toBe("ingest");
    if (result.kind !== "ingest") {
      return;
    }
    expect(result.request.payload.kind).toBe("github_issue");
    expect(result.request.payload.issueNumber).toBe(42);
    expect(result.request.payload.repo.fullName).toBe("OpenHuge/HugeCode");
    expect(result.request.payload.triggerMode).toBe("assignment");
  });

  it("normalizes PR comments with /hugecode continue and strips the command body", () => {
    const result = normalizeGitHubWebhookEvent("issue_comment", "delivery-2", {
      action: "created",
      issue: {
        number: 74,
        title: "Source-driven delegation",
        body: "Need runtime-owned orchestration.",
        html_url: "https://github.com/OpenHuge/HugeCode/pull/74",
        pull_request: {
          html_url: "https://github.com/OpenHuge/HugeCode/pull/74",
        },
      },
      comment: {
        id: 991,
        html_url: "https://github.com/OpenHuge/HugeCode/pull/74#issuecomment-991",
        body: "/hugecode continue\nFocus on webhook dedupe and source state transitions.",
        user: {
          login: "reviewer",
          id: 2,
          type: "User",
        },
      },
      repository: {
        full_name: "OpenHuge/HugeCode",
        clone_url: "https://github.com/OpenHuge/HugeCode.git",
      },
      sender: {
        login: "reviewer",
        id: 2,
        type: "User",
      },
    });

    expect(result.kind).toBe("ingest");
    if (result.kind !== "ingest") {
      return;
    }
    expect(result.request.payload.kind).toBe("github_pr_followup");
    expect(result.request.payload.commandKind).toBe("continue");
    expect(result.request.payload.commentBody).toBe(
      "Focus on webhook dedupe and source state transitions."
    );
    expect(result.request.payload.pullRequestNumber).toBe(74);
  });

  it("ignores comments without a supported command", () => {
    const result = normalizeGitHubWebhookEvent("issue_comment", "delivery-3", {
      action: "created",
      issue: {
        number: 10,
      },
      comment: {
        id: 100,
        body: "plain discussion",
      },
      repository: {
        full_name: "OpenHuge/HugeCode",
      },
    });

    expect(result).toEqual({
      kind: "ignored",
      status: 202,
      reason: "Issue comment does not contain a supported /hugecode command.",
    });
  });

  it("resolves relative runtime gateway endpoints against the current request URL", () => {
    expect(
      resolveServerRuntimeGatewayEndpoint(
        "https://hugecode.dev/github/webhooks",
        "/__code_runtime_rpc"
      )
    ).toBe("https://hugecode.dev/__code_runtime_rpc");
  });

  it("verifies GitHub webhook signatures", async () => {
    const secret = "super-secret";
    const payload = JSON.stringify({ ok: true });
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const rendered = `sha256=${[...new Uint8Array(signature)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")}`;

    await expect(verifyGitHubWebhookSignature(payload, rendered, secret)).resolves.toBe(true);
    await expect(verifyGitHubWebhookSignature(payload, "sha256=deadbeef", secret)).resolves.toBe(
      false
    );
  });
});
