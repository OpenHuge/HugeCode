import { getRuntimeClient } from "./runtimeClient";

export async function subscribeThreadLive(workspaceId: string, threadId: string) {
  const client = await getRuntimeClient();
  return client.threadLiveSubscribe(workspaceId, threadId);
}

export async function unsubscribeThreadLive(subscriptionId: string) {
  const client = await getRuntimeClient();
  return client.threadLiveUnsubscribe(subscriptionId);
}
