import { getDesktopHostBridge } from "./desktopHostBridge";

type InvokePayload = Record<string, unknown> | undefined;

type DesktopHostInvokeFunction = <Result>(
  command: string,
  payload?: InvokePayload
) => Promise<Result | undefined> | Result | undefined;

async function invokeWithOptionalPayload<Result>(
  invokeFn: DesktopHostInvokeFunction,
  command: string,
  payload?: InvokePayload
): Promise<Result> {
  if (payload === undefined) {
    return (await invokeFn<Result>(command)) as Result;
  }
  return (await invokeFn<Result>(command, payload)) as Result;
}

export class DesktopCommandUnavailableError extends Error {
  constructor(command: string) {
    super(`Electron bridge command "${command}" is unavailable in the renderer.`);
    this.name = "DesktopCommandUnavailableError";
  }
}

export function isDesktopHostRuntime() {
  return typeof getDesktopHostBridge()?.core?.invoke === "function";
}

export async function invokeDesktopCommand<Result>(
  command: string,
  payload?: InvokePayload
): Promise<Result> {
  const invokeBridge = getDesktopHostBridge()?.core?.invoke;
  if (typeof invokeBridge === "function") {
    return await invokeWithOptionalPayload<Result>(invokeBridge, command, payload);
  }

  throw new DesktopCommandUnavailableError(command);
}

export const invoke = invokeDesktopCommand;
