import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../../design-system";
import {
  buildRuntimeExecutionReliability,
  DEFAULT_RUNTIME_EXECUTION_SUCCESS_MIN_RATE,
} from "../../../application/runtime/facades/runtimeExecutionReliability";
import {
  callWebMcpTool,
  createWebMcpMessage,
  elicitWebMcpInput,
  getWebMcpCapabilities,
  invalidateCachedRuntimeLiveSkills,
  listWebMcpCatalog,
} from "../../../application/runtime/ports/webMcpBridge";
import type {
  WebMcpCatalog,
  WebMcpCreateMessageInput,
  WebMcpElicitInput,
} from "../../../application/runtime/types/webMcpBridge";
import { resolveWebMcpErrorMessage } from "../../../application/runtime/ports/webMcpInputSchemaValidationError";
import {
  WEB_MCP_CREATE_MESSAGE_INPUT_SCHEMA,
  WEB_MCP_ELICIT_INPUT_SCHEMA,
} from "../../../application/runtime/ports/webMcpModelInputSchemas";
import {
  type SchemaValidationResult,
  validateToolInputAgainstSchema,
} from "../../../application/runtime/ports/webMcpToolInputSchemaValidation";
import {
  appendRuntimeOperatorTranscriptItem,
  hydrateRuntimeOperatorTranscript,
  normalizeWebMcpConsoleTranscriptItem,
  type NormalizeWebMcpConsoleTranscriptItemInput,
  type RuntimeOperatorTranscriptItem,
} from "../../../application/runtime/facades/runtimeOperatorTranscript";
import { joinClassNames } from "../../../utils/classNames";
import {
  type WebMcpHistoryActionFilter,
  type WebMcpHistoryCallerProviderFilter,
  type WebMcpHistoryCallerSourceFilter,
  type WebMcpHistoryStatusFilter,
  WorkspaceHomeAgentWebMcpConsoleHistorySection,
} from "./WorkspaceHomeAgentWebMcpConsoleHistorySection";
import {
  buildSchemaTemplate,
  type CatalogView,
  DEFAULT_CREATE_MESSAGE_DRAFT,
  DEFAULT_ELICIT_INPUT_DRAFT,
  DEFAULT_TOOL_ARGUMENTS_DRAFT,
  EMPTY_SCHEMA_VALIDATION_RESULT,
  type ExecutionAction,
  extractRuntimeErrorCode,
  extractRuntimeToolExecutionDiagnosticsPayload,
  extractRuntimeGuardrailEffectiveLimits,
  extractRuntimeToolExecutionMetricsSnapshot,
  extractSchemaValidationFromError,
  formatSuccessRate,
  getActionLabel,
  getCapabilityStatus,
  getToolInputSchema,
  getToolName,
  maybeConfirmExecution,
  mergeSchemaValidationResults,
  parseJsonError,
  parseJsonObject,
  RUNTIME_METRICS_UNAVAILABLE_CODE,
  type RuntimeToolExecutionMetricsSnapshot,
  resolveCatalogEntries,
  resolveExecutionFixHints,
  resolveToolExecutionDryRun,
  selectCatalogLabel,
  stringifyJson,
  summarizeResult,
  summarizeRuntimeToolExecutionMetrics,
} from "./WorkspaceHomeAgentWebMcpConsoleSection.helpers";
import * as controlStyles from "./WorkspaceHomeAgentControl.styles.css";
import { WorkspaceHomeAgentWebMcpConsoleToolCallCard } from "./WorkspaceHomeAgentWebMcpConsoleToolCallCard";

type WorkspaceHomeAgentWebMcpConsoleSectionProps = {
  webMcpSupported: boolean;
  webMcpEnabled: boolean;
  autoExecuteCalls: boolean;
  onSetAutoExecuteCalls: (value: boolean) => void;
  mode: "basic" | "advanced";
  onSetMode: (mode: "basic" | "advanced") => void;
  controlsLocked?: boolean;
};

