import * as dragDrop from "./dragDrop";
import * as events from "./events";
import * as logger from "./logger";
import * as retryScheduler from "./retryScheduler";
import * as runtimeClient from "./runtimeClient";
import * as runtimeClientMode from "./runtimeClientMode";
import * as runtimeEventChannelDiagnostics from "./runtimeEventChannelDiagnostics";
import * as runtimeEventStabilityMetrics from "./runtimeEventStabilityMetrics";
import * as runtimeEventStateMachine from "./runtimeEventStateMachine";
import * as toasts from "./toasts";
import * as webMcpBridge from "./webMcpBridge";

export type RuntimeInfrastructure = {
  dragDrop: typeof dragDrop;
  events: typeof events;
  logger: typeof logger;
  retryScheduler: typeof retryScheduler;
  runtimeClient: typeof runtimeClient;
  runtimeClientMode: typeof runtimeClientMode;
  runtimeEventChannelDiagnostics: typeof runtimeEventChannelDiagnostics;
  runtimeEventStabilityMetrics: typeof runtimeEventStabilityMetrics;
  runtimeEventStateMachine: typeof runtimeEventStateMachine;
  toasts: typeof toasts;
  webMcpBridge: typeof webMcpBridge;
};

export function createRuntimeInfrastructure(): RuntimeInfrastructure {
  return {
    dragDrop,
    events,
    logger,
    retryScheduler,
    runtimeClient,
    runtimeClientMode,
    runtimeEventChannelDiagnostics,
    runtimeEventStabilityMetrics,
    runtimeEventStateMachine,
    toasts,
    webMcpBridge,
  };
}

export const runtimeInfrastructure = createRuntimeInfrastructure();
