import { logger } from "./logger";
import type {
  WebMcpPromptDescriptor,
  WebMcpResourceDescriptor,
} from "./webMcpBridgeContextDescriptors";
import type { WebMcpAgent } from "./webMcpBridgeTypes";
import { WebMcpInputSchemaValidationError } from "./webMcpInputSchemaValidationError";
import {
  validateWebMcpCreateMessageInput,
  validateWebMcpElicitInput,
} from "./webMcpModelInputSchemas";

type JsonRecord = Record<string, unknown>;

type WebMcpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  title?: string;
  taskSupport?: "none" | "partial" | "full";
};

type WebMcpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonRecord;
  annotations?: WebMcpToolAnnotations;
  execute: (input: JsonRecord, agent: WebMcpAgent | null) => unknown;
};

type WebMcpContextPayload = {
  tools?: WebMcpToolDescriptor[];
  resources?: WebMcpResourceDescriptor[];
  prompts?: WebMcpPromptDescriptor[];
};

export type WebMcpRegistrationHandle = {
  unregister?: () => void | Promise<void>;
};

export type WebMcpModelContext = {
  provideContext?: (payload: WebMcpContextPayload) => void | Promise<void>;
  clearContext?: () => void | Promise<void>;
  registerTool?: (
    tool: WebMcpToolDescriptor
  ) => WebMcpRegistrationHandle | undefined | Promise<WebMcpRegistrationHandle | undefined>;
  unregisterTool?: (toolName: string) => void | Promise<void>;
  listTools?: () => unknown[] | Promise<unknown[]>;
  callTool?: (params: { name: string; arguments?: JsonRecord }) => unknown | Promise<unknown>;
  registerResource?: (
    resource: WebMcpResourceDescriptor
  ) => WebMcpRegistrationHandle | undefined | Promise<WebMcpRegistrationHandle | undefined>;
  unregisterResource?: (uri: string) => void | Promise<void>;
  listResources?: () => unknown[] | Promise<unknown[]>;
  listResourceTemplates?: () => unknown[] | Promise<unknown[]>;
  registerPrompt?: (
    prompt: WebMcpPromptDescriptor
  ) => WebMcpRegistrationHandle | undefined | Promise<WebMcpRegistrationHandle | undefined>;
  unregisterPrompt?: (name: string) => void | Promise<void>;
  listPrompts?: () => unknown[] | Promise<unknown[]>;
  createMessage?: (params: JsonRecord) => unknown | Promise<unknown>;
  elicitInput?: (params: JsonRecord) => unknown | Promise<unknown>;
};

type WebMcpNavigator = Navigator & {
  modelContext?: WebMcpModelContext;
};

export type WebMcpCapabilityMatrix = {
  modelContext: boolean;
  tools: {
    provideContext: boolean;
    clearContext: boolean;
    registerTool: boolean;
    unregisterTool: boolean;
    listTools: boolean;
    callTool: boolean;
  };
  resources: {
    registerResource: boolean;
    unregisterResource: boolean;
    listResources: boolean;
    listResourceTemplates: boolean;
  };
  prompts: {
    registerPrompt: boolean;
    unregisterPrompt: boolean;
    listPrompts: boolean;
  };
  model: {
    createMessage: boolean;
    elicitInput: boolean;
  };
  supported: boolean;
  missingRequired: string[];
};

export type WebMcpCatalog = {
  tools: unknown[];
  resources: unknown[];
  resourceTemplates: unknown[];
  prompts: unknown[];
  capabilities: WebMcpCapabilityMatrix;
};

export type WebMcpCallToolInput = {
  name: string;
  arguments?: JsonRecord;
};

export type WebMcpCreateMessageInput = {
  messages: Array<Record<string, unknown>>;
  maxTokens: number;
  systemPrompt?: string;
  temperature?: number;
  stopSequences?: string[];
  modelPreferences?: Record<string, unknown>;
  includeContext?: "none" | "thisServer" | "allServers";
  metadata?: Record<string, unknown>;
};

