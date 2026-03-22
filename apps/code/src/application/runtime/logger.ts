type LoggerMethod = (message: string, context?: unknown) => void;

function writeConsole(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  context?: unknown
) {
  if (context === undefined) {
    // oxlint-disable-next-line no-console -- centralized logger delegates to runtime console sink.
    console[level](message);
    return;
  }
  // oxlint-disable-next-line no-console -- centralized logger delegates to runtime console sink.
  console[level](message, context);
}

export const logger: Record<"debug" | "info" | "warn" | "error", LoggerMethod> = {
  debug: (message, context) => {
    writeConsole("debug", message, context);
  },
  info: (message, context) => {
    writeConsole("info", message, context);
  },
  warn: (message, context) => {
    writeConsole("warn", message, context);
  },
  error: (message, context) => {
    writeConsole("error", message, context);
  },
};
