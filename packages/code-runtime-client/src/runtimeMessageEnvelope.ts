import { RUNTIME_MESSAGE_CODES, resolveRuntimeMessageCode } from "./runtimeMessageCodes";

type JsonRecord = Record<string, unknown>;

export type AgentEnvelopeRoute = {
  sourceAgentId: string;
  targetAgentId: string;
  channelId: string;
};

export type AgentEnvelopeQueueReference = {
  queueId: string;
  priority?: number;
};

export type AgentEnvelopeAck = {
  ackId: string;
  required: boolean;
  success?: boolean;
  error?: string;
};

export type AgentEnvelopeFailure = {
  code?: string;
  message?: string;
};

export type AgentEnvelopeEventType =
  | "agent.message"
  | "agent.route"
  | "agent.queue"
  | "agent.ack"
  | "agent.failure"
  | "agent.system"
  | (string & {});

export type AgentEnvelopeMetadata = {
  route: AgentEnvelopeRoute;
  eventType: AgentEnvelopeEventType;
  queue?: AgentEnvelopeQueueReference;
  ack?: AgentEnvelopeAck;
  failure?: AgentEnvelopeFailure;
  payload?: JsonRecord;
};

export type RuntimeMessageEnvelope<Data extends JsonRecord = JsonRecord> = {
  ok: true;
  code?: string;
  message: string;
  data: Data;
  envelope?: AgentEnvelopeMetadata;
};

export type RuntimeMessageError = Error & {
  code?: string;
};

export function createRuntimeEnvelope<Data extends JsonRecord>(options: {
  code?: string | null;
  message: string;
  data: Data;
  envelopeMetadata?: AgentEnvelopeMetadata | null;
}): RuntimeMessageEnvelope<Data> {
  const resolvedCode =
    typeof options.code === "string" && options.code.trim().length > 0
      ? options.code.trim()
      : resolveRuntimeMessageCode(options.message);
  return {
    ok: true,
    code: resolvedCode,
    message: options.message,
    data: options.data,
    envelope: options.envelopeMetadata ?? undefined,
  };
}

export function createAgentEnvelope<Data extends JsonRecord>(options: {
  code?: string | null;
  message: string;
  data: Data;
  metadata: AgentEnvelopeMetadata;
}): RuntimeMessageEnvelope<Data> {
  return createRuntimeEnvelope({
    code: options.code,
    message: options.message,
    data: options.data,
    envelopeMetadata: options.metadata,
  });
}

export function attachAgentEnvelopeMetadata<Data extends JsonRecord>(
  envelope: RuntimeMessageEnvelope<Data>,
  metadata: AgentEnvelopeMetadata
): RuntimeMessageEnvelope<Data> {
  return {
    ...envelope,
    envelope: {
      ...(envelope.envelope ?? {}),
      ...metadata,
    },
  };
}

export function readAgentEnvelopeMetadata(
  envelope: RuntimeMessageEnvelope<JsonRecord> | null | undefined
): AgentEnvelopeMetadata | null {
  if (!envelope || !envelope.envelope) {
    return null;
  }
  return envelope.envelope;
}

export function createRuntimeError(options: {
  code?: string | null;
  message: string;
}): RuntimeMessageError {
  const error = new Error(options.message) as RuntimeMessageError;
  error.code =
    typeof options.code === "string" && options.code.trim().length > 0
      ? options.code.trim()
      : RUNTIME_MESSAGE_CODES.runtime.validation.unknownError;
  return error;
}

export function readRuntimeCode(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const maybeCode = (value as { code?: unknown }).code;
  if (typeof maybeCode !== "string") {
    return null;
  }
  const trimmed = maybeCode.trim();
  return trimmed.length > 0 ? trimmed : null;
}