export type WebMcpElicitInput =
  | {
      mode?: "form";
      message: string;
      requestedSchema: Record<string, unknown>;
    }
  | {
      mode: "url";
      message: string;
      elicitationId: string;
      url: string;
    };

function hasFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

export function getModelContext(): WebMcpModelContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const navigatorWithModelContext = window.navigator as WebMcpNavigator;
  return navigatorWithModelContext.modelContext ?? null;
}

export function buildCapabilityMatrix(
  modelContext: WebMcpModelContext | null
): WebMcpCapabilityMatrix {
  const matrix: WebMcpCapabilityMatrix = {
    modelContext: Boolean(modelContext),
    tools: {
      provideContext: hasFunction(modelContext?.provideContext),
      clearContext: hasFunction(modelContext?.clearContext),
      registerTool: hasFunction(modelContext?.registerTool),
      unregisterTool: hasFunction(modelContext?.unregisterTool),
      listTools: hasFunction(modelContext?.listTools),
      callTool: hasFunction(modelContext?.callTool),
    },
    resources: {
      registerResource: hasFunction(modelContext?.registerResource),
      unregisterResource: hasFunction(modelContext?.unregisterResource),
      listResources: hasFunction(modelContext?.listResources),
      listResourceTemplates: hasFunction(modelContext?.listResourceTemplates),
    },
    prompts: {
      registerPrompt: hasFunction(modelContext?.registerPrompt),
      unregisterPrompt: hasFunction(modelContext?.unregisterPrompt),
      listPrompts: hasFunction(modelContext?.listPrompts),
    },
    model: {
      createMessage: hasFunction(modelContext?.createMessage),
      elicitInput: hasFunction(modelContext?.elicitInput),
    },
    supported: false,
    missingRequired: [],
  };

  const supportsRegistrationViaProvideContext = matrix.tools.provideContext;
  const supportsRegistrationViaGranularApis =
    matrix.tools.registerTool && matrix.resources.registerResource && matrix.prompts.registerPrompt;

  if (
    matrix.modelContext &&
    !supportsRegistrationViaProvideContext &&
    !supportsRegistrationViaGranularApis
  ) {
    matrix.missingRequired = [
      [matrix.tools.registerTool, "registerTool"],
      [matrix.resources.registerResource, "registerResource"],
      [matrix.prompts.registerPrompt, "registerPrompt"],
    ]
      .filter(([available]) => !available)
      .map(([, methodName]) => `modelContext.${methodName}`);
  }

  matrix.supported =
    matrix.modelContext &&
    (supportsRegistrationViaProvideContext || supportsRegistrationViaGranularApis);
  return matrix;
}

export function getWebMcpCapabilities(): WebMcpCapabilityMatrix {
  return buildCapabilityMatrix(getModelContext());
}

export function supportsWebMcp(): boolean {
  return getWebMcpCapabilities().supported;
}

export function formatMissingMethodsMessage(missingRequired: string[]): string {
  if (missingRequired.length === 0) {
    return "WebMCP bridge registration requirements are not satisfied.";
  }
  return `WebMCP bridge requires registration methods: ${missingRequired.join(", ")}.`;
}

type WebMcpMethodError = Error & {
  code?: string;
  method?: string;
};

function createMethodUnavailableError(methodName: string): WebMcpMethodError {
  const error = new Error(`WebMCP method ${methodName} is unavailable.`) as WebMcpMethodError;
  error.code = "METHOD_UNAVAILABLE";
  error.method = methodName;
  return error;
}

function createMethodCallError(
  methodName: string,
  payload: Record<string, unknown>,
  error: unknown
): Error {
  const payloadKeys = Object.keys(payload);
  const reason = error instanceof Error ? error.message : String(error);
  return new Error(
    `WebMCP ${methodName} failed (${reason}). Payload keys: ${
      payloadKeys.length > 0 ? payloadKeys.join(", ") : "(none)"
    }.`
  );
}

