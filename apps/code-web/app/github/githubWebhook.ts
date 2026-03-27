import type {
  RuntimeTaskSourceIngestRequest,
  RuntimeTaskSourceRequester,
} from "@ku0/code-runtime-host-contract";
import { WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY } from "@ku0/shared/runtimeGatewayEnv";

export const GITHUB_WEBHOOK_SECRET_ENV_KEY = "CODE_GITHUB_WEBHOOK_SECRET";

type GitHubRecord = Record<string, unknown>;

export type GitHubWebhookNormalization =
  | {
      kind: "ingest";
      request: RuntimeTaskSourceIngestRequest;
    }
  | {
      kind: "ignored";
      status: number;
      reason: string;
    }
  | {
      kind: "invalid";
      status: number;
      reason: string;
    };

function isRecord(value: unknown): value is GitHubRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRequester(value: unknown): RuntimeTaskSourceRequester | null {
  if (!isRecord(value)) {
    return null;
  }
  return {
    login: readString(value.login),
    id: readNumber(value.id),
    type: readString(value.type),
  };
}

function readRepoContext(payload: GitHubRecord) {
  const repository = isRecord(payload.repository) ? payload.repository : null;
  const fullName = readString(repository?.full_name);
  const [owner, name] = fullName?.split("/") ?? [];
  return {
    owner: readString(owner),
    name: readString(name),
    fullName,
    remoteUrl: readString(repository?.clone_url) ?? readString(repository?.html_url),
  };
}

function extractHugeCodeCommand(commentBody: string | null): {
  commandKind: "run" | "continue" | "retry" | null;
  instructionPatch: string | null;
} {
  if (!commentBody) {
    return {
      commandKind: null,
      instructionPatch: null,
    };
  }

  const match = commentBody.match(/(^|\n)\s*\/hugecode\s+(run|continue|retry)\b[^\n]*/iu);
  if (!match) {
    return {
      commandKind: null,
      instructionPatch: null,
    };
  }

  const commandKind = match[2]?.toLowerCase();
  const stripped = commentBody
    .replace(match[0], "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return {
    commandKind:
      commandKind === "run" || commandKind === "continue" || commandKind === "retry"
        ? commandKind
        : null,
    instructionPatch: stripped.length > 0 ? stripped : null,
  };
}

function buildIssueIngestRequest(
  eventName: string,
  action: string | null,
  payload: GitHubRecord
): RuntimeTaskSourceIngestRequest {
  const issue = isRecord(payload.issue) ? payload.issue : payload;
  const title = readString(issue.title);
  const body = readString(issue.body);
  const issueNumber = readNumber(issue.number);
  const repo = readRepoContext(payload);
  const requestedBy = readRequester(payload.sender) ?? readRequester(issue.user);

  return {
    provider: "github",
    event: {
      deliveryId: readString(payload.deliveryId),
      eventName,
      action,
      receivedAt: Date.now(),
    },
    payload: {
      kind: "github_issue",
      title,
      body,
      url: readString(issue.html_url),
      canonicalUrl: readString(issue.html_url),
      repo,
      issueNumber,
      triggerMode: "assignment",
      externalId: issueNumber !== null ? `github:issue:${issueNumber}` : null,
      requestedBy,
    },
    launch: {
      enabled: true,
    },
  };
}

