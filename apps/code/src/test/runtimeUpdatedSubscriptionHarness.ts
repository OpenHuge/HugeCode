import {
  runtimeUpdatedEventMatchesWorkspace,
  type RuntimeUpdatedEvent,
  type RuntimeUpdatedEventSubscriptionOptions,
} from "../services/runtimeUpdatedEvents";

type RuntimeUpdatedListener = (event: RuntimeUpdatedEvent) => void;

type Registration = {
  options: RuntimeUpdatedEventSubscriptionOptions;
  listener: RuntimeUpdatedListener;
};

function resolveWorkspaceId(
  workspaceId: RuntimeUpdatedEventSubscriptionOptions["workspaceId"]
): string | null {
  if (typeof workspaceId === "function") {
    return resolveWorkspaceId(workspaceId());
  }
  if (typeof workspaceId !== "string") {
    return null;
  }
  const trimmed = workspaceId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createRuntimeUpdatedSubscriptionHarness() {
  const registrations: Registration[] = [];

  return {
    subscribeScopedRuntimeUpdatedEvents(
      options: RuntimeUpdatedEventSubscriptionOptions,
      listener: RuntimeUpdatedListener
    ) {
      const registration = { options, listener };
      registrations.push(registration);
      return () => {
        const index = registrations.indexOf(registration);
        if (index >= 0) {
          registrations.splice(index, 1);
        }
      };
    },
    emitRuntimeUpdated(event: RuntimeUpdatedEvent) {
      for (const registration of registrations) {
        const workspaceId = resolveWorkspaceId(registration.options.workspaceId);
        if (workspaceId && !runtimeUpdatedEventMatchesWorkspace(event, workspaceId)) {
          continue;
        }
        const scopes = new Set(
          (registration.options.scopes ?? [])
            .map((scope) => scope.trim())
            .filter((scope) => scope.length > 0)
        );
        if (scopes.size > 0 && !event.scope.some((scope) => scopes.has(scope))) {
          continue;
        }
        registration.listener(event);
      }
    },
    reset() {
      registrations.splice(0, registrations.length);
    },
  };
}
