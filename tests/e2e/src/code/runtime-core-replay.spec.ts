import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  assertPageResponsive,
  isRuntimeGatewayReady,
  expectComposerControlValue,
  queueComposerPrompt,
  selectComposerOption,
  sendComposerPrompt,
  waitForCurrentTurnState,
  waitForMessageText,
  waitForThreadHistoryReady,
  waitForWorkspaceShell,
} from "./helpers";

type SelectionAction =
  | {
      type: "select-option";
      control: "Agent access" | "Model" | "Thinking mode" | "Execution path";
      value: string;
    }
  | {
      type: "send-prompt";
      promptMode?: "new" | "append";
      promptTurnId: string;
    }
  | {
      type: "queue-prompt";
      promptTurnId: string;
    }
  | {
      type: "rpc-agent-task-start";
    }
  | {
      type: "wait-message";
      text: string;
      timeoutMs?: number;
    }
  | {
      type: "wait-turn-state";
      state: "failed" | "complete" | "working" | "idle" | "no-visible-response";
      timeoutMs?: number;
    };

type SelectionAssertion =
  | {
      type: "wait-message";
      text: string;
      timeoutMs?: number;
    }
  | {
      type: "wait-turn-state";
      state: "failed" | "complete" | "working" | "idle" | "no-visible-response";
      timeoutMs?: number;
    }
  | {
      type: "workspace-file-contains";
      relativePath: string;
      text: string;
      timeoutMs?: number;
    }
  | {
      type: "workspace-file-missing";
      relativePath: string;
      timeoutMs?: number;
    }
  | {
      type: "assert-composer-option";
      control: "Agent access" | "Model" | "Thinking mode" | "Execution path";
      value: string;
      timeoutMs?: number;
    }
  | {
      type: "wait-runtime-task-field";
      fieldPath: string;
      matcher?: "present" | "absent" | "equals" | "includes";
      expected?: string | number | boolean | null;
      timeoutMs?: number;
    }
  | {
      type: "wait-runtime-summary";
      fieldPath: string;
      matcher?: "present" | "absent" | "equals" | "includes";
      expected?: string | number | boolean | null;
      source?: "agent-task" | "diagnostics-export";
      canonicalSectionPath?: string;
      timeoutMs?: number;
    }
  | {
      type: "assert-runtime-actionability";
      expectedState?: string;
      summaryMatcher?: "present" | "absent";
      minimumActionCount?: number;
      timeoutMs?: number;
    }
  | {
      type: "assert-autodrive-trace";
      decisionTraceMatcher?: "present" | "absent";
      runtimeScenarioProfileMatcher?: "present" | "absent";
      repoEvaluationProfileMatcher?: "present" | "absent";
      outcomeFeedbackMatcher?: "present" | "absent";
      autonomyStateMatcher?: "present" | "absent";
      timeoutMs?: number;
    }
  | {
      type: "assert-replay-gap-event";
      text?: string;
      messageText?: string;
      expectedReason?: string;
      timeoutMs?: number;
    }
  | {
      type: "assert-review-pack-linkage";
      uiText: string;
      taskFieldPath: string;
      canonicalSource?: "agent-task" | "diagnostics-export";
      canonicalSectionPath?: string;
      canonicalFieldPath?: string;
      timeoutMs?: number;
    };

type RuntimeReplaySample = {
  sample: {
    id: string;
  };
  input: {
    runtimeConfig?: {
      accessMode?: "read-only" | "on-request" | "full-access";
      executionMode?: "runtime" | "local-cli" | "hybrid";
    };
    workspaceSetup?: {
      files?: Array<{
        relativePath: string;
        content: string;
      }>;
    };
    runtimeOperation?: {
      type: "agent-task-start";
      title?: string;
      taskSource?: Record<string, unknown> | null;
      autoDrive?: Record<string, unknown> | null;
      steps: Array<Record<string, unknown>>;
    };
    turns: Array<{
      id: string;
      prompt: string;
    }>;
  };
  process: {
    harness: {
      runner: string;
      testName: string;
      timeoutMs?: number;
      workspaceId: string;
      actions: SelectionAction[];
      assertions: SelectionAssertion[];
    };
  };
};

