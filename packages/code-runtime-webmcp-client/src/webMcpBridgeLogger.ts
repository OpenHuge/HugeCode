type LoggerMethod = (message: string, context?: unknown) => void;

function writeWarning(message: string, context?: unknown) {
  if (context === undefined) {
    // oxlint-disable-next-line no-console -- centralized package logger delegates to runtime console sink.
    console.warn(message);
    return;
  }

  // oxlint-disable-next-line no-console -- centralized package logger delegates to runtime console sink.
  console.warn(message, context);
}

export const logger: { warn: LoggerMethod } = {
  warn: (message, context) => {
    writeWarning(message, context);
  },
};
