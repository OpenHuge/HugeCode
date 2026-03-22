export const RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_BYTES = 256 * 1024;
export const RUNTIME_CONTEXT_BUDGET_PREVIEW_MAX_CHARS = 256 * 1024;

type JsonRecord = Record<string, unknown>;

export type RuntimeToolOutputSummaryLike = {
  truncated: boolean;
  preview: string;
  byteCount: number;
  previewByteCount: number;
  spoolReference: {
    uri: string;
    byteCount: number;
    previewCharCount: number;
  } | null;
};

type RuntimeToolResultLike = JsonRecord & {
  output: string;
  metadata?: unknown;
};

export type RuntimeContextCompactedToolOutput = RuntimeToolOutputSummaryLike & {
  compactionApplied: boolean;
  compactionSummary: string | null;
  compactionReference: string | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildCompactionSummary(input: { byteCount: number; previewByteCount: number }): string {
  return `Output compacted for context budget (${input.previewByteCount}/${input.byteCount} bytes preview retained).`;
}

export function applyRuntimeContextBudgetToToolOutput<
  TResult extends RuntimeToolResultLike,
>(input: {
  result: TResult;
  toolOutput: RuntimeToolOutputSummaryLike;
}): {
  result: TResult;
  toolOutput: RuntimeContextCompactedToolOutput;
} {
  const compactionApplied = input.toolOutput.truncated;
  const compactionReference = input.toolOutput.spoolReference?.uri ?? null;
  const compactionSummary = compactionApplied
    ? buildCompactionSummary({
        byteCount: input.toolOutput.byteCount,
        previewByteCount: input.toolOutput.previewByteCount,
      })
    : null;
  const toolOutput: RuntimeContextCompactedToolOutput = {
    ...input.toolOutput,
    compactionApplied,
    compactionSummary,
    compactionReference,
  };
  if (!compactionApplied) {
    return {
      result: input.result,
      toolOutput,
    };
  }

  const metadata = isRecord(input.result.metadata) ? input.result.metadata : {};
  const compactedResult = {
    ...input.result,
    output: input.toolOutput.preview,
    metadata: {
      ...metadata,
      outputTruncated: true,
      outputSpoolUri: compactionReference,
      outputByteCount: input.toolOutput.byteCount,
      outputPreviewByteCount: input.toolOutput.previewByteCount,
      compactionApplied: true,
      outputCompactionSummary: compactionSummary,
      outputCompactionReference: compactionReference,
    },
  } as TResult;

  return {
    result: compactedResult,
    toolOutput,
  };
}