export function normalizeGitHubWebhookEvent(
  eventNameRaw: string | null,
  deliveryIdRaw: string | null,
  payload: unknown
): GitHubWebhookNormalization {
  if (!eventNameRaw) {
    return {
      kind: "invalid",
      status: 400,
      reason: "GitHub webhook is missing x-github-event.",
    };
  }
  if (!deliveryIdRaw) {
    return {
      kind: "invalid",
      status: 400,
      reason: "GitHub webhook is missing x-github-delivery.",
    };
  }
  if (!isRecord(payload)) {
    return {
      kind: "invalid",
      status: 400,
      reason: "GitHub webhook body must be a JSON object.",
    };
  }

  const eventName = eventNameRaw.trim().toLowerCase();
  const action = readString(payload.action);

  if (eventName === "issues" && action === "assigned") {
    const request = buildIssueIngestRequest(eventName, action, {
      ...payload,
      deliveryId: deliveryIdRaw,
    });
    return {
      kind: "ingest",
      request,
    };
  }

  if (eventName === "issue_comment") {
    const issue = isRecord(payload.issue) ? payload.issue : null;
    const comment = isRecord(payload.comment) ? payload.comment : null;
    const commentBody = readString(comment?.body);
    const command = extractHugeCodeCommand(commentBody);
    if (!command.commandKind) {
      return {
        kind: "ignored",
        status: 202,
        reason: "Issue comment does not contain a supported /hugecode command.",
      };
    }

    const isPullRequestComment = isRecord(issue?.pull_request);
    const repo = readRepoContext(payload);
    const issueNumber = readNumber(issue?.number);
    const issueTitle = readString(issue?.title);
    const issueBody = readString(issue?.body);

    return {
      kind: "ingest",
      request: {
        provider: "github",
        event: {
          deliveryId: deliveryIdRaw,
          eventName,
          action,
          receivedAt: Date.now(),
        },
        payload: {
          kind: isPullRequestComment ? "github_pr_followup" : "github_issue",
          title: issueTitle,
          body: issueBody,
          url: readString(issue?.html_url),
          canonicalUrl: readString(issue?.html_url),
          repo,
          issueNumber: isPullRequestComment ? null : issueNumber,
          pullRequestNumber: isPullRequestComment ? issueNumber : null,
          commentId: readNumber(comment?.id),
          commentUrl: readString(comment?.html_url),
          commentBody: command.instructionPatch,
          commentAuthor: readRequester(comment?.user),
          commandKind: command.commandKind,
          triggerMode: isPullRequestComment
            ? "pull_request_comment_command"
            : "issue_comment_command",
          externalId:
            readNumber(comment?.id) !== null
              ? `github:comment:${String(readNumber(comment?.id))}`
              : null,
          requestedBy: readRequester(payload.sender) ?? readRequester(comment?.user),
        },
        launch: {
          enabled: true,
        },
      },
    };
  }

  if (eventName === "pull_request_review_comment") {
    const pullRequest = isRecord(payload.pull_request) ? payload.pull_request : null;
    const comment = isRecord(payload.comment) ? payload.comment : null;
    const commentBody = readString(comment?.body);
    const command = extractHugeCodeCommand(commentBody);
    if (!command.commandKind) {
      return {
        kind: "ignored",
        status: 202,
        reason: "Pull request review comment does not contain a supported /hugecode command.",
      };
    }

    return {
      kind: "ingest",
      request: {
        provider: "github",
        event: {
          deliveryId: deliveryIdRaw,
          eventName,
          action,
          receivedAt: Date.now(),
        },
        payload: {
          kind: "github_pr_followup",
          title: readString(pullRequest?.title),
          body: readString(pullRequest?.body),
          url: readString(pullRequest?.html_url),
          canonicalUrl: readString(pullRequest?.html_url),
          repo: readRepoContext(payload),
          pullRequestNumber: readNumber(pullRequest?.number),
          commentId: readNumber(comment?.id),
          commentUrl: readString(comment?.html_url),
          commentBody: command.instructionPatch,
          commentAuthor: readRequester(comment?.user),
          commandKind: command.commandKind,
          triggerMode: "pull_request_review_comment_command",
          headSha: readString(isRecord(pullRequest?.head) ? pullRequest.head.sha : null),
          externalId:
            readNumber(comment?.id) !== null
              ? `github:review-comment:${String(readNumber(comment?.id))}`
              : null,
          requestedBy: readRequester(payload.sender) ?? readRequester(comment?.user),
        },
        launch: {
          enabled: true,
        },
      },
    };
  }

  return {
    kind: "ignored",
    status: 202,
    reason: `GitHub event ${eventNameRaw} is not enabled for HugeCode source ingestion.`,
  };
}

export function resolveServerRuntimeGatewayEndpoint(
  requestUrl: string,
  configuredEndpoint: string | null
): string | null {
  const raw = configuredEndpoint?.trim();
  if (!raw) {
    return null;
  }
  try {
    return new URL(raw, requestUrl).toString();
  } catch {
    return null;
  }
}

export function readConfiguredServerRuntimeGatewayEndpoint(): string | null {
  const env = (
    import.meta as ImportMeta & {
      env?: Record<string, string | boolean | undefined>;
    }
  ).env;
  const globalWithProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const raw =
    env?.[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY] ??
    globalWithProcess.process?.env?.[WEB_RUNTIME_GATEWAY_ENDPOINT_ENV_KEY];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

export function readConfiguredGitHubWebhookSecret(): string | null {
  const env = (
    import.meta as ImportMeta & {
      env?: Record<string, string | boolean | undefined>;
    }
  ).env;
  const globalWithProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const raw =
    env?.[GITHUB_WEBHOOK_SECRET_ENV_KEY] ??
    globalWithProcess.process?.env?.[GITHUB_WEBHOOK_SECRET_ENV_KEY];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export async function verifyGitHubWebhookSignature(
  payloadText: string,
  signatureHeader: string | null,
  secret: string
) {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  const expected = `sha256=${hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadText))
  )}`;
  return timingSafeEqual(expected, signatureHeader);
}