type RuntimeAgentTaskSummary = {
  taskId?: string;
  updatedAt?: number;
  checkpointId?: string | null;
  traceId?: string | null;
  publishHandoff?: unknown;
  missionLinkage?: {
    recoveryPath?: string | null;
    summary?: string | null;
  } | null;
  reviewActionability?: {
    state?: string | null;
    summary?: string | null;
    actions?: Array<unknown> | null;
  } | null;
  takeoverBundle?: {
    pathKind?: string | null;
    summary?: string | null;
  } | null;
  autoDrive?: Record<string, unknown> | null;
};

type RuntimeDiagnosticsExportResponse = {
  filename?: string;
  zipBase64?: string | null;
};

type RuntimeAssertionContext = {
  page: Page;
  workspaceId: string;
  trackedTaskId?: string;
  diagnosticsSectionCache: Map<string, unknown>;
  diagnosticsArchiveDir?: string;
  diagnosticsArchivePath?: string;
};

function loadSelection(selectionPath: string): RuntimeReplaySample[] {
  const selection = JSON.parse(fs.readFileSync(selectionPath, "utf8"));
  return (Array.isArray(selection?.samples) ? selection.samples : []).filter(
    (entry) => entry?.process?.harness?.runner === "runtime-core-playwright"
  );
}

function resolveTurnPrompt(sample: RuntimeReplaySample, promptTurnId: string) {
  const turn = sample.input.turns.find((entry) => entry.id === promptTurnId);
  if (!turn) {
    throw new Error(`Sample ${sample.sample.id} is missing turn ${promptTurnId}.`);
  }
  return turn.prompt;
}

function resolveRuntimeReplayWorkspaceFile(relativePath: string) {
  const workspaceRoot = process.env.CODE_RUNTIME_REPLAY_WORKSPACE_ROOT?.trim();
  if (!workspaceRoot) {
    throw new Error(
      "CODE_RUNTIME_REPLAY_WORKSPACE_ROOT is required for workspace-file assertions."
    );
  }
  return path.join(workspaceRoot, relativePath);
}

function resolveRuntimeReplayWorkspaceRoot() {
  const workspaceRoot = process.env.CODE_RUNTIME_REPLAY_WORKSPACE_ROOT?.trim();
  if (!workspaceRoot) {
    throw new Error("CODE_RUNTIME_REPLAY_WORKSPACE_ROOT is required for runtime replay setup.");
  }
  return workspaceRoot;
}

function resolveRuntimeReplayRpcEndpoint() {
  const explicitEndpoint =
    process.env.CODE_RUNTIME_REPLAY_RPC_ENDPOINT?.trim() ??
    process.env.VITE_CODE_RUNTIME_GATEWAY_WEB_ENDPOINT?.trim();
  return explicitEndpoint || "http://127.0.0.1:8788/rpc";
}

async function runtimeRpcRequest<T>(
  request: APIRequestContext,
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  const response = await request.post(resolveRuntimeReplayRpcEndpoint(), {
    timeout: 10_000,
    data: {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    },
  });
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as {
    ok?: boolean;
    result?: T;
    error?: { message?: string };
  };
  expect(payload.ok).toBe(true);
  return payload.result as T;
}

async function listRuntimeTasks(
  request: APIRequestContext,
  workspaceId: string
): Promise<RuntimeAgentTaskSummary[]> {
  return await runtimeRpcRequest<RuntimeAgentTaskSummary[]>(request, "code_runtime_runs_list", {
    workspaceId,
    limit: 32,
  });
}

function selectLatestRuntimeTask(tasks: RuntimeAgentTaskSummary[]): RuntimeAgentTaskSummary | null {
  return (
    [...tasks].sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0)).at(0) ?? null
  );
}

function selectContextRuntimeTask(
  tasks: RuntimeAgentTaskSummary[],
  trackedTaskId?: string
): RuntimeAgentTaskSummary | null {
  if (trackedTaskId) {
    const trackedTask = tasks.find((task) => task.taskId === trackedTaskId);
    if (trackedTask) {
      return trackedTask;
    }
  }
  return selectLatestRuntimeTask(tasks);
}

