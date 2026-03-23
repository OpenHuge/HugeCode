#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { loadRootEnvLocal } from "./lib/load-env.mjs";
import { resolveAvailablePort } from "./lib/ports.mjs";
import {
  compileRuntimeReplayFixture,
  deriveRuntimeReplayGovernanceGoldenBlockers,
  deriveRuntimeReplayRerecordStability,
  loadRuntimeReplayDataset,
  normalizeRuntimeReplayEndpoint,
  normalizeRuntimeReplayWorkspaceId,
  parseRuntimeReplayFilters,
  redactRuntimeReplayText,
  resolveRuntimeReplayFailureClass,
  selectRuntimeReplaySamples,
  summarizeRuntimeReplayRecoveryQualification,
  summarizeReRecordDiff,
  updateRuntimeReplayGoldenBlockerHistory,
  updateManifestEntryFromSample,
  validateRuntimeReplayDataset,
  writeJson,
} from "./lib/runtimeReplayDataset.mjs";

loadRootEnvLocal(import.meta.url);

const DEFAULT_RPC_ENDPOINT = "http://127.0.0.1:8788/rpc";
const DEFAULT_WORKSPACE_ID = "ws-playground";
const DEFAULT_RUNTIME_READY_TIMEOUT_MS = 120_000;
const HEALTHCHECK_TIMEOUT_MS = 1_500;
const TURN_CAPTURE_TIMEOUT_MS = 180_000;

const repoRoot = process.cwd();
const runtimeDevScriptPath = path.join(
  repoRoot,
  "packages",
  "code-runtime-service-rs",
  "scripts",
  "dev.mjs"
);

export function resolveRuntimeReplayIntakeSampleIds({ intakePath, intakeGroup }) {
  if (typeof intakePath !== "string" || intakePath.trim().length === 0) {
    return [];
  }
  const resolvedIntakePath = path.isAbsolute(intakePath)
    ? intakePath
    : path.resolve(process.cwd(), intakePath);
  const payload = JSON.parse(fs.readFileSync(resolvedIntakePath, "utf8"));
  const groupName =
    typeof intakeGroup === "string" && intakeGroup.trim().length > 0
      ? intakeGroup.trim()
      : "backgroundReadyNightlyIds";
  const ids = payload?.[groupName];
  if (!Array.isArray(ids)) {
    throw new Error(`Candidate intake group ${groupName} was not found in ${resolvedIntakePath}.`);
  }
  return [...new Set(ids.filter((entry) => typeof entry === "string" && entry.trim().length > 0))];
}

async function allocateIsolatedRuntimeEndpoint() {
  const isolatedPort = await resolveAvailablePort(8788, {
    host: "127.0.0.1",
    maxAttempts: 200,
  });
  return `http://127.0.0.1:${isolatedPort}/rpc`;
}

function parseArgs(argv) {
  const filters = parseRuntimeReplayFilters(argv);
  let workspaceId = DEFAULT_WORKSPACE_ID;
  let rpcEndpointExplicitlyProvided = false;
  let rpcEndpoint =
    process.env.CODE_RUNTIME_PROVIDER_RECORD_RPC_ENDPOINT ??
    process.env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT ??
    DEFAULT_RPC_ENDPOINT;
  let useExistingOnly = false;
  const turnIndices = [];
  let candidateIntake = null;
  let intakeGroup = "backgroundReadyNightlyIds";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace" && argv[index + 1]) {
      workspaceId = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--rpc-endpoint" && argv[index + 1]) {
      rpcEndpoint = argv[index + 1];
      rpcEndpointExplicitlyProvided = true;
      index += 1;
      continue;
    }
    if (arg === "--use-existing-runtime") {
      useExistingOnly = true;
      continue;
    }
    if (arg === "--turn-index" && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        turnIndices.push(parsed);
      }
      index += 1;
      continue;
    }
    if (arg === "--candidate-intake" && argv[index + 1]) {
      candidateIntake = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--intake-group" && argv[index + 1]) {
      intakeGroup = argv[index + 1];
      index += 1;
    }
  }

  return {
    ...filters,
    workspaceId,
    rpcEndpoint: rpcEndpoint.trim() || DEFAULT_RPC_ENDPOINT,
    rpcEndpointExplicitlyProvided:
      rpcEndpointExplicitlyProvided ||
      Boolean(process.env.CODE_RUNTIME_PROVIDER_RECORD_RPC_ENDPOINT?.trim()) ||
      Boolean(process.env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT?.trim()),
    useExistingOnly,
    turnIndices,
    candidateIntake,
    intakeGroup,
  };
}

function deriveHealthEndpoint(rpcEndpoint) {
  const url = new URL(rpcEndpoint);
  url.pathname = "/health";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function deriveEventsEndpoint(rpcEndpoint) {
  const url = new URL(rpcEndpoint);
  url.pathname = "/events";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function hasPresentValue(value) {
  if (value == null) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function normalizeWorkspaceSetupFiles(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      relativePath:
        typeof entry.relativePath === "string" && entry.relativePath.trim().length > 0
          ? entry.relativePath.trim()
          : null,
      content:
        typeof entry.content === "string"
          ? entry.content
          : entry.content == null
            ? ""
            : String(entry.content),
    }))
    .filter((entry) => entry.relativePath !== null);
}

function resolveRuntimeWorkspaceSetup(sample) {
  const workspaceSetup = sample?.input?.workspaceSetup;
  if (!workspaceSetup || typeof workspaceSetup !== "object") {
    return [];
  }
  return normalizeWorkspaceSetupFiles(workspaceSetup.files);
}

function resolveRuntimeOnlyOperation(sample) {
  const runtimeOperation = sample?.input?.runtimeOperation;
  if (!runtimeOperation || typeof runtimeOperation !== "object") {
    return null;
  }
  const type =
    typeof runtimeOperation.type === "string" && runtimeOperation.type.trim().length > 0
      ? runtimeOperation.type.trim()
      : null;
  if (!type) {
    return null;
  }
  return {
    type,
    payload: structuredClone(runtimeOperation),
  };
}

