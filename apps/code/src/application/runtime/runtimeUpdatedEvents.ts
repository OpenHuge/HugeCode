import { subscribeAppServerEvents } from "./ports/events";
import {
  createRuntimeUpdatedStore,
  parseRuntimeUpdatedEvent,
  runtimeUpdatedEventMatchesWorkspace,
} from "./stores/RuntimeUpdatedStore";

export type {
  RuntimeUpdatedEvent,
  RuntimeUpdatedEventSubscriptionOptions,
  RuntimeUpdatedStoreSnapshot,
} from "./stores/RuntimeUpdatedStore";

const runtimeUpdatedStore = createRuntimeUpdatedStore(subscribeAppServerEvents);

export const getRuntimeUpdatedSnapshot = runtimeUpdatedStore.getSnapshot;
export const subscribeRuntimeUpdatedSnapshot = runtimeUpdatedStore.subscribeSnapshot;

export const subscribeRuntimeUpdatedEvents = runtimeUpdatedStore.subscribeRuntimeUpdatedEvents;

export const subscribeScopedRuntimeUpdatedEvents =
  runtimeUpdatedStore.subscribeScopedRuntimeUpdatedEvents;

export { parseRuntimeUpdatedEvent, runtimeUpdatedEventMatchesWorkspace };