function warnSchemaValidationWarnings(
  methodName: "createMessage" | "elicitInput",
  validation: ReturnType<typeof validateWebMcpCreateMessageInput>
): void {
  if (validation.extraFields.length > 0) {
    logger.warn(
      `[webmcp][${methodName}] ${methodName} received unexpected input fields: ${validation.extraFields.join(
        ", "
      )}`,
      {
        methodName,
        extraFields: validation.extraFields,
        warnings: validation.warnings,
      }
    );
    return;
  }
  if (validation.warnings.length > 0) {
    logger.warn(
      `[webmcp][${methodName}] ${methodName} input warnings: ${validation.warnings.join("; ")}`,
      {
        methodName,
        warnings: validation.warnings,
      }
    );
  }
}

export async function listWebMcpCatalog(): Promise<WebMcpCatalog> {
  const modelContext = getModelContext();
  const capabilities = buildCapabilityMatrix(modelContext);
  if (!modelContext) {
    throw createMethodUnavailableError("listTools/listResources/listPrompts");
  }

  const listTools = modelContext.listTools;
  const listResources = modelContext.listResources;
  const listResourceTemplates = modelContext.listResourceTemplates;
  const listPrompts = modelContext.listPrompts;
  if (!hasFunction(listTools) || !hasFunction(listResources) || !hasFunction(listPrompts)) {
    throw createMethodUnavailableError("listTools/listResources/listPrompts");
  }

  const tools = await listTools();
  const resources = await listResources();
  const resourceTemplates = hasFunction(listResourceTemplates) ? await listResourceTemplates() : [];
  const prompts = await listPrompts();

  return {
    tools: Array.isArray(tools) ? tools : [],
    resources: Array.isArray(resources) ? resources : [],
    resourceTemplates: Array.isArray(resourceTemplates) ? resourceTemplates : [],
    prompts: Array.isArray(prompts) ? prompts : [],
    capabilities,
  };
}

export async function callWebMcpTool(input: WebMcpCallToolInput): Promise<unknown> {
  const modelContext = getModelContext();
  const callTool = modelContext?.callTool;
  if (!modelContext || !hasFunction(callTool)) {
    throw createMethodUnavailableError("callTool");
  }
  const payload: Record<string, unknown> = {
    name: input.name,
    arguments: input.arguments ?? {},
  };
  try {
    return await callTool({
      name: input.name,
      arguments: input.arguments ?? {},
    });
  } catch (error) {
    throw createMethodCallError("callTool", payload, error);
  }
}

export async function createWebMcpMessage(input: WebMcpCreateMessageInput): Promise<unknown> {
  const modelContext = getModelContext();
  const createMessage = modelContext?.createMessage;
  if (!modelContext || !hasFunction(createMessage)) {
    throw createMethodUnavailableError("createMessage");
  }
  const validation = validateWebMcpCreateMessageInput(input);
  warnSchemaValidationWarnings("createMessage", validation);
  if (validation.errors.length > 0) {
    throw new WebMcpInputSchemaValidationError({
      toolName: "createMessage",
      scope: "createMessage",
      validation,
    });
  }
  const payload = input as Record<string, unknown>;
  try {
    return await createMessage(payload);
  } catch (error) {
    throw createMethodCallError("createMessage", payload, error);
  }
}

export async function elicitWebMcpInput(input: WebMcpElicitInput): Promise<unknown> {
  const modelContext = getModelContext();
  const elicitInput = modelContext?.elicitInput;
  if (!modelContext || !hasFunction(elicitInput)) {
    throw createMethodUnavailableError("elicitInput");
  }
  const validation = validateWebMcpElicitInput(input);
  warnSchemaValidationWarnings("elicitInput", validation);
  if (validation.errors.length > 0) {
    throw new WebMcpInputSchemaValidationError({
      toolName: "elicitInput",
      scope: "elicitInput",
      validation,
    });
  }
  const payload = input as Record<string, unknown>;
  try {
    return await elicitInput(payload);
  } catch (error) {
    throw createMethodCallError("elicitInput", payload, error);
  }
}