async function applyWorkspaceSetup(workspaceRoot, sample) {
  const setupFiles = resolveRuntimeWorkspaceSetup(sample);
  for (const file of setupFiles) {
    const targetPath = path.join(workspaceRoot, file.relativePath);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.writeFile(targetPath, file.content, "utf8");
  }
}

export function buildRuntimeTruthAssertionsFromTask(
  task,
  { eventReplayReason = "runtime.updated" } = {}
) {
  const autoDrive = task?.autoDrive ?? null;
  return {
    taskFields: [
      {
        type: "wait-runtime-task-field",
        fieldPath: "checkpointId",
        matcher: hasPresentValue(task?.checkpointId) ? "present" : "absent",
        timeoutMs: 20000,
      },
      {
        type: "wait-runtime-task-field",
        fieldPath: "traceId",
        matcher: hasPresentValue(task?.traceId) ? "present" : "absent",
        timeoutMs: 20000,
      },
      {
        type: "wait-runtime-task-field",
        fieldPath: "publishHandoff",
        matcher: hasPresentValue(task?.publishHandoff) ? "present" : "absent",
        timeoutMs: 20000,
      },
    ],
    review: [
      ...(hasPresentValue(task?.missionLinkage?.summary)
        ? [
            {
              type: "wait-runtime-summary",
              fieldPath: "missionLinkage.summary",
              matcher: "present",
              timeoutMs: 20000,
            },
          ]
        : []),
      ...(hasPresentValue(task?.reviewActionability)
        ? [
            {
              type: "assert-runtime-actionability",
              expectedState:
                typeof task.reviewActionability?.state === "string"
                  ? task.reviewActionability.state
                  : undefined,
              summaryMatcher: "present",
              minimumActionCount: Array.isArray(task.reviewActionability?.actions)
                ? task.reviewActionability.actions.length
                : 0,
              timeoutMs: 20000,
            },
          ]
        : []),
    ],
    autodrive: [
      {
        type: "assert-autodrive-trace",
        decisionTraceMatcher: hasPresentValue(autoDrive?.decisionTrace) ? "present" : "absent",
        runtimeScenarioProfileMatcher: hasPresentValue(
          autoDrive?.runtimeScenarioProfile ?? autoDrive?.scenarioProfile
        )
          ? "present"
          : "absent",
        repoEvaluationProfileMatcher: hasPresentValue(autoDrive?.repoEvaluationProfile)
          ? "present"
          : "absent",
        outcomeFeedbackMatcher: hasPresentValue(autoDrive?.outcomeFeedback) ? "present" : "absent",
        autonomyStateMatcher: hasPresentValue(autoDrive?.autonomyState) ? "present" : "absent",
        timeoutMs: 20000,
      },
    ],
    eventReplay: [
      {
        type: "assert-replay-gap-event",
        expectedReason: eventReplayReason,
        timeoutMs: 20000,
      },
    ],
  };
}

async function fetchWithTimeout(url, timeoutMs, init = undefined) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function isRuntimeHealthy(rpcEndpoint) {
  try {
    const response = await fetchWithTimeout(
      deriveHealthEndpoint(rpcEndpoint),
      HEALTHCHECK_TIMEOUT_MS
    );
    if (!response.ok) {
      return false;
    }
    const payload = await response.json().catch(() => null);
    return payload?.app === "code-runtime-service-rs";
  } catch {
    return false;
  }
}

async function waitForRuntime(rpcEndpoint, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isRuntimeHealthy(rpcEndpoint)) {
      return;
    }
    await delay(300);
  }
  throw new Error(`Runtime did not become healthy at ${rpcEndpoint} within ${timeoutMs}ms.`);
}

async function rpc(rpcEndpoint, method, params) {
  const response = await fetch(rpcEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`${method} failed with HTTP ${response.status}.`);
  }
  const payload = await response.json();
  if (!payload?.ok) {
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : `${method} rejected request.`;
    throw new Error(message);
  }
  return payload.result;
}

async function listRuntimeTasks(rpcEndpoint, workspaceId) {
  return await rpc(rpcEndpoint, "code_runtime_runs_list", {
    workspaceId,
    limit: 32,
  });
}

function selectLatestRuntimeTask(tasks) {
  return [...tasks].sort((left, right) => (right?.updatedAt ?? 0) - (left?.updatedAt ?? 0)).at(0);
}

async function waitForRuntimeTask(rpcEndpoint, workspaceId, taskId, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tasks = await listRuntimeTasks(rpcEndpoint, workspaceId).catch(() => []);
    const matched = Array.isArray(tasks)
      ? (tasks.find((task) => task?.taskId === taskId) ?? selectLatestRuntimeTask(tasks))
      : null;
    if (matched) {
      return matched;
    }
    await delay(200);
  }
  throw new Error(`Runtime task ${taskId} was not observed within ${timeoutMs}ms.`);
}

function parseSseFrames(buffer) {
  const frames = [];
  let remaining = buffer;
  while (true) {
    const separatorIndex = remaining.indexOf("\n\n");
    if (separatorIndex < 0) {
      break;
    }
    frames.push(remaining.slice(0, separatorIndex));
    remaining = remaining.slice(separatorIndex + 2);
  }
  return {
    frames,
    remaining,
  };
}

function parseSsePayload(frame) {
  const payloadLines = [];
  for (const line of frame.split("\n")) {
    const normalized = line.replace(/\r$/, "");
    if (normalized.startsWith("data:")) {
      payloadLines.push(normalized.slice(5).trimStart());
    }
  }
  if (payloadLines.length === 0) {
    return null;
  }
  const payloadText = payloadLines.join("\n").trim();
  if (!payloadText || payloadText === "[DONE]") {
    return null;
  }
  try {
    return JSON.parse(payloadText);
  } catch {
    return null;
  }
}

function splitReplayOutputIntoChunks(output, minimumChunks) {
  if (minimumChunks <= 1) {
    return [output];
  }
  const paragraphParts = output.match(/[^\n]+\n?|(?:\n)/g)?.filter((part) => part.length > 0) ?? [];
  if (paragraphParts.length >= minimumChunks) {
    return paragraphParts;
  }
  const sentenceParts =
    output.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g)?.filter((part) => part.length > 0) ?? [];
  if (sentenceParts.length >= minimumChunks) {
    return sentenceParts;
  }
  const chunks = [];
  const targetLength = Math.max(1, Math.ceil(output.length / minimumChunks));
  for (let index = 0; index < output.length; index += targetLength) {
    chunks.push(output.slice(index, index + targetLength));
  }
  return chunks;
}

