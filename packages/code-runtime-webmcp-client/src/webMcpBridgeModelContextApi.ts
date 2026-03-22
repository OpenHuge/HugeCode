import {
  validateWebMcpCreateMessageInput,
  validateWebMcpElicitInput,
} from "@ku0/code-runtime-client/webMcpModelInputSchemas";
import { logger } from "./webMcpBridgeLogger";
import type {
  WebMcpCallToolInput,
  WebMcpCapabilityMatrix,
  WebMcpCatalog,
  WebMcpCreateMessageInput,
  WebMcpElicitInput,
  WebMcpModelContext,
} from "./webMcpBridgeTypes";

type WebMcpNavigator = Navigator & {
  modelContext?: WebMcpModelContext;
};

function hasFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

export function getModelContext(): WebMcpModelContext | null {
  const navigatorWithModelContext = (
    globalThis as typeof globalThis & {
      navigator?: WebMcpNavigator;
    }
  ).navigator;
  if (!navigatorWithModelContext) {
    return null;
  }
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

export function listWebMcpCatalog(): WebMcpCatalog {
  const modelContext = getModelContext();
  const capabilities = getWebMcpCapabilities();
  if (!modelContext) {
    throw createMethodUnavailableError("listTools/listResources/listPrompts");
  }

  const listTools = modelContext.listTools;
  const listResources = modelContext.listResources;
  const listPrompts = modelContext.listPrompts;
  if (!hasFunction(listTools) || !hasFunction(listResources) || !hasFunction(listPrompts)) {
    throw createMethodUnavailableError("listTools/listResources/listPrompts");
  }

  return {
    tools: [],
    resources: [],
    resourceTemplates: [],
    prompts: [],
    capabilities,
  };
}

export function loggerWarning(message: string, context?: Record<string, unknown>): void {
  logger.warn(message, context);
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
  validation: { extraFields: string[]; warnings: string[] }
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

export async function listWebMcpCatalogAsync(): Promise<WebMcpCatalog> {
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
  const validation = validateWebMcpCreateMessageInput(input);
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join("; "));
  }
  warnSchemaValidationWarnings("createMessage", validation);

  const modelContext = getModelContext();
  const createMessage = modelContext?.createMessage;
  if (!modelContext || !hasFunction(createMessage)) {
    throw createMethodUnavailableError("createMessage");
  }
  const payload = { ...input };
  try {
    return await createMessage(payload);
  } catch (error) {
    throw createMethodCallError("createMessage", payload, error);
  }
}

export async function elicitWebMcpInput(input: WebMcpElicitInput): Promise<unknown> {
  const validation = validateWebMcpElicitInput(input);
  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join("; "));
  }
  warnSchemaValidationWarnings("elicitInput", validation);

  const modelContext = getModelContext();
  const elicitInput = modelContext?.elicitInput;
  if (!modelContext || !hasFunction(elicitInput)) {
    throw createMethodUnavailableError("elicitInput");
  }
  const payload = { ...input };
  try {
    return await elicitInput(payload);
  } catch (error) {
    throw createMethodCallError("elicitInput", payload, error);
  }
}
