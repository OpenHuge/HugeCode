import { getRuntimeClient } from "./runtimeClient";
import { recordLegacyLifecycleUsage } from "./runtimeLegacyLifecycleTelemetry";

type ThreadLiveTelemetryOptions = {
  telemetrySource?: string | null;
};

export async function subscribeThreadLive(
  workspaceId: string,
  threadId: string,
  options?: ThreadLiveTelemetryOptions
) {
  recordLegacyLifecycleUsage({
    method: "code_thread_live_subscribe",
    workspaceId,
    threadId,
    source: options?.telemetrySource ?? "thread_live_subscription",
  });
  const client = await getRuntimeClient();
  return client.threadLiveSubscribe(workspaceId, threadId);
}

export async function unsubscribeThreadLive(
  subscriptionId: string,
  options?: ThreadLiveTelemetryOptions
) {
  recordLegacyLifecycleUsage({
    method: "code_thread_live_unsubscribe",
    source: options?.telemetrySource ?? "thread_live_subscription",
  });
  const client = await getRuntimeClient();
  return client.threadLiveUnsubscribe(subscriptionId);
}