function normalizeReplayDeltaChunks(turn, recordedDeltaChunks, output) {
  const expectationMinChunks =
    typeof turn?.expectations?.minDeltaChunks === "number" &&
    Number.isFinite(turn.expectations.minDeltaChunks)
      ? Math.max(1, Math.trunc(turn.expectations.minDeltaChunks))
      : 1;
  const usableRecordedChunks =
    Array.isArray(recordedDeltaChunks) &&
    recordedDeltaChunks.length > 0 &&
    recordedDeltaChunks.join("") === output
      ? recordedDeltaChunks
      : [];
  if (usableRecordedChunks.length >= expectationMinChunks) {
    return {
      deltaChunks: usableRecordedChunks,
      deltaChunkSource: "recorded",
    };
  }
  return {
    deltaChunks: splitReplayOutputIntoChunks(output, expectationMinChunks),
    deltaChunkSource:
      usableRecordedChunks.length > 0 ? "normalized-from-recording" : "normalized-from-output",
  };
}

function normalizeRuntimeEnvOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => typeof key === "string" && key.trim().length > 0)
      .map(([key, entry]) => [key, entry == null ? null : String(entry)])
  );
}

function normalizeRuntimeReplayHttpStub(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const envKey =
    typeof value.envKey === "string" && value.envKey.trim().length > 0
      ? value.envKey.trim()
      : "CODE_RUNTIME_SERVICE_OPENAI_ENDPOINT";
  const status =
    typeof value.status === "number" && Number.isFinite(value.status)
      ? Math.trunc(value.status)
      : 403;
  const body =
    typeof value.body === "string" && value.body.trim().length > 0
      ? value.body
      : JSON.stringify({ error: { message: "Provider rejected request for this turn." } });
  const headers =
    value.headers && typeof value.headers === "object" && !Array.isArray(value.headers)
      ? Object.fromEntries(
          Object.entries(value.headers).map(([key, entry]) => [key, String(entry)])
        )
      : { "content-type": "application/json" };
  const pathName =
    typeof value.path === "string" && value.path.trim().length > 0
      ? value.path.trim()
      : "/v1/responses";
  return {
    envKey,
    status,
    body,
    headers,
    path: pathName.startsWith("/") ? pathName : `/${pathName}`,
  };
}

async function startRuntimeReplayHttpStubServer(stub) {
  const port = await resolveAvailablePort(32001, {
    host: "127.0.0.1",
    maxAttempts: 200,
  });
  const server = http.createServer((request, response) => {
    if (request.url !== stub.path) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
      return;
    }
    response.writeHead(stub.status, stub.headers);
    response.end(stub.body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${port}${stub.path}`,
    async close() {
      await new Promise((resolve) => server.close(() => resolve(undefined)));
    },
  };
}

function buildRuntimeChildEnv(rpcEndpoint, envOverrides = {}) {
  const nextEnv = {
    ...process.env,
    CODE_RUNTIME_SERVICE_PORT: String(new URL(rpcEndpoint).port || "8788"),
  };
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value == null) {
      delete nextEnv[key];
      continue;
    }
    nextEnv[key] = value;
  }
  return nextEnv;
}

export function recordingProfileRequiresScopedRuntime(recordingProfile) {
  if (!recordingProfile || recordingProfile.strategy === "synthetic-failure") {
    return false;
  }
  return Object.keys(recordingProfile.env ?? {}).length > 0 || Boolean(recordingProfile.httpStub);
}

async function materializeRecordingProfileRuntime(recordingProfile) {
  const env = {
    ...(recordingProfile?.env ?? {}),
  };
  let stubServer = null;
  if (recordingProfile?.httpStub) {
    stubServer = await startRuntimeReplayHttpStubServer(recordingProfile.httpStub);
    env[recordingProfile.httpStub.envKey] = stubServer.url;
  }
  return {
    env,
    stubServer,
    async cleanup() {
      if (stubServer) {
        await stubServer.close();
      }
    },
  };
}

async function cleanupRuntimeMaterialization(materialization) {
  if (materialization?.cleanup) {
    await materialization.cleanup();
  }
}

function createRuntimeProfileSignature(recordingProfile, rpcEndpoint = null) {
  return JSON.stringify({
    strategy: recordingProfile?.strategy ?? "runtime-record",
    env: recordingProfile?.env ?? {},
    httpStub: recordingProfile?.httpStub ?? null,
    rpcEndpoint,
  });
}

function canonicalizeRecordedFailure(recordingProfile, failure) {
  if (!recordingProfile?.failure) {
    return failure;
  }
  return {
    ...failure,
    ...recordingProfile.failure,
  };
}

async function stopRuntimeChild(runtimeChild) {
  if (!runtimeChild) {
    return;
  }
  runtimeChild.kill("SIGTERM");
  await new Promise((resolve) => {
    runtimeChild.once("exit", () => resolve(undefined));
    setTimeout(() => resolve(undefined), 2_000);
  });
}

async function waitForRuntimeShutdown(rpcEndpoint, timeoutMs = 5_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!(await isRuntimeHealthy(rpcEndpoint))) {
      return;
    }
    await delay(150);
  }
  throw new Error(`Runtime at ${rpcEndpoint} did not stop within ${timeoutMs}ms.`);
}

async function captureTurn({
  rpcEndpoint,
  eventsEndpoint,
  workspaceId,
  threadId,
  replayVariant,
  replayTurn,
}) {
  const controller = new AbortController();
  const response = await fetch(eventsEndpoint, {
    headers: {
      accept: "text/event-stream",
    },
    signal: controller.signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Unable to subscribe to runtime events at ${eventsEndpoint}.`);
  }

  const requestId = `provider-replay-${replayVariant.variantId}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const ack = await rpc(rpcEndpoint, "code_turn_send", {
    payload: {
      workspaceId,
      threadId,
      requestId,
      content: replayTurn.userPrompt,
      provider: replayVariant.provider ?? null,
      modelId: replayVariant.modelId,
      reasonEffort: replayVariant.reasonEffort ?? null,
      accessMode: replayVariant.recordingAccessMode ?? "on-request",
      executionMode: replayVariant.recordingExecutionMode ?? "runtime",
      queue: false,
      attachments: [],
      collaborationMode: null,
    },
  });

  const turnId =
    typeof ack?.turnId === "string" && ack.turnId.trim().length > 0 ? ack.turnId.trim() : null;
  if (!turnId) {
    controller.abort();
    throw new Error(`Runtime accepted ${replayVariant.variantId} but did not return a turn id.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deltaChunks = [];
  const startedAt = Date.now();

  try {
    while (Date.now() - startedAt < TURN_CAPTURE_TIMEOUT_MS) {
      const readResult = await reader.read();
      if (readResult.done) {
        break;
      }
      buffer += decoder.decode(readResult.value, { stream: true }).replace(/\r\n/g, "\n");
      const parsed = parseSseFrames(buffer);
      buffer = parsed.remaining;
      for (const frame of parsed.frames) {
        const event = parseSsePayload(frame);
        if (!event || typeof event !== "object") {
          continue;
        }
        if (event.kind === "item.agentMessage.delta" && event.payload?.turnId === turnId) {
          const delta =
            typeof event.payload?.delta === "string"
              ? event.payload.delta
              : String(event.payload?.delta ?? "");
          if (delta.length > 0) {
            deltaChunks.push(delta);
          }
          continue;
        }
        if (event.kind === "turn.completed" && event.payload?.turnId === turnId) {
          return {
            status: "completed",
            output:
              typeof event.payload?.output === "string"
                ? event.payload.output
                : deltaChunks.join(""),
            deltaChunks,
            failure: null,
          };
        }
        if (event.kind === "turn.failed" && event.payload?.turnId === turnId) {
          return {
            status: "failed",
            output: "",
            deltaChunks: [],
            failure: {
              code:
                typeof event.payload?.error?.code === "string"
                  ? event.payload.error.code
                  : "TURN_EXECUTION_FAILED",
              message:
                typeof event.payload?.error?.message === "string"
                  ? event.payload.error.message
                  : `Turn ${turnId} failed.`,
            },
          };
        }
      }
    }
  } finally {
    controller.abort();
    reader.releaseLock();
  }

  throw new Error(
    `Timed out while recording ${replayVariant.variantId} at prompt ${replayTurn.userPrompt}`
  );
}