export function WorkspaceHomeAgentWebMcpConsoleSection({
  webMcpSupported,
  webMcpEnabled,
  autoExecuteCalls,
  onSetAutoExecuteCalls,
  mode,
  onSetMode,
  controlsLocked = false,
}: WorkspaceHomeAgentWebMcpConsoleSectionProps) {
  const [catalog, setCatalog] = useState<WebMcpCatalog | null>(null);
  const [catalogView, setCatalogView] = useState<CatalogView>("tools");
  const [catalogFilter, setCatalogFilter] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedToolName, setSelectedToolName] = useState("");
  const [toolArgumentsDraft, setToolArgumentsDraft] = useState(DEFAULT_TOOL_ARGUMENTS_DRAFT);
  const [createMessageDraft, setCreateMessageDraft] = useState(DEFAULT_CREATE_MESSAGE_DRAFT);
  const [elicitInputDraft, setElicitInputDraft] = useState(DEFAULT_ELICIT_INPUT_DRAFT);

  const [executionLoading, setExecutionLoading] = useState(false);
  const [activeExecution, setActiveExecution] = useState<ExecutionAction | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executionNote, setExecutionNote] = useState<string | null>(null);
  const [executionFixHints, setExecutionFixHints] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<string>("No calls executed yet.");
  const [executionHistory, setExecutionHistory] = useState<RuntimeOperatorTranscriptItem[]>([]);
  const [historyActionFilter, setHistoryActionFilter] = useState<WebMcpHistoryActionFilter>("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<WebMcpHistoryStatusFilter>("all");
  const [historyCallerSourceFilter, setHistoryCallerSourceFilter] =
    useState<WebMcpHistoryCallerSourceFilter>("all");
  const [historyCallerProviderFilter, setHistoryCallerProviderFilter] =
    useState<WebMcpHistoryCallerProviderFilter>("all");
  const [bridgeToolSchemaValidation, setBridgeToolSchemaValidation] =
    useState<SchemaValidationResult>(EMPTY_SCHEMA_VALIDATION_RESULT);
  const [bridgeCreateMessageSchemaValidation, setBridgeCreateMessageSchemaValidation] =
    useState<SchemaValidationResult>(EMPTY_SCHEMA_VALIDATION_RESULT);
  const [bridgeElicitInputSchemaValidation, setBridgeElicitInputSchemaValidation] =
    useState<SchemaValidationResult>(EMPTY_SCHEMA_VALIDATION_RESULT);
  const [runtimeMetricsSnapshot, setRuntimeMetricsSnapshot] =
    useState<RuntimeToolExecutionMetricsSnapshot | null>(null);
  const [runtimeExecutionDiagnosticsPayload, setRuntimeExecutionDiagnosticsPayload] = useState<{
    metrics: unknown;
    guardrails: unknown;
  } | null>(null);
  const [runtimeMetricsError, setRuntimeMetricsError] = useState<string | null>(null);
  const [runtimeMetricsLoading, setRuntimeMetricsLoading] = useState(false);
  const [runtimeMetricsChannelUnavailable, setRuntimeMetricsChannelUnavailable] = useState(false);

  const capabilitySnapshot = useMemo(
    () => catalog?.capabilities ?? getWebMcpCapabilities(),
    [catalog]
  );

  const toolArgumentsError = useMemo(
    () => parseJsonError(toolArgumentsDraft),
    [toolArgumentsDraft]
  );
  const createMessageError = useMemo(
    () => parseJsonError(createMessageDraft),
    [createMessageDraft]
  );
  const elicitInputError = useMemo(() => parseJsonError(elicitInputDraft), [elicitInputDraft]);

  const toolNames = useMemo(() => {
    if (!catalog) {
      return [] as string[];
    }
    return catalog.tools
      .map((entry) => getToolName(entry))
      .filter((name): name is string => name !== null);
  }, [catalog]);

  const selectedTool = useMemo(() => {
    if (!catalog) {
      return null;
    }
    return catalog.tools.find((entry) => getToolName(entry) === selectedToolName) ?? null;
  }, [catalog, selectedToolName]);

  const selectedToolSchema = useMemo(() => getToolInputSchema(selectedTool), [selectedTool]);

  const localToolSchemaValidation = useMemo<SchemaValidationResult>(() => {
    if (toolArgumentsError || !selectedToolSchema) {
      return EMPTY_SCHEMA_VALIDATION_RESULT;
    }
    try {
      const payload = parseJsonObject(toolArgumentsDraft);
      return validateToolInputAgainstSchema(payload, selectedToolSchema);
    } catch {
      return EMPTY_SCHEMA_VALIDATION_RESULT;
    }
  }, [selectedToolSchema, toolArgumentsDraft, toolArgumentsError]);

  const toolSchemaValidation = useMemo<SchemaValidationResult>(
    () => mergeSchemaValidationResults(localToolSchemaValidation, bridgeToolSchemaValidation),
    [localToolSchemaValidation, bridgeToolSchemaValidation]
  );

  const localCreateMessageSchemaValidation = useMemo<SchemaValidationResult>(() => {
    if (createMessageError) {
      return EMPTY_SCHEMA_VALIDATION_RESULT;
    }
    try {
      const payload = parseJsonObject(createMessageDraft);
      return validateToolInputAgainstSchema(payload, WEB_MCP_CREATE_MESSAGE_INPUT_SCHEMA);
    } catch {
      return EMPTY_SCHEMA_VALIDATION_RESULT;
    }
  }, [createMessageDraft, createMessageError]);

  const createMessageSchemaValidation = useMemo<SchemaValidationResult>(
    () =>
      mergeSchemaValidationResults(
        localCreateMessageSchemaValidation,
        bridgeCreateMessageSchemaValidation
      ),
    [localCreateMessageSchemaValidation, bridgeCreateMessageSchemaValidation]
  );

  const localElicitInputSchemaValidation = useMemo<SchemaValidationResult>(() => {
    if (elicitInputError) {
      return EMPTY_SCHEMA_VALIDATION_RESULT;
    }
    try {
      const payload = parseJsonObject(elicitInputDraft);
      return validateToolInputAgainstSchema(payload, WEB_MCP_ELICIT_INPUT_SCHEMA);
    } catch {
      return EMPTY_SCHEMA_VALIDATION_RESULT;
    }
  }, [elicitInputDraft, elicitInputError]);

  const elicitInputSchemaValidation = useMemo<SchemaValidationResult>(
    () =>
      mergeSchemaValidationResults(
        localElicitInputSchemaValidation,
        bridgeElicitInputSchemaValidation
      ),
    [localElicitInputSchemaValidation, bridgeElicitInputSchemaValidation]
  );

  const catalogEntries = useMemo(() => {
    const query = catalogFilter.trim().toLowerCase();
    const source = resolveCatalogEntries(catalog, catalogView);
    if (query.length === 0) {
      return source;
    }
    return source.filter((entry, index) => {
      if (selectCatalogLabel(entry, index).includes(query)) {
        return true;
      }
      return stringifyJson(entry).toLowerCase().includes(query);
    });
  }, [catalog, catalogFilter, catalogView]);

  const catalogEntryCount = useMemo(
    () => resolveCatalogEntries(catalog, catalogView).length,
    [catalog, catalogView]
  );

  const callToolAvailable = webMcpSupported && webMcpEnabled && capabilitySnapshot.tools.callTool;
  const createMessageAvailable =
    webMcpSupported && webMcpEnabled && capabilitySnapshot.model.createMessage;
  const elicitInputAvailable =
    webMcpSupported && webMcpEnabled && capabilitySnapshot.model.elicitInput;
  const listCatalogAvailable =
    webMcpSupported &&
    webMcpEnabled &&
    capabilitySnapshot.tools.listTools &&
    capabilitySnapshot.resources.listResources &&
    capabilitySnapshot.prompts.listPrompts;
  const isAdvancedMode = mode === "advanced";
  const hasToolSchemaErrors = toolSchemaValidation.errors.length > 0;
  const hasCreateMessageSchemaErrors = createMessageSchemaValidation.errors.length > 0;
  const hasElicitInputSchemaErrors = elicitInputSchemaValidation.errors.length > 0;
  const runtimeMetricsSummary = useMemo(
    () => summarizeRuntimeToolExecutionMetrics(runtimeMetricsSnapshot),
    [runtimeMetricsSnapshot]
  );
  const runtimeExecutionReliability = useMemo(
    () =>
      buildRuntimeExecutionReliability({
        metrics: runtimeExecutionDiagnosticsPayload?.metrics ?? null,
        guardrails: runtimeExecutionDiagnosticsPayload?.guardrails ?? null,
        minSuccessRate: DEFAULT_RUNTIME_EXECUTION_SUCCESS_MIN_RATE,
      }),
    [runtimeExecutionDiagnosticsPayload]
  );
  const runtimeToolSuccessGateLabel = useMemo(() => {
    if (runtimeExecutionReliability.gate.passed === null) {
      return "n/a";
    }
    return runtimeExecutionReliability.gate.passed ? "pass" : "fail";
  }, [runtimeExecutionReliability.gate.passed]);
  const runtimeToolSuccessGateWarning = useMemo(() => {
    if (
      runtimeExecutionReliability.state === "ready" ||
      runtimeExecutionReliability.channelHealth.status === "unavailable"
    ) {
      return null;
    }
    return runtimeExecutionReliability.recommendedAction;
  }, [runtimeExecutionReliability]);
  const runtimeToolDefaultLimitsText = useMemo(() => {
    const { payloadLimitBytes, computerObserveRateLimitPerMinute } =
      runtimeMetricsSummary.effectiveLimitsByProfile.default;
    if (payloadLimitBytes === null || computerObserveRateLimitPerMinute === null) {
      return "n/a";
    }
    return `${payloadLimitBytes}B / ${computerObserveRateLimitPerMinute}/min`;
  }, [runtimeMetricsSummary.effectiveLimitsByProfile.default]);
  const runtimeToolSoloMaxLimitsText = useMemo(() => {
    const { payloadLimitBytes, computerObserveRateLimitPerMinute } =
      runtimeMetricsSummary.effectiveLimitsByProfile.soloMax;
    if (payloadLimitBytes === null || computerObserveRateLimitPerMinute === null) {
      return "n/a";
    }
    return `${payloadLimitBytes}B / ${computerObserveRateLimitPerMinute}/min`;
  }, [runtimeMetricsSummary.effectiveLimitsByProfile.soloMax]);
  const callToolExecutionEnabled = callToolAvailable && !runtimeMetricsChannelUnavailable;
  const hydratedExecutionHistory = useMemo(
    () => hydrateRuntimeOperatorTranscript(executionHistory),
    [executionHistory]
  );
  const filteredExecutionHistory = useMemo(() => {
    return hydratedExecutionHistory.filter((entry) => {
      if (historyActionFilter !== "all" && entry.action !== historyActionFilter) {
        return false;
      }
      if (historyStatusFilter !== "all" && entry.status !== historyStatusFilter) {
        return false;
      }
      const callerSource = entry.callerSourceFilter;
      if (historyCallerSourceFilter !== "all" && callerSource !== historyCallerSourceFilter) {
        return false;
      }
      const callerProvider = entry.callerProviderFilter;
      if (historyCallerProviderFilter !== "all" && callerProvider !== historyCallerProviderFilter) {
        return false;
      }
      return true;
    });
  }, [
    hydratedExecutionHistory,
    historyActionFilter,
    historyStatusFilter,
    historyCallerProviderFilter,
    historyCallerSourceFilter,
  ]);

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    invalidateCachedRuntimeLiveSkills();
    try {
      const nextCatalog = await listWebMcpCatalog();
      setCatalog(nextCatalog);
      const firstTool = nextCatalog.tools
        .map((entry) => getToolName(entry))
        .find((name): name is string => name !== null);
      if (firstTool && selectedToolName.trim().length === 0) {
        setSelectedToolName(firstTool);
      }
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : String(error));
    } finally {
      setCatalogLoading(false);
    }
  }, [selectedToolName]);

  useEffect(() => {
    if (!listCatalogAvailable) {
      return;
    }
    if (catalog || catalogLoading || catalogError) {
      return;
    }
    void refreshCatalog();
  }, [catalog, catalogError, catalogLoading, listCatalogAvailable, refreshCatalog]);

  const refreshRuntimeMetrics = useCallback(async () => {
    if (!webMcpSupported || !webMcpEnabled) {
      return;
    }
    setRuntimeMetricsLoading(true);
    try {
      const response = await callWebMcpTool({
        name: "get-runtime-tool-execution-metrics",
        arguments: {},
      });
      const nextSnapshot = extractRuntimeToolExecutionMetricsSnapshot(response);
      const nextDiagnosticsPayload = extractRuntimeToolExecutionDiagnosticsPayload(response);
      if (nextSnapshot) {
        setRuntimeMetricsSnapshot(nextSnapshot);
        setRuntimeExecutionDiagnosticsPayload(nextDiagnosticsPayload);
        setRuntimeMetricsError(null);
        setRuntimeMetricsChannelUnavailable(false);
      } else {
        setRuntimeExecutionDiagnosticsPayload(null);
        setRuntimeMetricsError("Runtime metrics are not yet available.");
        setRuntimeMetricsChannelUnavailable(false);
      }
    } catch (error) {
      const message = resolveWebMcpErrorMessage(error);
      const code = extractRuntimeErrorCode(error, message);
      const isMetricsUnavailable = code === RUNTIME_METRICS_UNAVAILABLE_CODE;
      setRuntimeMetricsError(
        isMetricsUnavailable
          ? "Runtime metrics channel is unavailable. Run tool is disabled until it recovers."
          : `Runtime metrics refresh failed: ${message}`
      );
      setRuntimeExecutionDiagnosticsPayload(null);
      setRuntimeMetricsChannelUnavailable(isMetricsUnavailable);
    } finally {
      setRuntimeMetricsLoading(false);
    }
  }, [webMcpEnabled, webMcpSupported]);

  useEffect(() => {
    if (!webMcpSupported || !webMcpEnabled) {
      return;
    }
    void refreshRuntimeMetrics();
  }, [refreshRuntimeMetrics, webMcpEnabled, webMcpSupported]);

  const formatToolArguments = useCallback(() => {
    try {
      setToolArgumentsDraft(stringifyJson(parseJsonObject(toolArgumentsDraft)));
      setBridgeToolSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
      setExecutionError(null);
      setExecutionNote("Tool arguments formatted.");
      setExecutionFixHints([]);
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : String(error));
      setExecutionFixHints([]);
    }
  }, [toolArgumentsDraft]);

  const formatCreateMessage = useCallback(() => {
    try {
      setCreateMessageDraft(stringifyJson(parseJsonObject(createMessageDraft)));
      setBridgeCreateMessageSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
      setExecutionError(null);
      setExecutionNote("createMessage payload formatted.");
      setExecutionFixHints([]);
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : String(error));
      setExecutionFixHints([]);
    }
  }, [createMessageDraft]);

  const formatElicitInput = useCallback(() => {
    try {
      setElicitInputDraft(stringifyJson(parseJsonObject(elicitInputDraft)));
      setBridgeElicitInputSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
      setExecutionError(null);
      setExecutionNote("elicitInput payload formatted.");
      setExecutionFixHints([]);
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : String(error));
      setExecutionFixHints([]);
    }
  }, [elicitInputDraft]);

  const applySelectedToolTemplate = useCallback(() => {
    if (!catalog) {
      setExecutionError("Load catalog before applying a tool template.");
      setExecutionFixHints([]);
      return;
    }
    const selected = catalog.tools.find((entry) => getToolName(entry) === selectedToolName);
    if (!selected || typeof selected !== "object") {
      setExecutionError("Select a tool before applying a template.");
      setExecutionFixHints([]);
      return;
    }
    const schema = (selected as Record<string, unknown>).inputSchema;
    setToolArgumentsDraft(
      stringifyJson(buildSchemaTemplate(schema, { toolName: getToolName(selected) }))
    );
    setBridgeToolSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
    setExecutionError(null);
    setExecutionNote("Tool argument template applied.");
    setExecutionFixHints([]);
  }, [catalog, selectedToolName]);

  const recordExecution = useCallback((entry: NormalizeWebMcpConsoleTranscriptItemInput) => {
    setExecutionHistory((current) =>
      appendRuntimeOperatorTranscriptItem(current, normalizeWebMcpConsoleTranscriptItem(entry), 8)
    );
  }, []);

  const runToolCall = useCallback(async () => {
    const confirmed = await maybeConfirmExecution(autoExecuteCalls, "callTool");
    if (!confirmed) {
      setExecutionError("Execution cancelled.");
      setExecutionNote(null);
      setExecutionFixHints([]);
      return;
    }
    const startedAt = Date.now();
    let toolInput: Record<string, unknown> | null = null;
    setActiveExecution("tool");
    setExecutionLoading(true);
    try {
      const toolName = selectedToolName.trim();
      if (toolName.length === 0) {
        throw new Error("Select a tool before executing.");
      }
      const parsedArguments = parseJsonObject(toolArgumentsDraft);
      toolInput = parsedArguments;
      const response = await callWebMcpTool({
        name: toolName,
        arguments: parsedArguments,
      });
      const resultText = stringifyJson(response);
      setBridgeToolSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
      setLastResult(resultText);
      setExecutionError(null);
      setExecutionNote("Tool call completed.");
      setExecutionFixHints([]);
      recordExecution({
        action: "tool",
        status: "success",
        durationMs: Date.now() - startedAt,
        summary: summarizeResult(response),
        result: resultText,
        dryRun: resolveToolExecutionDryRun(parsedArguments, response),
        input: parsedArguments,
        response,
      });
    } catch (error) {
      const message = resolveWebMcpErrorMessage(error);
      const schemaValidation =
        extractSchemaValidationFromError(error) ?? extractSchemaValidationFromError(message);
      if (schemaValidation) {
        setBridgeToolSchemaValidation(schemaValidation);
      }
      setExecutionError(message);
      setExecutionNote(null);
      setExecutionFixHints(resolveExecutionFixHints(error, message));
      recordExecution({
        action: "tool",
        status: "error",
        durationMs: Date.now() - startedAt,
        summary: message,
        result: lastResult,
        dryRun: resolveToolExecutionDryRun(toolInput, null),
        effectiveLimits: extractRuntimeGuardrailEffectiveLimits(message),
        input: toolInput,
        response: null,
      });
    } finally {
      void refreshRuntimeMetrics();
      setExecutionLoading(false);
      setActiveExecution(null);
    }
  }, [
    autoExecuteCalls,
    lastResult,
    recordExecution,
    refreshRuntimeMetrics,
    selectedToolName,
    toolArgumentsDraft,
  ]);

  const runCreateMessage = useCallback(async () => {
    const confirmed = await maybeConfirmExecution(autoExecuteCalls, "createMessage");
    if (!confirmed) {
      setExecutionError("Execution cancelled.");
      setExecutionNote(null);
      setExecutionFixHints([]);
      return;
    }
    const startedAt = Date.now();
    let createMessageInput: Record<string, unknown> | null = null;
    setActiveExecution("createMessage");
    setExecutionLoading(true);
    try {
      const payload = parseJsonObject(createMessageDraft);
      createMessageInput = payload;
      const response = await createWebMcpMessage(payload as unknown as WebMcpCreateMessageInput);
      const resultText = stringifyJson(response);
      setBridgeCreateMessageSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
      setLastResult(resultText);
      setExecutionError(null);
      setExecutionNote("createMessage completed.");
      setExecutionFixHints([]);
      recordExecution({
        action: "createMessage",
        status: "success",
        durationMs: Date.now() - startedAt,
        summary: summarizeResult(response),
        result: resultText,
        input: payload,
        response,
      });
    } catch (error) {
      const message = resolveWebMcpErrorMessage(error);
      const schemaValidation =
        extractSchemaValidationFromError(error) ?? extractSchemaValidationFromError(message);
      if (schemaValidation) {
        setBridgeCreateMessageSchemaValidation(schemaValidation);
      }
      setExecutionError(message);
      setExecutionNote(null);
      setExecutionFixHints(resolveExecutionFixHints(error, message));
      recordExecution({
        action: "createMessage",
        status: "error",
        durationMs: Date.now() - startedAt,
        summary: message,
        result: lastResult,
        effectiveLimits: extractRuntimeGuardrailEffectiveLimits(message),
        input: createMessageInput,
        response: null,
      });
    } finally {
      setExecutionLoading(false);
      setActiveExecution(null);
    }
  }, [autoExecuteCalls, createMessageDraft, lastResult, recordExecution]);

  const runElicitInput = useCallback(async () => {
    const confirmed = await maybeConfirmExecution(autoExecuteCalls, "elicitInput");
    if (!confirmed) {
      setExecutionError("Execution cancelled.");
      setExecutionNote(null);
      setExecutionFixHints([]);
      return;
    }
    const startedAt = Date.now();
    let elicitInputPayload: Record<string, unknown> | null = null;
    setActiveExecution("elicitInput");
    setExecutionLoading(true);
    try {
      const payload = parseJsonObject(elicitInputDraft);
      elicitInputPayload = payload;
      const response = await elicitWebMcpInput(payload as unknown as WebMcpElicitInput);
      const resultText = stringifyJson(response);
      setBridgeElicitInputSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
      setLastResult(resultText);
      setExecutionError(null);
      setExecutionNote("elicitInput completed.");
      setExecutionFixHints([]);
      recordExecution({
        action: "elicitInput",
        status: "success",
        durationMs: Date.now() - startedAt,
        summary: summarizeResult(response),
        result: resultText,
        input: payload,
        response,
      });
    } catch (error) {
      const message = resolveWebMcpErrorMessage(error);
      const schemaValidation =
        extractSchemaValidationFromError(error) ?? extractSchemaValidationFromError(message);
      if (schemaValidation) {
        setBridgeElicitInputSchemaValidation(schemaValidation);
      }
      setExecutionError(message);
      setExecutionNote(null);
      setExecutionFixHints(resolveExecutionFixHints(error, message));
      recordExecution({
        action: "elicitInput",
        status: "error",
        durationMs: Date.now() - startedAt,
        summary: message,
        result: lastResult,
        effectiveLimits: extractRuntimeGuardrailEffectiveLimits(message),
        input: elicitInputPayload,
        response: null,
      });
    } finally {
      setExecutionLoading(false);
      setActiveExecution(null);
    }
  }, [autoExecuteCalls, elicitInputDraft, lastResult, recordExecution]);

  const copyResult = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable in this runtime.");
      }
      await navigator.clipboard.writeText(lastResult);
      setExecutionError(null);
      setExecutionNote("Result copied to clipboard.");
      setExecutionFixHints([]);
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : String(error));
      setExecutionNote(null);
      setExecutionFixHints([]);
    }
  }, [lastResult]);

  return (
    <div className={controlStyles.controlSection}>
      <div className={controlStyles.sectionHeader}>
        <div className={controlStyles.sectionTitle}>WebMCP Console</div>
        <div className={controlStyles.sectionMeta}>
          {executionLoading && activeExecution
            ? `Running ${getActionLabel(activeExecution)}`
            : isAdvancedMode
              ? "Advanced mode · Full operations"
              : "Basic mode · Focused controls"}
        </div>
      </div>

      <div className="workspace-home-webmcp-console-toolbar">
        <fieldset className="workspace-home-webmcp-console-mode" aria-label="Console mode">
          <button
            type="button"
            className={
              mode === "basic"
                ? "workspace-home-webmcp-console-mode-button workspace-home-webmcp-console-mode-button--active"
                : "workspace-home-webmcp-console-mode-button"
            }
            aria-pressed={mode === "basic"}
            disabled={executionLoading || controlsLocked}
            onClick={() => onSetMode("basic")}
          >
            Basic
          </button>
          <button
            type="button"
            className={
              mode === "advanced"
                ? "workspace-home-webmcp-console-mode-button workspace-home-webmcp-console-mode-button--active"
                : "workspace-home-webmcp-console-mode-button"
            }
            aria-pressed={mode === "advanced"}
            disabled={executionLoading || controlsLocked}
            onClick={() => onSetMode("advanced")}
          >
            Advanced
          </button>
        </fieldset>
        <label className={controlStyles.controlToggle}>
          <input
            className={controlStyles.toggleInput}
            type="checkbox"
            checked={autoExecuteCalls}
            disabled={controlsLocked}
            onChange={(event) => onSetAutoExecuteCalls(event.target.checked)}
          />
          Auto execute WebMCP calls
        </label>
        <button
          type="button"
          onClick={() => {
            void refreshCatalog();
          }}
          disabled={!listCatalogAvailable || catalogLoading}
        >
          {catalogLoading ? "Refreshing..." : "Refresh catalog"}
        </button>
      </div>

      {!webMcpSupported || !webMcpEnabled ? (
        <div className="workspace-home-webmcp-console-warning">
          Enable WebMCP and use a supported runtime to interact with this console.
        </div>
      ) : null}

      {catalog ? (
        <div className="workspace-home-webmcp-console-status">
          <span>tools: {catalog.tools.length}</span>
          <span>resources: {catalog.resources.length}</span>
          <span>prompts: {catalog.prompts.length}</span>
        </div>
      ) : null}
      <div className="workspace-home-webmcp-console-status">
        {getCapabilityStatus(capabilitySnapshot).map((item) => (
          <Badge
            key={item.key}
            className="workspace-home-webmcp-console-chip"
            tone={item.ready ? "success" : "danger"}
            shape="chip"
            size="md"
          >
            {item.key}: {item.ready ? "ready" : "missing"}
          </Badge>
        ))}
      </div>

      {catalog?.capabilities.missingRequired.length ? (
        <div className="workspace-home-webmcp-console-warning">
          Missing required methods: {catalog.capabilities.missingRequired.join(", ")}
        </div>
      ) : null}
      {runtimeMetricsError ? (
        <div className="workspace-home-webmcp-console-warning workspace-home-webmcp-console-warning--metrics">
          {runtimeMetricsError}
        </div>
      ) : null}
      {runtimeToolSuccessGateWarning ? (
        <div className="workspace-home-webmcp-console-warning workspace-home-webmcp-console-warning--metrics">
          {runtimeToolSuccessGateWarning}
        </div>
      ) : null}
      {toolArgumentsError ? (
        <div className={controlStyles.warning}>Tool arguments JSON: {toolArgumentsError}</div>
      ) : null}
      {!toolArgumentsError && hasToolSchemaErrors ? (
        <div className={controlStyles.warning}>
          Tool arguments schema validation:
          <ul className="workspace-home-webmcp-console-validation-list">
            {toolSchemaValidation.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!toolArgumentsError && toolSchemaValidation.warnings.length > 0 ? (
        <div className="workspace-home-webmcp-console-warning">
          Tool arguments schema warnings:
          <ul className="workspace-home-webmcp-console-validation-list">
            {toolSchemaValidation.warnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {isAdvancedMode && createMessageError ? (
        <div className={controlStyles.warning}>
          createMessage payload JSON: {createMessageError}
        </div>
      ) : null}
      {isAdvancedMode && !createMessageError && hasCreateMessageSchemaErrors ? (
        <div className={controlStyles.warning}>
          createMessage schema validation:
          <ul className="workspace-home-webmcp-console-validation-list">
            {createMessageSchemaValidation.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {isAdvancedMode &&
      !createMessageError &&
      createMessageSchemaValidation.warnings.length > 0 ? (
        <div className="workspace-home-webmcp-console-warning">
          createMessage schema warnings:
          <ul className="workspace-home-webmcp-console-validation-list">
            {createMessageSchemaValidation.warnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {isAdvancedMode && elicitInputError ? (
        <div className={controlStyles.warning}>elicitInput payload JSON: {elicitInputError}</div>
      ) : null}
      {isAdvancedMode && !elicitInputError && hasElicitInputSchemaErrors ? (
        <div className={controlStyles.warning}>
          elicitInput schema validation:
          <ul className="workspace-home-webmcp-console-validation-list">
            {elicitInputSchemaValidation.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {isAdvancedMode && !elicitInputError && elicitInputSchemaValidation.warnings.length > 0 ? (
        <div className="workspace-home-webmcp-console-warning">
          elicitInput schema warnings:
          <ul className="workspace-home-webmcp-console-validation-list">
            {elicitInputSchemaValidation.warnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {catalogError ? <div className={controlStyles.error}>{catalogError}</div> : null}

      <div className="workspace-home-webmcp-console-grid">
        <div className="workspace-home-webmcp-console-card workspace-home-webmcp-console-metrics-card">
          <div className={controlStyles.sectionHeader}>
            <div className={controlStyles.sectionTitle}>Runtime Tool Metrics</div>
            <button
              type="button"
              onClick={() => {
                void refreshRuntimeMetrics();
              }}
              disabled={runtimeMetricsLoading}
            >
              {runtimeMetricsLoading ? "Refreshing..." : "Refresh metrics"}
            </button>
          </div>
          <div className="workspace-home-webmcp-console-status">
            <span>
              overall success rate: {formatSuccessRate(runtimeMetricsSummary.overallSuccessRate)}
            </span>
            <span>
              gate (&gt;= {formatSuccessRate(runtimeExecutionReliability.gate.minSuccessRate)}):{" "}
              {runtimeToolSuccessGateLabel}
            </span>
            <span>blocked: {runtimeMetricsSummary.blockedTotal}</span>
            <span>
              window:{" "}
              {runtimeMetricsSummary.windowSize === null ? "n/a" : runtimeMetricsSummary.windowSize}
            </span>
            <span>
              updated:{" "}
              {runtimeMetricsSummary.updatedAt === null
                ? "n/a"
                : new Date(runtimeMetricsSummary.updatedAt).toLocaleTimeString()}
            </span>
            <span>default limits: {runtimeToolDefaultLimitsText}</span>
            <span>solo-max limits: {runtimeToolSoloMaxLimitsText}</span>
          </div>
          <div className="workspace-home-webmcp-console-metrics-grid">
            {runtimeMetricsSummary.scopeSuccessRates.map((entry) => (
              <div key={entry.scope} className="workspace-home-webmcp-console-metric">
                <span>{entry.scope}</span>
                <strong>{formatSuccessRate(entry.successRate)}</strong>
                <small>blocked: {entry.blockedTotal}</small>
              </div>
            ))}
          </div>
          <div className={controlStyles.sectionTitle}>Top Failed Tools</div>
          {runtimeMetricsSummary.topFailedTools.length === 0 ? (
            <div className={controlStyles.emptyState}>No failed tools in current window.</div>
          ) : (
            <ul className="workspace-home-webmcp-console-validation-list">
              {runtimeMetricsSummary.topFailedTools.map((entry) => (
                <li key={`${entry.scope}:${entry.toolName}`}>
                  {entry.toolName} ({entry.scope}) · failures: {entry.failures} · blocked:{" "}
                  {entry.blockedTotal}
                </li>
              ))}
            </ul>
          )}
        </div>

        <WorkspaceHomeAgentWebMcpConsoleToolCallCard
          selectedToolName={selectedToolName}
          toolNames={toolNames}
          toolArgumentsDraft={toolArgumentsDraft}
          selectedToolSchema={selectedToolSchema}
          callToolAvailable={callToolExecutionEnabled}
          toolArgumentsError={toolArgumentsError}
          hasToolSchemaErrors={hasToolSchemaErrors}
          executionLoading={executionLoading}
          activeExecution={activeExecution}
          onSelectedToolNameChange={(value) => {
            setSelectedToolName(value);
            setBridgeToolSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
          }}
          onToolArgumentsDraftChange={(value) => {
            setToolArgumentsDraft(value);
            setBridgeToolSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
          }}
          onFormatToolArguments={formatToolArguments}
          onApplySchemaTemplate={applySelectedToolTemplate}
          onResetToolArguments={() => {
            setToolArgumentsDraft(DEFAULT_TOOL_ARGUMENTS_DRAFT);
            setBridgeToolSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
          }}
          onRunTool={() => {
            void runToolCall();
          }}
        />

        {isAdvancedMode ? (
          <div className="workspace-home-webmcp-console-card">
            <div className={controlStyles.sectionTitle}>createMessage</div>
            <label className={controlStyles.field}>
              <span>Payload JSON</span>
              <textarea
                className={joinClassNames(
                  "workspace-home-webmcp-console-input",
                  controlStyles.fieldTextarea
                )}
                value={createMessageDraft}
                onChange={(event) => {
                  setCreateMessageDraft(event.target.value);
                  setBridgeCreateMessageSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
                }}
              />
            </label>
            <div className={controlStyles.actions}>
              <button
                type="button"
                className={controlStyles.actionButton}
                onClick={formatCreateMessage}
              >
                Format JSON
              </button>
              <button
                type="button"
                className={controlStyles.actionButton}
                onClick={() => {
                  setCreateMessageDraft(DEFAULT_CREATE_MESSAGE_DRAFT);
                  setBridgeCreateMessageSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
                }}
              >
                Reset
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                void runCreateMessage();
              }}
              disabled={
                !createMessageAvailable ||
                Boolean(createMessageError) ||
                hasCreateMessageSchemaErrors ||
                executionLoading
              }
            >
              {executionLoading && activeExecution === "createMessage"
                ? "Running..."
                : "Run createMessage"}
            </button>
          </div>
        ) : null}

        {isAdvancedMode ? (
          <div className="workspace-home-webmcp-console-card">
            <div className={controlStyles.sectionTitle}>elicitInput</div>
            <label className={controlStyles.field}>
              <span>Payload JSON</span>
              <textarea
                className={joinClassNames(
                  "workspace-home-webmcp-console-input",
                  controlStyles.fieldTextarea
                )}
                value={elicitInputDraft}
                onChange={(event) => {
                  setElicitInputDraft(event.target.value);
                  setBridgeElicitInputSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
                }}
              />
            </label>
            <div className={controlStyles.actions}>
              <button
                type="button"
                className={controlStyles.actionButton}
                onClick={formatElicitInput}
              >
                Format JSON
              </button>
              <button
                type="button"
                className={controlStyles.actionButton}
                onClick={() => {
                  setElicitInputDraft(DEFAULT_ELICIT_INPUT_DRAFT);
                  setBridgeElicitInputSchemaValidation(EMPTY_SCHEMA_VALIDATION_RESULT);
                }}
              >
                Reset
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                void runElicitInput();
              }}
              disabled={
                !elicitInputAvailable ||
                Boolean(elicitInputError) ||
                hasElicitInputSchemaErrors ||
                executionLoading
              }
            >
              {executionLoading && activeExecution === "elicitInput"
                ? "Running..."
                : "Run elicitInput"}
            </button>
          </div>
        ) : null}

        <div className="workspace-home-webmcp-console-card">
          <div className={controlStyles.sectionTitle}>Catalog Preview</div>
          <label className={controlStyles.field}>
            <span>View</span>
            <select
              className={controlStyles.fieldControl}
              value={catalogView}
              onChange={(event) => setCatalogView(event.target.value as CatalogView)}
            >
              <option value="tools">Tools</option>
              <option value="resources">Resources</option>
              <option value="prompts">Prompts</option>
              <option value="resourceTemplates">Resource Templates</option>
            </select>
          </label>
          <label className={controlStyles.field}>
            <span>Filter</span>
            <input
              className={controlStyles.fieldControl}
              value={catalogFilter}
              onChange={(event) => setCatalogFilter(event.target.value)}
              placeholder="Filter catalog"
            />
          </label>
          <div className="workspace-home-webmcp-console-status">
            <span>
              showing: {catalogEntries.length} / {catalogEntryCount}
            </span>
          </div>
          <div className="workspace-home-webmcp-console-list">
            <pre>{stringifyJson(catalogEntries)}</pre>
          </div>
        </div>
      </div>

      {executionError ? <div className={controlStyles.error}>{executionError}</div> : null}
      {executionFixHints.length > 0 ? (
        <div className="workspace-home-webmcp-console-guidance">
          Suggested fixes:
          <ul className="workspace-home-webmcp-console-validation-list">
            {executionFixHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {executionNote ? <div className={controlStyles.emptyState}>{executionNote}</div> : null}
      <div className="workspace-home-webmcp-console-output">
        <div className={controlStyles.sectionHeader}>
          <div className={controlStyles.sectionTitle}>Last Result</div>
          <div className={controlStyles.actions}>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() => setLastResult("No calls executed yet.")}
              disabled={executionLoading}
            >
              Clear
            </button>
            <button
              type="button"
              className={controlStyles.actionButton}
              onClick={() => {
                void copyResult();
              }}
              disabled={executionLoading}
            >
              Copy
            </button>
          </div>
        </div>
        <pre>{lastResult}</pre>
      </div>
      <WorkspaceHomeAgentWebMcpConsoleHistorySection
        executionHistory={hydratedExecutionHistory}
        filteredExecutionHistory={filteredExecutionHistory}
        historyActionFilter={historyActionFilter}
        historyStatusFilter={historyStatusFilter}
        historyCallerSourceFilter={historyCallerSourceFilter}
        historyCallerProviderFilter={historyCallerProviderFilter}
        onHistoryActionFilterChange={setHistoryActionFilter}
        onHistoryStatusFilterChange={setHistoryStatusFilter}
        onHistoryCallerSourceFilterChange={setHistoryCallerSourceFilter}
        onHistoryCallerProviderFilterChange={setHistoryCallerProviderFilter}
        onLoadResult={setLastResult}
      />
    </div>
  );
}