function readObjectPath(value: unknown, pathExpression: string): unknown {
  if (!pathExpression.trim()) {
    return value;
  }
  return pathExpression.split(".").reduce((current, segment) => {
    if (!segment) {
      return current;
    }
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function runtimeMatcherPasses(
  value: unknown,
  matcher: "present" | "absent" | "equals" | "includes" = "present",
  expected?: string | number | boolean | null
): boolean {
  if (matcher === "present") {
    return value !== null && value !== undefined && !(typeof value === "string" && !value.trim());
  }
  if (matcher === "absent") {
    return value === null || value === undefined || (typeof value === "string" && !value.trim());
  }
  if (matcher === "equals") {
    return JSON.stringify(value) === JSON.stringify(expected);
  }
  if (matcher === "includes") {
    if (typeof value === "string") {
      return value.includes(String(expected ?? ""));
    }
    if (Array.isArray(value)) {
      return value.includes(expected);
    }
    return false;
  }
  return false;
}

async function pollLatestRuntimeTask(
  context: RuntimeAssertionContext,
  predicate: (task: RuntimeAgentTaskSummary) => boolean | Promise<boolean>,
  timeoutMs = 20_000
): Promise<RuntimeAgentTaskSummary> {
  let matchedTask: RuntimeAgentTaskSummary | null = null;
  await expect
    .poll(
      async () => {
        const latestTask = selectContextRuntimeTask(
          await listRuntimeTasks(context.page.request, context.workspaceId),
          context.trackedTaskId
        );
        if (!latestTask) {
          return false;
        }
        if (!(await predicate(latestTask))) {
          return false;
        }
        matchedTask = latestTask;
        return true;
      },
      { timeout: timeoutMs }
    )
    .toBe(true);
  if (!matchedTask) {
    throw new Error(`Runtime task predicate did not match within ${timeoutMs}ms.`);
  }
  return matchedTask;
}

async function loadDiagnosticsSection(
  context: RuntimeAssertionContext,
  sectionPath: string
): Promise<unknown> {
  if (context.diagnosticsSectionCache.has(sectionPath)) {
    return context.diagnosticsSectionCache.get(sectionPath);
  }
  if (!context.diagnosticsArchivePath) {
    const exported = await runtimeRpcRequest<RuntimeDiagnosticsExportResponse>(
      context.page.request,
      "code_runtime_diagnostics_export_v1",
      {
        workspaceId: context.workspaceId,
        redactionLevel: "minimal",
        includeTaskSummaries: false,
        includeEventTail: true,
        includeZipBase64: true,
      }
    );
    if (typeof exported.zipBase64 !== "string" || exported.zipBase64.trim().length === 0) {
      throw new Error("Runtime diagnostics export did not include zipBase64.");
    }
    context.diagnosticsArchiveDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "runtime-replay-diagnostics-")
    );
    context.diagnosticsArchivePath = path.join(
      context.diagnosticsArchiveDir,
      exported.filename ?? "runtime-diagnostics.zip"
    );
    fs.writeFileSync(context.diagnosticsArchivePath, Buffer.from(exported.zipBase64, "base64"));
  }

  const rawJson = execFileSync("unzip", ["-p", context.diagnosticsArchivePath, sectionPath], {
    encoding: "utf8",
  });
  const parsed = JSON.parse(rawJson);
  context.diagnosticsSectionCache.set(sectionPath, parsed);
  return parsed;
}

function selectDiagnosticsEntry(sectionPayload: unknown, taskId: string | undefined): unknown {
  if (!Array.isArray(sectionPayload)) {
    return sectionPayload;
  }
  if (typeof taskId === "string" && taskId.trim().length > 0) {
    return (
      sectionPayload.find(
        (entry) =>
          entry && typeof entry === "object" && (entry as { taskId?: string }).taskId === taskId
      ) ??
      sectionPayload.at(-1) ??
      null
    );
  }
  return sectionPayload.at(-1) ?? null;
}

async function gotoRuntimeReplayWorkspace(page: Page, workspaceId: string) {
  await page.goto(`/workspaces/${workspaceId}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(page).toHaveURL(new RegExp(`/workspaces/${workspaceId}(?:\\?|$)`));
  expect(await waitForWorkspaceShell(page, 20_000)).toBe(true);
  await assertPageResponsive(page);
}

function normalizeWorkspaceSetupFiles(sample: RuntimeReplaySample) {
  return Array.isArray(sample.input.workspaceSetup?.files)
    ? sample.input.workspaceSetup.files.filter(
        (entry) =>
          typeof entry?.relativePath === "string" &&
          entry.relativePath.trim().length > 0 &&
          typeof entry?.content === "string"
      )
    : [];
}

async function applyRuntimeReplayWorkspaceSetup(sample: RuntimeReplaySample) {
  const workspaceRoot = resolveRuntimeReplayWorkspaceRoot();
  for (const file of normalizeWorkspaceSetupFiles(sample)) {
    const targetPath = path.join(workspaceRoot, file.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, file.content, "utf8");
  }
}

function hasExplicitSelectAction(
  sample: RuntimeReplaySample,
  control: "Agent access" | "Execution path"
) {
  return sample.process.harness.actions.some(
    (action) => action.type === "select-option" && action.control === control
  );
}

function resolveAccessModeLabel(
  accessMode: NonNullable<RuntimeReplaySample["input"]["runtimeConfig"]>["accessMode"]
) {
  if (accessMode === "read-only") {
    return "Read only";
  }
  if (accessMode === "on-request") {
    return "On-request";
  }
  return "Full access";
}

function resolveExecutionModeLabel(
  executionMode: NonNullable<RuntimeReplaySample["input"]["runtimeConfig"]>["executionMode"]
) {
  if (executionMode === "runtime") {
    return "Runtime";
  }
  if (executionMode === "hybrid") {
    return "Hybrid";
  }
  return "Local Codex CLI";
}

async function applyRuntimeReplayDefaults(sample: RuntimeReplaySample, page: Page) {
  const runtimeConfig = sample.input.runtimeConfig;
  if (!runtimeConfig) {
    return;
  }
  if (runtimeConfig.accessMode && !hasExplicitSelectAction(sample, "Agent access")) {
    await selectComposerOption(
      page,
      "Agent access",
      resolveAccessModeLabel(runtimeConfig.accessMode)
    );
  }
  if (runtimeConfig.executionMode && !hasExplicitSelectAction(sample, "Execution path")) {
    await selectComposerOption(
      page,
      "Execution path",
      resolveExecutionModeLabel(runtimeConfig.executionMode)
    );
  }
}

async function runAction(
  context: RuntimeAssertionContext,
  sample: RuntimeReplaySample,
  page: Page,
  action: SelectionAction
) {
  if (action.type === "select-option") {
    await selectComposerOption(page, action.control, action.value);
    return;
  }
  if (action.type === "send-prompt") {
    const prompt = resolveTurnPrompt(sample, action.promptTurnId);
    const composedPrompt = action.promptMode === "append" ? prompt : `/new ${prompt}`;
    await sendComposerPrompt(page, composedPrompt);
    return;
  }
  if (action.type === "queue-prompt") {
    await queueComposerPrompt(page, resolveTurnPrompt(sample, action.promptTurnId));
    return;
  }
  if (action.type === "rpc-agent-task-start") {
    const runtimeOperation = sample.input.runtimeOperation;
    if (!runtimeOperation || runtimeOperation.type !== "agent-task-start") {
      throw new Error(`Sample ${sample.sample.id} is missing input.runtimeOperation.`);
    }
    const startResult = await runtimeRpcRequest<{ taskId?: string }>(
      page.request,
      "code_runtime_run_start",
      {
        workspaceId: sample.process.harness.workspaceId,
        ...(runtimeOperation.title ? { title: runtimeOperation.title } : {}),
        ...(runtimeOperation.taskSource ? { taskSource: runtimeOperation.taskSource } : {}),
        ...(runtimeOperation.autoDrive ? { autoDrive: runtimeOperation.autoDrive } : {}),
        steps: runtimeOperation.steps,
      }
    );
    if (typeof startResult?.taskId === "string" && startResult.taskId.trim().length > 0) {
      context.trackedTaskId = startResult.taskId.trim();
    }
    return;
  }
  if (action.type === "wait-message") {
    await waitForMessageText(page, action.text, action.timeoutMs);
    return;
  }
  if (action.type === "wait-turn-state") {
    await waitForCurrentTurnState(page, action.state, action.timeoutMs);
  }
}

async function runAssertion(context: RuntimeAssertionContext, assertion: SelectionAssertion) {
  const { page } = context;
  if (assertion.type === "wait-message") {
    await waitForMessageText(page, assertion.text, assertion.timeoutMs);
    return;
  }
  if (assertion.type === "wait-turn-state") {
    await waitForCurrentTurnState(page, assertion.state, assertion.timeoutMs);
    return;
  }
  if (assertion.type === "workspace-file-contains") {
    const absolutePath = resolveRuntimeReplayWorkspaceFile(assertion.relativePath);
    await expect
      .poll(() => (fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null), {
        timeout: assertion.timeoutMs ?? 20_000,
      })
      .toContain(assertion.text);
    return;
  }
  if (assertion.type === "workspace-file-missing") {
    const absolutePath = resolveRuntimeReplayWorkspaceFile(assertion.relativePath);
    await expect
      .poll(() => fs.existsSync(absolutePath), { timeout: assertion.timeoutMs ?? 20_000 })
      .toBe(false);
    return;
  }
  if (assertion.type === "assert-composer-option") {
    await expectComposerControlValue(
      page,
      assertion.control,
      assertion.value,
      assertion.timeoutMs ?? 20_000
    );
    return;
  }
  if (assertion.type === "wait-runtime-task-field") {
    await pollLatestRuntimeTask(
      context,
      (task) =>
        runtimeMatcherPasses(
          readObjectPath(task, assertion.fieldPath),
          assertion.matcher,
          assertion.expected
        ),
      assertion.timeoutMs
    );
    return;
  }
  if (assertion.type === "wait-runtime-summary") {
    if (assertion.source === "diagnostics-export" && assertion.canonicalSectionPath) {
      await pollLatestRuntimeTask(
        context,
        async () => {
          const latestTask = selectContextRuntimeTask(
            await listRuntimeTasks(context.page.request, context.workspaceId),
            context.trackedTaskId
          );
          const sectionPayload = await loadDiagnosticsSection(
            context,
            assertion.canonicalSectionPath
          );
          const sectionEntry = selectDiagnosticsEntry(sectionPayload, latestTask?.taskId);
          return runtimeMatcherPasses(
            readObjectPath(sectionEntry, assertion.fieldPath),
            assertion.matcher,
            assertion.expected
          );
        },
        assertion.timeoutMs
      );
      return;
    }
    await pollLatestRuntimeTask(
      context,
      (task) =>
        runtimeMatcherPasses(
          readObjectPath(task, assertion.fieldPath),
          assertion.matcher,
          assertion.expected
        ),
      assertion.timeoutMs
    );
    return;
  }
  if (assertion.type === "assert-runtime-actionability") {
    await pollLatestRuntimeTask(
      context,
      (task) => {
        const reviewActionability = task.reviewActionability ?? null;
        if (!reviewActionability) {
          return false;
        }
        if (assertion.expectedState && reviewActionability.state !== assertion.expectedState) {
          return false;
        }
        if (
          assertion.summaryMatcher &&
          !runtimeMatcherPasses(reviewActionability.summary, assertion.summaryMatcher)
        ) {
          return false;
        }
        if (
          typeof assertion.minimumActionCount === "number" &&
          (reviewActionability.actions?.length ?? 0) < assertion.minimumActionCount
        ) {
          return false;
        }
        return true;
      },
      assertion.timeoutMs
    );
    return;
  }
  if (assertion.type === "assert-autodrive-trace") {
    await pollLatestRuntimeTask(
      context,
      (task) => {
        const autoDrive = task.autoDrive ?? null;
        if (!autoDrive) {
          return (
            assertion.decisionTraceMatcher === "absent" &&
            assertion.runtimeScenarioProfileMatcher === "absent" &&
            assertion.repoEvaluationProfileMatcher === "absent" &&
            assertion.outcomeFeedbackMatcher === "absent" &&
            assertion.autonomyStateMatcher === "absent"
          );
        }
        return (
          (!assertion.decisionTraceMatcher ||
            runtimeMatcherPasses(autoDrive.decisionTrace, assertion.decisionTraceMatcher)) &&
          (!assertion.runtimeScenarioProfileMatcher ||
            runtimeMatcherPasses(
              autoDrive.runtimeScenarioProfile ?? autoDrive.scenarioProfile,
              assertion.runtimeScenarioProfileMatcher
            )) &&
          (!assertion.repoEvaluationProfileMatcher ||
            runtimeMatcherPasses(
              autoDrive.repoEvaluationProfile,
              assertion.repoEvaluationProfileMatcher
            )) &&
          (!assertion.outcomeFeedbackMatcher ||
            runtimeMatcherPasses(autoDrive.outcomeFeedback, assertion.outcomeFeedbackMatcher)) &&
          (!assertion.autonomyStateMatcher ||
            runtimeMatcherPasses(autoDrive.autonomyState, assertion.autonomyStateMatcher))
        );
      },
      assertion.timeoutMs
    );
    return;
  }
  if (assertion.type === "assert-replay-gap-event") {
    const expectedText = assertion.text ?? assertion.messageText ?? null;
    if (expectedText) {
      await expect(page.getByText(expectedText, { exact: false }).last()).toBeVisible({
        timeout: assertion.timeoutMs ?? 20_000,
      });
      return;
    }
    const expectedReason = assertion.expectedReason ?? "runtime.updated";
    await expect
      .poll(
        async () => {
          const runtimeDiagnostics = (await loadDiagnosticsSection(
            context,
            "runtime/runtime-diagnostics.json"
          )) as { eventTail?: { recentKinds?: string[] } };
          return runtimeDiagnostics?.eventTail?.recentKinds ?? [];
        },
        { timeout: assertion.timeoutMs ?? 20_000 }
      )
      .toContain(expectedReason);
    return;
  }
  if (assertion.type === "assert-review-pack-linkage") {
    const latestTask = await pollLatestRuntimeTask(
      context,
      (task) => runtimeMatcherPasses(readObjectPath(task, assertion.taskFieldPath), "present"),
      assertion.timeoutMs
    );
    const taskValue = readObjectPath(latestTask, assertion.taskFieldPath);
    const visibleText = `${assertion.uiText} ${String(taskValue)}`;
    await expect(page.getByText(visibleText, { exact: false }).last()).toBeVisible({
      timeout: assertion.timeoutMs ?? 20_000,
    });
    if (assertion.canonicalSource === "diagnostics-export" && assertion.canonicalSectionPath) {
      const diagnosticsPayload = await loadDiagnosticsSection(
        context,
        assertion.canonicalSectionPath
      );
      const diagnosticsEntry = selectDiagnosticsEntry(diagnosticsPayload, latestTask.taskId);
      expect(
        readObjectPath(diagnosticsEntry, assertion.canonicalFieldPath ?? assertion.taskFieldPath)
      ).toEqual(taskValue);
    } else {
      expect(
        readObjectPath(latestTask, assertion.canonicalFieldPath ?? assertion.taskFieldPath)
      ).toEqual(taskValue);
    }
  }
}

const runtimeReplaySelectionPath = process.env.CODE_RUNTIME_REPLAY_SELECTION_FILE?.trim() ?? "";
const samples = runtimeReplaySelectionPath ? loadSelection(runtimeReplaySelectionPath) : [];

test.describe.configure({ mode: "serial" });
test.skip(
  !runtimeReplaySelectionPath,
  "CODE_RUNTIME_REPLAY_SELECTION_FILE is required for runtime replay E2E."
);

for (const sample of samples) {
  test(sample.process.harness.testName, async ({ page }) => {
    if (typeof sample.process.harness.timeoutMs === "number") {
      test.setTimeout(sample.process.harness.timeoutMs);
    }
    await expect
      .poll(async () => await isRuntimeGatewayReady(page.request), {
        timeout: 30_000,
        message: "Runtime gateway must be ready before runtime replay execution begins.",
      })
      .toBe(true);
    await gotoRuntimeReplayWorkspace(page, sample.process.harness.workspaceId);
    await waitForThreadHistoryReady(page, { timeoutMs: 20_000 });
    await applyRuntimeReplayWorkspaceSetup(sample);
    await applyRuntimeReplayDefaults(sample, page);
    const assertionContext: RuntimeAssertionContext = {
      page,
      workspaceId: sample.process.harness.workspaceId,
      trackedTaskId: undefined,
      diagnosticsSectionCache: new Map(),
    };

    try {
      for (const action of sample.process.harness.actions) {
        await runAction(assertionContext, sample, page, action);
      }
      for (const assertion of sample.process.harness.assertions) {
        await runAssertion(assertionContext, assertion);
      }
    } finally {
      if (assertionContext.diagnosticsArchiveDir) {
        fs.rmSync(assertionContext.diagnosticsArchiveDir, { recursive: true, force: true });
      }
    }
  });
}