function resolveWorkspace(workspaces, preferredWorkspaceId) {
  const preferred = workspaces.find((entry) => entry?.id === preferredWorkspaceId);
  if (preferred) {
    return preferred;
  }
  const connected = workspaces.find((entry) => entry?.connected !== false);
  if (connected) {
    return connected;
  }
  return workspaces[0] ?? null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveReplayTurnRecordingProfile(sample, replayTurn) {
  const profileId =
    typeof replayTurn?.recordingProfile === "string" &&
    replayTurn.recordingProfile.trim().length > 0
      ? replayTurn.recordingProfile.trim()
      : null;
  if (!profileId) {
    return { id: null, env: {} };
  }
  const profile = sample.governance?.recordingProfiles?.[profileId];
  if (!profile || typeof profile !== "object") {
    throw new Error(`Sample ${sample.sample.id} references missing recordingProfile ${profileId}.`);
  }
  return {
    id: profileId,
    env: normalizeRuntimeEnvOverrides(profile.env),
    httpStub: normalizeRuntimeReplayHttpStub(profile.httpStub),
    strategy:
      typeof profile.strategy === "string" && profile.strategy.trim().length > 0
        ? profile.strategy.trim()
        : "runtime-record",
    failure:
      profile.failure && typeof profile.failure === "object"
        ? {
            class:
              typeof profile.failure.class === "string" && profile.failure.class.trim().length > 0
                ? profile.failure.class.trim()
                : null,
            code:
              typeof profile.failure.code === "string" && profile.failure.code.trim().length > 0
                ? profile.failure.code.trim()
                : "TURN_EXECUTION_FAILED",
            message:
              typeof profile.failure.message === "string" &&
              profile.failure.message.trim().length > 0
                ? profile.failure.message.trim()
                : "Turn failed.",
          }
        : null,
  };
}

function resolveLiveFailureProbe(sample) {
  const probe = sample.governance?.liveFailureProbe;
  if (!probe || typeof probe !== "object") {
    return null;
  }
  const profileId =
    typeof probe.profileId === "string" && probe.profileId.trim().length > 0
      ? probe.profileId.trim()
      : null;
  const turnId =
    typeof probe.turnId === "string" && probe.turnId.trim().length > 0 ? probe.turnId.trim() : null;
  if (!profileId || !turnId) {
    return null;
  }
  const profile = sample.governance?.recordingProfiles?.[profileId];
  if (!profile || typeof profile !== "object") {
    throw new Error(
      `Sample ${sample.sample.id} liveFailureProbe references missing profile ${profileId}.`
    );
  }
  return {
    enabled: probe.enabled !== false,
    attempts:
      typeof probe.attempts === "number" && Number.isFinite(probe.attempts) && probe.attempts > 0
        ? Math.trunc(probe.attempts)
        : 1,
    profileId,
    turnId,
    expectedFailureClasses: Array.isArray(probe.expectedFailureClasses)
      ? probe.expectedFailureClasses.filter(
          (entry) => typeof entry === "string" && entry.trim().length > 0
        )
      : [],
    profile: {
      env: normalizeRuntimeEnvOverrides(profile.env),
      httpStub: normalizeRuntimeReplayHttpStub(profile.httpStub),
      strategy:
        typeof profile.strategy === "string" && profile.strategy.trim().length > 0
          ? profile.strategy.trim()
          : "runtime-record",
    },
  };
}

async function captureLiveFailureProbeAttempt({
  rpcEndpoint,
  workspaceId,
  replayVariant,
  replayTurn,
}) {
  const eventsEndpoint = deriveEventsEndpoint(rpcEndpoint);
  await waitForRuntime(rpcEndpoint, DEFAULT_RUNTIME_READY_TIMEOUT_MS);
  const workspaces = await rpc(rpcEndpoint, "code_workspaces_list", {});
  const workspace = Array.isArray(workspaces) ? resolveWorkspace(workspaces, workspaceId) : null;
  if (!workspace?.id) {
    throw new Error("No runtime workspace is available for live failure probing.");
  }
  const thread = await rpc(rpcEndpoint, "code_thread_create", {
    workspaceId: workspace.id,
    title: `Provider replay live failure probe ${replayVariant.variantId}`,
  });
  const threadId =
    typeof thread?.id === "string" && thread.id.trim().length > 0 ? thread.id.trim() : null;
  if (!threadId) {
    throw new Error(
      `Failed to create a thread for live failure probe of ${replayVariant.variantId}.`
    );
  }
  try {
    return await captureTurn({
      rpcEndpoint,
      eventsEndpoint,
      workspaceId: workspace.id,
      threadId,
      replayVariant,
      replayTurn,
    });
  } finally {
    await rpc(rpcEndpoint, "code_thread_archive", {
      workspaceId: workspace.id,
      threadId,
    }).catch(() => undefined);
  }
}

function writeStdoutLine(message) {
  process.stdout.write(`${message}\n`);
}

function writeStderrLine(message) {
  process.stderr.write(`${message}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.candidateIntake) {
    options.ids.push(
      ...resolveRuntimeReplayIntakeSampleIds({
        intakePath: options.candidateIntake,
        intakeGroup: options.intakeGroup,
      })
    );
  }
  const dataset = loadRuntimeReplayDataset({ manifestPath: options.manifestPath });
  const selectedSamples = selectRuntimeReplaySamples(dataset, options);
  if (selectedSamples.length === 0) {
    throw new Error("No runtime replay samples matched the requested filters.");
  }
  const requiresEphemeralWorkspace = selectedSamples.some(
    (entry) => entry.sample.sample?.scenarioType === "write-safe-minimal"
  );
  if (
    requiresEphemeralWorkspace &&
    (options.useExistingOnly || options.rpcEndpointExplicitlyProvided)
  ) {
    throw new Error(
      "write-safe-minimal samples require an isolated runtime-managed workspace and cannot run with --use-existing-runtime/--rpc-endpoint."
    );
  }
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-replay-workspace-"));

  if (!options.rpcEndpointExplicitlyProvided && !options.useExistingOnly) {
    options.rpcEndpoint = await allocateIsolatedRuntimeEndpoint();
  }

  let runtimeChild = null;
  let activeRuntimeProfileSignature = null;
  let activeRuntimeMaterialization = null;

  try {
    for (const entry of selectedSamples) {
      const sample = entry.sample;
      const previous = clone(sample);
      await applyWorkspaceSetup(workspaceRoot, sample);
      const runtimeOnlyOperation = resolveRuntimeOnlyOperation(sample);
      if (runtimeOnlyOperation) {
        const runtimeOnlyProfileSignature = createRuntimeProfileSignature({
          strategy: "runtime-only",
          env: {},
          httpStub: null,
        });
        if (runtimeChild && activeRuntimeProfileSignature !== runtimeOnlyProfileSignature) {
          await stopRuntimeChild(runtimeChild);
          runtimeChild = null;
          activeRuntimeProfileSignature = null;
          await cleanupRuntimeMaterialization(activeRuntimeMaterialization);
          activeRuntimeMaterialization = null;
          try {
            await waitForRuntimeShutdown(options.rpcEndpoint);
          } catch (error) {
            if (options.useExistingOnly || options.rpcEndpointExplicitlyProvided) {
              throw error;
            }
            const previousRpcEndpoint = options.rpcEndpoint;
            options.rpcEndpoint = await allocateIsolatedRuntimeEndpoint();
            writeStdoutLine(
              `Runtime profile change for ${sample.sample.id} kept ${previousRpcEndpoint} alive; rotating to ${options.rpcEndpoint}.`
            );
          }
        }
        if (!(await isRuntimeHealthy(options.rpcEndpoint))) {
          if (options.useExistingOnly) {
            throw new Error(`Runtime is not healthy at ${options.rpcEndpoint}.`);
          }
          runtimeChild = spawn(process.execPath, [runtimeDevScriptPath], {
            cwd: repoRoot,
            env: buildRuntimeChildEnv(options.rpcEndpoint, {
              CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH: workspaceRoot,
            }),
            stdio: "inherit",
            detached: false,
          });
          activeRuntimeProfileSignature = runtimeOnlyProfileSignature;
        }
        await waitForRuntime(options.rpcEndpoint, DEFAULT_RUNTIME_READY_TIMEOUT_MS);
        const workspaces = await rpc(options.rpcEndpoint, "code_workspaces_list", {});
        const workspace = Array.isArray(workspaces)
          ? resolveWorkspace(workspaces, options.workspaceId)
          : null;
        if (!workspace?.id) {
          throw new Error("No runtime workspace is available for runtime-only replay recording.");
        }
        if (runtimeOnlyOperation.type !== "agent-task-start") {
          throw new Error(
            `Unsupported runtime replay operation ${runtimeOnlyOperation.type} for ${sample.sample.id}.`
          );
        }
        writeStdoutLine(`Recording ${sample.sample.id} via runtime-only agent task start`);
        const payload = { ...runtimeOnlyOperation.payload };
        delete payload.type;
        const startResult = await rpc(options.rpcEndpoint, "code_runtime_run_start", {
          workspaceId: workspace.id,
          ...payload,
        });
        const taskId =
          typeof startResult?.taskId === "string" && startResult.taskId.trim().length > 0
            ? startResult.taskId.trim()
            : null;
        if (!taskId) {
          throw new Error(
            `Runtime-only sample ${sample.sample.id} did not return a taskId from code_runtime_run_start.`
          );
        }
        const latestTask = await waitForRuntimeTask(options.rpcEndpoint, workspace.id, taskId);
        sample.runtimeTruth = buildRuntimeTruthAssertionsFromTask(latestTask, {
          eventReplayReason: "native_state_fabric_updated",
        });
        sample.runtimeTruth.taskFields = [];
        sample.runtimeTruth.review = [];
        const recordedAt = new Date().toISOString();
        sample.sample.recordedAt = recordedAt;
        sample.sample.source = "recorded";
        sample.result.runtimeOperation = {
          type: "agent-task-start",
          method: "code_runtime_run_start",
          taskId,
          recordedAt,
          refreshCommand: [
            "node",
            "scripts/record-runtime-provider-replay.mjs",
            "--id",
            sample.sample.id,
          ].join(" "),
        };
        sample.governance.lastRefreshReason =
          "Re-recorded from the live runtime-only task-start path.";
        writeJson(entry.filePath, sample);
        sample.manifestEntry = updateManifestEntryFromSample(dataset, sample);
        const diffSummary = summarizeReRecordDiff(previous, sample);
        if (diffSummary.length > 0) {
          writeStdoutLine(`Diff ${sample.sample.id}: ${diffSummary.join("; ")}`);
        } else {
          writeStdoutLine(`Diff ${sample.sample.id}: no canonical changes detected.`);
        }
        continue;
      }
      const replayVariant = sample.result.providerReplay;
      for (const [turnIndex, replayTurn] of replayVariant.turns.entries()) {
        if (
          Array.isArray(options.turnIndices) &&
          options.turnIndices.length > 0 &&
          !options.turnIndices.includes(turnIndex + 1)
        ) {
          continue;
        }
        const recordingProfile = resolveReplayTurnRecordingProfile(sample, replayTurn);
        const runtimeProfileSignature = createRuntimeProfileSignature(recordingProfile);
        const usesSyntheticFailure = recordingProfile.strategy === "synthetic-failure";
        const requiresTurnScopedRuntime = recordingProfileRequiresScopedRuntime(recordingProfile);
        if (
          requiresTurnScopedRuntime &&
          (options.useExistingOnly || options.rpcEndpointExplicitlyProvided)
        ) {
          throw new Error(
            `Sample ${sample.sample.id} turn ${turnIndex + 1} requires recordingProfile ${recordingProfile.id}, which is incompatible with --use-existing-runtime/--rpc-endpoint.`
          );
        }
        if (runtimeChild && runtimeProfileSignature !== activeRuntimeProfileSignature) {
          await stopRuntimeChild(runtimeChild);
          runtimeChild = null;
          activeRuntimeProfileSignature = null;
          await cleanupRuntimeMaterialization(activeRuntimeMaterialization);
          activeRuntimeMaterialization = null;
          try {
            await waitForRuntimeShutdown(options.rpcEndpoint);
          } catch (error) {
            if (options.useExistingOnly || options.rpcEndpointExplicitlyProvided) {
              throw error;
            }
            const previousRpcEndpoint = options.rpcEndpoint;
            options.rpcEndpoint = await allocateIsolatedRuntimeEndpoint();
            writeStdoutLine(
              `Runtime profile change for ${sample.sample.id} turn ${turnIndex + 1} kept ${previousRpcEndpoint} alive; rotating to ${options.rpcEndpoint}.`
            );
          }
        }
        if (!usesSyntheticFailure && !(await isRuntimeHealthy(options.rpcEndpoint))) {
          if (options.useExistingOnly) {
            throw new Error(`Runtime is not healthy at ${options.rpcEndpoint}.`);
          }
          const runtimeMaterialization = await materializeRecordingProfileRuntime(recordingProfile);
          runtimeChild = spawn(process.execPath, [runtimeDevScriptPath], {
            cwd: repoRoot,
            env: buildRuntimeChildEnv(options.rpcEndpoint, {
              CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH: workspaceRoot,
              ...runtimeMaterialization.env,
            }),
            stdio: "inherit",
            detached: false,
          });
          activeRuntimeProfileSignature = runtimeProfileSignature;
          activeRuntimeMaterialization = runtimeMaterialization;
        } else if (!usesSyntheticFailure && requiresTurnScopedRuntime) {
          throw new Error(
            `Runtime at ${options.rpcEndpoint} is already running, so recordingProfile ${recordingProfile.id} cannot be applied safely.`
          );
        }

        let workspaceId = "workspace-web";
        let recorded;
        if (usesSyntheticFailure) {
          writeStdoutLine(
            `Recording ${sample.sample.id} turn ${turnIndex + 1} via controlled synthetic failure profile ${recordingProfile.id}`
          );
          if (!recordingProfile.failure) {
            throw new Error(
              `Sample ${sample.sample.id} turn ${turnIndex + 1} synthetic-failure profile ${recordingProfile.id} is missing failure details.`
            );
          }
          recorded = {
            status: "failed",
            output: "",
            deltaChunks: [],
            failure: {
              ...recordingProfile.failure,
            },
          };
        } else {
          await waitForRuntime(options.rpcEndpoint, DEFAULT_RUNTIME_READY_TIMEOUT_MS);
          const workspaces = await rpc(options.rpcEndpoint, "code_workspaces_list", {});
          const workspace = Array.isArray(workspaces)
            ? resolveWorkspace(workspaces, options.workspaceId)
            : null;
          if (!workspace?.id) {
            throw new Error("No runtime workspace is available for provider replay recording.");
          }
          workspaceId = workspace.id;
          const thread = await rpc(options.rpcEndpoint, "code_thread_create", {
            workspaceId: workspace.id,
            title: `Provider replay capture ${sample.sample.id} turn ${turnIndex + 1}`,
          });
          const threadId =
            typeof thread?.id === "string" && thread.id.trim().length > 0 ? thread.id.trim() : null;
          if (!threadId) {
            throw new Error(
              `Failed to create a thread for ${sample.sample.id} turn ${turnIndex + 1}.`
            );
          }

          writeStdoutLine(
            `Recording ${sample.sample.id} turn ${turnIndex + 1} via ${replayVariant.modelId} (${replayVariant.reasonEffort ?? "none"})`
          );
          recorded = await captureTurn({
            rpcEndpoint: options.rpcEndpoint,
            eventsEndpoint: deriveEventsEndpoint(options.rpcEndpoint),
            workspaceId: workspace.id,
            threadId,
            replayVariant,
            replayTurn,
          });

          await rpc(options.rpcEndpoint, "code_thread_archive", {
            workspaceId: workspace.id,
            threadId,
          }).catch(() => undefined);
        }
        if (!usesSyntheticFailure) {
          const tasks = await listRuntimeTasks(options.rpcEndpoint, workspaceId).catch(() => []);
          const latestTask = Array.isArray(tasks) ? selectLatestRuntimeTask(tasks) : null;
          if (latestTask) {
            sample.runtimeTruth = buildRuntimeTruthAssertionsFromTask(latestTask);
          }
        }
        const recordedAt = new Date().toISOString();
        const expectsFailure =
          typeof replayTurn.failure?.message === "string" &&
          replayTurn.failure.message.trim().length > 0;
        if (recorded.status === "failed" && !expectsFailure) {
          throw new Error(
            `Sample ${sample.sample.id} turn ${turnIndex + 1} failed unexpectedly: ${recorded.failure?.message ?? "unknown failure"}`
          );
        }
        if (recorded.status === "completed" && expectsFailure) {
          throw new Error(
            `Sample ${sample.sample.id} turn ${turnIndex + 1} was expected to fail but completed successfully.`
          );
        }
        if (recorded.status === "failed") {
          const observedFailureClass = resolveRuntimeReplayFailureClass(recorded.failure);
          const canonicalFailure = canonicalizeRecordedFailure(
            recordingProfile,
            recorded.failure ?? {}
          );
          const redactedFailureMessage = redactRuntimeReplayText(canonicalFailure?.message ?? "");
          if (!replayTurn.failure) {
            replayTurn.failure = {};
          }
          replayTurn.failure.class =
            resolveRuntimeReplayFailureClass(canonicalFailure) ?? replayTurn.failure.class;
          replayTurn.failure.message = redactedFailureMessage;
          if (
            typeof canonicalFailure?.code === "string" &&
            canonicalFailure.code.trim().length > 0
          ) {
            replayTurn.failure.code = canonicalFailure.code.trim();
          }
          replayTurn.output = null;
          replayTurn.deltaChunks = [];
          if (!replayTurn.provenance || typeof replayTurn.provenance !== "object") {
            replayTurn.provenance = {};
          }
          replayTurn.provenance.observedFailureClass = observedFailureClass;
          replayTurn.provenance.observedFailureCode =
            typeof recorded.failure?.code === "string" && recorded.failure.code.trim().length > 0
              ? recorded.failure.code.trim()
              : null;
          replayTurn.provenance.observedFailureMessage = redactRuntimeReplayText(
            recorded.failure?.message ?? ""
          );
        } else {
          const redactedOutput = redactRuntimeReplayText(recorded.output);
          const redactedChunks = recorded.deltaChunks.map((chunk) =>
            redactRuntimeReplayText(chunk)
          );
          const normalizedReplay = normalizeReplayDeltaChunks(
            replayTurn,
            redactedChunks,
            redactedOutput
          );
          replayTurn.output = redactedOutput;
          replayTurn.deltaChunks = normalizedReplay.deltaChunks;
          delete replayTurn.failure;
        }
        replayTurn.recordedAt = recordedAt;
        replayTurn.provenance = {
          ...(replayTurn.provenance ?? {}),
          source: usesSyntheticFailure ? "controlled-synthetic" : "recorded",
          notes: usesSyntheticFailure
            ? "Controlled synthetic failure injected by the runtime replay recorder to keep the recovery failure class stable."
            : "Recorded from the live runtime/provider path for the runtime-core golden replay set.",
          rpcEndpoint: normalizeRuntimeReplayEndpoint(options.rpcEndpoint),
          workspaceId: normalizeRuntimeReplayWorkspaceId(workspaceId),
          recordedProvider: replayVariant.provider ?? null,
          recordedModelId: replayVariant.modelId,
          recordedReasonEffort: replayVariant.reasonEffort ?? null,
          recordedAccessMode: replayVariant.recordingAccessMode ?? "on-request",
          recordedExecutionMode: replayVariant.recordingExecutionMode ?? "runtime",
          deltaChunkSource:
            recorded.status === "failed"
              ? "none"
              : normalizeReplayDeltaChunks(replayTurn, replayTurn.deltaChunks, replayTurn.output)
                  .deltaChunkSource,
          refreshCommand: [
            "node",
            "scripts/record-runtime-provider-replay.mjs",
            "--id",
            sample.sample.id,
          ].join(" "),
        };
      }

      const latestRecordedAt = replayVariant.turns
        .map((turn) => (typeof turn.recordedAt === "string" ? turn.recordedAt : null))
        .filter((value) => value !== null)
        .sort()
        .at(-1);
      sample.sample.recordedAt = latestRecordedAt ?? sample.sample.recordedAt;
      const turnSources = replayVariant.turns.map((turn) => turn?.provenance?.source ?? "unknown");
      if (turnSources.every((source) => source === "recorded")) {
        sample.sample.source = "recorded";
      } else if (turnSources.some((source) => source === "controlled-synthetic")) {
        sample.sample.source = "mixed";
      }
      const liveFailureProbe = resolveLiveFailureProbe(sample);
      if (liveFailureProbe?.enabled) {
        if (options.useExistingOnly || options.rpcEndpointExplicitlyProvided) {
          throw new Error(
            `Sample ${sample.sample.id} liveFailureProbe requires isolated runtime control and cannot run with --use-existing-runtime/--rpc-endpoint.`
          );
        }
        const probeTurnIndex = sample.input?.turns?.findIndex?.(
          (turn) => turn?.id === liveFailureProbe.turnId
        );
        if (typeof probeTurnIndex !== "number" || probeTurnIndex < 0) {
          throw new Error(
            `Sample ${sample.sample.id} liveFailureProbe turn ${liveFailureProbe.turnId} was not found in input.turns.`
          );
        }
        const replayTurn = replayVariant.turns[probeTurnIndex];
        if (!replayTurn) {
          throw new Error(
            `Sample ${sample.sample.id} liveFailureProbe turn ${liveFailureProbe.turnId} was not found in providerReplay.turns.`
          );
        }

        const observedFailureClasses = [];
        const attemptRecords = [];
        for (let attempt = 0; attempt < liveFailureProbe.attempts; attempt += 1) {
          if (runtimeChild) {
            await stopRuntimeChild(runtimeChild);
            runtimeChild = null;
            activeRuntimeProfileSignature = null;
            await cleanupRuntimeMaterialization(activeRuntimeMaterialization);
            activeRuntimeMaterialization = null;
          }
          const probePort = await resolveAvailablePort(8788, {
            host: "127.0.0.1",
            maxAttempts: 200,
          });
          const probeRpcEndpoint = `http://127.0.0.1:${probePort}/rpc`;
          const runtimeProfileSignature = createRuntimeProfileSignature(
            liveFailureProbe.profile,
            probeRpcEndpoint
          );
          const probeMaterialization = await materializeRecordingProfileRuntime(
            liveFailureProbe.profile
          );
          runtimeChild = spawn(process.execPath, [runtimeDevScriptPath], {
            cwd: repoRoot,
            env: buildRuntimeChildEnv(probeRpcEndpoint, {
              CODE_RUNTIME_SERVICE_DEFAULT_WORKSPACE_PATH: workspaceRoot,
              ...probeMaterialization.env,
            }),
            stdio: "inherit",
            detached: false,
          });
          activeRuntimeProfileSignature = runtimeProfileSignature;
          activeRuntimeMaterialization = probeMaterialization;

          try {
            writeStdoutLine(
              `Probing live failure stability for ${sample.sample.id} attempt ${attempt + 1}/${liveFailureProbe.attempts}`
            );
            const probeResult = await captureLiveFailureProbeAttempt({
              rpcEndpoint: probeRpcEndpoint,
              workspaceId: options.workspaceId,
              replayVariant,
              replayTurn,
            });
            const failureClass = resolveRuntimeReplayFailureClass(probeResult.failure);
            const outcome = probeResult.status === "failed" ? "failed" : "completed";
            attemptRecords.push({
              attempt: attempt + 1,
              outcome,
              failureClass,
            });
            if (failureClass) {
              observedFailureClasses.push(failureClass);
            }
          } finally {
            await stopRuntimeChild(runtimeChild);
            runtimeChild = null;
            activeRuntimeProfileSignature = null;
            await cleanupRuntimeMaterialization(activeRuntimeMaterialization);
            activeRuntimeMaterialization = null;
          }
        }

        const uniqueFailureClasses = [...new Set(observedFailureClasses)];
        const stable =
          uniqueFailureClasses.length === 1 &&
          liveFailureProbe.expectedFailureClasses.length > 0 &&
          uniqueFailureClasses.every((entry) =>
            liveFailureProbe.expectedFailureClasses.includes(entry)
          );
        sample.governance.liveFailureProbe = {
          ...(sample.governance.liveFailureProbe ?? {}),
          profileId: liveFailureProbe.profileId,
          turnId: liveFailureProbe.turnId,
          attempts: liveFailureProbe.attempts,
          expectedFailureClasses: liveFailureProbe.expectedFailureClasses,
          lastRun: {
            recordedAt: new Date().toISOString(),
            attempts: liveFailureProbe.attempts,
            observedFailureClasses: uniqueFailureClasses,
            attemptRecords,
            stable,
            driftObserved: uniqueFailureClasses.length > 1,
          },
        };
        sample.governance.lastLiveFailureClass = uniqueFailureClasses[0] ?? null;
        sample.governance.lastLiveRerecordStable = stable;
        sample.governance.rerecordStability = deriveRuntimeReplayRerecordStability(
          liveFailureProbe.expectedFailureClasses,
          sample.governance.liveFailureProbe.lastRun
        );
      }
      const liveFailureProbeLastRun = sample.governance.liveFailureProbe?.lastRun;
      if (sample.process?.errorRecovery?.expected === true) {
        if (!sample.governance.rerecordStability) {
          sample.governance.rerecordStability = deriveRuntimeReplayRerecordStability(
            sample.process?.errorRecovery?.expectedFailureClasses,
            liveFailureProbeLastRun
          );
        }
      } else {
        delete sample.governance.lastLiveFailureClass;
        delete sample.governance.lastLiveRerecordStable;
        delete sample.governance.rerecordStability;
        delete sample.governance.recoveryQualification;
        delete sample.governance.liveFailureProbe;
      }
      sample.governance.goldenBlockers = deriveRuntimeReplayGovernanceGoldenBlockers(sample);
      sample.governance.goldenBlockerHistory = updateRuntimeReplayGoldenBlockerHistory(
        sample.governance.goldenBlockerHistory,
        sample.governance.goldenBlockers,
        sample.sample.recordedAt
      );
      if (sample.process?.errorRecovery?.expected === true) {
        sample.governance.recoveryQualification =
          summarizeRuntimeReplayRecoveryQualification(sample);
      }
      sample.governance.lastRefreshReason = turnSources.some(
        (source) => source === "controlled-synthetic"
      )
        ? "Refreshed with controlled synthetic failure evidence plus live recorded recovery evidence."
        : "Re-recorded from the live runtime/provider path.";
      writeJson(entry.filePath, sample);
      updateManifestEntryFromSample(dataset, sample);
      const diffSummary = summarizeReRecordDiff(previous, sample);
      if (diffSummary.length > 0) {
        writeStdoutLine(`Diff ${sample.sample.id}: ${diffSummary.join("; ")}`);
      } else {
        writeStdoutLine(`Diff ${sample.sample.id}: no canonical changes detected.`);
      }
    }

    writeJson(dataset.manifestPath, dataset.manifest);
    const validation = validateRuntimeReplayDataset(dataset, {
      requireRecorded: options.requireRecorded,
      requireCoverageMatrixSatisfaction: true,
    });
    if (validation.errors.length > 0) {
      throw new Error(validation.errors.join("\n"));
    }
    for (const warning of validation.warnings) {
      writeStdoutLine(`warning: ${warning}`);
    }

    if (options.emitCompiledFixture) {
      const compiled = compileRuntimeReplayFixture(dataset, selectedSamples);
      const outputPath = path.isAbsolute(options.emitCompiledFixture)
        ? options.emitCompiledFixture
        : path.resolve(repoRoot, options.emitCompiledFixture);
      writeJson(outputPath, compiled);
      writeStdoutLine(`Compiled replay fixture: ${outputPath}`);
    }

    writeStdoutLine(`Updated replay dataset: ${dataset.manifestPath}`);
  } finally {
    await stopRuntimeChild(runtimeChild);
    await cleanupRuntimeMaterialization(activeRuntimeMaterialization);
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  await main().catch((error) => {
    writeStderrLine(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
