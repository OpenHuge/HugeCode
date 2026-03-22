import type { AppServerEvent } from "../types";
import {
  parseRuntimeUpdatedEvent,
  type RuntimeUpdatedEvent,
} from "../services/runtimeUpdatedEvents";
import { DEFAULT_RUNTIME_WORKSPACE_ID } from "../utils/runtimeWorkspaceIds";

type RuntimeUpdatedEventFixtureOptions = {
  eventWorkspaceId?: string;
  paramsWorkspaceId?: string | null;
  scope?: string[];
  reason?: string;
  revision?: string;
};

type NativeStateFabricUpdatedFixtureOptions = {
  eventWorkspaceId?: string;
  paramsWorkspaceId?: string | null;
  scopeKind?: string;
  changeKind?: string;
  revision?: number;
  reason?: string;
};

export function createRuntimeUpdatedAppServerEvent(
  options: RuntimeUpdatedEventFixtureOptions = {}
): AppServerEvent {
  const {
    eventWorkspaceId = DEFAULT_RUNTIME_WORKSPACE_ID,
    paramsWorkspaceId = null,
    scope = ["threads"],
    reason = "",
    revision = "fixture-revision",
  } = options;
  return {
    workspace_id: eventWorkspaceId,
    message: {
      method: "runtime/updated",
      params: {
        revision,
        scope,
        reason,
        ...(paramsWorkspaceId ? { workspaceId: paramsWorkspaceId } : {}),
      },
    },
  };
}

export function createRuntimeUpdatedEventFixture(
  options: RuntimeUpdatedEventFixtureOptions = {}
): RuntimeUpdatedEvent {
  const parsed = parseRuntimeUpdatedEvent(createRuntimeUpdatedAppServerEvent(options));
  if (!parsed) {
    throw new Error("Expected runtime/updated fixture to parse successfully.");
  }
  return parsed;
}

export function createNativeStateFabricUpdatedAppServerEvent(
  options: NativeStateFabricUpdatedFixtureOptions = {}
): AppServerEvent {
  const {
    eventWorkspaceId = DEFAULT_RUNTIME_WORKSPACE_ID,
    paramsWorkspaceId = null,
    scopeKind = "workspace",
    changeKind = "workspaceUpsert",
    revision = 1,
    reason,
  } = options;
  return {
    workspace_id: eventWorkspaceId,
    message: {
      method: "native_state_fabric_updated",
      params: {
        revision,
        scopeKind,
        changeKind,
        ...(reason ? { reason } : {}),
        ...(paramsWorkspaceId ? { workspaceId: paramsWorkspaceId } : {}),
      },
    },
  };
}
