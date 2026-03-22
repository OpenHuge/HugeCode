import type { SchemaValidationResult } from "./webMcpToolInputSchemaValidation";
import { validateToolInputAgainstSchema } from "./webMcpToolInputSchemaValidation";

type JsonRecord = Record<string, unknown>;

export const WEB_MCP_CREATE_MESSAGE_INPUT_SCHEMA: JsonRecord = {
  type: "object",
  properties: {
    messages: {
      type: "array",
      items: { type: "object" },
    },
    maxTokens: { type: "integer" },
    systemPrompt: { type: "string" },
    temperature: { type: "number" },
    stopSequences: {
      type: "array",
      items: { type: "string" },
    },
    modelPreferences: { type: "object" },
    includeContext: {
      type: "string",
      enum: ["none", "thisServer", "allServers"],
    },
    metadata: { type: "object" },
  },
  required: ["messages", "maxTokens"],
};

export const WEB_MCP_ELICIT_INPUT_SCHEMA: JsonRecord = {
  oneOf: [
    {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["form"],
        },
        message: { type: "string" },
        requestedSchema: { type: "object" },
      },
      required: ["message", "requestedSchema"],
    },
    {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["url"],
        },
        message: { type: "string" },
        elicitationId: { type: "string" },
        url: { type: "string" },
      },
      required: ["mode", "message", "elicitationId", "url"],
    },
  ],
};

export function validateWebMcpCreateMessageInput(input: unknown): SchemaValidationResult {
  return validateToolInputAgainstSchema(input, WEB_MCP_CREATE_MESSAGE_INPUT_SCHEMA);
}

export function validateWebMcpElicitInput(input: unknown): SchemaValidationResult {
  return validateToolInputAgainstSchema(input, WEB_MCP_ELICIT_INPUT_SCHEMA);
}
